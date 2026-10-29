import type { Tx } from '../lib/db.js';
import { ScoringRule, type EvaluationResult, type InjectedFault, type Rubric, type TelemetryEvent } from './rubricEngine.js';

export interface SessionRow {
  id: string;
  learner_id: string;
  institution_id: string;
  lab_code: string;
  mode: 'guided' | 'sandbox' | 'assessment';
  status: 'in_progress' | 'submitted' | 'evaluated' | 'aborted' | 'voided';
  rubric_id: string | null;
  injected_fault_ids: string[];
  started_at: Date;
  submitted_at: Date | null;
  time_limit_s: number | null;
  last_seq: string; // bigint comes back as string
}

/** Locks the session row so concurrent batches for one session serialise. */
export async function lockSession(tx: Tx, sessionId: string): Promise<SessionRow | null> {
  const { rows } = await tx.query<SessionRow>(
    `SELECT s.id, s.learner_id, u.institution_id, l.code AS lab_code, s.mode, s.status, s.rubric_id,
            s.injected_fault_ids, s.started_at, s.submitted_at, s.time_limit_s, s.last_seq
       FROM virtual_lab_sessions s
       JOIN users u ON u.id = s.learner_id
       JOIN virtual_labs l ON l.id = s.lab_id
      WHERE s.id = $1
      FOR UPDATE OF s`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function existingSeqs(tx: Tx, sessionId: string, seqs: number[]): Promise<Set<number>> {
  const { rows } = await tx.query<{ seq: string }>(
    `SELECT seq FROM vlab_telemetry WHERE session_id = $1 AND seq = ANY($2::bigint[])`,
    [sessionId, seqs],
  );
  return new Set(rows.map((r) => Number(r.seq)));
}

export async function insertTelemetry(tx: Tx, sessionId: string, events: TelemetryEvent[]): Promise<void> {
  if (events.length === 0) return;
  // unnest() keeps this to a single round-trip regardless of batch size.
  await tx.query(
    `INSERT INTO vlab_telemetry (session_id, seq, occurred_at, verb, object_ref, value)
     SELECT $1, * FROM unnest($2::bigint[], $3::timestamptz[], $4::text[], $5::text[], $6::jsonb[])
     ON CONFLICT DO NOTHING`,
    [
      sessionId,
      events.map((e) => e.seq),
      events.map((e) => e.occurredAt.toISOString()),
      events.map((e) => e.verb),
      events.map((e) => e.objectRef ?? null),
      events.map((e) => JSON.stringify(e.value)),
    ],
  );
  await tx.query(`UPDATE virtual_lab_sessions SET last_seq = GREATEST(last_seq, $2) WHERE id = $1`, [
    sessionId,
    Math.max(...events.map((e) => e.seq)),
  ]);
}

export async function loadTelemetry(tx: Tx, sessionId: string): Promise<TelemetryEvent[]> {
  const { rows } = await tx.query<{ seq: string; occurred_at: Date; verb: string; object_ref: string | null; value: Record<string, unknown> }>(
    `SELECT seq, occurred_at, verb, object_ref, value FROM vlab_telemetry WHERE session_id = $1 ORDER BY seq`,
    [sessionId],
  );
  return rows.map((r) => ({ seq: Number(r.seq), occurredAt: r.occurred_at, verb: r.verb, objectRef: r.object_ref, value: r.value }));
}

export async function loadRubric(tx: Tx, rubricId: string): Promise<Rubric> {
  const { rows } = await tx.query<{
    pass_threshold: string; key: string; label: string; weight: string; is_gate: boolean; competency_id: string | null; scoring: unknown;
  }>(
    `SELECT r.pass_threshold, c.key, c.label, c.weight, c.is_gate, c.competency_id, c.scoring
       FROM rubrics r JOIN rubric_criteria c ON c.rubric_id = r.id
      WHERE r.id = $1 ORDER BY c.key`,
    [rubricId],
  );
  if (rows.length === 0) throw new Error(`rubric ${rubricId} has no criteria`);
  return {
    id: rubricId,
    passThreshold: Number(rows[0]!.pass_threshold),
    criteria: rows.map((r) => ({
      key: r.key,
      label: r.label,
      weight: Number(r.weight),
      isGate: r.is_gate,
      competencyId: r.competency_id,
      // Validate stored JSON so a malformed rubric fails loudly, not silently mis-scores.
      scoring: ScoringRule.parse(r.scoring),
    })),
  };
}

export async function loadFaults(tx: Tx, faultIds: string[]): Promise<InjectedFault[]> {
  if (faultIds.length === 0) return [];
  const { rows } = await tx.query<{ code: string; component_ref: string; correct_isolation_steps: string[] }>(
    `SELECT code, component_ref, correct_isolation_steps FROM lab_faults WHERE id = ANY($1::uuid[])`,
    [faultIds],
  );
  return rows.map((r) => ({ code: r.code, componentRef: r.component_ref, correctIsolationSteps: r.correct_isolation_steps }));
}

export async function loadEvaluation(tx: Tx, sessionId: string) {
  const { rows } = await tx.query(
    `SELECT criterion_scores, total_score::float AS total_score, passed, gate_failures, evaluated_at
       FROM rubric_evaluations WHERE subject_type = 'vlab_session' AND subject_id = $1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export interface EvaluationSubject {
  type: 'vlab_session' | 'workshop_observation';
  id: string;
  learnerId: string;
  rubricId: string;
}

/**
 * Persist an evaluation and propagate it to the learner's competency profile.
 * Levels only ever move up from a single piece of evidence (GREATEST on the
 * enum's declared order); downgrades are an explicit IQA action.
 */
export async function saveEvaluation(
  tx: Tx,
  subject: EvaluationSubject,
  result: EvaluationResult,
  levelFor: (score: number) => string,
  evaluatorId: string | null,
): Promise<void> {
  const criterionScores = Object.fromEntries(
    result.criteria.map((c) => [c.key, { score: c.score, gateFailed: c.gateFailed, evidenceSeqs: c.evidenceSeqs, detail: c.detail }]),
  );
  await tx.query(
    `INSERT INTO rubric_evaluations
       (rubric_id, subject_type, subject_id, learner_id, evaluator_id, criterion_scores, total_score, passed, gate_failures)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (subject_type, subject_id, rubric_id) DO UPDATE
       SET criterion_scores = EXCLUDED.criterion_scores, total_score = EXCLUDED.total_score,
           passed = EXCLUDED.passed, gate_failures = EXCLUDED.gate_failures,
           evaluator_id = EXCLUDED.evaluator_id, evaluated_at = now()`,
    [subject.rubricId, subject.type, subject.id, subject.learnerId, evaluatorId, criterionScores, result.totalScore, result.passed, result.gateFailures],
  );

  for (const c of result.criteria) {
    if (!c.competencyId) continue;
    // A failed safety gate never counts as positive evidence.
    const level = c.gateFailed ? 'not_yet' : levelFor(c.score);
    await tx.query(
      `INSERT INTO competency_evidence (learner_id, competency_id, source_type, source_id, score, level_awarded, assessor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [subject.learnerId, c.competencyId, subject.type, subject.id, c.score, level, evaluatorId],
    );
    await tx.query(
      `INSERT INTO learner_competencies (learner_id, competency_id, level, score, evidence_count, last_assessed_at)
       VALUES ($1, $2, $3, $4, 1, now())
       ON CONFLICT (learner_id, competency_id) DO UPDATE
         SET level = GREATEST(learner_competencies.level, EXCLUDED.level),
             score = EXCLUDED.score,
             evidence_count = learner_competencies.evidence_count + 1,
             last_assessed_at = now(), updated_at = now()`,
      [subject.learnerId, c.competencyId, level, c.score],
    );
  }
}

export async function markSessionEvaluated(tx: Tx, sessionId: string, submittedAt: Date, result: EvaluationResult): Promise<void> {
  await tx.query(
    `UPDATE virtual_lab_sessions
        SET status = 'evaluated', submitted_at = COALESCE(submitted_at, $2), final_score = $3, passed = $4
      WHERE id = $1`,
    [sessionId, submittedAt, result.totalScore, result.passed],
  );
}

export interface AlertInput { institutionId: string; learnerId: string; source: 'vlab' | 'rfid' | 'observation'; sessionId?: string | null; criterionKey?: string; verb?: string; detail: string }

export async function insertAlerts(tx: Tx, alerts: AlertInput[]): Promise<{ id: string; raised_at: Date }[]> {
  const out: { id: string; raised_at: Date }[] = [];
  for (const a of alerts) {
    const { rows } = await tx.query<{ id: string; raised_at: Date }>(
      `INSERT INTO safety_alerts (institution_id, learner_id, source, session_id, criterion_key, verb, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, raised_at`,
      [a.institutionId, a.learnerId, a.source, a.sessionId ?? null, a.criterionKey ?? null, a.verb ?? null, a.detail],
    );
    out.push(rows[0]!);
  }
  return out;
}
