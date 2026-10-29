// Copied from app/src/components/modules/SkillsHeatmap.tsx by scripts/sync-modules.sh. Edit the original, not this file.
'use client';
/**
 * Executive skills heatmap (director / IQA, desktop or wall screen).
 *
 *   ┌ filters: cohort ───────────────── legend: Not yet · Novice · Intermediate · Autonomous · Master ┐
 *   │ readiness by element: 100% stacked bars, grouped under their national unit                      │
 *   │ learner × element matrix (one hue, light → dark, letter in every cell)  │ radar: learner vs cohort│
 *   └ weekly level-ups ──────────────────────────────────────────────────────┘
 *
 * Levels are ordinal, so the colour is one sequential hue (the trade's
 * --seq token) stepped light → dark, and every cell also carries its letter
 * (N, I, A, M), so nothing is told by colour alone. Elements come from the
 * national occupational standard the trade's framework is built on.
 */
import { useMemo, useState } from 'react';
import { cx, fmt, LEVEL_TXT, LEVELS, pickAr, pickBi, type Level, type Ui } from './types';

export interface HeatUnit { cohortId: string; cohort: string; cohortAr: string | null; competencyId: string; code: string; title: string; titleAr: string | null;
  unitCode: string | null; unitTitle: string | null; unitTitleAr: string | null; notYet: number; novice: number; intermediate: number; autonomous: number; master: number;
  learners: number; meanLevel: number | null }
export interface HeatCell { learnerId: string; name: string; nameAr: string | null; cohortId: string; code: string; level: Level; score: number | null }
export interface RadarPoint { code: string; title: string; titleAr: string | null; level: Level; score: number | null; cohortMean: number | null }
export interface SkillsData { units: HeatUnit[]; grid: HeatCell[]; flow: { week: string; level: Level; n: number }[] }

const SHADE: Record<Level, string> = { not_yet: '6%', novice: '26%', intermediate: '50%', autonomous: '74%', master: '100%' };
const levelBg = (l: Level) => `color-mix(in oklab, var(--seq) ${SHADE[l]}, var(--sheet))`;
const levelInk = (l: Level) => (l === 'autonomous' || l === 'master' ? 'var(--sheet)' : 'var(--ink)');
const LETTER: Record<Level, Record<'en' | 'ar', string>> = {
  not_yet: { en: '·', ar: '·' }, novice: { en: 'N', ar: 'م' }, intermediate: { en: 'I', ar: 'ت' }, autonomous: { en: 'A', ar: 'س' }, master: { en: 'M', ar: 'خ' },
};
/** "AUTO-L3-U01-E2" → "U01-E2": the unit and element, which is what differs within a trade. */
const short = (code: string) => code.split(/[-.]/).slice(-2).join('-');
const IDX: Record<Level, number> = { not_yet: 0, novice: 1, intermediate: 2, autonomous: 3, master: 4 };

