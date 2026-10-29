/**
 * Rubric evaluation engine for V-Lab practical assessments and workshop
 * floor observations (a trainer's tablet scoring becomes `observed` and
 * `measured` events, so both evidence sources go through the same rules).
 *
 * Pure and deterministic: given the same telemetry stream, rubric and session
 * context it always produces the same result, which is what lets an IQA
 * auditor re-run an evaluation months later and get an identical score.
 *
 * The same rule definitions drive two things:
 *   1. live guardrails during telemetry ingestion (gate rules only), and
 *   2. the final weighted score when the learner submits.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Rule definitions (stored as JSON in rubric_criteria.scoring)
// ---------------------------------------------------------------------------
export const ScoringRule = z.discriminatedUnion('rule', [
  // Every `then` verb must happen after the first `first` verb.
  // e.g. LOTO must be applied before the panel is opened.
  z.object({ rule: z.literal('precedes'), first: z.string(), then: z.array(z.string()).min(1) }),
  // The verb must never appear (e.g. touching an energised conductor).
  z.object({ rule: z.literal('absent'), verb: z.string() }),
  // Learner's submitted diagnosis vs. the trainer's injected fault(s).
  z.object({ rule: z.literal('fault_diagnosed'), componentOnlyCredit: z.number().min(0).max(100).default(50) }),
  // Did the learner take the expected diagnostic measurements, in order?
  z.object({ rule: z.literal('isolation_steps') }),
  // A specific reading must land within an engineering tolerance.
  z.object({
    rule: z.literal('measurement_tolerance'),
    objectRef: z.string(),
    expected: z.number(),
    absTol: z.number().positive().optional(),
    relTol: z.number().positive().optional(),
  }),
  // Full marks at or under target time, linear decay to zero at maxS.
  z.object({ rule: z.literal('time'), targetS: z.number().positive(), maxS: z.number().positive() }),
  // Fixed deduction for each occurrence of a verb, e.g. replacing a healthy part.
  z.object({
    rule: z.literal('penalty_per'),
    verb: z.string(),
    per: z.number().positive(),
    ignoreFaultyComponents: z.boolean().default(true),
  }),
  // Workshop floor observation: a checklist item the trainer ticked (e.g. PPE worn).
  z.object({ rule: z.literal('check'), objectRef: z.string() }),
  // Workshop floor observation: a 0..max rating the trainer gave a criterion.
  z.object({ rule: z.literal('rating'), objectRef: z.string(), max: z.number().positive().default(4) }),
]).refine(
  (r) => r.rule !== 'measurement_tolerance' || r.absTol !== undefined || r.relTol !== undefined,
  'measurement_tolerance needs absTol or relTol',
);
export type ScoringRule = z.infer<typeof ScoringRule>;

export interface Criterion {
  key: string;
  label: string;
  weight: number;
  isGate: boolean;
  competencyId?: string | null;
  scoring: ScoringRule;
}

export interface Rubric {
  id: string;
  passThreshold: number;
  criteria: Criterion[];
}

export interface TelemetryEvent {
  seq: number;
  occurredAt: Date;
  verb: string;
  objectRef?: string | null;
  value: Record<string, unknown>;
}

export interface InjectedFault {
  code: string;
  componentRef: string;
  correctIsolationSteps: string[];
}

export interface SessionContext {
  startedAt: Date;
  submittedAt: Date;
  faults: InjectedFault[];
}

export interface CriterionResult {
  key: string;
  label: string;
  score: number; // 0..100
  weight: number;
  isGate: boolean;
  gateFailed: boolean;
  competencyId: string | null;
  evidenceSeqs: number[];
  detail: string;
}

export interface EvaluationResult {
  totalScore: number;
  passed: boolean;
  gateFailures: string[];
  criteria: CriterionResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Length of the longest common subsequence — rewards correct *order* of steps. */
