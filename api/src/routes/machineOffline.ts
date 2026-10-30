/**
 * Machine checks that keep working when the device has no connection
 *
 *   GET /v1/safety/offline-pack     what a phone or tablet keeps for offline scans
 *   POST /v1/sync {type:'machine_scan'}   a scan made offline, confirmed against the server
 *
 * The pack lists the institution's machines (by the code printed in their QR
 * sticker) and, for each person the device may check, the skills those
 * machines need and the safety passports they hold. A learner's pack holds
 * only themselves; a trainer's holds the learners of their cohorts, so the
 * trainer can scan a machine and see who may use it. The device decides from
 * the pack, shows the answer as "not yet confirmed", and queues the scan. On
 * reconnect the server decides again from its own records; when the two
 * disagree (offline said allowed, the server says not) a safety alert goes
 * to the trainer.
 *
 * Offline, "allowed" needs a safety passport that was already valid: the
 * pre-check quiz itself is graded only by the server, never on the device.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import type { Db, Tx } from '../lib/db.js';
import { forbidden, notFound } from '../lib/errors.js';
import * as repo from '../services/vlabRepository.js';

/** How long a downloaded pack may be used for offline decisions. */
export const PACK_TTL_H = 12;
const LEVEL_OK = ['novice', 'intermediate', 'autonomous', 'master'];

async function peopleFor(db: Db, p: Principal): Promise<string[]> {
  if (p.roles.includes('student') && !isStaff(p)) return [p.userId];
  if (!isStaff(p) && !p.roles.includes('director')) throw forbidden();
  // Trainers: the learners of their own cohorts. Other staff with no cohorts: every learner.
  const mine = await db.query<{ id: string }>(
    `SELECT DISTINCT s.user_id AS id FROM cohort_members me JOIN cohort_members s ON s.cohort_id = me.cohort_id AND s.member_role = 'student'
      WHERE me.user_id = $1 AND me.member_role <> 'student'`, [p.userId]);
  if (mine.rows.length) return mine.rows.map((r) => r.id);
  const all = await db.query<{ id: string }>(
    `SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student' WHERE u.institution_id = $1 AND u.is_active LIMIT 2000`, [p.institutionId]);
  return all.rows.map((r) => r.id);
}

export function machineOfflineRouter(deps: { db: Db }) {
  const router = Router();

  router.get('/v1/safety/offline-pack', async (req: Request, res) => {
    const p = req.principal!;
    const people = await peopleFor(deps.db, p);
    const [machines, persons, skills, passports] = await Promise.all([
      deps.db.query(
        `SELECT a.qr_code AS code, a.asset_tag AS tag, a.name, a.status::text, a.brand, a.model_no AS model, a.serial_no AS serial,
                w.name AS workshop, w.name_ar AS "workshopAr", c.code AS "centerCode", c.name AS center, w.trade_id AS "tradeId",
                mt.name AS "typeName", mt.name_ar AS "typeNameAr", mt.model_id AS "twinId",
                comp.id AS "competencyId", comp.code AS "competencyCode", (a.precheck_id IS NOT NULL) AS "hasPrecheck"
           FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id JOIN centers c ON c.id = w.center_id
           LEFT JOIN machine_types mt ON mt.id = a.machine_type_id LEFT JOIN competencies comp ON comp.id = a.required_competency_id
          WHERE w.institution_id = $1 AND a.category = 'machine' AND a.qr_code IS NOT NULL ORDER BY a.asset_tag`, [p.institutionId]),
      deps.db.query(`SELECT id, full_name AS name, full_name_ar AS "nameAr" FROM users WHERE id = ANY($1::uuid[]) ORDER BY full_name`, [people]),
      deps.db.query<{ learner_id: string; competency_id: string }>(
        `SELECT lc.learner_id, lc.competency_id FROM learner_competencies lc
          WHERE lc.learner_id = ANY($1::uuid[]) AND lc.level::text = ANY($2::text[])
            AND lc.competency_id IN (SELECT required_competency_id FROM workshop_assets WHERE required_competency_id IS NOT NULL)`, [people, LEVEL_OK]),
      deps.db.query<{ learner_id: string; tag: string; valid_until: Date }>(
        `SELECT sp.learner_id, a.asset_tag AS tag, max(sp.valid_until) AS valid_until FROM safety_passports sp JOIN workshop_assets a ON a.id = sp.asset_id
          WHERE sp.learner_id = ANY($1::uuid[]) AND sp.revoked_at IS NULL AND sp.valid_until > now() GROUP BY 1, 2`, [people]),
    ]);
    const generatedAt = new Date();
    res.json({
      version: 1, generatedAt, validUntil: new Date(generatedAt.getTime() + PACK_TTL_H * 3600_000), forUser: p.userId,
      machines: machines.rows,
      people: persons.rows.map((u) => ({
        ...u,
        competencies: skills.rows.filter((s) => s.learner_id === u.id).map((s) => s.competency_id),
        passports: passports.rows.filter((s) => s.learner_id === u.id).map((s) => ({ tag: s.tag, validUntil: s.valid_until })),
      })),
    });
  });

  return router;
}

