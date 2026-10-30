/**
 * The student's Private space: what it stores and the pure logic around it
 * (flashcard scheduling, practice questions, merging two copies). No React
 * here, so the API can validate the same shape and tests can run it directly.
 *
 * Everything lives in one JSON document per learner. Only the learner can read
 * or write it; nothing in it is graded or shown to staff.
 */
import type { Lesson } from '../LessonPlayer';
import { modelParts, type ModelDef, type Txt } from '../../models/kit';
import type { Scenario } from '../../safety/types';
import { newId, type AttemptRecord, type LockerDrop, type LockerKind } from '../locker';

export type { AttemptRecord, LockerDrop, LockerKind };

export interface LockerItem {
  id: string;
  kind: LockerKind;
  at: string;
  title: Txt;
  body?: string;
  ref?: Record<string, string>;
  value?: Record<string, unknown>;
  tags: string[];
  pinned?: boolean;
  /** Photos are downscaled JPEG data URLs. */
  image?: string;
  url?: string;
}

/** Leitner box 1–5 and when the card is next due. */
export interface CardState { box: number; due: string; seen: number; right: number }
export interface Goal { id: string; text: string; done: boolean; at: string }
export interface DayLog { reviews: number; mins: number; practice: number }

export interface PrivateState {
  v: 1;
  items: LockerItem[];
  cards: Record<string, CardState>;
  history: AttemptRecord[];
  goals: Goal[];
  /** Keyed by local date, YYYY-MM-DD. */
  activity: Record<string, DayLog>;
}

export const LIMITS = { items: 300, history: 400, goals: 40, image: 400_000, body: 8000 };

export const emptyState = (): PrivateState => ({ v: 1, items: [], cards: {}, history: [], goals: [], activity: {} });

/** Accept whatever was stored (older or partial) and return a complete state. */
export function normalize(raw: unknown): PrivateState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<PrivateState>;
  return {
    v: 1,
    items: Array.isArray(s.items) ? s.items.filter((i) => i && i.id && i.title).map((i) => ({ ...i, tags: Array.isArray(i.tags) ? i.tags : [] })) : [],
    cards: s.cards && typeof s.cards === 'object' ? s.cards : {},
    history: Array.isArray(s.history) ? s.history.filter((h) => h && h.id) : [],
    goals: Array.isArray(s.goals) ? s.goals : [],
    activity: s.activity && typeof s.activity === 'object' ? s.activity : {},
  };
}

/** Two copies edited apart (another tab, an offline save): keep everything from both, local edits win. */
export function mergeStates(local: PrivateState, remote: PrivateState): PrivateState {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map(b.map((x) => [x.id, x]));
    for (const x of a) m.set(x.id, x);
    return [...m.values()];
  };
  const activity: Record<string, DayLog> = { ...remote.activity };
  for (const [d, l] of Object.entries(local.activity)) {
    const r = activity[d];
    activity[d] = r ? { reviews: Math.max(r.reviews, l.reviews), mins: Math.max(r.mins, l.mins), practice: Math.max(r.practice, l.practice) } : l;
  }
  const cards = { ...remote.cards };
  for (const [k, c] of Object.entries(local.cards)) { const r = cards[k]; if (!r || c.seen >= r.seen) cards[k] = c; }
  return {
    v: 1,
    items: byId(local.items, remote.items).sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMITS.items),
    cards,
    history: byId(local.history, remote.history).sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMITS.history),
    goals: byId(local.goals, remote.goals).slice(0, LIMITS.goals),
    activity,
  };
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function logDay(s: PrivateState, patch: Partial<DayLog>, d = new Date()): PrivateState {
  const k = dayKey(d);
  const cur = s.activity[k] ?? { reviews: 0, mins: 0, practice: 0 };
  return { ...s, activity: { ...s.activity, [k]: { reviews: cur.reviews + (patch.reviews ?? 0), mins: cur.mins + (patch.mins ?? 0), practice: cur.practice + (patch.practice ?? 0) } } };
}

