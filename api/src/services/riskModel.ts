/**
 * Early-warning model: flags learners likely to fail their final practical
 * from signals the centre already records (trainer floor rubrics, V-Lab
 * telemetry, quizzes, class attendance and OJT hours).
 *
 * It is a transparent logistic model with hand-set weights, not a black box:
 * every flag lists the factors that pushed it up, in words a trainer can act
 * on. Once a cohort has sat finals, refit the weights on the real outcomes
 * (risk_snapshots keeps the inputs) and bump MODEL_VERSION.
 *
 * Pure TypeScript; the prototype computes its demo flags with the same code.
 */
export const MODEL_VERSION = 'ew-1.0';

export interface Signals {
  /** Share of timetabled sessions attended in the last 30 days, 0–1. */
  attendanceRate?: number | null;
  /** Mean floor-rubric score, last 30 days. */
  floorAvg?: number | null;
  /** Mean of the last 3 floor scores minus the 3 before (points). */
  floorTrend?: number | null;
  /** Safety-gate failures on floor rubrics, last 30 days. */
  gateFails?: number | null;
  /** Share of V-Lab attempts passed, last 30 days, 0–1. */
  vlabPassRate?: number | null;
  /** V-Lab safety violations (guardrail alerts), last 30 days. */
  safetyViolations?: number | null;
  /** Theory quiz percentage, last 30 days. */
  quizPct?: number | null;
  /** Verified OJT hours ÷ hours expected by today, 0–1 (null when not on placement). */
  ojtPace?: number | null;
  /** Days since any assessed evidence. */
  daysInactive?: number | null;
  /** Days until the final practical (affects urgency, not the probability). */
  daysToFinal?: number | null;
}

export type FactorKey = keyof Omit<Signals, 'daysToFinal'>;
export interface Factor { key: FactorKey; value: number; contribution: number }
export interface Risk { probability: number; score: number; band: 'low' | 'watch' | 'high'; urgent: boolean; factors: Factor[]; model: string }

/** For each signal: how far it sits on the bad side of a healthy value, in "units of concern". */
const FEATURES: { key: FactorKey; weight: number; deficit: (v: number) => number }[] = [
  { key: 'attendanceRate', weight: 1.1, deficit: (v) => (0.9 - v) / 0.1 },
  { key: 'floorAvg', weight: 0.9, deficit: (v) => (75 - v) / 10 },
  { key: 'floorTrend', weight: 0.5, deficit: (v) => -v / 10 },
  { key: 'gateFails', weight: 0.8, deficit: (v) => v },
  { key: 'vlabPassRate', weight: 0.7, deficit: (v) => (0.7 - v) / 0.2 },
  { key: 'safetyViolations', weight: 0.6, deficit: (v) => v },
  { key: 'quizPct', weight: 0.6, deficit: (v) => (70 - v) / 15 },
  { key: 'ojtPace', weight: 0.5, deficit: (v) => (0.9 - v) / 0.2 },
  { key: 'daysInactive', weight: 0.4, deficit: (v) => Math.max(0, (v - 7) / 7) },
];
const INTERCEPT = -1.6;

export function assess(s: Signals): Risk {
  let z = INTERCEPT;
  const factors: Factor[] = [];
  for (const f of FEATURES) {
    const v = s[f.key];
    if (v === null || v === undefined || Number.isNaN(v)) continue;  // missing → neutral
    const c = f.weight * Math.max(-2, Math.min(3, f.deficit(v)));
    z += c;
    factors.push({ key: f.key, value: v, contribution: Math.round(c * 100) / 100 });
  }
  const probability = 1 / (1 + Math.exp(-z));
  const band = probability >= 0.6 ? 'high' : probability >= 0.35 ? 'watch' : 'low';
  return {
    probability: Math.round(probability * 1000) / 1000, score: Math.round(probability * 100), band,
    urgent: band !== 'low' && (s.daysToFinal ?? Infinity) <= 21,
    factors: factors.filter((f) => f.contribution > 0).sort((a, b) => b.contribution - a.contribution),
    model: MODEL_VERSION,
  };
}

/** Plain-language reason for a factor (EN/AR), for the dashboard and the trainer's notice. */
export function explain(f: Factor): { en: string; ar: string } {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const n = (x: number) => String(Math.round(x));
  switch (f.key) {
    case 'attendanceRate': return { en: `Attendance ${pct(f.value)} (30 days)`, ar: `الحضور ${pct(f.value)} (30 يومًا)` };
    case 'floorAvg': return { en: `Workshop rubric average ${n(f.value)}`, ar: `متوسط تقييم الورشة ${n(f.value)}` };
    case 'floorTrend': return { en: `Workshop scores falling (${n(f.value)} pts)`, ar: `درجات الورشة في تراجع (${n(f.value)} نقطة)` };
    case 'gateFails': return { en: `${n(f.value)} safety gate fail(s) on the floor`, ar: `${n(f.value)} إخفاق في شروط الأمان بالورشة` };
    case 'vlabPassRate': return { en: `V-Lab pass rate ${pct(f.value)}`, ar: `نسبة النجاح في المعمل الافتراضي ${pct(f.value)}` };
    case 'safetyViolations': return { en: `${n(f.value)} V-Lab safety violation(s)`, ar: `${n(f.value)} مخالفة أمان في المعمل الافتراضي` };
    case 'quizPct': return { en: `Theory quizzes ${n(f.value)}%`, ar: `الاختبارات النظرية ${n(f.value)}%` };
    case 'ojtPace': return { en: `OJT hours at ${pct(f.value)} of plan`, ar: `ساعات التدريب الميداني ${pct(f.value)} من الخطة` };
    case 'daysInactive': return { en: `No assessed work for ${n(f.value)} days`, ar: `لا يوجد عمل مُقيَّم منذ ${n(f.value)} يومًا` };
  }
}
