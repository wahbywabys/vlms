'use client';
import { useMemo, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { DOMAINS, LEVELS, STUDY_SYSTEMS, YEARS, type CoreAttitude, type CurriculumUnit, type Ksa, type ProgramProfile } from '@/lib/curriculumTree';
import type { Txt } from '@/lib/i18n';

/**
 * One programme's curriculum, read-only: the profile (occupation, hours, EQF,
 * tracks, capstone) and every knowledge module, skill and attitude by year,
 * each with its learning outcomes or performance criteria. Filters by year,
 * domain and free text. Text follows the language toggle.
 */
export function CurriculumView({ name, code, accent, profile, units, attitudes, compact }: {
  name: Txt; code: string | null; accent?: string | null; profile: ProgramProfile | null; units: CurriculumUnit[]; attitudes: CoreAttitude[]; compact?: boolean;
}) {
  const { L, pick, ar, num } = useL();
  const years = [...new Set(units.map((u) => u.year))];
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');
  const [ksa, setKsa] = useState<Ksa | 'all'>('all');
  const [query, setQuery] = useState('');
  const [openAll, setOpenAll] = useState(false);
  const att = new Map(attitudes.map((a) => [a.code, a]));

  const shown = useMemo(() => {
    const qq = query.trim().toLowerCase();
    return units.filter((u) => (year === 'all' || u.year === year) && (ksa === 'all' || u.ksa === ksa))
      .map((u) => ({ ...u, items: qq ? u.items.filter((i) => [i.code, i.title.en, i.title.ar, ...i.criteria.flatMap((c) => [c.text.en, c.text.ar])]
        .some((s) => s.toLowerCase().includes(qq))) : u.items }))
      .filter((u) => u.items.length);
  }, [units, year, ksa, query]);

  const count = (k: Ksa) => units.filter((u) => u.ksa === k && (year === 'all' || u.year === year)).reduce((n, u) => n + u.items.length, 0);
  const hoursK = units.filter((u) => u.ksa === 'K' && (year === 'all' || u.year === year)).reduce((n, u) => n + u.items.reduce((h, i) => h + (i.hours ?? 0), 0), 0);

  if (!units.length) return <p className="notice">{L('No curriculum has been loaded for this programme yet.', 'لم يُحمَّل منهج لهذا التخصص بعد.')}</p>;

  return (
    <div className="curriculum" style={accent ? { ['--accent' as string]: accent } : undefined}>
      {profile && !compact && (
        <section className="panel cur-profile">
          <header className="panel-head">
            <div>
              <p className="eyebrow">{code} · {profile.eqf} · {L(`${num(profile.hours ?? 0)} hours over 3 years`, `${num(profile.hours ?? 0)} ساعة على 3 سنوات`)}</p>
              <h2>{pick(name)}</h2>
              {profile.occupation && <p className="muted">{L('Occupation', 'المهنة')}: <b>{pick(profile.occupation)}</b></p>}
            </div>
          </header>
          {profile.overview && <p>{pick(profile.overview)}</p>}
          <dl className="cur-facts">
            {profile.duration && <><dt>{L('Duration', 'المدة')}</dt><dd>{pick(profile.duration)}</dd></>}
            {profile.pvtd && <><dt>{L('PVTD reference occupation', 'المهنة المرجعية بمصلحة الكفاية الإنتاجية')}</dt><dd>{profile.pvtd}</dd></>}
            {profile.adopts && <><dt>{L('Shared units adopted', 'الوحدات المشتركة المعتمدة')}</dt><dd>{pick(profile.adopts)}</dd></>}
            {profile.occupations && <><dt>{L('Jobs after graduation', 'الوظائف بعد التخرج')}</dt><dd>{pick(profile.occupations)}</dd></>}
            {profile.tracks?.length ? <><dt>{L('Year 3 tracks', 'مسارات السنة الثالثة')}</dt><dd className="chips">{profile.tracks.map((t) => <span key={t.en} className="cur-tag">{pick(t)}</span>)}</dd></> : null}
            {profile.equipment && <><dt>{L('Training requirements: core equipment', 'مستلزمات التدريب: المعدات الأساسية')}</dt><dd>{pick(profile.equipment)}</dd></>}
            {profile.standards && <><dt>{L('Standards', 'المعايير')}</dt><dd dir="ltr" className="small">{profile.standards}</dd></>}
            {profile.capstone && <><dt>{L('Capstone project', 'مشروع التخرج')}</dt><dd>{pick(profile.capstone)}</dd></>}
          </dl>
          {profile.source && <p className="muted small">{L('Source', 'المصدر')}: {pick(profile.source)}</p>}
        </section>
      )}

      {profile?.revision && !compact && (
        <section className="panel">
          <header className="panel-head"><h2>{L('Two study systems', 'نظاما الدراسة')}</h2></header>
          <p className="muted small">{L('Every programme can run under either system. The modules are the same; the pass rule and the hours differ.',
            'يمكن تقديم كل تخصص وفق أي من النظامين. الوحدات واحدة، ويختلف شرط النجاح وعدد الساعات.')}</p>
          <div className="cur-systems">
            {STUDY_SYSTEMS.map((s) => (
              <article key={s.id} className={`cur-system sys-${s.id}`}>
                <p className="cur-pct">{num(s.pct)}%</p>
                <h3>{pick(s.name)}</h3>
                <dl className="cur-facts">
                  <dt>{L('Where', 'أين')}</dt><dd>{pick(s.settings)}</dd>
                  <dt>{L('Pass rule', 'شرط النجاح')}</dt><dd>{pick(s.pass)}</dd>
                  <dt>{L('Hours', 'الساعات')}</dt><dd>{pick(s.hours)}</dd>
                  <dt>{L('Exams', 'الامتحانات')}</dt><dd>{pick(s.exams)}</dd>
                </dl>
              </article>
            ))}
          </div>
          {profile.system_b && profile.system_b.length > 1 && (
            <details className="cur-sysb">
              <summary><b>{L('System B training-unit plan', 'خطة الوحدات التدريبية وفق النظام (ب)')}</b> <span className="muted small">({L(`${num(profile.system_b.length - 1)} rows`, `${num(profile.system_b.length - 1)} صف`)})</span></summary>
              <div className="cur-table">
                <table className="comp">
                  <thead><tr><th>{L('Year', 'السنة')}</th><th>{L('Sem.', 'الفصل')}</th><th>#</th><th>{L('Training unit', 'الوحدة التدريبية')}</th><th>{L('Codes', 'الرموز')}</th><th>{L('Hours', 'الساعات')}</th></tr></thead>
                  <tbody>{profile.system_b.slice(1).map((r, i) => (
                    <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{ar(r[3], r[4])}</td><td className="mono small" dir="ltr">{r[5]}</td><td>{r[6]}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      <section className="panel">
        <div className="cur-filters">
          <div className="tabs" role="tablist" aria-label={L('Year', 'السنة')}>
            {years.map((y) => <button key={y} type="button" role="tab" aria-selected={year === y} className={year === y ? 'primary' : 'ghost'} onClick={() => setYear(y)}>
              {L(`Year ${y}`, `السنة ${['', 'الأولى', 'الثانية', 'الثالثة'][y] ?? y}`)}</button>)}
            <button type="button" role="tab" aria-selected={year === 'all'} className={year === 'all' ? 'primary' : 'ghost'} onClick={() => setYear('all')}>{L('All years', 'كل السنوات')}</button>
          </div>
          <div className="chips" role="group" aria-label={L('Domain', 'المجال')}>
            <button type="button" className={`chip ${ksa === 'all' ? 'chip-on' : ''}`} onClick={() => setKsa('all')}>{L('All', 'الكل')}</button>
            {(['K', 'S', 'A'] as const).map((k) => <button key={k} type="button" className={`chip ksa-${k} ${ksa === k ? 'chip-on' : ''}`} onClick={() => setKsa(k)}>
              <b>{k}</b> {pick(DOMAINS[k].short)} <span className="muted">({num(count(k))})</span></button>)}
          </div>
          <input type="search" placeholder={L('Search a skill or outcome…', 'ابحث عن مهارة أو ناتج تعلم…')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="button" className="ghost" onClick={() => setOpenAll((v) => !v)}>{openAll ? L('Collapse all', 'طي الكل') : L('Expand all', 'فتح الكل')}</button>
        </div>
        <p className="muted small">{L(`${num(count('K'))} knowledge modules (${num(hoursK)} theory hours) · ${num(count('S'))} skills · ${num(count('A'))} attitudes`,
          `${num(count('K'))} وحدة معرفية (${num(hoursK)} ساعة نظرية) · ${num(count('S'))} مهارة · ${num(count('A'))} اتجاه مهني`)}</p>

        {shown.length === 0 && <p className="notice">{L('Nothing matches this search.', 'لا توجد نتائج مطابقة.')}</p>}
        {shown.map((u) => (
          <div key={u.code} className={`cur-unit ksa-${u.ksa}`}>
            <h3><span className="ksa-badge">{u.ksa}</span> {pick(DOMAINS[u.ksa].long)} <span className="muted small">· {pick(YEARS[u.year] ?? { en: `Year ${u.year}`, ar: `السنة ${u.year}` })}</span></h3>
            <ul className="plain cur-items">
              {u.items.map((i) => (
                <li key={i.code + String(openAll)}>
                  <details open={openAll}>
                    <summary>
                      <span className="mono small code">{i.code}</span> <b>{pick(i.title)}</b>
                      {i.hours ? <span className="cur-tag">{L(`${i.hours} h`, `${i.hours} س`)}</span> : null}
                      {i.level && <span className="cur-tag" title={pick(LEVELS[i.level] ?? { en: i.level, ar: i.level })}>{pick(LEVELS[i.level] ?? { en: i.level, ar: i.level })}</span>}
                      {i.core && <span className="cur-tag" title={ar(att.get(i.core)?.indicators, att.get(i.core)?.indicatorsAr)}>{i.core} · {ar(att.get(i.core)?.name ?? i.core, att.get(i.core)?.nameAr)}</span>}
                      {/^(ETF|CPM)-/.test(i.code) && <span className="cur-tag cur-shared" title={L('Shared unit: assessed once, credited to every programme that adopts it', 'وحدة مشتركة: تُقيَّم مرة واحدة وتُحتسب لكل تخصص يعتمدها')}>{L('Shared unit', 'وحدة مشتركة')}</span>}
                      {i.safety && <span className="chip chip-danger">{L('Safety-critical', 'سلامة حرجة')}</span>}
                    </summary>
                    <p className="muted small">{u.ksa === 'K' ? L('Learning outcomes', 'نواتج التعلم') : u.ksa === 'S' ? L('Performance criteria', 'معايير الأداء') : L('Observable behaviours', 'سلوكيات ملحوظة')}</p>
                    <ul className="cur-criteria">{i.criteria.map((c) => <li key={c.code}>{pick(c.text)}</li>)}</ul>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {!compact && attitudes.length > 0 && (
        <section className="panel">
          <header className="panel-head"><h2>{L('The seven core attitudes', 'الاتجاهات المهنية السبعة الأساسية')}</h2></header>
          <p className="muted small">{L('Every programme assesses these in every year.', 'تُقيَّم هذه الاتجاهات في كل التخصصات وكل السنوات.')}</p>
          <ul className="plain cur-attitudes">
            {attitudes.map((a) => <li key={a.code}><span className="ksa-badge">{a.code}</span> <b>{ar(a.name, a.nameAr)}</b> <span className="muted small">— {ar(a.indicators, a.indicatorsAr)}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
