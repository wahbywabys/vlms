'use client';
/**
 * Theory and applied assessment player: multiple choice, calculation,
 * parameterised calculation (every learner gets their own numbers, graded
 * against the tolerance band drawn for them) and schematic pinpointing
 * (drop pins on the fault in a wiring diagram or weld macro).
 *
 * Pins are recorded in the drawing's own coordinates (its viewBox), so the
 * grade does not depend on the screen or zoom. After submitting, each item
 * shows the expected answer and band, or the target regions with the pins.
 */
import { useRef, useState, type PointerEvent } from 'react';
import { cx, fmt, pickAr, type Ui } from './types';

interface Base { id: string; code: string; maxPoints: number; stem: string; stemAr: string | null }
export type Item = Base & (
  | { type: 'mcq'; options: { id: string; en: string; ar: string }[] }
  | { type: 'calculation'; unit: string | null }
  | { type: 'parametric'; unit: string | null; decimals: number | null }
  | { type: 'hotspot'; maxPins: number; targets: number; schematic: { code: string; title: string; titleAr: string | null; kind: string; viewBox: string; svg: string } | null }
);
export interface Sitting { assessmentId: string; items: Item[] }
type Region = { key: string; role: 'target' | 'distractor'; shape: 'circle' | 'rect' | 'polygon'; cx?: number; cy?: number; r?: number; x?: number; y?: number; w?: number; h?: number;
  points?: [number, number][]; feedback?: { en: string; ar: string } };
export interface ItemResult { id: string; type: string; correct: boolean; points: number; maxPoints: number; key?: unknown; band?: number; given?: unknown; deviation?: number | null;
  pins?: { x: number; y: number }[]; regions?: Region[]; missed?: string[]; distractorHits?: string[] }
export interface Graded { score: number; max: number; items: ItemResult[] }
export type Response = string | { pins: { x: number; y: number }[] };

const TYPE: Record<Item['type'], [string, string]> = {
  mcq: ['Multiple choice', 'اختيار من متعدد'], calculation: ['Calculation', 'مسألة حسابية'],
  parametric: ['Your own numbers', 'أرقام خاصة بك'], hotspot: ['Find it on the drawing', 'حدّده على المخطط'],
};

