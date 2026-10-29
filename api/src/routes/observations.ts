/**
 * Workshop floor observations (trainer tablet)
 *
 *   POST /v1/workshop/observations
 *
 * The trainer's one-tap scoring is turned into `observed` / `measured`
 * events and graded by the same rubric engine as a V-Lab attempt, so
 * physical and virtual evidence land on the competency matrix the same way.
 * Replays from the offline outbox are idempotent on clientMutationId.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff } from '../lib/auth.js';
import { withTx, type Db } from '../lib/db.js';
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
});

export function observationsRouter(deps: { db: Db; realtime: Realtime }) {
  const router = Router();

  router.post('/v1/workshop/observations', async (req: Request, res) => {
    const p = req.principal!;
    if (!isStaff(p)) throw forbidden('Only trainers record observations');
    const body = Observation.parse(req.body);

    const out = await withTx(deps.db, async (tx) => {
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
          { ...body.measurements, checks: body.checks, ratings: body.ratings, note: body.note ?? null }, '[]', body.clientMutationId]);
      const observationId = rows[0]!.id;
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
      };
    });

    if (!out.replayed) {
      await deps.realtime.publish(`vlab:alerts:${p.institutionId}`, { type: 'observation_scored', observationId: out.observationId });
    }
    res.status(out.replayed ? 200 : 201).json(out);
  });

  return router;
}