export function SkillsHeatmap({ ui, data, loadLearner, standard }: { ui: Ui; data: SkillsData;
  loadLearner: (learnerId: string) => Promise<RadarPoint[]>; standard?: string }) {
  const { L } = ui;
  const cohorts = useMemo(() => [...new Map(data.units.map((u) => [u.cohortId, { id: u.cohortId, name: pickAr(ui, u.cohort, u.cohortAr) }])).values()], [data.units, ui]);
  const [cohort, setCohort] = useState(cohorts[0]?.id ?? '');
  const [sel, setSel] = useState<{ id: string; name: string; radar: RadarPoint[] | null } | null>(null);
  const [hover, setHover] = useState<{ cell: HeatCell; title: string } | null>(null);

  const units = data.units.filter((u) => u.cohortId === cohort);
  const groups = useMemo(() => {
    const m = new Map<string, { code: string; title: string; els: HeatUnit[] }>();
    for (const u of units) {
      const k = u.unitCode ?? '—';
      if (!m.has(k)) m.set(k, { code: k, title: pickAr(ui, u.unitTitle, u.unitTitleAr), els: [] });
      m.get(k)!.els.push(u);
    }
    return [...m.values()];
  }, [units, ui]);
  const codes = groups.flatMap((g) => g.els.map((e) => e.code));
  const learners = useMemo(() => {
    const m = new Map<string, { id: string; name: string; cells: Map<string, HeatCell>; mean: number }>();
    for (const c of data.grid) {
      if (c.cohortId !== cohort) continue;
      if (!m.has(c.learnerId)) m.set(c.learnerId, { id: c.learnerId, name: pickAr(ui, c.name, c.nameAr), cells: new Map(), mean: 0 });
      m.get(c.learnerId)!.cells.set(c.code, c);
    }
    for (const l of m.values()) l.mean = [...l.cells.values()].reduce((a, c) => a + IDX[c.level], 0) / Math.max(1, l.cells.size);
    return [...m.values()].sort((a, b) => b.mean - a.mean);
  }, [data.grid, cohort, ui]);
  const ready = units.reduce((a, u) => a + u.autonomous + u.master, 0), cells = units.reduce((a, u) => a + u.learners, 0);
  const titleOf = (code: string) => { const u = units.find((x) => x.code === code); return u ? pickAr(ui, u.title, u.titleAr) : code; };

  const pick = async (id: string, name: string) => {
    setSel({ id, name, radar: null });
    const radar = await loadLearner(id).catch(() => []);
    setSel((s) => (s?.id === id ? { ...s, radar } : s));
  };

  return (
    <div className="flex flex-col gap-4 font-body text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={L('Cohort', 'المجموعة')} className="flex flex-wrap gap-1 rounded-xl bg-sunk p-1">
          {cohorts.map((c) => (
            <button key={c.id} role="tab" type="button" aria-selected={c.id === cohort} onClick={() => { setCohort(c.id); setSel(null); }}
              className="tw-reset h-10 rounded-lg px-3 text-sm font-semibold text-ink-2 aria-selected:bg-sheet aria-selected:text-ink aria-selected:shadow-card">{c.name}</button>
          ))}
        </div>
        <Legend ui={ui} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={L('Element sign-offs at Autonomous or Master', 'العناصر المعتمدة بمستوى مستقل أو متمكن')} value={cells ? `${Math.round((100 * ready) / cells)}%` : '—'} />
        <Stat label={L('Learners in cohort', 'المتدربون في المجموعة')} value={fmt(ui, learners.length)} />
        <Stat label={L('Elements in the standard', 'عناصر المعيار')} value={fmt(ui, codes.length)} sub={standard} />
      </div>

      <section className="rounded-2xl bg-sheet p-4 shadow-card" aria-label={L('Readiness by element', 'الجاهزية حسب العنصر')}>
        <h3 className="font-display text-lg font-bold">{L('Readiness by element', 'الجاهزية حسب العنصر')}</h3>
        <p className="mb-3 text-sm text-ink-3">{L('Share of learners at each level, grouped by national unit', 'نسبة المتدربين في كل مستوى، مجمّعة حسب الوحدة الوطنية')}</p>
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.code}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-3"><span className="font-mono">{g.code}</span> · {g.title}</p>
              <div className="flex flex-col gap-1">
                {g.els.map((e) => {
                  const tot = Math.max(1, e.learners);
                  return (
                    <div key={e.code} className="grid grid-cols-[minmax(8rem,16rem)_1fr_3rem] items-center gap-2 text-sm">
                      <span className="truncate" title={pickAr(ui, e.title, e.titleAr)}><span className="font-mono text-xs text-ink-3">{e.code}</span> {pickAr(ui, e.title, e.titleAr)}</span>
                      <div className="flex h-5 gap-[2px] overflow-hidden rounded" dir="ltr" role="img"
                        aria-label={LEVELS.map((l) => `${pickBi(ui, LEVEL_TXT[l])} ${e[l === 'not_yet' ? 'notYet' : l]}`).join(', ')}>
                        {LEVELS.map((l) => {
                          const n = e[l === 'not_yet' ? 'notYet' : l];
                          return n ? <span key={l} title={`${pickBi(ui, LEVEL_TXT[l])}: ${n}`} style={{ width: `${(100 * n) / tot}%`, background: levelBg(l) }}
                            className={cx('h-full', l === 'not_yet' && 'outline outline-1 -outline-offset-1 outline-rule')} /> : null;
                        })}
                      </div>
                      <span className="text-end font-mono text-xs text-ink-2">{Math.round((100 * (e.autonomous + e.master)) / tot)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="relative overflow-x-auto rounded-2xl bg-sheet p-4 shadow-card" aria-label={L('Learner by element', 'المتدرب حسب العنصر')}>
          <h3 className="font-display text-lg font-bold">{L('Learner × element', 'المتدرب × العنصر')}</h3>
          <p className="mb-3 text-sm text-ink-3">{L('Tap a learner for their radar', 'اضغط على متدرب لعرض المخطط الراداري')}</p>
          <table className="border-separate border-spacing-[2px] text-xs">
            <thead>
              <tr>
                <th className="sticky start-0 z-10 bg-sheet" />
                {groups.map((g) => <th key={g.code} colSpan={g.els.length} className="whitespace-nowrap border-b-2 border-rule px-1 pb-1 text-start font-mono font-semibold text-ink-3" title={g.title}>{g.code.split(/[-.]/).at(-1)}</th>)}
              </tr>
              <tr>
                <th className="sticky start-0 z-10 bg-sheet" />
                {codes.map((c) => <th key={c} className="h-16 w-8 pb-1 align-bottom font-mono font-normal text-ink-3"><span className="inline-block rotate-180 whitespace-nowrap [writing-mode:vertical-rl]" title={titleOf(c)}>{short(c)}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.id}>
                  <th scope="row" className="sticky start-0 z-10 bg-sheet pe-2 text-start font-normal">
                    <button type="button" onClick={() => void pick(l.id, l.name)}
                      className={cx('tw-reset max-w-40 truncate rounded px-1 py-1 text-sm', sel?.id === l.id ? 'bg-accent-soft font-semibold text-accent-ink' : 'hover:bg-sunk')}>{l.name}</button>
                  </th>
                  {codes.map((c) => {
                    const cell = l.cells.get(c);
                    const lv = cell?.level ?? 'not_yet';
                    return (
                      <td key={c} className="h-8 w-8 rounded text-center font-bold" style={{ background: levelBg(lv), color: levelInk(lv) }}
                        onMouseEnter={() => cell && setHover({ cell, title: titleOf(c) })} onMouseLeave={() => setHover(null)}
                        title={`${l.name} · ${c} ${titleOf(c)}: ${pickBi(ui, LEVEL_TXT[lv])}${cell?.score != null ? ` (${Math.round(cell.score)})` : ''}`}>
                        {LETTER[lv][ui.lang]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {hover && (
            <div className="pointer-events-none absolute end-4 top-4 rounded-xl bg-ink px-3 py-2 text-xs text-paper shadow-lift" role="status">
              <p className="font-semibold">{pickAr(ui, hover.cell.name, hover.cell.nameAr)}</p>
              <p><span className="font-mono">{hover.cell.code}</span> {hover.title}</p>
              <p>{pickBi(ui, LEVEL_TXT[hover.cell.level])}{hover.cell.score != null ? ` · ${Math.round(hover.cell.score)}` : ''}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-sheet p-4 shadow-card" aria-label={L('Learner radar', 'المخطط الراداري للمتدرب')}>
          <h3 className="font-display text-lg font-bold">{sel ? sel.name : L('Learner radar', 'المخطط الراداري')}</h3>
          {!sel && <p className="text-sm text-ink-3">{L('Pick a learner in the matrix to compare them with the cohort.', 'اختر متدربًا من المصفوفة لمقارنته بالمجموعة.')}</p>}
          {sel && !sel.radar && <p className="text-sm text-ink-3">…</p>}
          {sel?.radar && <Radar ui={ui} points={sel.radar} />}
        </section>
      </div>

      {data.flow.length > 0 && <Flow ui={ui} flow={data.flow} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-sheet p-4 shadow-card">
      <p className="text-sm text-ink-3">{label}</p>
      <p className="font-display text-4xl font-bold">{value}</p>
      {sub && <p className="truncate text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

export function Legend({ ui }: { ui: Ui }) {
  return (
    <ul className="m-0 list-none p-0 flex flex-wrap items-center gap-3 text-xs text-ink-2" aria-label={ui.L('Levels', 'المستويات')}>
      {LEVELS.map((l) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold outline outline-1 -outline-offset-1 outline-rule" style={{ background: levelBg(l), color: levelInk(l) }}>{LETTER[l][ui.lang]}</span>
          {pickBi(ui, LEVEL_TXT[l])}
        </li>
      ))}
    </ul>
  );
}

/** Learner (solid) against the cohort mean (dashed), one spoke per element, rings at each level. */
export function Radar({ ui, points }: { ui: Ui; points: RadarPoint[] }) {
  const n = points.length, R = 110, c = 150;
  const [hover, setHover] = useState<number | null>(null);
  if (n < 3) return <p className="text-sm text-ink-3">{ui.L('Not enough elements to draw a radar.', 'لا توجد عناصر كافية لرسم المخطط.')}</p>;
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [c + Math.cos(a) * (R * v) / 4, c + Math.sin(a) * (R * v) / 4] as const;
  };
  const path = (vals: number[]) => vals.map((v, i) => at(i, v).join(',')).join(' ');
  const me = points.map((p) => IDX[p.level]), cohort = points.map((p) => p.cohortMean ?? 0);
  return (
    <div>
      <svg viewBox="-10 0 320 300" className="w-full" role="img" aria-label={points.map((p) => `${p.code}: ${pickBi(ui, LEVEL_TXT[p.level])}`).join('; ')}>
        {[1, 2, 3, 4].map((k) => <polygon key={k} points={path(points.map(() => k))} fill="none" stroke="var(--rule)" strokeWidth="1" />)}
        {points.map((_, i) => { const [x, y] = at(i, 4); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--rule)" strokeWidth="1" />; })}
        <polygon points={path(cohort)} fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeDasharray="5 4" />
        <polygon points={path(me)} fill="color-mix(in oklab, var(--accent) 18%, transparent)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => {
          const [x, y] = at(i, me[i]!), [lx, ly] = at(i, 4.75);
          return (
            <g key={p.code} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x} cy={y} r="12" fill="transparent" />
              <circle cx={x} cy={y} r="4.5" fill="var(--accent)" stroke="var(--sheet)" strokeWidth="2" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="var(--ink-2)" fontFamily="var(--f-mono)">{short(p.code)}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-accent" />{ui.L('Learner', 'المتدرب')}</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-ink-3" />{ui.L('Cohort mean', 'متوسط المجموعة')}</span>
      </div>
      <p className="mt-2 min-h-10 text-sm" aria-live="polite">
        {hover !== null && <><span className="font-mono text-xs text-ink-3">{points[hover]!.code}</span> {pickAr(ui, points[hover]!.title, points[hover]!.titleAr)}:{' '}
          <b>{pickBi(ui, LEVEL_TXT[points[hover]!.level])}</b> · {ui.L('cohort', 'المجموعة')} {fmt(ui, points[hover]!.cohortMean ?? 0, 1)}</>}
      </p>
    </div>
  );
}

/** Weekly count of level-ups, stacked by the level reached. */
function Flow({ ui, flow }: { ui: Ui; flow: { week: string; level: Level; n: number }[] }) {
  const weeks = [...new Set(flow.map((f) => f.week.slice(0, 10)))].sort();
  const per = weeks.map((w) => LEVELS.slice(1).map((l) => flow.find((f) => f.week.slice(0, 10) === w && f.level === l)?.n ?? 0));
  const max = Math.max(1, ...per.map((p) => p.reduce((a, b) => a + b, 0)));
  return (
    <section className="rounded-2xl bg-sheet p-4 shadow-card" aria-label={ui.L('Level-ups per week', 'الترقيات في المستوى أسبوعيًا')}>
      <h3 className="font-display text-lg font-bold">{ui.L('Level-ups per week', 'الترقيات في المستوى أسبوعيًا')}</h3>
      <p className="mb-3 text-sm text-ink-3">{ui.L('Element sign-offs that moved a learner up a level, by the level reached', 'اعتمادات العناصر التي رفعت مستوى المتدرب، حسب المستوى المحقق')}</p>
      <div className="flex h-36 items-end gap-2" dir="ltr">
        {weeks.map((w, i) => (
          <div key={w} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${w}: ${per[i]!.reduce((a, b) => a + b, 0)}`}>
            <div className="flex w-full max-w-10 flex-col-reverse gap-[2px]">
              {per[i]!.map((n, k) => n ? <span key={k} className="w-full first:rounded-b last:rounded-t" style={{ height: `${(n / max) * 112}px`, background: levelBg(LEVELS[k + 1]!) }} /> : null)}
            </div>
            <span className="font-mono text-[10px] text-ink-3">{new Date(w).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
