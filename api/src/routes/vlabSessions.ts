/**
 * V-Lab fault-test endpoints
 *
 *   POST /v1/vlab/sessions/:sessionId/telemetry   batched, idempotent ingestion
 *                                                 + live safety guardrails
 *   POST /v1/vlab/sessions/:sessionId/evaluate    submit & score against rubric
 */
import { Router, type Request } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import { withTx, type Db } from '../lib/db.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';
import { detectGateViolations, evaluate, levelForScore, type TelemetryEvent } from '../services/rubricEngine.js';
import * as repo from '../services/vlabRepository.js';

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const TIME_LIMIT_GRACE_MS = 30_000;

const TelemetryBatch = z.object({
  events: z
    .array(
      z.object({
        seq: z.number().int().positive(),
        occurredAt: z.string().datetime({ offset: true }),
        // Compact xAPI verb id; the LRS forwarder expands it to a full IRI.
        verb: z.string().regex(/^[a-z][a-z_]{1,39}$/),
        objectRef: z.string().max(120).optional(),
        value: z.record(z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(500)
    .refine((ev) => new Set(ev.map((e) => e.seq)).size === ev.length, 'duplicate seq within batch'),
});

const SessionParams = z.object({ sessionId: z.string().uuid() });

function assertCanAct(p: Principal, session: repo.SessionRow) {
  if (p.institutionId !== session.institution_id) throw notFound('Session'); // don't leak existence cross-tenant
  if (p.userId !== session.learner_id && !isStaff(p)) throw forbidden();
}

export function vlabSessionsRouter(deps: { db: Db; realtime: Realtime; log: Logger }) {
  const { db, realtime, log } = deps;
  const router = Router();

  // -------------------------------------------------------------------------
  // Telemetry ingestion
  // -------------------------------------------------------------------------
  router.post('/v1/vlab/sessions/:sessionId/telemetry', async (req: Request, res) => {
    const { sessionId } = SessionParams.parse(req.params);
    const batch = TelemetryBatch.parse(req.body);
    const principal = req.principal!;
    const now = Date.now();

    const outcome = await withTx(db, async (tx) => {
      const session = await repo.lockSession(tx, sessionId);
      if (!session) throw notFound('Session');
      assertCanAct(principal, session);
      // Only the learner's own client streams telemetry; staff observe via Redis.
      if (principal.userId !== session.learner_id) throw forbidden('Only the session learner can stream telemetry');
      if (session.status !== 'in_progress') throw conflict('session_closed', `Session is ${session.status}`);

      const deadline =
        session.mode === 'assessment' && session.time_limit_s
          ? session.started_at.getTime() + session.time_limit_s * 1000 + TIME_LIMIT_GRACE_MS
          : Infinity;

      const rejected: { seq: number; reason: string }[] = [];
      const candidates: TelemetryEvent[] = [];
      for (const e of batch.events) {
        const t = new Date(e.occurredAt);
        if (t.getTime() > now + MAX_CLOCK_SKEW_MS) rejected.push({ seq: e.seq, reason: 'occurred_in_future' });
        else if (t.getTime() < session.started_at.getTime() - MAX_CLOCK_SKEW_MS) rejected.push({ seq: e.seq, reason: 'before_session_start' });
        else if (t.getTime() > deadline) rejected.push({ seq: e.seq, reason: 'after_time_limit' });
        else candidates.push({ seq: e.seq, occurredAt: t, verb: e.verb, objectRef: e.objectRef ?? null, value: e.value });
      }

      // Retries from flaky workshop Wi-Fi resend the same seqs: accept once, ack always.
      const seen = await repo.existingSeqs(tx, sessionId, candidates.map((c) => c.seq));
      const fresh = candidates.filter((c) => !seen.has(c.seq));
      await repo.insertTelemetry(tx, sessionId, fresh);

      let alerts: ReturnType<typeof detectGateViolations> = [];
      if (session.rubric_id && fresh.length > 0) {
        // One pg client per transaction ⇒ queries run sequentially.
        // (At scale, keep the gate-relevant verbs in a Redis hash instead of re-reading.)
        const rubric = await repo.loadRubric(tx, session.rubric_id);
        const prior = await repo.loadTelemetry(tx, sessionId);
        const faults = await repo.loadFaults(tx, session.injected_fault_ids);
        const freshSeqs = new Set(fresh.map((f) => f.seq));
        alerts = detectGateViolations(rubric, prior.filter((p) => !freshSeqs.has(p.seq)), fresh, {
          startedAt: session.started_at,
          faults,
        });
      }

      const lastSeq = Math.max(Number(session.last_seq), ...fresh.map((f) => f.seq));
      return { session, fresh, duplicates: seen.size, rejected, alerts, lastSeq };
    });

    // Fan-out happens after commit so dashboards never show uncommitted data.
    await realtime.appendTelemetry(sessionId, outcome.fresh);
    if (outcome.alerts.length > 0) {
      log.warn({ sessionId, alerts: outcome.alerts }, 'safety gate violation');
      await realtime.publish(`vlab:alerts:${outcome.session.institution_id}`, {
        type: 'safety_gate_violation',
        sessionId,
        learnerId: outcome.session.learner_id,
        alerts: outcome.alerts,
      });
    }

    res.status(202).json({
      accepted: outcome.fresh.length,
      duplicates: outcome.duplicates,
      rejected: outcome.rejected,
      lastSeq: outcome.lastSeq,
      alerts: outcome.alerts,
      // Guided mode is a teaching mode: the client must block the unsafe action
      // and replay the safety micro-lesson. Assessment mode records silently.
      guardrail: outcome.session.mode === 'guided' && outcome.alerts.length > 0 ? 'block' : null,
    });
  });

  // -------------------------------------------------------------------------
  // Rubric evaluation
  // -------------------------------------------------------------------------
  router.post('/v1/vlab/sessions/:sessionId/evaluate', async (req: Request, res) => {
    const { sessionId } = SessionParams.parse(req.params);
    const principal = req.principal!;

    const result = await withTx(db, async (tx) => {
      const session = await repo.lockSession(tx, sessionId);
      if (!session) throw notFound('Session');
      assertCanAct(principal, session);
      if (!session.rubric_id) throw new HttpError(422, 'no_rubric', 'Session has no rubric attached');

      // Idempotent: a second submit returns the stored result.
      if (session.status === 'evaluated') {
        return { cached: true as const, session, stored: await repo.loadEvaluation(tx, sessionId) };
      }
      if (session.status !== 'in_progress' && session.status !== 'submitted') {
        throw conflict('session_closed', `Session is ${session.status}`);
      }

      const rubric = await repo.loadRubric(tx, session.rubric_id);
      const events = await repo.loadTelemetry(tx, sessionId);
      const faults = await repo.loadFaults(tx, session.injected_fault_ids);
      const submittedAt = session.submitted_at ?? new Date();
      const evaluation = evaluate(rubric, events, { startedAt: session.started_at, submittedAt, faults });

      const evaluatorId = principal.userId === session.learner_id ? null : principal.userId;
      await repo.saveEvaluation(tx, session, submittedAt, evaluation, levelForScore, evaluatorId);
      return { cached: false as const, session, evaluation, eventCount: events.length };
    });

    if (result.cached) {
      const s = result.stored;
      res.status(200).json({
        sessionId,
        cached: true,
        totalScore: s?.total_score ?? null,
        passed: s?.passed ?? null,
        gateFailures: s?.gate_failures ?? [],
        criteria: s?.criterion_scores ?? {},
        evaluatedAt: s?.evaluated_at ?? null,
      });
      return;
    }
    await realtime.publish(`vlab:alerts:${result.session.institution_id}`, {
      type: 'session_evaluated',
      sessionId,
      learnerId: result.session.learner_id,
      totalScore: result.evaluation.totalScore,
      passed: result.evaluation.passed,
    });
    res.status(200).json({ sessionId, cached: false, eventCount: result.eventCount, ...result.evaluation });
  });

  return router;
}
