'use client';
/**
 * Tablet shop-floor rubric: single-tap scoring with instant photo capture.
 *
 * Built for a trainer walking the floor with a 10–11" tablet, often in
 * gloves: every control is at least 56 px tall, a criterion is scored with
 * one tap, and the camera opens straight from the criterion it documents.
 *
 *   ┌ header: learner · station · job card ─────────────── score ring ┐
 *   │ [PPE] PPE worn             GATE   [ ✓ Met ] [ ✗ Not met ]   📷  │
 *   │ [⚙] Machine setup                 [1][2][3][4] descriptors  📷  │
 *   │ [📏] Diameter Ø25 h7              [ 24.99 ] ▕──■──▏ in tol  📷  │
 *   │ …                                                              │
 *   └ photos strip · note · verdict · [ Sign off & next station → ] ┘
 *
 * The component is controlled: marks and photos live in the parent, which
 * decides what "sign off" does (POST to the API, queue offline, or the
 * prototype's in-memory store). The score shown is a live preview using the
 * same bands as the API's rubric engine; the saved score comes from the server.
 */
import { useRef, type ReactNode } from 'react';
import { cx, fmt, pickAr, type Bi, type Ui } from './types';

export type Category = 'ppe' | 'safety' | 'hygiene' | 'precision' | 'method' | 'quality';
export interface RubricCriterion {
  key: string;
  label: string;
  labelAr?: string | null;
  weight: number;
  isGate: boolean;
  category?: Category | null;
  rule: 'check' | 'rating' | 'measurement_tolerance';
  /** measurement_tolerance: nominal value, ± band and unit. */
  expected?: number;
  absTol?: number;
  unit?: string;
  descriptors?: { value: string | number; en: string; ar: string }[];
  photoRule?: 'optional' | 'on_fail' | 'always';
}
export type Mark = 'pass' | 'fail' | number | string | undefined;
export type Marks = Record<string, Mark>;
export interface RubricPhoto {
  id: string;
  url: string;
  criterionKey?: string;
  state: 'uploading' | 'saved' | 'queued' | 'failed';
}

/** Same bands as the API's measurement_tolerance rule: full inside, half inside 2×. */
export function toleranceScore(c: Pick<RubricCriterion, 'expected' | 'absTol'>, v: number) {
  const d = Math.abs(v - (c.expected ?? 0)), t = c.absTol ?? 0;
  return d <= t + 1e-12 ? 100 : d <= 2 * t + 1e-12 ? 50 : 0;
}

export function criterionScore(c: RubricCriterion, m: Mark): number | null {
  if (m === undefined || m === '') return null;
  if (c.rule === 'check') return m === 'pass' ? 100 : 0;
  if (c.rule === 'rating') return (Number(m) / 4) * 100;
  const v = Number(String(m).replace(',', '.'));
  return Number.isFinite(v) ? toleranceScore(c, v) : null;
}

export function previewScore(criteria: RubricCriterion[], marks: Marks, passThreshold = 70) {
  let weighted = 0, weights = 0, done = 0;
  const gateFails: string[] = [];
  for (const c of criteria) {
    weights += c.weight;
    const s = criterionScore(c, marks[c.key]);
    if (s === null) continue;
    done++;
    if (c.isGate && s < 100) gateFails.push(c.key);
    weighted += s * c.weight;
  }
  const score = weights ? Math.round((weighted / weights) * 10) / 10 : 0;
  const complete = done === criteria.length;
  return { complete, done, score, gateFails, passed: complete && gateFails.length === 0 && score >= passThreshold };
}

/** Which criteria still need a photo before sign-off. */
export function missingPhotos(criteria: RubricCriterion[], marks: Marks, photos: RubricPhoto[]) {
  return criteria.filter((c) => {
    const s = criterionScore(c, marks[c.key]);
    const needs = c.photoRule === 'always' || (c.photoRule === 'on_fail' && s !== null && s < (c.rule === 'rating' ? 26 : 100));
    return needs && !photos.some((p) => p.criterionKey === c.key);
  }).map((c) => c.key);
}

