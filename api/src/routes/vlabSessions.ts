/**
 * V-Lab fault-test endpoints
 *
 *   POST /v1/vlab/sessions                        start a practice or assessment session
 *   GET  /v1/vlab/sessions/:sessionId             session state (rig, events, result)
 *   POST /v1/vlab/sessions/:sessionId/telemetry   batched, idempotent ingestion
 *                                                 + live safety guardrails
 *   POST /v1/vlab/sessions/:sessionId/probe       multimeter reading at a test point
 *                                                 (computed server-side; recorded as telemetry)
 *   POST /v1/vlab/sessions/:sessionId/evaluate    submit & score against rubric
 */
import { Router, type Request } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import type { Realtime } from '../lib/redis.js';
import { INSIDE_PANEL, TEST_POINTS, motorRuns, readMeter, type RigState } from '../services/dolSimulator.js';
import { detectGateViolations, evaluate, levelForScore, type GuardrailAlert, type TelemetryEvent } from '../services/rubricEngine.js';
import * as repo from '../services/vlabRepository.js';

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const TIME_LIMIT_GRACE_MS = 30_000;
const DEFAULT_EXAM_LIMIT_S = 1800;

const EventIn = z.object({
  seq: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  // Compact xAPI verb id; the LRS forwarder expands it to a full IRI.
  verb: z.string().regex(/^[a-z][a-z_]{1,39}$/),
  objectRef: z.string().max(120).optional(),
  value: z.record(z.unknown()).default({}),
});

const TelemetryBatch = z.object({
  events: z
    .array(EventIn)
    .min(1)
    .max(500)
    .refine((ev) => new Set(ev.map((e) => e.seq)).size === ev.length, 'duplicate seq within batch'),
});

const ProbeBody = z.object({
  seq: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  testPoint: z.enum(TEST_POINTS),
});

const CreateSession = z.object({
  labCode: z.string().min(1),
  mode: z.enum(['guided', 'sandbox', 'assessment']),
  learnerId: z.string().uuid().optional(),
  faultCode: z.string().optional(),
  timeLimitS: z.number().int().min(60).max(4 * 3600).optional(),
});

const SessionParams = z.object({ sessionId: z.string().uuid() });

function assertCanAct(p: Principal, session: repo.SessionRow) {
  if (p.institutionId !== session.institution_id) throw notFound('Session'); // don't leak existence cross-tenant
  if (p.userId !== session.learner_id && !isStaff(p)) throw forbidden();
}

/** Rig state is derived from the recorded stream, never trusted from the client. */
export function rigFrom(events: TelemetryEvent[]): RigState & { ppe: boolean } {
  const rig = { ppe: false, locked: false, panelOpen: false, replaced: [] as string[] };
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (e.verb === 'ppe_donned') rig.ppe = true;
    else if (e.verb === 'loto_applied') rig.locked = true;
    else if (e.verb === 'loto_removed') rig.locked = false;
    else if (e.verb === 'panel_opened') rig.panelOpen = true;
    else if (e.verb === 'panel_closed') rig.panelOpen = false;
    else if (e.verb === 'component_replaced' && e.objectRef && !rig.replaced.includes(e.objectRef)) rig.replaced.push(e.objectRef);
  }
  return rig;
}