export function lcsLength(a: readonly string[], b: readonly string[]): number {
  const dp: number[] = new Array(b.length + 1).fill(0);
  for (const x of a) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = x === b[j - 1] ? prev + 1 : Math.max(dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

export function withinTolerance(actual: number, expected: number, absTol?: number, relTol?: number): boolean {
  const diff = Math.abs(actual - expected);
  if (absTol !== undefined && diff <= absTol + 1e-12) return true;
  if (relTol !== undefined && expected !== 0 && diff / Math.abs(expected) <= relTol + 1e-12) return true;
  return false;
}

function readingOf(e: TelemetryEvent): number | undefined {
  const r = e.value['reading'];
  return typeof r === 'number' && Number.isFinite(r) ? r : undefined;
}

// ---------------------------------------------------------------------------
// Individual rule scorers
// ---------------------------------------------------------------------------
type Scored = { score: number; evidenceSeqs: number[]; detail: string };

function scoreRule(rule: ScoringRule, events: TelemetryEvent[], ctx: SessionContext): Scored {
  switch (rule.rule) {
    case 'precedes': {
      const firstSeq = events.find((e) => e.verb === rule.first)?.seq;
      const violations = events.filter(
        (e) => rule.then.includes(e.verb) && (firstSeq === undefined || e.seq < firstSeq),
      );
      return violations.length === 0
        ? { score: 100, evidenceSeqs: firstSeq !== undefined ? [firstSeq] : [], detail: `${rule.first} respected` }
        : {
            score: 0,
            evidenceSeqs: violations.map((v) => v.seq),
            detail: `${violations[0]!.verb} at seq ${violations[0]!.seq} before ${rule.first}`,
          };
    }

    case 'absent': {
      const hits = events.filter((e) => e.verb === rule.verb);
      return hits.length === 0
        ? { score: 100, evidenceSeqs: [], detail: `no ${rule.verb}` }
        : { score: 0, evidenceSeqs: hits.map((h) => h.seq), detail: `${hits.length}× ${rule.verb}` };
    }

    case 'fault_diagnosed': {
      if (ctx.faults.length === 0) return { score: 100, evidenceSeqs: [], detail: 'no fault injected' };
      const diagnoses = events.filter((e) => e.verb === 'diagnosis_submitted');
      const perFault = ctx.faults.map((f) => {
        // A learner may submit several diagnoses; the best one for each fault counts.
        let best: { score: number; seq?: number } = { score: 0 };
        for (const d of diagnoses) {
          const s =
            d.value['faultCode'] === f.code ? 100 : d.objectRef === f.componentRef ? rule.componentOnlyCredit : 0;
          if (s > best.score) best = { score: s, seq: d.seq };
        }
        return best;
      });
      const score = perFault.reduce((a, b) => a + b.score, 0) / perFault.length;
      return {
        score,
        evidenceSeqs: perFault.flatMap((p) => (p.seq !== undefined ? [p.seq] : [])),
        detail: `${perFault.filter((p) => p.score === 100).length}/${ctx.faults.length} faults correctly identified`,
      };
    }

    case 'isolation_steps': {
      const measured = events.filter((e) => e.verb === 'measured' && e.objectRef);
      const path = measured.map((e) => e.objectRef!);
      const ratios = ctx.faults
        .filter((f) => f.correctIsolationSteps.length > 0)
        .map((f) => lcsLength(path, f.correctIsolationSteps) / f.correctIsolationSteps.length);
      if (ratios.length === 0) return { score: 100, evidenceSeqs: [], detail: 'no isolation path defined' };
      const score = (100 * ratios.reduce((a, b) => a + b, 0)) / ratios.length;
      return { score, evidenceSeqs: measured.map((m) => m.seq), detail: `${Math.round(score)}% of expected test points in order` };
    }

    case 'measurement_tolerance': {
      const m = [...events].reverse().find((e) => e.verb === 'measured' && e.objectRef === rule.objectRef);
      const reading = m ? readingOf(m) : undefined;
      if (!m || reading === undefined) return { score: 0, evidenceSeqs: [], detail: `no reading at ${rule.objectRef}` };
      // Full marks inside tolerance, half marks inside 2× tolerance.
      const score = withinTolerance(reading, rule.expected, rule.absTol, rule.relTol)
        ? 100
        : withinTolerance(
              reading,
              rule.expected,
              rule.absTol !== undefined ? rule.absTol * 2 : undefined,
              rule.relTol !== undefined ? rule.relTol * 2 : undefined,
            )
          ? 50
          : 0;
      return { score, evidenceSeqs: [m.seq], detail: `read ${reading} vs ${rule.expected}` };
    }

    case 'time': {
      const elapsedS = (ctx.submittedAt.getTime() - ctx.startedAt.getTime()) / 1000;
      const score =
        elapsedS <= rule.targetS
          ? 100
          : elapsedS >= rule.maxS
            ? 0
            : (100 * (rule.maxS - elapsedS)) / (rule.maxS - rule.targetS);
      return { score, evidenceSeqs: [], detail: `${Math.round(elapsedS)}s (target ${rule.targetS}s)` };
    }

    case 'penalty_per': {
      const faulty = new Set(ctx.faults.map((f) => f.componentRef));
      const hits = events.filter(
        (e) => e.verb === rule.verb && !(rule.ignoreFaultyComponents && e.objectRef && faulty.has(e.objectRef)),
      );
      return {
        score: clamp(100 - hits.length * rule.per),
        evidenceSeqs: hits.map((h) => h.seq),
        detail: `${hits.length} penalised ${rule.verb}`,
      };
    }
    case 'check':
    case 'rating': {
      const o = [...events].reverse().find((e) => e.verb === 'observed' && e.objectRef === rule.objectRef);
      if (!o) return { score: 0, evidenceSeqs: [], detail: `${rule.objectRef} not observed` };
      if (rule.rule === 'check') {
        const ok = o.value['ok'] === true;
        return { score: ok ? 100 : 0, evidenceSeqs: [o.seq], detail: ok ? `${rule.objectRef} ok` : `${rule.objectRef} not met` };
      }
      const r = typeof o.value['rating'] === 'number' ? (o.value['rating'] as number) : 0;
      return { score: (100 * r) / rule.max, evidenceSeqs: [o.seq], detail: `rated ${r}/${rule.max}` };
    }
    default:
      throw new Error(`unknown rule ${(rule as { rule: string }).rule}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function evaluate(rubric: Rubric, rawEvents: TelemetryEvent[], ctx: SessionContext): EvaluationResult {
  // Order by client sequence; occurredAt can drift on offline tablets.
  const events = [...rawEvents].sort((a, b) => a.seq - b.seq);

  const criteria: CriterionResult[] = rubric.criteria.map((c) => {
    const r = scoreRule(c.scoring, events, ctx);
    const score = round2(clamp(r.score));
    return {
      key: c.key,
      label: c.label,
      score,
      weight: c.weight,
      isGate: c.isGate,
      gateFailed: c.isGate && score < 100,
      competencyId: c.competencyId ?? null,
      evidenceSeqs: r.evidenceSeqs,
      detail: r.detail,
    };
  });

  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);
  const totalScore = totalWeight === 0 ? 0 : round2(criteria.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight);
  const gateFailures = criteria.filter((c) => c.gateFailed).map((c) => c.key);

  return { totalScore, passed: gateFailures.length === 0 && totalScore >= rubric.passThreshold, gateFailures, criteria };
}

export interface GuardrailAlert {
  criterionKey: string;
  label: string;
  seq: number;
  verb: string;
  detail: string;
}

/**
 * Run the rubric's safety-gate rules over the full stream and report only
 * violations caused by the newly ingested events, so a trainer tablet is
 * alerted once per incident rather than on every subsequent batch.
 */
export function detectGateViolations(
  rubric: Rubric,
  priorEvents: TelemetryEvent[],
  newEvents: TelemetryEvent[],
  ctx: Omit<SessionContext, 'submittedAt'>,
): GuardrailAlert[] {
  const newSeqs = new Set(newEvents.map((e) => e.seq));
  const all = [...priorEvents, ...newEvents].sort((a, b) => a.seq - b.seq);
  const bySeq = new Map(all.map((e) => [e.seq, e]));
  const alerts: GuardrailAlert[] = [];

  for (const c of rubric.criteria) {
    if (!c.isGate || (c.scoring.rule !== 'precedes' && c.scoring.rule !== 'absent')) continue;
    const r = scoreRule(c.scoring, all, { ...ctx, submittedAt: new Date() });
    if (r.score >= 100) continue;
    for (const seq of r.evidenceSeqs) {
      if (!newSeqs.has(seq)) continue;
      alerts.push({ criterionKey: c.key, label: c.label, seq, verb: bySeq.get(seq)!.verb, detail: r.detail });
    }
  }
  return alerts;
}

/**
 * Map a virtual-lab score to a proficiency level. Virtual evidence alone is
 * capped at 'autonomous' — 'master' requires workplace (WBL) verification.
 */
export function levelForScore(score: number): 'not_yet' | 'novice' | 'intermediate' | 'autonomous' {
  if (score >= 85) return 'autonomous';
  if (score >= 70) return 'intermediate';
  if (score >= 50) return 'novice';
  return 'not_yet';
}