const ICON: Record<Category, string> = {
  ppe: 'M12 3a7 7 0 0 0-7 7v2h14v-2a7 7 0 0 0-7-7zM3 14h18v2H3zM10 3v5M14 3v5',
  safety: 'M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5zM9 12l2 2 4-4',
  hygiene: 'M5 21h14M7 21V10l5-6 5 6v11M10 14h4',
  precision: 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  method: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  quality: 'M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.5l1.1-6L3.4 9.3l6-.8z',
};
const TONE: Record<Category, string> = {
  ppe: 'bg-amber-soft text-amber', safety: 'bg-bad-soft text-bad', hygiene: 'bg-ok-soft text-ok',
  precision: 'bg-blue-soft text-blue', method: 'bg-sunk text-ink-2', quality: 'bg-accent-soft text-accent-ink',
};
const CAT_TXT: Record<Category, Bi> = {
  ppe: { en: 'PPE', ar: 'معدات الوقاية' }, safety: { en: 'Safety', ar: 'السلامة' }, hygiene: { en: 'Workplace hygiene', ar: 'نظافة مكان العمل' },
  precision: { en: 'Dimensional precision', ar: 'دقة الأبعاد' }, method: { en: 'Method', ar: 'المنهجية' }, quality: { en: 'Quality', ar: 'الجودة' },
};
const DEFAULT_RATINGS: { value: number; en: string; ar: string }[] = [
  { value: 1, en: 'Needs help', ar: 'يحتاج مساعدة' }, { value: 2, en: 'Developing', ar: 'في تطور' },
  { value: 3, en: 'Competent', ar: 'كفء' }, { value: 4, en: 'Excellent', ar: 'ممتاز' },
];
const RATING_TONE = ['', 'aria-checked:bg-bad aria-checked:text-sheet', 'aria-checked:bg-amber-fill aria-checked:text-on-amber',
  'aria-checked:bg-blue aria-checked:text-sheet', 'aria-checked:bg-ok aria-checked:text-sheet'];

