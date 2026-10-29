/**
 * Workshop floor observations (trainer tablet)
 *
 *   POST /v1/workshop/observations
 *
 * The trainer's one-tap scoring is turned into `observed` / `measured`
 * events and graded by the same rubric engine as a V-Lab attempt, so
 * physical and virtual evidence land on the competency matrix the same way.
 * Replays from the offline outbox are idempotent on clientMutationId.
 *
 * Photos are uploaded first (POST /v1/media) and referenced here by id,
 * optionally against the criterion they show. A signed-off observation also
 * issues the job card's materials from stores (trigger on workshop_observations),
 * and the response says what was issued and what is running low.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { forbidden, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';
import { evaluate, levelForScore, type TelemetryEvent } from '../services/rubricEngine.js';
import * as repo from '../services/vlabRepository.js';

const Observation = z.object({
  clientMutationId: z.string().uuid(),
  learnerId: z.string().uuid(),
  rubricCode: z.string().min(1),
  assetTag: z.string().optional(),
  taskRef: z.string().max(40).optional(),
  checks: z.record(z.boolean()).default({}),
  ratings: z.record(z.number().min(0).max(4)).default({}),
  measurements: z.record(z.number()).default({}),
  note: z.string().max(1000).optional(),
  media: z.array(z.object({ mediaId: z.string().uuid(), criterionKey: z.string().max(40).optional() })).max(12).default([]),
});
export type ObservationBody = z.infer<typeof Observation>;
export { Observation };

/** Scores and stores one floor observation; also used by the offline sync endpoint. */
export async function recordObservation(tx: Tx, p: Principal, body: ObservationBody) {
  const replay = await tx.query<{ id: string }>(
    `SELECT id FROM workshop_observations WHERE client_mutation_id = $1`, [body.clientMutationId]);
  if (replay.rows[0]) {
    const { rows } = await tx.query(
      `SELECT total_score::float AS "totalScore", passed, gate_failures AS "gateFailures", criterion_scores AS criteria
         FROM rubric_evaluations WHERE subject_type = 'workshop_observation' AND subject_id = $1`, [replay.rows[0].id]);
    return { replayed: true, observationId: replay.rows[0].id, ...rows[0] };
  }

  const learner = await tx.query(`SELECT 1 FROM users WHERE id = $1 AND institution_id = $2`, [body.learnerId, p.institutionId]);
  if (!learner.rows[0]) throw notFound('Learner');
  const rubricRow = await tx.query<{ id: string }>(
    `SELECT id FROM rubrics WHERE code = $1 ORDER BY version DESC LIMIT 1`, [body.rubricCode]);
  if (!rubricRow.rows[0]) throw notFound('Rubric');
  const rubricId = rubricRow.rows[0].id;
  const asset = body.assetTag
    ? (await tx.query<{ id: string }>(`SELECT id FROM workshop_assets WHERE asset_tag = $1`, [body.assetTag])).rows[0]
    : undefined;

  // Only the uploader's own media, from this institution, can be attached.
  const media = body.media.length
    ? (await tx.query<{ id: string; sha256: string }>(
      `SELECT id, sha256 FROM media_objects WHERE id = ANY($1::uuid[]) AND owner_id = $2`, [body.media.map((m) => m.mediaId), p.userId])).rows
      .map((r) => ({ ...body.media.find((m) => m.mediaId === r.id)!, sha256: r.sha256 }))
    : [];

  const now = new Date();
  let seq = 0;
  const events: TelemetryEvent[] = [
    ...Object.entries(body.checks).map(([k, ok]) => ({ seq: ++seq, occurredAt: now, verb: 'observed', objectRef: k, value: { ok } })),
    ...Object.entries(body.ratings).map(([k, rating]) => ({ seq: ++seq, occurredAt: now, verb: 'observed', objectRef: k, value: { rating } })),
    ...Object.entries(body.measurements).map(([k, reading]) => ({ seq: ++seq, occurredAt: now, verb: 'measured', objectRef: k, value: { reading } })),
  ];
  const rubric = await repo.loadRubric(tx, rubricId);
  const result = evaluate(rubric, events, { startedAt: now, submittedAt: now, faults: [] });

  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO workshop_observations (learner_id, trainer_id, asset_id, rubric_id, task_ref, measurements, evidence_media, client_mutation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [body.learnerId, p.userId, asset?.id ?? null, rubricId, body.taskRef ?? null,
      { ...body.measurements, checks: body.checks, ratings: body.ratings, note: body.note ?? null }, JSON.stringify(media), body.clientMutationId]);
  const observationId = rows[0]!.id;
  for (const m of media) {
    await tx.query(`INSERT INTO observation_media (observation_id, media_id, criterion_key) VALUES ($1, $2, $3)`, [observationId, m.mediaId, m.criterionKey ?? null]);
  }
  // Materials issued by the trigger, with the stock left after this task.
  const issued = await tx.query<{ sku: string; name: string; unit: string; qty: number; shortfall: number; onHand: number; status: string }>(
    `SELECT f.sku, f.name, f.unit, -m.delta::float AS qty, m.shortfall::float, f.on_hand AS "onHand", f.status
       FROM consumable_movements m JOIN v_consumable_forecast f ON f.consumable_id = m.consumable_id
      WHERE m.observation_id = $1 ORDER BY f.sku`, [observationId]);
  await repo.saveEvaluation(tx, { type: 'workshop_observation', id: observationId, learnerId: body.learnerId, rubricId },
    result, levelForScore, p.userId);
  if (result.gateFailures.length > 0) {
    await repo.insertAlerts(tx, result.gateFailures.map((k) => ({
      institutionId: p.institutionId, learnerId: body.learnerId, source: 'observation' as const,
      criterionKey: k, detail: `${rubric.criteria.find((c) => c.key === k)?.label ?? k} not met${body.taskRef ? ` on ${body.taskRef}` : ''}`,
    })));
  }
  return {
    replayed: false, observationId, totalScore: result.totalScore, passed: result.passed, gateFailures: result.gateFailures,
    criteria: Object.fromEntries(result.criteria.map((c) => [c.key, { score: c.score, gateFailed: c.gateFailed, detail: c.detail }])),
    media: media.length, issued: issued.rows, lowStock: issued.rows.filter((i) => i.status !== 'ok'),
  };
}

export function observationsRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();

  router.post('/v1/workshop/observations', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p)) throw forbidden('Only trainers record observations');
    const body = Observation.parse(req.body);

    const out = await withTx(deps.db, (tx) => recordObservation(tx, p, body));

    if (!out.replayed) {
      await deps.realtime.publish(`vlab:alerts:${p.institutionId}`, { type: 'observation_scored', observationId: out.observationId });
    }
    res.status(out.replayed ? 200 : 201).json(out);
  });

  return router;
}