/** Consecutive days with any study, counting back from today (or yesterday, so the streak survives until tonight). */
export function streak(s: PrivateState, today = new Date()): number {
  const active = (d: Date) => { const l = s.activity[dayKey(d)]; return !!l && (l.reviews + l.mins + l.practice) > 0; };
  const d = new Date(today);
  if (!active(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function lastDays(s: PrivateState, n: number, today = new Date()): { key: string; date: Date; log: DayLog }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (n - 1 - i));
    return { key: dayKey(d), date: d, log: s.activity[dayKey(d)] ?? { reviews: 0, mins: 0, practice: 0 } };
  });
}

/** Stored refs come back from jsonb with their keys reordered, so compare them key by key. */
export const sameRef = (a?: Record<string, string>, b?: Record<string, string>) =>
  !!a && !!b && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

export function addDrop(s: PrivateState, drop: LockerDrop, at = new Date().toISOString()): { state: PrivateState; item: LockerItem } {
  const body = drop.body === undefined ? undefined : typeof drop.body === 'string' ? drop.body : `${drop.body.en}\n${drop.body.ar}`;
  // Saving the same part or lesson twice refreshes it instead of filling the locker with copies.
  const same = drop.ref && drop.kind !== 'result' && drop.kind !== 'note'
    ? s.items.find((i) => i.kind === drop.kind && sameRef(i.ref, drop.ref)) : undefined;
  const item: LockerItem = {
    id: same?.id ?? newId(), kind: drop.kind, at, title: drop.title, ref: drop.ref, value: drop.value,
    body: (body ?? same?.body)?.slice(0, LIMITS.body), image: drop.image && drop.image.length <= LIMITS.image ? drop.image : undefined, url: drop.url, tags: [...new Set([...(same?.tags ?? []), ...(drop.tags ?? [])])].slice(0, 12), pinned: same?.pinned,
  };
  return { state: { ...s, items: [item, ...s.items.filter((i) => i.id !== item.id)].slice(0, LIMITS.items) }, item };
}

export function addAttempt(s: PrivateState, a: AttemptRecord): PrivateState {
  if (s.history.some((h) => h.id === a.id)) return s;
  return { ...s, history: [a, ...s.history].slice(0, LIMITS.history) };
}

// ---------------------------------------------------------------------------
// What the student can study: the trades' machines, lessons and simulators
// ---------------------------------------------------------------------------
export interface CatalogTrade { id: string; name: Txt; accent: string; models: ModelDef[]; lessons: Lesson[]; safety: Scenario[] }
export interface Catalog { trades: CatalogTrade[]; home: string }

export interface PartInfo { key: string; id: string; model: ModelDef; trade: CatalogTrade; name: Txt; what?: Txt; does?: Txt; specs: Record<'en' | 'ar', [string, string][]>; safety?: Txt }

const partCache = new WeakMap<ModelDef, PartInfo[]>();
/** Every part of a model in both languages, with its briefing. */
export function partsOf(model: ModelDef, trade: CatalogTrade): PartInfo[] {
  const hit = partCache.get(model);
  if (hit) return hit.map((p) => ({ ...p, trade }));
  const en = modelParts(model, 'en');
  const ar = modelParts(model, 'ar');
  const out = en.map((p, i) => {
    const a = ar.find((x) => x.id === p.id) ?? ar[i] ?? p;
    return {
      key: `${model.id}/${p.id}`, id: p.id, model, trade, name: { en: p.name, ar: a.name },
      what: p.brief && { en: p.brief.what, ar: a.brief?.what ?? p.brief.what },
      does: p.brief && { en: p.brief.does, ar: a.brief?.does ?? p.brief.does },
      specs: { en: Object.entries(p.hotspot?.specs ?? {}), ar: Object.entries(a.hotspot?.specs ?? {}) },
      safety: p.hotspot?.safety ? { en: p.hotspot.safety, ar: a.hotspot?.safety ?? p.hotspot.safety } : undefined,
    };
  });
  partCache.set(model, out);
  return out;
}