function Glyph({ d, className }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={cx('h-6 w-6', className)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const CAMERA = 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';

export function FloorRubric(props: {
  ui: Ui;
  criteria: RubricCriterion[];
  marks: Marks;
  onMark: (key: string, value: Mark) => void;
  photos: RubricPhoto[];
  /** Called with the raw file from the camera; the parent compresses, previews and uploads it. */
  onCapture: (file: File, criterionKey?: string) => void;
  onRemovePhoto: (id: string) => void;
  note: string;
  onNote: (note: string) => void;
  onSignOff: () => void;
  passThreshold?: number;
  busy?: boolean;
  signedOff?: { score: number; passed: boolean } | null;
  header: { learner: string; station?: string | null; job: string; task: string; warning?: string | null };
  /** Shown above the sign-off button, e.g. "offline · 2 queued". */
  status?: ReactNode;
}) {
  const { ui, criteria, marks, photos, signedOff } = props;
  const { L } = ui;
  const live = previewScore(criteria, marks, props.passThreshold);
  const needPhoto = missingPhotos(criteria, marks, photos);
  const canSign = live.complete && needPhoto.length === 0 && !props.busy && !signedOff;
  const shown = signedOff ?? (live.complete ? { score: live.score, passed: live.passed } : null);
  const ring = Math.max(0, Math.min(100, shown?.score ?? (live.done ? live.score : 0)));

  return (
    <section className="flex flex-col gap-3 font-body text-ink" aria-label={L('Rubric', 'معايير التقييم')}>
      <header className="flex items-center gap-4 rounded-2xl bg-sheet p-4 shadow-card">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-3">
            {props.header.station ? `${props.header.station} · ` : ''}{L(`Job card ${props.header.job}`, `بطاقة العمل ${props.header.job}`)}
          </p>
          <h2 className="truncate font-display text-2xl font-bold">{props.header.learner}</h2>
          <p className="truncate text-sm text-ink-2">{props.header.task}</p>
          {props.header.warning && <p className="mt-1 text-sm font-semibold text-bad">{props.header.warning}</p>}
        </div>
        <ScoreRing value={ring} state={!shown ? 'open' : shown.passed ? 'pass' : 'fail'}
          label={shown ? fmt(ui, Math.round(shown.score)) : `${live.done}/${criteria.length}`} />
      </header>

      <ol className="m-0 list-none p-0 flex flex-col gap-2">
        {criteria.map((c) => {
          const m = marks[c.key];
          const s = criterionScore(c, m);
          const cat = c.category ?? (c.isGate ? 'safety' : c.rule === 'measurement_tolerance' ? 'precision' : 'method');
          const mine = photos.filter((p) => p.criterionKey === c.key);
          const wantsPhoto = needPhoto.includes(c.key);
          return (
            <li key={c.key} className={cx('grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-2xl border bg-sheet p-3 shadow-card',
              c.isGate && s !== null && s < 100 ? 'border-bad' : c.isGate ? 'border-amber-fill' : 'border-rule')}>
              <span className={cx('grid h-12 w-12 place-items-center rounded-xl', TONE[cat])} title={pickAr(ui, CAT_TXT[cat].en, CAT_TXT[cat].ar)}>
                <Glyph d={ICON[cat]} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{pickAr(ui, c.label, c.labelAr)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                  <span>{pickAr(ui, CAT_TXT[cat].en, CAT_TXT[cat].ar)}</span>
                  {c.isGate && <span className="rounded-full bg-amber-fill px-2 py-0.5 font-bold text-on-amber">{L('Safety gate', 'شرط أمان')}</span>}
                  {c.photoRule === 'always' && <span className="rounded-full bg-blue-soft px-2 py-0.5 text-blue">{L('Photo needed', 'مطلوب صورة')}</span>}
                  {wantsPhoto && c.photoRule === 'on_fail' && <span className="rounded-full bg-bad-soft px-2 py-0.5 font-semibold text-bad">{L('Photo the issue', 'صوّر المشكلة')}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {mine.map((p) => <Thumb key={p.id} ui={ui} p={p} onRemove={signedOff ? undefined : () => props.onRemovePhoto(p.id)} />)}
                <CameraButton ui={ui} label={L(`Photo for ${c.label}`, `صورة لـ ${pickAr(ui, c.label, c.labelAr)}`)} urgent={wantsPhoto}
                  disabled={Boolean(signedOff)} onFile={(f) => props.onCapture(f, c.key)} />
              </div>
              <div className="col-span-3">
                {c.rule === 'check' && <CheckTap ui={ui} c={c} value={m} onChange={(v) => props.onMark(c.key, v)} disabled={Boolean(signedOff)} />}
                {c.rule === 'rating' && <RatingTap ui={ui} c={c} value={m} onChange={(v) => props.onMark(c.key, v)} disabled={Boolean(signedOff)} />}
                {c.rule === 'measurement_tolerance' && <ToleranceTap ui={ui} c={c} value={m} onChange={(v) => props.onMark(c.key, v)} disabled={Boolean(signedOff)} />}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-sheet p-3 shadow-card">
        <CameraButton ui={ui} wide label={L('Photo of the job', 'صورة للعمل')} disabled={Boolean(signedOff)} onFile={(f) => props.onCapture(f)} />
        {photos.filter((p) => !p.criterionKey).map((p) => <Thumb key={p.id} ui={ui} p={p} onRemove={signedOff ? undefined : () => props.onRemovePhoto(p.id)} />)}
        <label className="min-w-[14rem] flex-1">
          <span className="sr-only">{L('Note', 'ملاحظة')}</span>
          <input className="tw-reset h-14 w-full rounded-xl border border-rule bg-sunk px-4 text-base" value={props.note} disabled={Boolean(signedOff)}
            onChange={(e) => props.onNote(e.target.value)} placeholder={L('Note for the learner (optional)', 'ملاحظة للمتدرب (اختياري)')} />
        </label>
      </div>

      <footer className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-navy p-3 text-on-brand shadow-lift">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-display text-lg font-semibold">
            {signedOff ? (signedOff.passed ? L(`Signed off · ${Math.round(signedOff.score)} · Pass`, `تم الاعتماد · ${Math.round(signedOff.score)} · ناجح`) : L(`Signed off · ${Math.round(signedOff.score)} · Not yet`, `تم الاعتماد · ${Math.round(signedOff.score)} · لم يجتز بعد`))
              : !live.complete ? L(`${criteria.length - live.done} left to score`, `متبقٍ ${criteria.length - live.done} للتقييم`)
              : live.gateFails.length ? L('Not yet · safety gate failed', 'لم يجتز بعد · رسب في شرط أمان')
              : live.passed ? L(`Pass · ${Math.round(live.score)}`, `ناجح · ${Math.round(live.score)}`) : L(`Not yet · below ${props.passThreshold ?? 70}`, `لم يجتز بعد · أقل من ${props.passThreshold ?? 70}`)}
          </p>
          <p className="text-sm opacity-80">
            {needPhoto.length ? L(`Add ${needPhoto.length} photo${needPhoto.length > 1 ? 's' : ''} before signing off`, `أضف ${needPhoto.length} صورة قبل الاعتماد`) : props.status}
          </p>
        </div>
        <button type="button" onClick={props.onSignOff} disabled={!canSign}
          className="tw-reset h-16 min-w-[14rem] rounded-xl bg-accent px-6 font-display text-xl font-bold text-white transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
          {signedOff ? L('Signed off ✓', 'تم الاعتماد ✓') : props.busy ? L('Saving…', 'جارٍ الحفظ…') : L('Sign off & next →', 'اعتماد والتالي ←')}
        </button>
      </footer>
    </section>
  );
}

function CheckTap({ ui, c, value, onChange, disabled }: { ui: Ui; c: RubricCriterion; value: Mark; onChange: (v: Mark) => void; disabled: boolean }) {
  const d = c.descriptors?.length ? c.descriptors : [{ value: 'pass', en: 'Met', ar: 'مستوفى' }, { value: 'fail', en: 'Not met', ar: 'غير مستوفى' }];
  return (
    <div role="radiogroup" aria-label={c.label} className="grid grid-cols-2 gap-2">
      {d.map((o) => {
        const on = value === o.value;
        const pass = o.value === 'pass';
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.value as Mark)}
            className={cx('tw-reset flex h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-base font-bold transition active:scale-[.97]',
              on ? (pass ? 'border-ok bg-ok text-sheet' : 'border-bad bg-bad text-sheet') : 'border-rule bg-sunk text-ink-2')}>
            <span aria-hidden="true" className="text-xl">{pass ? '✓' : '✗'}</span>{pickAr(ui, o.en, o.ar)}
          </button>
        );
      })}
    </div>
  );
}

function RatingTap({ ui, c, value, onChange, disabled }: { ui: Ui; c: RubricCriterion; value: Mark; onChange: (v: Mark) => void; disabled: boolean }) {
  const d = c.descriptors?.length ? c.descriptors : DEFAULT_RATINGS;
  return (
    <div role="radiogroup" aria-label={c.label} className="grid grid-cols-4 gap-1.5">
      {d.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} disabled={disabled} onClick={() => onChange(o.value as Mark)}
          className={cx('tw-reset flex h-14 flex-col items-center justify-center rounded-xl border-2 border-rule bg-sunk leading-none transition active:scale-[.97] aria-checked:border-transparent',
            RATING_TONE[Number(o.value)] ?? '')}>
          <span className="font-display text-xl font-bold">{String(o.value)}</span>
          <span className="mt-0.5 text-[11px] leading-tight">{pickAr(ui, o.en, o.ar)}</span>
        </button>
      ))}
    </div>
  );
}

function ToleranceTap({ ui, c, value, onChange, disabled }: { ui: Ui; c: RubricCriterion; value: Mark; onChange: (v: Mark) => void; disabled: boolean }) {
  const { L } = ui;
  const e = c.expected ?? 0, t = c.absTol ?? 0, unit = c.unit ?? 'mm';
  const digits = t < 0.05 ? 3 : 2;
  const raw = value === undefined ? '' : String(value);
  const v = raw === '' ? null : Number(raw.replace(',', '.'));
  const s = v === null || Number.isNaN(v) ? null : toleranceScore(c, v);
  // Gauge spans ±3 tolerances; the marker sits where the reading falls.
  const pos = v === null || Number.isNaN(v) || t === 0 ? null : Math.max(0, Math.min(100, 50 + ((v - e) / (6 * t)) * 100));
  const nudge = (k: number) => onChange(((v ?? e) + k * Math.max(t / 5, 10 ** -digits)).toFixed(digits));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5" dir="ltr">
        <button type="button" disabled={disabled} onClick={() => nudge(-1)} aria-label={L('Decrease', 'إنقاص')}
          className="tw-reset h-14 w-12 rounded-xl border-2 border-rule bg-sunk text-2xl font-bold">−</button>
        <input dir="ltr" inputMode="decimal" disabled={disabled} value={raw} placeholder={e.toFixed(digits)}
          aria-label={L(`Measured value in ${unit}`, `القيمة المقاسة (${unit})`)}
          onChange={(ev) => onChange(ev.target.value.replace(',', '.').replace('٫', '.'))}
          className={cx('tw-reset h-14 w-full min-w-0 flex-1 rounded-xl border-2 bg-sheet px-3 text-center font-mono text-xl font-semibold',
            s === null ? 'border-rule' : s === 100 ? 'border-ok text-ok' : s === 50 ? 'border-amber-fill text-amber' : 'border-bad text-bad')} />
        <button type="button" disabled={disabled} onClick={() => nudge(1)} aria-label={L('Increase', 'زيادة')}
          className="tw-reset h-14 w-12 rounded-xl border-2 border-rule bg-sunk text-2xl font-bold">+</button>
        <span className="w-10 text-center font-mono text-sm text-ink-3">{unit}</span>
      </div>
      <div className="relative h-3 rounded-full bg-bad-soft" dir="ltr" aria-hidden="true">
        <div className="absolute inset-y-0 left-[16.67%] right-[16.67%] rounded-full bg-amber-soft" />
        <div className="absolute inset-y-0 left-[33.33%] right-[33.33%] rounded-full bg-ok-soft ring-1 ring-ok" />
        {pos !== null && <div className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded bg-ink" style={{ left: `${pos}%` }} />}
      </div>
      <p className="flex justify-between font-mono text-[11px] text-ink-3" dir="ltr">
        <span>{(e - t).toFixed(digits)}</span>
        <span className={cx('font-body font-semibold', s === 100 ? 'text-ok' : s === 50 ? 'text-amber' : s === 0 ? 'text-bad' : '')}>
          {s === null ? `${e.toFixed(digits)} ± ${t}` : s === 100 ? `✓ ${L('In tolerance', 'ضمن التفاوت')}` : s === 50 ? `◐ ${L('Within 2×', 'ضمن ضعف التفاوت')}` : `✗ ${L('Out of tolerance', 'خارج التفاوت')}`}
        </span>
        <span>{(e + t).toFixed(digits)}</span>
      </p>
    </div>
  );
}

export function CameraButton({ ui, label, onFile, urgent, disabled, wide }: { ui: Ui; label: string; onFile: (f: File) => void; urgent?: boolean; disabled?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => ref.current?.click()} aria-label={label} title={label}
        className={cx('tw-reset flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border-2 transition active:scale-[.97] disabled:opacity-40',
          wide ? 'px-4' : 'w-14', urgent ? 'animate-pulse border-bad bg-bad-soft text-bad' : 'border-rule bg-sunk text-ink-2')}>
        <Glyph d={CAMERA} />
        {wide && <span className="font-semibold">{label}</span>}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} aria-label={ui.L('Camera', 'الكاميرا')} />
    </>
  );
}