export function AssessmentPlayer({ ui, sitting, onSubmit, onRestart }: { ui: Ui; sitting: Sitting; onSubmit: (r: Record<string, Response>) => Promise<Graded>; onRestart?: () => void }) {
  const { L } = ui;
  const [resp, setResp] = useState<Record<string, Response>>({});
  const [graded, setGraded] = useState<Graded | null>(null);
  const [busy, setBusy] = useState(false);
  const answered = sitting.items.filter((i) => { const r = resp[i.id]; return typeof r === 'string' ? r.trim() !== '' : Boolean(r?.pins.length); }).length;
  const res = (id: string) => graded?.items.find((r) => r.id === id);
  return (
    <div className="flex flex-col gap-3 font-body text-ink">
      {graded && (
        <section className="flex items-center gap-4 rounded-2xl bg-navy p-4 text-on-brand shadow-lift" aria-live="polite">
          <p className="font-display text-5xl font-bold">{Math.round((100 * graded.score) / Math.max(1, graded.max))}%</p>
          <p className="flex-1">{L(`${fmt(ui, graded.score, 1)} of ${graded.max} marks · ${graded.items.filter((i) => i.correct).length}/${graded.items.length} correct`, `${fmt(ui, graded.score, 1)} من ${graded.max} درجة · ${graded.items.filter((i) => i.correct).length}/${graded.items.length} صحيحة`)}</p>
          {onRestart && <button type="button" onClick={onRestart} className="tw-reset h-12 rounded-xl bg-accent px-4 font-bold text-white">{L('New sitting', 'محاولة جديدة')}</button>}
        </section>
      )}
      <ol className="m-0 list-none p-0 flex flex-col gap-3">
        {sitting.items.map((it, n) => {
          const r = res(it.id);
          return (
            <li key={it.id} className={cx('rounded-2xl border-2 bg-sheet p-4 shadow-card', !r ? 'border-transparent' : r.correct ? 'border-ok' : 'border-bad')}>
              <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <span className="font-mono">{n + 1}. {it.code}</span>
                <span className="rounded-full bg-sunk px-2 py-0.5 font-semibold">{ui.lang === 'ar' ? TYPE[it.type][1] : TYPE[it.type][0]}</span>
                <span>{L(`${it.maxPoints} mark${it.maxPoints === 1 ? '' : 's'}`, `${it.maxPoints} درجة`)}</span>
                {r && <span className={cx('ms-auto font-bold', r.correct ? 'text-ok' : 'text-bad')}>{r.correct ? '✓' : '✗'} {fmt(ui, r.points, 1)}/{r.maxPoints}</span>}
              </p>
              <p className="mb-3 text-lg font-semibold leading-snug" dir="auto">{pickAr(ui, it.stem, it.stemAr)}</p>
              {it.type === 'mcq' && (
                <div className="flex flex-col gap-2" role="radiogroup">
                  {it.options.map((o) => {
                    const on = resp[it.id] === o.id, key = r?.key === o.id;
                    return (
                      <button key={o.id} type="button" role="radio" aria-checked={on} disabled={Boolean(graded)} onClick={() => setResp((x) => ({ ...x, [it.id]: o.id }))}
                        className={cx('tw-reset min-h-14 rounded-xl border-2 px-4 py-2 text-start', key ? 'border-ok bg-ok-soft' : on && r ? 'border-bad bg-bad-soft' : on ? 'border-accent bg-accent-soft' : 'border-rule bg-sunk')}>
                        {pickAr(ui, o.en, o.ar)}
                      </button>
                    );
                  })}
                </div>
              )}
              {(it.type === 'calculation' || it.type === 'parametric') && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2" dir="ltr">
                    <input inputMode="decimal" disabled={Boolean(graded)} value={typeof resp[it.id] === 'string' ? (resp[it.id] as string) : ''}
                      onChange={(e) => setResp((x) => ({ ...x, [it.id]: e.target.value }))} aria-label={L('Your answer', 'إجابتك')}
                      className="tw-reset h-14 w-48 rounded-xl border-2 border-rule bg-sunk px-3 text-center font-mono text-xl" />
                    {it.unit && <span className="font-mono text-ink-2">{it.unit}</span>}
                  </div>
                  {it.type === 'parametric' && it.decimals != null && !r && <p className="text-xs text-ink-3">{L(`Give your answer to ${it.decimals} decimal place${it.decimals === 1 ? '' : 's'}.`, `اكتب إجابتك لأقرب ${it.decimals} منزلة عشرية.`)}</p>}
                  {r && <p className={cx('text-sm', r.correct ? 'text-ok' : 'text-bad')} dir="ltr">
                    {L('Expected', 'المتوقع')} {String(r.key)}{r.band ? ` ± ${+(r.band as number).toPrecision(3)}` : ''}{it.unit ? ` ${it.unit}` : ''}
                    {r.deviation != null && <> · {L('you were off by', 'فرق إجابتك')} {+Math.abs(r.deviation).toPrecision(3)}</>}
                  </p>}
                </div>
              )}
              {it.type === 'hotspot' && it.schematic && (
                <Pinboard ui={ui} item={it} result={r} disabled={Boolean(graded)}
                  pins={typeof resp[it.id] === 'object' ? (resp[it.id] as { pins: { x: number; y: number }[] }).pins : []}
                  onPins={(pins) => setResp((x) => ({ ...x, [it.id]: { pins } }))} />
              )}
            </li>
          );
        })}
      </ol>
      {!graded && (
        <div className="sticky bottom-2 flex items-center gap-3 rounded-2xl bg-navy p-3 text-on-brand shadow-lift">
          <p className="flex-1">{L(`${answered} of ${sitting.items.length} answered`, `أُجيب عن ${answered} من ${sitting.items.length}`)}</p>
          <button type="button" disabled={busy || answered === 0} onClick={async () => { setBusy(true); try { setGraded(await onSubmit(resp)); } finally { setBusy(false); } }}
            className="tw-reset h-14 rounded-xl bg-accent px-6 font-display text-lg font-bold text-white disabled:opacity-40">{busy ? '…' : L('Submit for marking', 'أرسل للتصحيح')}</button>
        </div>
      )}
    </div>
  );
}

