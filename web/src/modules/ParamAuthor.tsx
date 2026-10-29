// Copied from app/src/components/modules/ParamAuthor.tsx by scripts/sync-modules.sh. Edit the original, not this file.
'use client';
/**
 * Authoring a parameterised calculation. The teacher writes the stem with
 * {{variables}}, the ranges (or a list of values) each variable is drawn
 * from, the answer formula and the tolerance band. "Preview" lints the
 * formulas on the server (unknown names, a range that can only ever give one
 * question, a constraint that never holds) and shows three learners' versions
 * with their expected answers, so a broken item never reaches a learner.
 */
import { useState } from 'react';
import { cx, type Ui } from './types';

export interface ParamRow { name: string; min: number; max: number; step: number; unit?: string | null; choices?: number[] | null }
export interface ParamDraft {
  body: { template: string; template_ar?: string; answer_expr: string; unit?: string; derived?: Record<string, string>; constraint?: string; answer_decimals?: number };
  params: ParamRow[]; absTol: number | null; relTol: number | null;
}
export interface PreviewResult { ok: boolean; issues: string[]; samples: { stem: string; stemAr: string | null; values: Record<string, number>; answer: number; band: number }[] }

const START: ParamDraft = {
  body: { template: 'Two resistors of {{R1}} Ω and {{R2}} Ω are in parallel across {{V}} V. What current does the supply deliver?',
    template_ar: 'مقاومتان {{R1}} أوم و{{R2}} أوم على التوازي على جهد {{V}} فولت. ما التيار الذي يعطيه المصدر؟',
    answer_expr: 'V / Rt', unit: 'A', derived: { Rt: 'R1 * R2 / (R1 + R2)' }, answer_decimals: 2 },
  params: [{ name: 'R1', min: 10, max: 100, step: 5, unit: 'Ω' }, { name: 'R2', min: 10, max: 100, step: 5, unit: 'Ω' }, { name: 'V', min: 0, max: 0, step: 1, unit: 'V', choices: [12, 24, 48] }],
  absTol: null, relTol: 0.02,
};