export function Thumb({ ui, p, onRemove }: { ui: Ui; p: RubricPhoto; onRemove?: () => void }) {
  const badge = { uploading: '…', saved: '✓', queued: '⇡', failed: '!' }[p.state];
  return (
    <span className="relative inline-block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-rule bg-sunk">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt="" className="h-full w-full object-cover" />
      <span className={cx('absolute bottom-0.5 left-0.5 rounded px-1 text-[10px] font-bold',
        p.state === 'saved' ? 'bg-ok text-sheet' : p.state === 'failed' ? 'bg-bad text-sheet' : 'bg-ink/70 text-paper')}
        title={p.state === 'queued' ? ui.L('Queued until online', 'في الانتظار حتى الاتصال') : p.state}>{badge}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={ui.L('Remove photo', 'حذف الصورة')}
          className="tw-reset absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-xs text-paper">✕</button>
      )}
    </span>
  );
}

function ScoreRing({ value, state, label }: { value: number; state: 'open' | 'pass' | 'fail'; label: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="h-20 w-20 shrink-0" role="img" aria-label={label}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--rule)" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="8" strokeLinecap="round" transform="rotate(-90 36 36)"
        stroke={state === 'pass' ? 'var(--ok)' : state === 'fail' ? 'var(--bad)' : 'var(--accent)'} strokeDasharray={`${(value / 100) * c} ${c}`} />
      <text x="36" y="41" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)" fontFamily="var(--f-display)">{label}</text>
    </svg>
  );
}