function Pinboard({ ui, item, pins, onPins, result, disabled }: { ui: Ui; item: Extract<Item, { type: 'hotspot' }>; pins: { x: number; y: number }[];
  onPins: (p: { x: number; y: number }[]) => void; result?: ItemResult; disabled: boolean }) {
  const { L } = ui;
  const svg = useRef<SVGSVGElement>(null);
  const s = item.schematic!;
  const [, , vw = 800] = s.viewBox.split(/\s+/).map(Number);
  const pinR = vw / 60;
  const drop = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled || !svg.current) return;
    const m = svg.current.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const near = pins.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < pinR * 1.6);
    if (near >= 0) { onPins(pins.filter((_, i) => i !== near)); return; }    // tap a pin again to lift it
    if (pins.length >= item.maxPins) return;
    onPins([...pins, { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }]);
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ink-2">{L(`Tap the drawing to drop a pin on each fault (${item.targets} to find, up to ${item.maxPins} pins). Tap a pin to lift it.`, `اضغط على المخطط لوضع دبوس على كل عطل (${item.targets} للعثور عليها، حتى ${item.maxPins} دبابيس). اضغط على الدبوس لإزالته.`)}</p>
      <div className="overflow-hidden rounded-xl border-2 border-rule bg-sunk text-ink">
        <svg ref={svg} viewBox={s.viewBox} className={cx('block w-full touch-manipulation', !disabled && 'cursor-crosshair')} onPointerUp={drop} role="img"
          aria-label={pickAr(ui, s.title, s.titleAr)}>
          <g dangerouslySetInnerHTML={{ __html: s.svg }} />
          {result?.regions?.map((r) => {
            const stroke = r.role === 'target' ? 'var(--ok)' : 'var(--bad)';
            const common = { fill: r.role === 'target' ? 'color-mix(in oklab, var(--ok) 18%, transparent)' : 'none', stroke, strokeWidth: 2, strokeDasharray: r.role === 'target' ? undefined : '6 4' };
            return r.shape === 'circle' ? <circle key={r.key} cx={r.cx} cy={r.cy} r={r.r} {...common} />
              : r.shape === 'rect' ? <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} rx={4} {...common} />
              : <polygon key={r.key} points={r.points!.map((p) => p.join(',')).join(' ')} {...common} />;
          })}
          {pins.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`}>
              <circle r={pinR} fill="var(--accent)" stroke="var(--sheet)" strokeWidth={pinR / 4} />
              <text y={pinR / 2.6} textAnchor="middle" fontSize={pinR * 1.1} fontWeight="700" fill="#fff">{i + 1}</text>
            </g>
          ))}
        </svg>
      </div>
      {result && (
        <ul className="m-0 list-none p-0 flex flex-col gap-1 text-sm">
          {result.regions?.filter((r) => r.role === 'target').map((r) => {
            const missed = result.missed?.includes(r.key);
            return <li key={r.key} className={missed ? 'text-bad' : 'text-ok'}>{missed ? '✗' : '✓'} <span className="font-mono">{r.key}</span>{r.feedback ? ` · ${pickAr(ui, r.feedback.en, r.feedback.ar)}` : ''}</li>;
          })}
          {result.regions?.filter((r) => result.distractorHits?.includes(r.key)).map((r) => (
            <li key={r.key} className="text-amber">◆ <span className="font-mono">{r.key}</span>{r.feedback ? ` · ${pickAr(ui, r.feedback.en, r.feedback.ar)}` : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