export function vlabSessionsRouter(deps: { db: Db; realtime: Realtime; log: Logger }) {
  const { db, realtime, log } = deps;
  const router = Router();

  // -------------------------------------------------------------------------
  // Start a session
  // -------------------------------------------------------------------------
  router.post('/v1/vlab/sessions', async (req: Request, res) => {
    const body = CreateSession.parse(req.body);
    const p = req.principal!;
    const staff = isStaff(p);
    const learnerId = body.learnerId ?? p.userId;
    if (!staff && learnerId !== p.userId) throw forbidden('Learners can only start their own sessions');
    if (!staff && body.mode === 'assessment') throw forbidden('Assessments are started by a trainer');
    if (!staff && body.faultCode) throw forbidden('Learners cannot choose the fault');

    const created = await withTx(db, async (tx) => {
      const learner = await tx.query<{ id: string }>(
        `SELECT u.id FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'student'
          WHERE u.id = $1 AND u.institution_id = $2`, [learnerId, p.institutionId]);
      if (!learner.rows[0]) throw notFound('Learner');
      const lab = await tx.query<{ id: string; default_rubric_id: string | null; supported_modes: string }>(
        `SELECT id, default_rubric_id, supported_modes::text FROM virtual_labs WHERE code = $1`, [body.labCode]);
      if (!lab.rows[0]) throw notFound('Lab');
      if (!lab.rows[0].supported_modes.includes(body.mode)) throw new HttpError(422, 'mode_unsupported', `Lab does not support ${body.mode}`);
      const fault = await tx.query<{ id: string }>(
        body.faultCode
          ? `SELECT id FROM lab_faults WHERE lab_id = $1 AND code = $2`
          : `SELECT id FROM lab_faults WHERE lab_id = $1 ORDER BY random() LIMIT 1`,
        body.faultCode ? [lab.rows[0].id, body.faultCode] : [lab.rows[0].id]);
      if (body.faultCode && !fault.rows[0]) throw notFound('Fault');
      // One open attempt per learner per lab: starting again abandons the previous one.
      await tx.query(
        `UPDATE virtual_lab_sessions SET status = 'aborted' WHERE learner_id = $1 AND lab_id = $2 AND status = 'in_progress'`,
        [learnerId, lab.rows[0].id]);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO virtual_lab_sessions (lab_id, learner_id, mode, rubric_id, injected_fault_ids, injected_by, device, time_limit_s)
         VALUES ($1, $2, $3, $4, $5, $6, 'browser', $7) RETURNING id`,
        [lab.rows[0].id, learnerId, body.mode, lab.rows[0].default_rubric_id, fault.rows.map((f) => f.id),
          staff ? p.userId : null, body.mode === 'assessment' ? (body.timeLimitS ?? DEFAULT_EXAM_LIMIT_S) : (body.timeLimitS ?? null)]);
      return rows[0]!.id;
    });
    res.status(201).json({ sessionId: created });
  });

  // -------------------------------------------------------------------------
  // Session state
  // -------------------------------------------------------------------------
  router.get('/v1/vlab/sessions/:sessionId', async (req: Request, res) => {
    const { sessionId } = SessionParams.parse(req.params);
    const p = req.principal!;
    const out = await withTx(db, async (tx) => {
      const session = await repo.lockSession(tx, sessionId);
      if (!session) throw notFound('Session');
      assertCanAct(p, session);
      const meta = await tx.query(
        `SELECT l.code AS lab_code, l.title AS lab_title, l.title_ar AS lab_title_ar,
                u.full_name, u.full_name_ar, s.final_score::float AS final_score, s.passed
           FROM virtual_lab_sessions s JOIN virtual_labs l ON l.id = s.lab_id JOIN users u ON u.id = s.learner_id
          WHERE s.id = $1`, [sessionId]);
      const events = await repo.loadTelemetry(tx, sessionId);
      const evaluation = session.status === 'evaluated' ? await repo.loadEvaluation(tx, sessionId) : null;
      // The injected fault stays hidden from the learner until the attempt is scored.
      const revealFaults = isStaff(p) || session.status === 'evaluated';
      const faults = revealFaults ? await repo.loadFaults(tx, session.injected_fault_ids) : [];
      const criteria = session.rubric_id
        ? (await repo.loadRubric(tx, session.rubric_id)).criteria.map((c) => ({ key: c.key, label: c.label, weight: c.weight, isGate: c.isGate }))
        : [];
      return { session, meta: meta.rows[0], events, evaluation, faults, criteria };
    });
    const rig = rigFrom(out.events);
    res.json({
      id: out.session.id,
      status: out.session.status,
      mode: out.session.mode,
      startedAt: out.session.started_at,
      timeLimitS: out.session.time_limit_s,
      lab: { code: out.meta.lab_code, title: out.meta.lab_title, titleAr: out.meta.lab_title_ar },
      learner: { id: out.session.learner_id, name: out.meta.full_name, nameAr: out.meta.full_name_ar },
      rig,
      events: out.events,
      criteria: out.criteria,
      faults: out.faults.map((f) => ({ code: f.code, componentRef: f.componentRef })),
      evaluation: out.evaluation && {
        totalScore: out.evaluation.total_score,
        passed: out.evaluation.passed,
        gateFailures: out.evaluation.gate_failures,
        criteria: out.evaluation.criterion_scores,
        evaluatedAt: out.evaluation.evaluated_at,
      },
    });
  });

  // -------------------------------------------------------------------------
  // Ingestion shared by /telemetry and /probe
  // -------------------------------------------------------------------------
  type Incoming = z.infer<typeof EventIn>;

  async function ingest(tx: Tx, p: Principal, sessionId: string, batch: Incoming[], now: number,
    resolve?: (session: repo.SessionRow, prior: TelemetryEvent[], faultComponents: string[]) => Incoming[]) {
    const session = await repo.lockSession(tx, sessionId);
    if (!session) throw notFound('Session');
    assertCanAct(p, session);
    // Only the learner's own client streams telemetry; staff observe via Redis.
    if (p.userId !== session.learner_id) throw forbidden('Only the session learner can stream telemetry');
    if (session.status !== 'in_progress') throw conflict('session_closed', `Session is ${session.status}`);

    const prior = await repo.loadTelemetry(tx, sessionId);
    const faults = await repo.loadFaults(tx, session.injected_fault_ids);
    const faultComponents = faults.map((f) => f.componentRef);
    if (resolve) batch = resolve(session, prior, faultComponents);

    const deadline =
      session.mode === 'assessment' && session.time_limit_s
        ? session.started_at.getTime() + session.time_limit_s * 1000 + TIME_LIMIT_GRACE_MS
        : Infinity;

    const rejected: { seq: number; reason: string }[] = [];
    const candidates: TelemetryEvent[] = [];
    for (const e of batch) {
      const t = new Date(e.occurredAt);
      if (t.getTime() > now + MAX_CLOCK_SKEW_MS) rejected.push({ seq: e.seq, reason: 'occurred_in_future' });
      else if (t.getTime() < session.started_at.getTime() - MAX_CLOCK_SKEW_MS) rejected.push({ seq: e.seq, reason: 'before_session_start' });
      else if (t.getTime() > deadline) rejected.push({ seq: e.seq, reason: 'after_time_limit' });
      else candidates.push({ seq: e.seq, occurredAt: t, verb: e.verb, objectRef: e.objectRef ?? null, value: e.value });
    }

    // Retries from flaky workshop Wi-Fi resend the same seqs: accept once, ack always.
    const seen = new Set(prior.map((e) => e.seq).filter((s) => candidates.some((c) => c.seq === s)));
    let fresh = candidates.filter((c) => !seen.has(c.seq));

    let alerts: GuardrailAlert[] = [];
    if (session.rubric_id && fresh.length > 0) {
      const rubric = await repo.loadRubric(tx, session.rubric_id);
      alerts = detectGateViolations(rubric, prior, fresh, { startedAt: session.started_at, faults });
    }
    // Guided mode is a teaching mode: an unsafe action is blocked before it
    // happens, so it is never recorded. Assessment mode records it silently.
    if (session.mode === 'guided' && alerts.length > 0) {
      const blocked = new Set(alerts.map((a) => a.seq));
      fresh = fresh.filter((f) => !blocked.has(f.seq));
      for (const seq of blocked) rejected.push({ seq, reason: 'blocked_by_guardrail' });
    }
    await repo.insertTelemetry(tx, sessionId, fresh);

    // Sandbox is free practice: the trainer is not alerted.
    let stored: { id: string; raised_at: Date }[] = [];
    if (session.mode === 'assessment' && alerts.length > 0) {
      stored = await repo.insertAlerts(tx, alerts.map((a) => ({
        institutionId: session.institution_id, learnerId: session.learner_id, source: 'vlab' as const,
        sessionId, criterionKey: a.criterionKey, verb: a.verb, detail: a.detail,
      })));
    }

    const all = [...prior, ...fresh];
    const rig = rigFrom(all);
    const lastSeq = Math.max(Number(session.last_seq), ...fresh.map((f) => f.seq));
    return {
      session, fresh, duplicates: seen.size, rejected, alerts, stored, lastSeq, rig,
      motorRuns: fresh.some((f) => f.verb === 'start_pressed') ? motorRuns(faultComponents, rig) : undefined,
    };
  }

  async function fanOut(outcome: Awaited<ReturnType<typeof ingest>>) {
    // Fan-out happens after commit so dashboards never show uncommitted data.
    await realtime.appendTelemetry(outcome.session.id, outcome.fresh);
    if (outcome.stored.length > 0) {
      log.warn({ sessionId: outcome.session.id, alerts: outcome.alerts }, 'safety gate violation');
      await realtime.publish(`vlab:alerts:${outcome.session.institution_id}`, {
        type: 'safety_gate_violation',
        sessionId: outcome.session.id,
        learnerId: outcome.session.learner_id,
        alerts: outcome.alerts,
      });
    }
  }

  const ingestResponse = (o: Awaited<ReturnType<typeof ingest>>) => ({
    accepted: o.fresh.length,
    duplicates: o.duplicates,
    rejected: o.rejected,
    lastSeq: o.lastSeq,
    alerts: o.alerts,
    // In guided mode the client must block the unsafe action and replay the safety micro-lesson.
    guardrail: o.session.mode === 'guided' && o.alerts.length > 0 ? ('block' as const) : null,
    rig: o.rig,
    ...(o.motorRuns !== undefined ? { motorRuns: o.motorRuns } : {}),
  });

  router.post('/v1/vlab/sessions/:sessionId/telemetry', async (req: Request, res) => {
    const { sessionId } = SessionParams.parse(req.params);
    const batch = TelemetryBatch.parse(req.body);
    const outcome = await withTx(db, (tx) => ingest(tx, req.principal!, sessionId, batch.events, Date.now()));
    await fanOut(outcome);
    res.status(202).json(ingestResponse(outcome));
  });

  // -------------------------------------------------------------------------
  // Multimeter probe: the reading depends on the hidden fault, so the server
  // computes it and records it as a `measured` (or `energized_contact`) event.
  // -------------------------------------------------------------------------
  router.post('/v1/vlab/sessions/:sessionId/probe', async (req: Request, res) => {
    const { sessionId } = SessionParams.parse(req.params);
    const body = ProbeBody.parse(req.body);
    let meter: ReturnType<typeof readMeter> | null = null;
    const outcome = await withTx(db, (tx) =>
      ingest(tx, req.principal!, sessionId, [], Date.now(), (_session, prior, faultComponents) => {
        const rig = rigFrom(prior);
        if (INSIDE_PANEL.has(body.testPoint) && !rig.panelOpen) throw conflict('panel_closed', 'Open the panel door first');
        meter = readMeter(body.testPoint, faultComponents, rig);
        const value = meter.live ? {} : { reading: meter.reading, unit: meter.unit };
        return [{ seq: body.seq, occurredAt: body.occurredAt, verb: meter.live ? 'energized_contact' : 'measured', objectRef: body.testPoint, value }];
      }));
    await fanOut(outcome);
    const blocked = outcome.rejected.some((r) => r.seq === body.seq);
    res.status(202).json({ ...ingestResponse(outcome), meter: blocked ? null : meter });
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
      await repo.saveEvaluation(tx, { type: 'vlab_session', id: session.id, learnerId: session.learner_id, rubricId: session.rubric_id },
        evaluation, levelForScore, evaluatorId);
      await repo.markSessionEvaluated(tx, session.id, submittedAt, evaluation);
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
