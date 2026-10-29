/**
 * Parameterised question engine. A calculation item stores a stem template,
 * an answer formula and a set of variables with ranges (question_parameters).
 * Every learner gets their own instance: values are drawn from a PRNG seeded
 * by (question, version, learner, assessment), so the same learner sees the
 * same numbers if they reload, two learners side by side see different ones,
 * and the server can always rebuild the instance to grade it.
 *
 * Tolerances can be fixed on the version (abs/rel) or drawn too, e.g. a
 * `tol` parameter with choices [0.02, 0.05] and `abs_tol_expr: "tol"`, so
 * the stem can say "±{{tol}} mm" and each learner works to their own band.
 *
 * Pure TypeScript (no Node APIs) so the prototype runs the same engine.
 */
import { evaluate, ExprError, parse, variables } from './expr.js';

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
  unit?: string | null;
  /** Draw from these values instead of the range. */
  choices?: number[] | null;
}

export interface ParametricBody {
  template: string;
  template_ar?: string;
  /** Formula for the expected answer, over the parameters and `derived` values. */
  answer_expr: string;
  unit?: string;
  /** Intermediate values, e.g. {"I": "V / R"}; usable in the template and the answer. */
  derived?: Record<string, string>;
  /** Redraw until this evaluates > 0, e.g. "D - d - 2" keeps the bore smaller than the bar. */
  constraint?: string;
  /** Formula for a drawn absolute tolerance (overrides the version's abs_tolerance). */
  abs_tol_expr?: string;
  /** How many decimals the learner is asked to give (display hint only). */
  answer_decimals?: number;
}

export interface Instance {
  seed: number;
  values: Record<string, number>;
  derived: Record<string, number>;
  stem: string;
  stemAr: string | null;
  answer: number;
  absTol: number | null;
  relTol: number | null;
  unit: string | null;
}

export interface Grade {
  correct: boolean;
  given: number | null;
  expected: number;
  deviation: number | null;
  /** The band the answer was judged against, as an absolute value. */
  band: number;
}

/** cyrb53: fast, well-mixed 53-bit string hash (seeds the PRNG). */
export function hashSeed(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 PRNG: deterministic for a seed, uniform in [0, 1). */
export function rng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const decimalsOf = (x: number) => {
  const s = String(x);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  return s.includes('.') ? s.split('.')[1]!.length : 0;
};
const roundTo = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

export function seedFor(questionId: string, version: number, learnerId: string, assessmentId: string) {
  return hashSeed(`${questionId}:${version}:${learnerId}:${assessmentId}`);
}

function draw(params: ParamSpec[], next: () => number) {
  const out: Record<string, number> = {};
  for (const p of params) {
    if (p.choices?.length) { out[p.name] = p.choices[Math.floor(next() * p.choices.length)]!; continue; }
    const steps = Math.max(0, Math.floor((p.max - p.min) / p.step + 1e-9));
    const k = Math.floor(next() * (steps + 1));
    out[p.name] = roundTo(p.min + k * p.step, Math.max(decimalsOf(p.step), decimalsOf(p.min)));
  }
  return out;
}

/** "{{d}}" or "{{d:2}}" (fixed decimals) are replaced by the drawn value. */
export function renderTemplate(tpl: string, vals: Record<string, number>) {
  return tpl.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)(?::(\d))?\s*\}\}/g, (m, name: string, d?: string) => {
    const v = vals[name];
    if (v === undefined) return m;
    return d === undefined ? String(roundTo(v, 6)) : v.toFixed(Number(d));
  });
}

/** Builds a learner's instance of a parameterised item. Throws ExprError for a broken item. */
export function instantiate(body: ParametricBody, params: ParamSpec[], seed: number,
  tol: { abs?: number | null; rel?: number | null } = {}): Instance {
  const next = rng(seed);
  for (let attempt = 0; attempt < 64; attempt++) {
    const values = draw(params, next);
    const derived: Record<string, number> = {};
    for (const [k, f] of Object.entries(body.derived ?? {})) derived[k] = evaluate(f, { ...values, ...derived });
    const scope = { ...values, ...derived };
    if (body.constraint && !(evaluate(body.constraint, scope) > 0)) continue;
    const answer = evaluate(body.answer_expr, scope);
    const absTol = body.abs_tol_expr ? Math.abs(evaluate(body.abs_tol_expr, scope)) : tol.abs ?? null;
    return {
      seed, values, derived, answer, absTol, relTol: tol.rel ?? null, unit: body.unit ?? null,
      stem: renderTemplate(body.template, scope), stemAr: body.template_ar ? renderTemplate(body.template_ar, scope) : null,
    };
  }
  throw new ExprError('No values satisfy the constraint; widen the ranges');
}

/** Accepts "0.05", "0,05", "٠٫٠٥" and stray units ("24.98 mm"). */
export function parseAnswer(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = raw.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,]/g, '.').replace(/[−–]/g, '-');
  const m = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?/i.exec(s);
  return m ? Number(m[0]) : null;
}

/** Correct when inside the absolute band OR the relative band (whichever is wider). */
export function grade(inst: Pick<Instance, 'answer' | 'absTol' | 'relTol'>, raw: string | number | null | undefined): Grade {
  const given = parseAnswer(raw);
  const band = Math.max(inst.absTol ?? 0, Math.abs(inst.answer) * (inst.relTol ?? 0));
  if (given === null) return { correct: false, given, expected: inst.answer, deviation: null, band };
  const deviation = given - inst.answer;
  return { correct: Math.abs(deviation) <= band + 1e-9, given, expected: inst.answer, deviation, band };
}

/** Author-time check: every variable in the formulas is defined, and 200 draws all evaluate. */
export function lint(body: ParametricBody, params: ParamSpec[]): string[] {
  const issues: string[] = [];
  const known = new Set([...params.map((p) => p.name), ...Object.keys(body.derived ?? {})]);
  const check = (label: string, f: string | undefined) => {
    if (!f) return;
    try {
      for (const v of variables(parse(f))) if (!known.has(v)) issues.push(`${label}: unknown variable "${v}"`);
    } catch (e) { issues.push(`${label}: ${(e as Error).message}`); }
  };
  check('Answer', body.answer_expr);
  check('Constraint', body.constraint);
  check('Tolerance', body.abs_tol_expr);
  for (const [k, f] of Object.entries(body.derived ?? {})) check(`Derived ${k}`, f);
  for (const p of params) {
    if (!(p.max >= p.min) || !(p.step > 0)) issues.push(`Variable ${p.name}: max must be ≥ min and step > 0`);
  }
  if (!issues.length) {
    const seen = new Set<string>();
    try {
      for (let s = 1; s <= 200; s++) seen.add(JSON.stringify(instantiate(body, params, s).values));
      if (seen.size < 5) issues.push(`Only ${seen.size} distinct instance(s); widen the ranges so neighbours get different numbers`);
    } catch (e) { issues.push((e as Error).message); }
  }
  return issues;
}
