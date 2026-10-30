'use client';
import { useState } from 'react';
import { ImportBox } from '@/components/admin/ImportBox';
import { useL } from '@/components/LangProvider';
import { apiFetch } from '@/lib/browserApi';
import { PROGRAM_COLUMNS } from '@/lib/sheetImport';

export interface Competency { code: string; kind: 'unit' | 'element' | 'criterion'; parentCode: string | null; title: string; titleAr: string | null; safetyCritical: boolean; hours: number | null }
export interface Program { id: string; code: string; name: string; nameAr: string | null; cohorts: number; workshops: number; competencies: Competency[] }

const KIND = { unit: ['Unit', 'وحدة'], element: ['Element', 'عنصر'], criterion: ['Criterion', 'معيار'] } as const;

export function ProgramsClient({ initial }: { initial: Program[] }) {
  const { L, lang } = useL();
  const [programs, setPrograms] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [err, setErr] = useState<string | null>(null);
  const reload = async () => setPrograms((await apiFetch<{ programs: Program[] }>('/admin/programs')).programs);
  const fail = (e: unknown) => setErr((e as { message?: string })?.message ?? L('Could not save.', 'تعذر الحفظ.'));
  const name = (p: { name: string; nameAr: string | null }) => (lang === 'ar' && p.nameAr ? p.nameAr : p.name);

  const addProgram = async (f: FormData) => {
    setErr(null);
    const code = String(f.get('code') ?? '').trim();
    try {
      const r = await apiFetch<{ program: { id: string } }>(`/admin/programs/${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        { method: 'PUT', body: { code, name: f.get('name'), nameAr: f.get('nameAr') } });
      await reload(); setOpen(r.program.id);
    } catch (e) { fail(e); }
  };
  const addSkill = async (p: Program, f: FormData) => {
    setErr(null);
    try {
      await apiFetch(`/admin/programs/${p.id}/competencies`, { body: { code: f.get('code'), kind: f.get('kind'), parentCode: f.get('parentCode') || undefined,
        title: f.get('title'), titleAr: f.get('titleAr') || undefined, safetyCritical: f.get('safety') === 'on', hours: f.get('hours') || undefined } });
      await reload();
    } catch (e) { fail(e); }
  };

  return (
    <div className="dash-grid">
      <section className="panel wide">
        <header className="panel-head"><h2>{L('Programmes', 'التخصصات')}</h2><span className="muted small">{L(`${programs.length} specialisations`, `${programs.length} تخصصات`)}</span></header>
        {err && <p className="notice notice-danger" role="alert">{err}</p>}
        <div className="tabs" role="tablist">
          {programs.map((p) => <button key={p.id} type="button" role="tab" aria-selected={open === p.id} className={open === p.id ? 'primary' : 'ghost'}
            onClick={() => setOpen(p.id)}>{p.code} · {name(p)} <span className="muted small">({p.competencies.length})</span></button>)}
        </div>
        {programs.filter((p) => p.id === open).map((p) => {
          const units = p.competencies.filter((c) => c.kind === 'unit');
          const kids = (code: string) => p.competencies.filter((c) => c.parentCode === code);
          const row = (c: Competency, depth: number): React.ReactNode => (
            <li key={c.code} style={{ paddingInlineStart: depth * 20 }}>
              <span className="mono small">{c.code}</span> <span className="muted small">{L(KIND[c.kind][0], KIND[c.kind][1])}</span>{' '}
              <b>{lang === 'ar' && c.titleAr ? c.titleAr : c.title}</b>
              {c.safetyCritical && <> <span className="chip chip-danger">{L('Safety-critical', 'سلامة حرجة')}</span></>}
              {c.hours ? <span className="muted small"> · {c.hours} h</span> : null}
              {kids(c.code).length > 0 && <ul className="plain">{kids(c.code).map((k) => row(k, 1))}</ul>}
            </li>
          );
          return (
            <div key={p.id}>
              <p className="muted small">{L(`${p.cohorts} cohort(s) · ${p.workshops} workshop(s)`, `${p.cohorts} مجموعة · ${p.workshops} ورشة`)}</p>
              {units.length ? <ul className="plain">{units.map((u) => row(u, 0))}</ul>
                : <p className="notice">{L('No skills yet. Add a unit below or import the template.', 'لا توجد مهارات بعد. أضف وحدة بالأسفل أو استورد النموذج.')}</p>}
              <form className="form-row" action={(f) => void addSkill(p, f)}>
                <label className="field"><span>{L('Skill code', 'رمز المهارة')}</span><input name="code" required dir="ltr" placeholder={`${p.code}-U01`} /></label>
                <label className="field"><span>{L('Level', 'المستوى')}</span><select name="kind" defaultValue="unit">
                  {(['unit', 'element', 'criterion'] as const).map((k) => <option key={k} value={k}>{L(KIND[k][0], KIND[k][1])}</option>)}</select></label>
                <label className="field"><span>{L('Parent code', 'رمز المستوى الأعلى')}</span><input name="parentCode" dir="ltr" list={`parents-${p.id}`} />
                  <datalist id={`parents-${p.id}`}>{p.competencies.filter((c) => c.kind !== 'criterion').map((c) => <option key={c.code} value={c.code}>{c.title}</option>)}</datalist></label>
                <label className="field"><span>{L('Title (English)', 'العنوان (إنجليزي)')}</span><input name="title" required dir="ltr" /></label>
                <label className="field"><span>{L('Title (Arabic)', 'العنوان (عربي)')}</span><input name="titleAr" dir="rtl" /></label>
                <label className="field"><span>{L('Hours', 'الساعات')}</span><input name="hours" inputMode="decimal" dir="ltr" size={5} /></label>
                <label className="field"><span>{L('Safety-critical', 'سلامة حرجة')}</span><input type="checkbox" name="safety" /></label>
                <div className="form-actions"><button type="submit" className="primary">{L('Add skill', 'أضف مهارة')}</button></div>
              </form>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <header className="panel-head"><h2>{L('New programme', 'تخصص جديد')}</h2></header>
        <form action={(f) => void addProgram(f)}>
          <label className="field"><span>{L('Code (short, e.g. PLMB)', 'الرمز (قصير، مثل PLMB)')}</span><input name="code" required dir="ltr" pattern="[A-Za-z][A-Za-z0-9_.-]{1,23}" /></label>
          <label className="field"><span>{L('Name (English)', 'الاسم (إنجليزي)')}</span><input name="name" required dir="ltr" /></label>
          <label className="field"><span>{L('Name (Arabic)', 'الاسم (عربي)')}</span><input name="nameAr" dir="rtl" /></label>
          <div className="form-actions"><button type="submit" className="primary">{L('Add programme', 'أضف التخصص')}</button></div>
        </form>
        <p className="muted small">{L('A new programme appears in every trade picker. Its 3D studio, lessons and V-Labs are empty until content is added for it.',
          'يظهر التخصص الجديد في كل قوائم التخصصات. يكون الاستوديو ثلاثي الأبعاد والدروس والمعامل الافتراضية فارغة حتى يُضاف محتوى له.')}</p>
      </section>

      <ImportBox endpoint="/admin/programs/import" columns={PROGRAM_COLUMNS} sheet="Programmes" required={['programCode']}
        template={{ xlsx: '/templates/programmes-template.xlsx', csv: '/templates/programmes-template.csv' }} onDone={() => void reload()} />
    </div>
  );
}