export const machineName = (m: ModelDef): Txt => ({ en: m.title.en.split(' · ')[0]!, ar: m.title.ar.split(' · ')[0]! });

export function allModels(c: Catalog): { model: ModelDef; trade: CatalogTrade }[] {
  const seen = new Set<string>();
  const out: { model: ModelDef; trade: CatalogTrade }[] = [];
  for (const t of c.trades) for (const m of t.models) if (!seen.has(m.id)) { seen.add(m.id); out.push({ model: m, trade: t }); }
  return out;
}

/** Find the part a locker item points at (saved from the explorer by asset tag, or from here by model id). */
export function findPart(c: Catalog, ref?: Record<string, string>): PartInfo | undefined {
  if (!ref?.part) return;
  const hit = allModels(c).find(({ model }) => model.id === ref.model || model.assetTag === ref.asset || model.title.en === ref.asset || model.title.ar === ref.asset);
  return hit && partsOf(hit.model, hit.trade).find((p) => p.id === ref.part);
}
export const findLesson = (c: Catalog, id?: string) => c.trades.flatMap((t) => t.lessons).find((l) => l.id === id);
export const findScenario = (c: Catalog, id?: string) => c.trades.flatMap((t) => t.safety).find((x) => x.id === id);

// ---------------------------------------------------------------------------
// Flashcards: a Leitner schedule over every part that has a briefing
// ---------------------------------------------------------------------------
const INTERVAL_DAYS = [0, 0, 1, 3, 7, 14];
export const MASTERED_BOX = 4;

export function review(c: CardState | undefined, knew: boolean, now = new Date()): CardState {
  const box = knew ? Math.min(5, (c?.box ?? 0) + 1) : 1;
  const due = new Date(now);
  due.setDate(due.getDate() + INTERVAL_DAYS[box]!);
  if (box <= 1) due.setMinutes(due.getMinutes() + 5);
  return { box, due: due.toISOString(), seen: (c?.seen ?? 0) + 1, right: (c?.right ?? 0) + (knew ? 1 : 0) };
}

export const isDue = (c: CardState | undefined, now = new Date()) => !c || new Date(c.due) <= now;

export function deckStats(parts: PartInfo[], cards: Record<string, CardState>, now = new Date()) {
  const studied = parts.filter((p) => cards[p.key]);
  return {
    total: parts.length,
    fresh: parts.length - studied.length,
    due: studied.filter((p) => isDue(cards[p.key], now)).length,
    mastered: studied.filter((p) => (cards[p.key]?.box ?? 0) >= MASTERED_BOX).length,
  };
}

/** Today's queue: cards that are due first (weakest box first), then up to `fresh` new ones. */
export function studyQueue(parts: PartInfo[], cards: Record<string, CardState>, fresh = 8, now = new Date()): PartInfo[] {
  const due = parts.filter((p) => cards[p.key] && isDue(cards[p.key], now)).sort((a, b) => cards[a.key]!.box - cards[b.key]!.box);
  const unseen = parts.filter((p) => !cards[p.key]).slice(0, fresh);
  return [...due, ...unseen];
}

// ---------------------------------------------------------------------------
// Practice: questions built from the parts, the lessons' checkpoints and the
// safety simulators' rules, plus the student's own saved mistakes
// ---------------------------------------------------------------------------
export type Source = 'parts' | 'lessons' | 'safety' | 'mistakes';
export interface Question { id: string; source: Source; prompt: Txt; context?: Txt; options: Txt[]; answer: number; explain?: Txt }

const shuffle = <T,>(a: T[], rnd = Math.random) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; };

function choices(right: Txt, pool: Txt[], rnd: () => number): { options: Txt[]; answer: number } {
  const wrong = shuffle(pool.filter((p) => p.en !== right.en), rnd).filter((p, i, a) => a.findIndex((x) => x.en === p.en) === i).slice(0, 3);
  const options = shuffle([right, ...wrong], rnd);
  return { options, answer: options.findIndex((o) => o.en === right.en) };
}