export const MachineScan = z.object({
  clientMutationId: z.string().uuid(),
  code: z.string().trim().min(1).max(80),
  learnerId: z.string().uuid().optional(),
  scannedAt: z.coerce.date(),
  offlineAllowed: z.boolean(),
  packGeneratedAt: z.coerce.date().optional(),
});

/** Why the server would (not) have let this learner use this machine at `at`. Empty = allowed. */
export async function serverDecision(tx: Tx, assetId: string, learnerId: string, at: Date): Promise<string[]> {
  const { rows } = await tx.query<{ status: string; required_competency_id: string | null; precheck_id: string | null; level: string | null; passport: boolean }>(
    `SELECT a.status::text, a.required_competency_id, a.precheck_id, lc.level::text,
            EXISTS (SELECT 1 FROM safety_passports sp WHERE sp.asset_id = a.id AND sp.learner_id = $2
                      AND sp.issued_at <= $3 AND sp.valid_until > $3 AND (sp.revoked_at IS NULL OR sp.revoked_at > $3)) AS passport
       FROM workshop_assets a LEFT JOIN learner_competencies lc ON lc.learner_id = $2 AND lc.competency_id = a.required_competency_id
      WHERE a.id = $1`, [assetId, learnerId, at]);
  const a = rows[0]!;
  const why: string[] = [];
  if (['maintenance', 'locked_out', 'retired'].includes(a.status)) why.push(`machine_${a.status}`);
  if (a.required_competency_id && !LEVEL_OK.includes(a.level ?? '')) why.push('missing_competency');
  if (!a.precheck_id) why.push('no_precheck');
  else if (!a.passport) why.push('no_passport');
  return why;
}

export async function recordOfflineScan(tx: Tx, p: Principal, b: z.infer<typeof MachineScan>) {
  const learnerId = b.learnerId ?? p.userId;
  if (learnerId !== p.userId && !isStaff(p)) throw forbidden('Only staff record scans for someone else');
  const { rows } = await tx.query<{ id: string; asset_tag: string }>(
    `SELECT a.id, a.asset_tag FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
      WHERE w.institution_id = $2 AND (a.qr_code = $1 OR ($3 AND a.asset_tag = $1))`, [b.code, p.institutionId, isStaff(p)]);
  const a = rows[0];
  if (!a) throw notFound('Machine');
  const learner = await tx.query(`SELECT 1 FROM users WHERE id = $1 AND institution_id = $2`, [learnerId, p.institutionId]);
  if (!learner.rows[0]) throw notFound('Learner');
  // A scan cannot be dated in the future, nor earlier than a day before it reaches the server.
  const at = new Date(Math.min(Date.now(), Math.max(b.scannedAt.getTime(), Date.now() - 86400_000)));
  const why = await serverDecision(tx, a.id, learnerId, at);
  const ins = await tx.query<{ confirmed: boolean }>(
    `INSERT INTO offline_machine_scans (client_mutation_id, asset_id, learner_id, scanned_by, scanned_at, pack_generated_at, offline_allowed, server_allowed, server_reasons)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (client_mutation_id) DO NOTHING RETURNING confirmed`,
    [b.clientMutationId, a.id, learnerId, p.userId, at, b.packGeneratedAt ?? null, b.offlineAllowed, why.length === 0, why]);
  if (!ins.rows[0]) {
    const old = await tx.query<{ confirmed: boolean; server_reasons: string[] }>(`SELECT confirmed, server_reasons FROM offline_machine_scans WHERE client_mutation_id = $1`, [b.clientMutationId]);
    return { replayed: true, confirmed: old.rows[0]!.confirmed, reasons: old.rows[0]!.server_reasons };
  }
  if (b.offlineAllowed && why.length) {
    await repo.insertAlerts(tx, [{ institutionId: p.institutionId, learnerId, source: 'rfid', criterionKey: 'offline_scan',
      detail: `Offline scan at ${a.asset_tag} showed "allowed", but the server says not (${why.join(', ')}). Check who used the machine.` }]);
  }
  await tx.query(
    `INSERT INTO asset_checkouts (asset_id, user_id, approved_by, checked_out_at, returned_at, access_granted, denial_reason, condition_out, client_mutation_id)
     VALUES ($1, $2, $3, $4, $4, $5, $6, 'offline scan, confirmed on sync', $7) ON CONFLICT (client_mutation_id) DO NOTHING`,
    [a.id, learnerId, learnerId === p.userId ? null : p.userId, at, why.length === 0, why.length ? why.join(', ') : null, b.clientMutationId]);
  return { replayed: false, confirmed: ins.rows[0].confirmed, reasons: why };
}
