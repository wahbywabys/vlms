/**
 * Machine safety pre-check: the short quiz a learner answers on their phone
 * after scanning the QR label on a machine. A random draw of the bank is
 * served in a shuffled order; every critical item must be right and the
 * score must reach the pass mark. Pure TypeScript, shared with the prototype.
 */
import { hashSeed, rng } from './paramEngine.js';

export interface PrecheckItem {
  id: string;
  prompt: { en: string; ar: string };
  options: { id: string; en: string; ar: string }[];
  correct: string;
  /** Getting a critical item wrong fails the pre-check whatever the score. */
  critical?: boolean;
  /** Shown after a wrong answer, so the learner knows what to fix before retrying. */
  why?: { en: string; ar: string };
}

export interface PrecheckDef { items: PrecheckItem[]; drawCount: number; passMark: number }
export type ServedItem = Omit<PrecheckItem, 'correct' | 'why'>;

/** Draws `drawCount` items (critical items always included) and shuffles items and options. */
export function serve(def: PrecheckDef, seedText: string): ServedItem[] {
  const next = rng(hashSeed(seedText));
  const shuffle = <T,>(xs: T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
  };
  const critical = def.items.filter((i) => i.critical);
  const rest = shuffle(def.items.filter((i) => !i.critical));
  const picked = shuffle([...critical, ...rest].slice(0, Math.max(def.drawCount, critical.length)));
  return picked.map(({ correct: _c, why: _w, ...item }) => ({ ...item, options: shuffle(item.options) }));
}

export interface PrecheckResult {
  score: number;
  passed: boolean;
  criticalMissed: string[];
  wrong: { id: string; why?: { en: string; ar: string } }[];
}

export function gradePrecheck(def: PrecheckDef, servedIds: string[], answers: Record<string, string>): PrecheckResult {
  const items = servedIds.map((id) => def.items.find((i) => i.id === id)).filter((i): i is PrecheckItem => Boolean(i));
  const wrong = items.filter((i) => answers[i.id] !== i.correct);
  const score = items.length ? Math.round(((items.length - wrong.length) / items.length) * 100) : 0;
  const criticalMissed = wrong.filter((i) => i.critical).map((i) => i.id);
  return {
    score, criticalMissed, passed: items.length > 0 && criticalMissed.length === 0 && score >= def.passMark,
    wrong: wrong.map((i) => ({ id: i.id, ...(i.why ? { why: i.why } : {}) })),
  };
}