export function partQuestions(parts: PartInfo[], rnd = Math.random): Question[] {
  const briefed = parts.filter((p) => p.what && p.does);
  return briefed.flatMap((p) => {
    const pool = briefed.filter((x) => x.key !== p.key);
    const same = pool.filter((x) => x.model === p.model);
    const near = same.length >= 3 ? same : pool;
    const m = machineName(p.model);
    const a = choices(p.name, near.map((x) => x.name), rnd);
    const b = choices(p.what!, near.map((x) => x.what!), rnd);
    return [
      { id: `p:${p.key}:does`, source: 'parts' as const, context: m, prompt: { en: `Which part does this? “${p.does!.en}”`, ar: `أي قطعة تقوم بهذا؟ «${p.does!.ar}»` }, ...a, explain: p.what },
      { id: `p:${p.key}:what`, source: 'parts' as const, context: m, prompt: { en: `Which describes the part “${p.name.en}”?`, ar: `أيّ وصف يناسب القطعة «${p.name.ar}»؟` }, ...b, explain: p.does },
    ];
  });
}

export function lessonQuestions(lessons: Lesson[]): Question[] {
  return lessons.flatMap((l) => l.stops.map((s) => ({ id: `l:${l.id}:${s.id}`, source: 'lessons' as const, context: l.title, prompt: s.question, options: s.options, answer: s.answer, explain: s.explain })));
}

export function safetyQuestions(scenarios: Scenario[], rnd = Math.random): Question[] {
  const outcomes = scenarios.flatMap((sc) => sc.actions.flatMap((a) => (a.hazards ?? []).map((h) => ({ sc, o: h.outcome }))));
  const unique = outcomes.filter((x, i) => outcomes.findIndex((y) => y.o.id === x.o.id) === i);
  return unique.map(({ sc, o }) => ({
    id: `s:${sc.id}:${o.id}`, source: 'safety' as const, context: sc.title,
    prompt: { en: `What rule prevents this? ${o.title.en}`, ar: `ما القاعدة التي تمنع هذا؟ ${o.title.ar}` },
    ...choices(o.rule, unique.map((u) => u.o.rule), rnd),
  }));
}

/** A mistake saved to the locker keeps its question, so it can be asked again. */
export function mistakeQuestions(items: LockerItem[]): Question[] {
  return items.filter((i) => i.kind === 'mistake' && i.value?.q).map((i) => ({ ...(i.value!.q as Question), id: `m:${i.id}`, source: 'mistakes' as const }));
}

export function buildQuiz(pools: Record<Source, Question[]>, sources: Source[], n: number, rnd = Math.random): Question[] {
  const live = sources.filter((s) => pools[s].length);
  if (!live.length) return [];
  // Round-robin across the chosen sources so a big pool does not crowd out a small one.
  const decks = live.map((s) => shuffle(pools[s], rnd));
  const out: Question[] = [];
  for (let i = 0; out.length < n && decks.some((d) => d.length); i++) {
    const d = decks[i % decks.length]!;
    const q = d.shift();
    if (q && !out.some((x) => x.id === q.id)) out.push(q);
  }
  return out;
}

export const practiceRef = (sources: Source[]) => `practice:${[...sources].sort().join('+')}`;

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------
/** Per-criterion difference between two attempts, matched by key (or label when keys differ). */
export function diffCriteria(a: AttemptRecord, b: AttemptRecord) {
  const keys = [...new Set([...(a.criteria ?? []).map((c) => c.key), ...(b.criteria ?? []).map((c) => c.key)])];
  return keys.map((k) => {
    const x = a.criteria?.find((c) => c.key === k);
    const y = b.criteria?.find((c) => c.key === k);
    return { key: k, label: (x ?? y)!.label, a: x?.score, b: y?.score, delta: x && y ? y.score - x.score : undefined };
  });
}
