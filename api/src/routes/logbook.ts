/**
 * Digital apprentice logbook
 *
 *   POST /v1/wbl/logbook                 apprentice submits an entry (photos/videos uploaded first)
 *   GET  /v1/wbl/logbook                 own entries (apprentice) or the supervisor's queue
 *   POST /v1/wbl/logbook/:id/signoff     industry supervisor approves / rejects / asks for revision
 *
 * Every sign-off is its own immutable row with a SHA-256 over the entry as
 * the supervisor saw it (hours, summary, media hashes), so a later edit to
 * the entry no longer matches the signature.
 */
import { createHash } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';

export const Entry = z.object({
  clientMutationId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().gt(0).max(16),
  summary: z.string().trim().min(15).max(4000),
  competencyIds: z.array(z.string().uuid()).max(12).default([]),
  media: z.array(z.string().uuid()).max(12).default([]),
  attendanceId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export type EntryBody = z.infer<typeof Entry>;

export async function recordEntry(tx: Tx, p: Principal, b: EntryBody) {
  const replay = await tx.query(`SELECT id FROM wbl_logbook_entries WHERE client_mutation_id = $1`, [b.clientMutationId]);
  if (replay.rows[0]) return { replayed: true, id: replay.rows[0].id as string };
  if (new Date(b.workDate) > new Date()) throw new HttpError(422, 'future_date', 'The work date is in the future');
  const pl = (await tx.query<{ id: string }>(
    `SELECT id FROM wbl_placements WHERE learner_id = $1 AND $2::date BETWEEN starts_on AND ends_on ORDER BY starts_on DESC LIMIT 1`,
    [p.userId, b.workDate])).rows[0];
  if (!pl) throw notFound('Placement for that date');
  const media = b.media.length ? (await tx.query<{ id: string; kind: string; mime: string; sha256: string; captured_at: Date; bytes: number }>(
    `SELECT id, kind, mime, sha256, captured_at, bytes FROM media_objects WHERE id = ANY($1::uuid[]) AND owner_id = $2`, [b.media, p.userId])).rows : [];
  if (media.length !== b.media.length) throw new HttpError(422, 'unknown_media', 'Some photos or videos were not uploaded');
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO wbl_logbook_entries (placement_id, work_date, hours, task_summary, competency_ids, media, status, submitted_at,
                                      client_mutation_id, attendance_id, submitted_lat, submitted_lon)
     VALUES ($1, $2, $3, $4, $5, $6, 'submitted', now(), $7, $8, $9, $10) RETURNING id`,
    [pl.id, b.workDate, b.hours, b.summary, b.competencyIds,
      JSON.stringify(media.map((m) => ({ mediaId: m.id, type: m.kind, mime: m.mime, sha256: m.sha256, captured_at: m.captured_at, bytes: m.bytes }))),
      b.clientMutationId, b.attendanceId ?? null, b.latitude ?? null, b.longitude ?? null]);
  return { replayed: false, id: rows[0]!.id };
}

const Signoff = z.object({
  decision: z.enum(['approved', 'rejected', 'revision_requested']),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(1000).optional(),
  signatureMediaId: z.string().uuid().optional(),
}).refine((s) => s.decision === 'approved' || (s.comment?.length ?? 0) >= 5, 'Say what needs to change');

export function logbookRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();

  router.post('/v1/wbl/logbook', async (req: Request, res) => {
    const p = req.principal!;
    if (!p.roles.includes('student')) throw forbidden('Only apprentices write logbook entries');
    const out = await withTx(deps.db, (tx) => recordEntry(tx, p, Entry.parse(req.body)));
    res.status(out.replayed ? 200 : 201).json(out);
  });

  router.get('/v1/wbl/logbook', async (req: Request, res) => {
    const p = req.principal!;
    const supervisor = p.roles.includes('industry_supervisor');
    const { rows } = await deps.db.query(
      `SELECT e.id, e.work_date AS "workDate", e.hours::float, e.task_summary AS summary, e.status::text, e.media, e.submitted_at AS "submittedAt",
              u.full_name AS learner, u.full_name_ar AS "learnerAr",
              (SELECT jsonb_build_object('decision', s.decision, 'comment', s.comment, 'signedAt', s.signed_at, 'hash', s.signature_hash)
                 FROM wbl_signoffs s WHERE s.entry_id = e.id ORDER BY s.signed_at DESC LIMIT 1) AS signoff
         FROM wbl_logbook_entries e JOIN wbl_placements pl ON pl.id = e.placement_id JOIN users u ON u.id = pl.learner_id
        WHERE u.institution_id = $1 AND (CASE WHEN $3 THEN pl.supervisor_id = $2 ELSE pl.learner_id = $2 END)
        ORDER BY e.work_date DESC, e.created_at DESC LIMIT 100`, [p.institutionId, p.userId, supervisor]);
    res.json({ entries: rows });
  });

  router.post('/v1/wbl/logbook/:id/signoff', async (req: Request, res) => {
    const p = req.principal!;
    if (!p.roles.includes('industry_supervisor')) throw forbidden('Only the site supervisor signs off');
    const id = z.string().uuid().parse(req.params['id']);
    const b = Signoff.parse(req.body);
    const out = await withTx(deps.db, async (tx) => {
      const { rows } = await tx.query<{ status: string; hours: number; task_summary: string; work_date: string; media: { sha256: string }[]; learner_id: string; competency_ids: string[] }>(
        `SELECT e.status::text, e.hours::float, e.task_summary, e.work_date::text, e.media, pl.learner_id, e.competency_ids
           FROM wbl_logbook_entries e JOIN wbl_placements pl ON pl.id = e.placement_id
          WHERE e.id = $1 AND pl.supervisor_id = $2 FOR UPDATE OF e`, [id, p.userId]);
      const e = rows[0];
      if (!e) throw notFound('Logbook entry');
      if (e.status !== 'submitted') throw conflict('not_pending', 'This entry is not waiting for a sign-off');
      const payload = JSON.stringify({ id, workDate: e.work_date, hours: e.hours, summary: e.task_summary, media: e.media.map((m) => m.sha256), decision: b.decision });
      const hash = createHash('sha256').update(`${payload}|${p.userId}`).digest('hex');
      await tx.query(
        `INSERT INTO wbl_signoffs (entry_id, supervisor_id, decision, rating, comment, signature_hash, signature_media_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, p.userId, b.decision, b.rating ?? null, b.comment ?? null, hash, b.signatureMediaId ?? null]);
      if (b.decision === 'approved') {
        for (const c of e.competency_ids) {
          await tx.query(
            `INSERT INTO competency_evidence (learner_id, competency_id, source_type, source_id, score, assessor_id) VALUES ($1, $2, 'wbl_logbook', $3, $4, $5)`,
            [e.learner_id, c, id, (b.rating ?? 4) * 20, p.userId]);
        }
      }
      return { id, decision: b.decision, signatureHash: hash };
    });
    res.json(out);
  });

  return router;
}
