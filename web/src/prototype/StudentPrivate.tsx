/**
 * Student → Private. The prototype keeps each learner's space in this
 * browser (one per trade, since each trade has its own sample learner) and
 * starts it with a week of sample study so Compare and the desk have
 * something to show.
 */
import { useMemo } from 'react';
import { PrivateSpace } from '../components/private/PrivateSpace';
import { dayKey, emptyState, partsOf, practiceRef, review, type Catalog, type PrivateState } from '../components/private/model';
import { localAdapter } from '../components/private/store';
import { useStore } from './store';
import { TRADES, type Trade } from './trades';
import { tx } from './i18n';

const catalog = (home: string): Catalog => ({
  home,
  trades: TRADES.map((t) => ({ id: t.id, name: t.name, accent: t.accent, models: t.models, lessons: t.lessons, safety: t.safety })),
});

const daysAgo = (d: number, h = 17) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 10 * d % 60, 0, 0); return x; };
const iso = (d: number, h?: number) => daysAgo(d, h).toISOString();

/** A believable first week: some cards learnt, two V-Lab tries, a lesson twice, three practice rounds and a few things saved. */
function sample(trade: Trade, cat: Catalog): PrivateState {
  const s = emptyState();
  const t = cat.trades.find((x) => x.id === trade.id)!;
  const parts = t.models.flatMap((m) => partsOf(m, t)).filter((p) => p.what);
  // Cards: the first few seen a few times, so some are due and some are mastered.
  parts.slice(0, 7).forEach((p, i) => {
    let c = review(undefined, i % 3 !== 2, daysAgo(6));
    if (i < 5) c = review(c, true, daysAgo(4));
    if (i < 3) c = review(c, true, daysAgo(2));
    if (i < 2) c = review(c, true, daysAgo(1));
    s.cards[p.key] = c;
  });
  const crit = (scores: number[]) => trade.lab.rubric.criteria.map((c, i) => ({ key: c.key, label: trade.lab.criterionLabels[c.key] ?? tx(c.key, c.key), score: scores[i % scores.length]! }));
  const lesson = t.lessons[0];
  const lessonTry = (d: number, right: boolean[]) => lesson && ({
    id: `sample-lesson-${d}`, at: iso(d, 18), kind: 'lesson' as const, ref: lesson.id, title: lesson.title,
    score: Math.round((100 * lesson.stops.filter((_, i) => right[i % right.length]).length) / Math.max(1, lesson.stops.length)),
    criteria: lesson.stops.map((st, i) => ({ key: st.id, label: st.question, score: right[i % right.length] ? 100 : 0 })),
  });
  const pr = practiceRef(['parts', 'lessons', 'safety']);
  const practice = (d: number, score: number, p: number, l: number, sf: number) => ({
    id: `sample-practice-${d}`, at: iso(d, 20), kind: 'practice' as const, ref: pr, score, mode: '10q',
    title: tx('Practice · Machine parts, Lesson checkpoints, Safety rules', 'تدريب · أجزاء الماكينات، نقاط تحقق الدروس، قواعد السلامة'),
    criteria: [{ key: 'parts', label: tx('Machine parts', 'أجزاء الماكينات'), score: p }, { key: 'lessons', label: tx('Lesson checkpoints', 'نقاط تحقق الدروس'), score: l }, { key: 'safety', label: tx('Safety rules', 'قواعد السلامة'), score: sf }],
  });
  s.history = [
    practice(0, 80, 75, 100, 67),
    { id: 'sample-vlab-1', at: iso(1, 11), kind: 'vlab', ref: trade.lab.code, title: trade.lab.title, score: 82, passed: true, mode: 'Guided', criteria: crit([100, 85, 70, 90, 60]) },
    lessonTry(2, [true, true, false]),
    practice(3, 60, 50, 67, 67),
    lessonTry(4, [true, false, false]),
    { id: 'sample-vlab-0', at: iso(4, 10), kind: 'vlab', ref: trade.lab.code, title: trade.lab.title, score: 58, passed: false, mode: 'Guided', criteria: crit([100, 40, 55, 60, 35]) },
    practice(5, 50, 50, 33, 67),
  ].filter((x) => !!x) as PrivateState['history'];
  const m = t.models[0]!;
  s.items = [
    ...parts.slice(0, 2).map((p, i) => ({ id: `sample-part-${i}`, kind: 'part' as const, at: iso(5 - i, 16), title: p.name, ref: { model: m.id, part: p.id },
      body: `${p.what!.en}\n${p.does!.en}`, tags: [m.title.en.split(' · ')[0]!], pinned: i === 0 })),
    ...(lesson ? [{ id: 'sample-lesson', kind: 'lesson' as const, at: iso(2, 18), title: lesson.title, body: lesson.summary.en, ref: { lesson: lesson.id }, value: { score: 67 }, tags: [] }] : []),
    { id: 'sample-note', kind: 'note', at: iso(1, 21), title: tx('Questions for my trainer', 'أسئلة لمدربي'), pinned: true, tags: ['ask'],
      body: trade.id === 'auto' ? 'Why does the starter click but not turn?\nWhat torque for the sump plug?' : trade.id === 'elec' ? 'When do I use the clamp meter instead of the multimeter?\nWhy is the overload set to 1.05 × FLC?'
        : trade.id === 'weld' ? 'Which gas mix for stainless?\nHow do I read porosity in the bead?' : 'Why do we touch off every tool?\nWhat feed for the finishing pass on C45?' },
    { id: 'sample-result', kind: 'result', at: iso(1, 11), title: trade.lab.title, ref: { lab: trade.lab.code }, value: { score: 82, passed: true, criteria: crit([100, 85, 70, 90, 60]) },
      body: 'Guided attempt', tags: [] },
  ];
  s.goals = [
    { id: 'g1', text: `Know every part of the ${m.title.en.split(' · ')[0]}`, done: false, at: iso(6) },
    { id: 'g2', text: 'Pass the V-Lab in Guided mode', done: true, at: iso(6) },
    { id: 'g3', text: 'Score 90 in practice before the exam', done: false, at: iso(3) },
  ];
  [[6, 25, 6, 1], [5, 15, 4, 1], [4, 25, 5, 0], [3, 0, 3, 1], [2, 45, 4, 0], [1, 25, 2, 0]].forEach(([d, mins, reviews, practiceN]) => {
    s.activity[dayKey(daysAgo(d!))] = { mins: mins!, reviews: reviews!, practice: practiceN! };
  });
  return s;
}

export function StudentPrivate({ active }: { active: boolean }) {
  const { trade, lang } = useStore();
  const cat = useMemo(() => catalog(trade.id), [trade.id]);
  const adapter = useMemo(() => localAdapter(`vtc_lms.private.v1.${trade.id}`, () => sample(trade, cat)), [trade, cat]);
  return <PrivateSpace key={trade.id} lang={lang} catalog={cat} owner={{ name: trade.learner.name }} adapter={adapter} listen active={active} />;
}