export function ParamAuthor({ ui, onPreview, onSave, competencies }: { ui: Ui; onPreview: (d: ParamDraft) => Promise<PreviewResult>;
  onSave: (d: ParamDraft & { competencyId: string; bloom: string; submit: boolean }) => Promise<{ error?: string } | void>;
  competencies: { id: string; label: string }[] }) {
  const { L } = ui;
  const [d, setD] = useState<ParamDraft>(START);
  const [derived, setDerived] = useState(Object.entries(START.body.derived ?? {}).map(([k, v]) => `${k} = ${v}`).join('\n'));
  const [tolKind, setTolKind] = useState<'abs' | 'rel'>('rel');
  const [tol, setTol] = useState('0.02');
  const [pv, setPv] = useState<PreviewResult | null>(null);
  const [comp, setComp] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const draft = (): ParamDraft => {
    const der = Object.fromEntries(derived.split('\n').map((l) => l.split('=')).filter((p) => p.length >= 2 && p[0]!.trim()).map(([k, ...v]) => [k!.trim(), v.join('=').trim()]));
    const t = Number(tol.replace(',', '.'));
    return { ...d, body: { ...d.body, derived: Object.keys(der).length ? der : undefined, constraint: d.body.constraint || undefined },
      absTol: tolKind === 'abs' ? t : null, relTol: tolKind === 'rel' ? t : null };
  };
  const setBody = (patch: Partial<ParamDraft['body']>) => { setD((x) => ({ ...x, body: { ...x.body, ...patch } })); setPv(null); };
  const setParam = (i: number, patch: Partial<ParamRow>) => { setD((x) => ({ ...x, params: x.params.map((p, k) => (k === i ? { ...p, ...patch } : p)) })); setPv(null); };
  const num = (v: string) => Number(v.replace(',', '.'));
  const input = 'tw-reset h-11 rounded-lg border-2 border-rule bg-sunk px-2 font-mono text-sm';

  return (
    <div className="flex flex-col gap-4 font-body text-ink">
      <section className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card">
        <h3 className="font-display text-lg font-bold">{L('1 · The question', '١ · السؤال')}</h3>
        <label className="flex flex-col gap-1 text-sm font-semibold">{L('Stem (English) · put variables in {{ }}, {{x:2}} for 2 decimals', 'نص السؤال (إنجليزي) · ضع المتغيرات بين {{ }}، و{{x:2}} لمنزلتين عشريتين')}
          <textarea rows={3} dir="ltr" value={d.body.template} onChange={(e) => setBody({ template: e.target.value })} className="tw-reset rounded-xl border-2 border-rule bg-sunk p-3 font-normal" /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{L('Stem (Arabic)', 'نص السؤال (عربي)')}
          <textarea rows={3} dir="rtl" value={d.body.template_ar ?? ''} onChange={(e) => setBody({ template_ar: e.target.value })} className="tw-reset rounded-xl border-2 border-rule bg-sunk p-3 font-normal" /></label>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-sheet p-4 shadow-card">
        <h3 className="font-display text-lg font-bold">{L('2 · Variables', '٢ · المتغيرات')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm" dir="ltr">
            <thead className="text-xs text-ink-3"><tr>{[L('Name', 'الاسم'), L('Min', 'الأدنى'), L('Max', 'الأقصى'), L('Step', 'الخطوة'), L('Unit', 'الوحدة'), L('…or pick from', '…أو اختر من'), ''].map((h, i) => <th key={i} className="p-1 text-start font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {d.params.map((p, i) => (
                <tr key={i}>
                  <td className="p-1"><input className={cx(input, 'w-20')} value={p.name} onChange={(e) => setParam(i, { name: e.target.value })} aria-label="name" /></td>
                  {(['min', 'max', 'step'] as const).map((k) => <td key={k} className="p-1"><input className={cx(input, 'w-20', Boolean(p.choices?.length) && 'opacity-40')} inputMode="decimal" value={String(p[k])} onChange={(e) => setParam(i, { [k]: num(e.target.value) })} aria-label={k} /></td>)}
                  <td className="p-1"><input className={cx(input, 'w-16')} value={p.unit ?? ''} onChange={(e) => setParam(i, { unit: e.target.value || null })} aria-label="unit" /></td>
                  <td className="p-1"><input className={cx(input, 'w-36')} placeholder="—" value={p.choices?.join(', ') ?? ''}
                    onChange={(e) => setParam(i, { choices: e.target.value.trim() ? e.target.value.split(/[,;\s]+/).filter(Boolean).map(num) : null })} aria-label="choices" /></td>
                  <td className="p-1"><button type="button" className="tw-reset h-11 w-11 rounded-lg text-ink-3" aria-label={L('Remove', 'حذف')} onClick={() => setD((x) => ({ ...x, params: x.params.filter((_, k) => k !== i) }))}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="tw-reset h-11 w-fit rounded-lg border-2 border-dashed border-rule-strong px-3 text-sm font-semibold" onClick={() => setD((x) => ({ ...x, params: [...x.params, { name: `x${x.params.length + 1}`, min: 1, max: 10, step: 1 }] }))}>＋ {L('Variable', 'متغير')}</button>
      </section>

      <section className="grid gap-3 rounded-2xl bg-sheet p-4 shadow-card md:grid-cols-2">
        <h3 className="font-display text-lg font-bold md:col-span-2">{L('3 · Answer and tolerance', '٣ · الإجابة والتفاوت')}</h3>
        <label className="flex flex-col gap-1 text-sm font-semibold">{L('Answer formula', 'معادلة الإجابة')}
          <input dir="ltr" className={input} value={d.body.answer_expr} onChange={(e) => setBody({ answer_expr: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{L('Working values (one per line: name = formula)', 'قيم وسيطة (سطر لكل قيمة: الاسم = المعادلة)')}
          <textarea dir="ltr" rows={2} className="tw-reset rounded-lg border-2 border-rule bg-sunk p-2 font-mono text-sm" value={derived} onChange={(e) => { setDerived(e.target.value); setPv(null); }} /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold">{L('Only draw when this is > 0 (optional)', 'اسحب فقط عندما تكون هذه > 0 (اختياري)')}
          <input dir="ltr" className={input} value={d.body.constraint ?? ''} placeholder="R1 - R2" onChange={(e) => setBody({ constraint: e.target.value })} /></label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">{L('Unit', 'الوحدة')}<input dir="ltr" className={cx(input, 'w-20')} value={d.body.unit ?? ''} onChange={(e) => setBody({ unit: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">{L('Decimals', 'المنازل')}<input dir="ltr" inputMode="numeric" className={cx(input, 'w-16')} value={d.body.answer_decimals ?? ''} onChange={(e) => setBody({ answer_decimals: e.target.value === '' ? undefined : num(e.target.value) })} /></label>
          <div className="flex flex-col gap-1 text-sm font-semibold">{L('Accept within', 'اقبل ضمن')}
            <div className="flex gap-1" dir="ltr">
              <select value={tolKind} onChange={(e) => { setTolKind(e.target.value as 'abs' | 'rel'); setPv(null); }} className="tw-reset h-11 rounded-lg border-2 border-rule bg-sunk px-2 text-sm">
                <option value="rel">± {L('fraction', 'نسبة')}</option><option value="abs">± {L('absolute', 'مطلق')}</option>
              </select>
              <input className={cx(input, 'w-20')} inputMode="decimal" value={tol} onChange={(e) => { setTol(e.target.value); setPv(null); }} />
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-sheet p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold">{L('4 · Preview three learners', '٤ · معاينة ثلاثة متدربين')}</h3>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); setPv(await onPreview(draft()).catch(() => ({ ok: false, issues: ['preview failed'], samples: [] }))); setBusy(false); }}
            className="tw-reset ms-auto h-11 rounded-xl bg-navy px-4 font-semibold text-on-brand">{L('Check & preview', 'افحص وعاين')}</button>
        </div>
        {pv && !pv.ok && <ul className="m-0 list-none p-0 flex flex-col gap-1">{pv.issues.map((i) => <li key={i} className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad" dir="ltr">✗ {i}</li>)}</ul>}
        {pv?.ok && (
          <div className="grid gap-2 md:grid-cols-3">
            {pv.samples.map((s, i) => (
              <article key={i} className="flex flex-col gap-2 rounded-xl bg-sunk p-3 text-sm">
                <p className="text-xs font-semibold text-ink-3">{L(`Learner ${i + 1}`, `المتدرب ${i + 1}`)}</p>
                <p dir="auto">{ui.lang === 'ar' && s.stemAr ? s.stemAr : s.stem}</p>
                <p className="mt-auto font-mono font-bold text-ok" dir="ltr">= {d.body.answer_decimals != null ? s.answer.toFixed(d.body.answer_decimals) : s.answer} {d.body.unit} <span className="font-normal text-ink-3">± {+s.band.toPrecision(3)}</span></p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <select value={comp} onChange={(e) => setComp(e.target.value)} className="tw-reset h-12 min-w-0 flex-1 rounded-xl border-2 border-rule bg-sheet px-3" aria-label={L('Competency', 'الجدارة')}>
          <option value="">{L('Competency this item assesses…', 'الجدارة التي يقيسها السؤال…')}</option>
          {competencies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="button" disabled={!pv?.ok || !comp || busy} onClick={async () => { setBusy(true); const r = await onSave({ ...draft(), competencyId: comp, bloom: 'apply', submit: true }); if (r?.error) setMsg(r.error); setBusy(false); }}
          className="tw-reset h-12 rounded-xl bg-accent px-5 font-bold text-white disabled:opacity-40">{L('Save & send to review', 'حفظ وإرسال للمراجعة')}</button>
      </div>
      {!pv?.ok && <p className="text-sm text-ink-3">{L('Preview the item without issues before saving.', 'عاين السؤال دون أخطاء قبل الحفظ.')}</p>}
      {msg && <p role="alert" className="text-sm font-semibold text-bad">{msg}</p>}
    </div>
  );
}
