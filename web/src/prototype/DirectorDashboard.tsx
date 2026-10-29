/** Screen 3 — Centre Director / Executive Analytics Dashboard (docs/ui-blueprint.md §3). */
import { useMemo, useState } from 'react';
import { COMPLIANCE, INSTITUTIONS, KPIS, REGIONS, TERMS, TREND_LABELS, type Kpi } from './data';
import { tx, type Lang } from './i18n';
import { useL, useStore } from './store';
import { TradeIcon } from './TradeBar';
import { TRADES, tradeById } from './trades';
import { PageHeader } from './ui';

/** Deterministic nudge so each filter combination shows plausible, stable numbers. */
function nudge(seed: string, i: number, span: number) {
  let h = 2166136261;
  for (const ch of `${seed}|${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % (span * 2 + 1)) - span;
}
const fmtVal = (k: Kpi, v: number) => (k.unit === '/5' ? v.toFixed(1) : String(Math.round(v)));
const MODE = { Guided: { en: 'Guided', ar: 'موجّه' }, Exam: { en: 'Exam', ar: 'امتحان' } };

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function DirectorDashboard() {
  const { evals, alerts, dirTrade, setDirTrade, setTrade: setActiveTrade } = useStore();
  const { lang, L, pick } = useL();
  const [inst, setInst] = useState(0);
  const [term, setTerm] = useState(0);
  const one = dirTrade === 'all' ? null : tradeById(dirTrade);
  const setTrade = (id: string) => { setDirTrade(id); if (id !== 'all') setActiveTrade(id); };
  const trade = dirTrade;
  const tradeName = one ? one.name : tx('All trades', 'كل التخصصات');
  const [drill, setDrill] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [pack, setPack] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const seed = `${inst}|${term}|${trade}`;
  const isBase = inst === 0 && term === 0 && trade === 'all';

  const kpis = useMemo(() => KPIS.map((k, i) => {
    if (isBase) return k;
    // A single trade starts from its own headline numbers, then the school/term wobble applies.
    const own = one ? ({ attain: one.overview.attainment, util: one.overview.utilisation, wbl: one.overview.wbl } as Record<string, number>)[k.key] : undefined;
    if (own !== undefined) k = { ...k, value: own, trend: k.trend.map((t) => t + own - k.value) };
    const scale = k.unit === '/5' ? 0.1 : 1;
    const d = nudge(seed, i, k.unit === '' ? 2 : 6) * scale;
    const clampV = (v: number) => Math.max(0, k.unit === '/5' ? Math.min(5, v) : k.unit === '%' ? Math.min(100, v) : v);
    return { ...k, value: clampV(k.value + d), trend: k.trend.map((t) => clampV(t + d)) };
  }), [seed, isBase, one]);
  const assets = useMemo(() => {
    const pool = one ? one.assets : TRADES.flatMap((t) => t.assets).sort((a, b) => b.pct - a.pct).slice(0, 8);
    return pool.map((a, i) => ({ ...a, pct: isBase ? a.pct : Math.max(8, Math.min(99, a.pct + nudge(seed, i + 10, 7))) })).sort((a, b) => b.pct - a.pct);
  }, [seed, isBase, one]);
  // One trade: regions × its units. All trades: regions × trades (mean across each trade's units).
  const columns = one
    ? one.units.map((u) => ({ code: u.code, title: u.title }))
    : TRADES.map((t) => ({ code: t.code, title: t.name }));
  const baseHeat = useMemo(() => (one ? one.heatmap
    : REGIONS.map((_, r) => TRADES.map((t) => Math.round(t.heatmap[r]!.reduce((a, b) => a + b, 0) / t.heatmap[r]!.length)))), [one]);
  const heat = useMemo(() => baseHeat.map((row, r) => row.map((v, c) => (isBase ? v : Math.max(5, Math.min(99, v + nudge(seed, r * 10 + c + 20, 5)))))), [seed, isBase, baseHeat]);
  const inScope = (id: string) => !one || one.id === id;
  const scopedEvals = evals.filter((e) => inScope(e.trade));
  const bank = TRADES.filter((t) => inScope(t.id)).flatMap((t) => t.bank.map((q) => ({ ...q, trade: t })));
  const isFlagged = (q: { p: number; d: number }) => q.p < 0.2 || q.p > 0.85 || q.d < 0.2;
  const flagged = bank.filter(isFlagged);
  // Across all trades, show the two weakest-discriminating flagged items of each trade.
  const shownItems = one ? flagged.slice(0, 4)
    : TRADES.flatMap((t) => flagged.filter((q) => q.trade.id === t.id).sort((x, y) => x.d - y.d).slice(0, 2));
  const stock = TRADES.filter((t) => inScope(t.id)).flatMap((t) => t.consumables.map((c) => ({ ...c, trade: t })))
    .sort((a, b) => a.onHand / a.reorderAt - b.onHand / b.reorderAt);

  const drillK = kpis.find((k) => k.key === drill);
  const hotRegion = INSTITUTIONS[inst]!.region;
  const vlabIncidents = alerts.filter((a) => a.source === 'V-Lab' && inScope(a.trade)).length;

  const exportPack = async () => {
    const items = scopedEvals.map((e) => ({ trade: tradeById(e.trade).code, learner: pick(e.learner), lab: tradeById(e.trade).lab.code, mode: e.mode, score: e.score, passed: e.passed, gateFailures: e.gateFailures, at: pick(e.at) }));
    const hashed = await Promise.all(items.map(async (it) => ({ ...it, sha256: await sha256(JSON.stringify(it)) })));
    const body = { institution: pick(INSTITUTIONS[inst]!.name), term: pick(TERMS[term]!), trade: one?.framework.code ?? 'ALL', generatedAt: new Date().toISOString(), evaluations: hashed };
    setPack(JSON.stringify({ ...body, packSha256: await sha256(JSON.stringify(body)) }, null, 2));
    setCopied(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(pack ?? ''); setCopied(true); }
    catch { (document.getElementById('iqa-pack') as HTMLTextAreaElement | null)?.select(); }
  };

  return (
    <div className="dash">
      <PageHeader
        crumbs={[L('Network', 'الشبكة'), pick(INSTITUTIONS[inst]!.name)]}
        title={L('Institutional health', 'صحة المؤسسة')}
        meta={<>{pick(INSTITUTIONS[inst]!.name)} · {pick(TERMS[term]!)} · {pick(tradeName)}</>}
        actions={<button type="button" className="primary" onClick={() => void exportPack()}>{L('Export IQA pack', 'تصدير حزمة ضمان الجودة')}</button>} />

      <div className="card filters" role="group" aria-label={L('Filters', 'عوامل التصفية')}>
        <label className="field"><span>{L('School', 'المدرسة')}</span>
          <select id="f-inst" value={inst} onChange={(e) => setInst(Number(e.target.value))}>{INSTITUTIONS.map((x, i) => <option key={x.name.en} value={i}>{pick(x.name)}</option>)}</select></label>
        <label className="field"><span>{L('Term', 'الفصل الدراسي')}</span>
          <select id="f-term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>{TERMS.map((x, i) => <option key={x.en} value={i}>{pick(x)}</option>)}</select></label>
        <label className="field"><span>{L('Trade', 'التخصص')}</span>
          <select id="f-trade" value={trade} onChange={(e) => setTrade(e.target.value)}>
            <option value="all">{L('All trades', 'كل التخصصات')}</option>
            {TRADES.map((t) => <option key={t.id} value={t.id}>{pick(t.name)}</option>)}
          </select></label>
        {!isBase && <button type="button" className="ghost" onClick={() => { setInst(0); setTerm(0); setTrade('all'); }}>{L('Reset filters', 'إعادة الضبط')}</button>}
      </div>

      <div className="kpis">
        {kpis.map((k) => {
          const good = k.delta === 0 ? null : (k.delta > 0) === k.upIsGood;
          const amt = `${Math.abs(k.delta)}${k.unit === '%' ? L(' pts', ' نقطة') : ''}`;
          return (
            <button key={k.key} type="button" className="kpi" aria-pressed={drill === k.key} onClick={() => setDrill(drill === k.key ? null : k.key)}>
              <span className="kpi-label">{pick(k.label)}</span>
              <span className="kpi-value" dir="ltr">{fmtVal(k, k.value)}<small>{k.unit}</small></span>
              <span className={`kpi-delta ${good === null ? '' : good ? 'up-good' : 'up-bad'}`}>
                {k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '■'} {L(`${amt} vs last term`, `${amt} عن الفصل السابق`)}
              </span>
              <Spark data={k.trend} />
            </button>
          );
        })}
      </div>

      {drillK && (
        <section className="card panel drill" aria-label={pick(drillK.label)}>
          <header className="panel-head">
            <h2>{pick(drillK.label)} · {L('last 8 weeks', 'آخر 8 أسابيع')}</h2>
            <button type="button" className="ghost" onClick={() => setDrill(null)}>{L('Close', 'إغلاق')}</button>
          </header>
          <p className="muted">{pick(drillK.note)}</p>
          <TrendBars k={drillK} lang={lang} />
        </section>
      )}

      {!one && (
        <section className="card panel" aria-label={L('Trades', 'التخصصات')}>
          <header className="panel-head"><h2>{L('Trades at this centre', 'التخصصات في هذا المركز')}</h2>
            <span className="muted">{L('Open a trade to filter the whole dashboard', 'افتح تخصصًا لتصفية لوحة المعلومات كلها')}</span></header>
          <div className="trade-cards">
            {TRADES.map((t) => (
              <button key={t.id} type="button" className="trade-card" onClick={() => setTrade(t.id)}>
                <span className="trade-card-head"><TradeIcon trade={t} />
                  <span><strong>{pick(t.name)}</strong><small dir="ltr">{t.framework.code}</small></span></span>
                <dl>
                  <div><dt>{L('Learners', 'المتدربون')}</dt><dd>{t.overview.learners}</dd></div>
                  <div><dt>{L('Attainment', 'التحقق')}</dt><dd>{t.overview.attainment}%</dd></div>
                  <div><dt>{L('Utilisation', 'الاستغلال')}</dt><dd>{t.overview.utilisation}%</dd></div>
                </dl>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="dash-grid">
        <section className="card panel" aria-label={L('Regional skill heatmap', 'خريطة المهارات الإقليمية')}>
          <header className="panel-head"><h2>{L('Regional skill heatmap', 'خريطة المهارات الإقليمية')}</h2>
            <span className="muted">{L('% of learners at autonomous or above', '% المتدربين بمستوى "مستقل" أو أعلى')}</span></header>
          <div className="scroll-x">
            <table className="heat">
              <thead><tr><th scope="col">{L('Region', 'المنطقة')}</th>{columns.map((u) => <th key={u.code} scope="col" title={pick(u.title)}>{u.code}</th>)}</tr></thead>
              <tbody>
                {REGIONS.map((r, ri) => (
                  <tr key={r.key} className={hotRegion === r.key ? 'is-mine' : ''}>
                    <th scope="row">{pick(r.name)}{hotRegion === r.key && <span className="you">{L('this school', 'هذه المدرسة')}</span>}</th>
                    {heat[ri]!.map((v, ci) => (
                      <td key={ci} style={{ ['--v' as string]: v / 100 }} className={v >= 60 ? 'hi' : ''}
                        title={`${pick(r.name)} · ${columns[ci]!.code} ${pick(columns[ci]!.title)}: ${v}%`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="heat-legend" aria-hidden="true"><span>0%</span><i /><span>100%</span></div>
          <p className="muted small">{one ? pick(one.heatNote) : L('Columns are trades (mean across their units). Upper Egypt trails in every trade; welding is the widest gap.',
            'الأعمدة هي التخصصات (متوسط وحداتها). الصعيد متأخر في كل التخصصات، وأكبر فجوة في اللحام.')}</p>
        </section>

        <section className="card panel" aria-label={L('Asset utilisation', 'استغلال الأصول')}>
          <header className="panel-head"><h2>{L('Asset utilisation · 30 days', 'استغلال الأصول · 30 يومًا')}</h2>
            <span className="muted">{L('booked ÷ available hours', 'الساعات المحجوزة ÷ المتاحة')}</span></header>
          <ul className="bars">
            {assets.map((a) => {
              const flag = a.pct > 85 ? L('Bottleneck', 'اختناق') : a.pct < 35 ? L('Under-used', 'استغلال ضعيف') : null;
              return (
                <li key={a.tag} title={`${a.tag} ${pick(a.name)}: ${a.pct}%`}>
                  <span className="bar-label"><b>{a.tag}</b><small>{pick(a.name)}</small></span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${a.pct}%` }} />
                    <span className="bar-mark" style={{ insetInlineStart: '35%' }} /><span className="bar-mark" style={{ insetInlineStart: '85%' }} />
                  </span>
                  <span className="bar-val">{a.pct}%</span>
                  {flag ? <span className={`flag ${a.pct > 85 ? 'flag-warn' : 'flag-info'}`}>{a.pct > 85 ? '▲' : '▽'} {flag}</span> : <span />}
                </li>
              );
            })}
          </ul>
          <p className="muted small">{L('Ticks mark the 35% and 85% thresholds.', 'العلامتان تحددان حدي 35% و85%.')} {one ? pick(one.assetNote)
            : L('Busiest assets across all trades. Vehicle lifts and CNC lathes are the bottlenecks.', 'أكثر الأصول انشغالًا في كل التخصصات. رافعات السيارات ومخارط CNC هي نقاط الاختناق.')}</p>
        </section>

        <section className="card panel" aria-label={L('Consumables', 'المستهلكات')}>
          <header className="panel-head"><h2>{L('Consumables · stock', 'المستهلكات · المخزون')}</h2>
            <span className="muted">{L('lowest against reorder point first', 'الأقرب لحد إعادة الطلب أولًا')}</span></header>
          <ul className="stock">
            {stock.slice(0, one ? 3 : 6).map((c) => {
              const low = c.onHand <= c.reorderAt;
              return (
                <li key={c.trade.id + c.code} className={low ? 'low' : ''}>
                  <span>{pick(c.name)}</span>
                  <span className="qty">{low ? '▲ ' : ''}{c.onHand} {pick(c.unit)}</span>
                  <small>{!one && `${pick(c.trade.name)} · `}{L(`reorder at ${c.reorderAt} ${c.unit.en}`, `إعادة الطلب عند ${c.reorderAt} ${c.unit.ar}`)}</small>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card panel" aria-label={L('Compliance and IQA', 'الامتثال وضمان الجودة')}>
          <header className="panel-head"><h2>{L('Compliance & IQA', 'الامتثال وضمان الجودة الداخلي')}</h2></header>
          <ul className="queue">
            {COMPLIANCE.map((c) => (
              <li key={c.id} className={c.severity === 'ok' || done[c.id] ? 'q-ok' : 'q-warn'}>
                <span className="q-icon" aria-hidden="true">{c.severity === 'ok' || done[c.id] ? '✓' : '▲'}</span>
                <span className="q-text">{pick(c.text)}</span>
                {c.action && (done[c.id]
                  ? <span className="muted small">{pick(c.doneText!)} · {L('just now', 'الآن')}</span>
                  : <button type="button" onClick={() => setDone((d) => ({ ...d, [c.id]: true }))}>{pick(c.action)}</button>)}
              </li>
            ))}
            {vlabIncidents > 0 && (
              <li className="q-warn"><span className="q-icon" aria-hidden="true">▲</span>
                <span className="q-text">{L(`${vlabIncidents} V-Lab safety-gate breach${vlabIncidents === 1 ? '' : 'es'} today (exam mode)`,
                  `${vlabIncidents} مخالفة لشروط الأمان في المعمل الافتراضي اليوم (وضع الامتحان)`)}</span></li>
            )}
          </ul>
        </section>

        <section className="card panel" aria-label={L('Question bank quality', 'جودة بنك الأسئلة')}>
          <header className="panel-head"><h2>{L('Item quality', 'جودة الأسئلة')}</h2>
            <span className="muted">{one ? L(`${one.framework.code} bank · ${flagged.length} of ${bank.length} sample items flagged`, `بنك ${one.framework.code} · ${flagged.length} من ${bank.length} أسئلة بحاجة لمراجعة`)
              : L('1,240 items · 38 flagged', '1,240 سؤالًا · 38 بحاجة لمراجعة')}</span></header>
          <p className="muted small">{L('Flagged when difficulty p < 0.2 or > 0.85, or discrimination D < 0.2.',
            'يُعلَّم السؤال إذا كان معامل الصعوبة p أقل من 0.2 أو أكبر من 0.85، أو معامل التمييز D أقل من 0.2.')}</p>
          <div className="scroll-x">
            <table className="items">
              <thead><tr><th>{L('Item', 'السؤال')}</th><th>{L('Stem', 'نص السؤال')}</th><th className="num">p</th><th className="num">D</th></tr></thead>
              <tbody>
                {shownItems.map((q) => (
                  <tr key={q.id}><td className="mono">{q.id}<small>{q.trade.code} · {q.unit}</small></td><td>{pick(q.stem)}</td>
                    <td className={`num ${q.p < 0.2 || q.p > 0.85 ? 'bad' : ''}`}>{q.p.toFixed(2)}</td>
                    <td className={`num ${q.d < 0.2 ? 'bad' : ''}`}>{q.d.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card panel wide" aria-label={L('Latest V-Lab evaluations', 'أحدث تقييمات المعمل الافتراضي')}>
          <header className="panel-head"><h2>{L('Latest V-Lab evaluations', 'أحدث تقييمات المعمل الافتراضي')}</h2>
            <span className="muted">{L('scored by the rubric engine · new attempts appear here live', 'مقيّمة بمحرك المعايير · تظهر المحاولات الجديدة هنا مباشرة')}</span></header>
          <div className="scroll-x">
            <table className="evals">
              <thead><tr><th>{L('Learner', 'المتدرب')}</th><th>{L('Lab', 'المعمل')}</th><th>{L('Mode', 'الوضع')}</th>
                <th className="num">{L('Score', 'الدرجة')}</th><th>{L('Result', 'النتيجة')}</th><th>{L('When', 'الوقت')}</th></tr></thead>
              <tbody>
                {scopedEvals.map((e) => (
                  <tr key={e.id} className={e.live ? 'is-live' : ''}>
                    <td>{pick(e.learner)}{e.live && <span className="you">{L('new', 'جديد')}</span>}</td><td>{pick(tradeById(e.trade).lab.title)}</td><td>{pick(MODE[e.mode])}</td>
                    <td className="num">{e.score}</td>
                    <td><span className={`res ${e.passed ? 'res-pass' : 'res-fail'}`}>
                      {e.passed ? `✓ ${L('Pass', 'ناجح')}` : `✗ ${L('Not yet', 'لم يجتز بعد')}${e.gateFailures.length ? ` · ${L('gate', 'شرط أمان')}: ${e.gateFailures.join(', ')}` : ''}`}
                    </span></td>
                    <td className="muted">{pick(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {pack && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="iqa-title">
          <div className="modal-card">
            <header className="panel-head"><h2 id="iqa-title">{L('IQA evidence pack', 'حزمة أدلة ضمان الجودة الداخلي')}</h2>
              <button type="button" className="ghost" onClick={() => setPack(null)}>{L('Close', 'إغلاق')}</button></header>
            <p className="muted small">{L('Each evaluation carries a SHA-256 hash, and the pack has its own, so an auditor can check nothing changed after export. The production build also attaches telemetry summaries and signed logbook entries.',
              'كل تقييم يحمل بصمة SHA-256، وللحزمة بصمتها الخاصة، ليتحقق المدقق من عدم تغيير أي شيء بعد التصدير. النسخة الإنتاجية ترفق أيضًا ملخصات القياس وسجلات التدريب المعتمدة.')}</p>
            <textarea id="iqa-pack" className="mono" dir="ltr" readOnly value={pack} rows={14} />
            <button type="button" className="primary" onClick={() => void copy()}>{copied ? L('Copied', 'تم النسخ') : L('Copy JSON', 'نسخ JSON')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Spark({ data }: { data: number[] }) {
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [4 + (i * 112) / (data.length - 1), 26 - ((v - min) / span) * 20] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const last = pts.at(-1)!;
  return (
    <svg className="spark" viewBox="0 0 120 30" aria-hidden="true">
      <path d={`${d}L${last[0]},30L4,30Z`} className="spark-area" />
      <path d={d} className="spark-line" />
      <circle cx={last[0]} cy={last[1]} r={3} className="spark-dot" />
    </svg>
  );
}

/** Weekly bars. Time runs left-to-right in both languages, as in printed Arabic charts. */
function TrendBars({ k, lang }: { k: Kpi; lang: Lang }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = k.unit === '%' ? 100 : k.unit === '/5' ? 5 : Math.max(...k.trend) + 1;
  const W = 640, H = 200, padL = 36, padB = 24, bw = (W - padL) / k.trend.length;
  const ticks = [0, max / 2, max];
  const y = (v: number) => H - padB - (v / max) * (H - padB - 10);
  return (
    <div className="scroll-x">
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${k.label[lang]}: ${k.trend.map((v) => fmtVal(k, v)).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}><line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis">{fmtVal(k, t)}</text></g>
        ))}
        {k.trend.map((v, i) => {
          const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={0} width={bw} height={H - padB} fill="transparent" />
              <path className={`bar ${i === k.trend.length - 1 ? 'bar-now' : ''}`}
                d={`M${x},${y(0)}V${y(v) + 4}q0,-4 4,-4h${w - 8}q4,0 4,4V${y(0)}Z`} />
              <text x={x + w / 2} y={H - 6} textAnchor="middle" className="axis">{TREND_LABELS[i]![lang]}</text>
              {(hover === i || (hover === null && i === k.trend.length - 1)) && (
                <text x={x + w / 2} y={y(v) - 8} textAnchor="middle" className="bar-val-label">{fmtVal(k, v)}{k.unit}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
