/** Screen 3 — Centre Director / Executive Analytics Dashboard (docs/ui-blueprint.md §3). */
import { useMemo, useState } from 'react';
import {
  ASSETS, COMPLIANCE, FLAGGED_ITEMS, HEATMAP, INSTITUTIONS, KPIS, REGIONS, TERMS, TRADES, TREND_LABELS, UNITS, type Kpi,
} from './data';
import { useStore } from './store';

/** Deterministic nudge so each filter combination shows plausible, stable numbers. */
function nudge(seed: string, i: number, span: number) {
  let h = 2166136261;
  for (const ch of `${seed}|${i}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % (span * 2 + 1)) - span;
}
const REGION_OF: Record<string, string | undefined> = { 'ATS Cairo East': 'Cairo', 'ATS Giza West': 'Giza', 'ATS Alexandria': 'Alexandria' };
const fmtVal = (k: Kpi, v: number) => (k.unit === '/5' ? v.toFixed(1) : String(Math.round(v)));

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function DirectorDashboard() {
  const { evals, alerts } = useStore();
  const [inst, setInst] = useState<string>(INSTITUTIONS[0]);
  const [term, setTerm] = useState<string>(TERMS[0]);
  const [trade, setTrade] = useState<string>(TRADES[0]);
  const [drill, setDrill] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [pack, setPack] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const seed = `${inst}|${term}|${trade}`;
  const isBase = inst === INSTITUTIONS[0] && term === TERMS[0] && trade === TRADES[0];

  const kpis = useMemo(() => KPIS.map((k, i) => {
    if (isBase) return k;
    const scale = k.unit === '/5' ? 0.1 : 1;
    const d = nudge(seed, i, k.unit === '' ? 2 : 6) * scale;
    const clampV = (v: number) => Math.max(0, k.unit === '/5' ? Math.min(5, v) : k.unit === '%' ? Math.min(100, v) : v);
    return { ...k, value: clampV(k.value + d), trend: k.trend.map((t) => clampV(t + d)) };
  }), [seed, isBase]);
  const assets = useMemo(() => ASSETS.map((a, i) => ({ ...a, pct: isBase ? a.pct : Math.max(8, Math.min(99, a.pct + nudge(seed, i + 10, 7))) }))
    .sort((a, b) => b.pct - a.pct), [seed, isBase]);
  const heat = useMemo(() => HEATMAP.map((row, r) => row.map((v, c) => (isBase ? v : Math.max(5, Math.min(99, v + nudge(seed, r * 10 + c + 20, 5)))))), [seed, isBase]);

  const drillK = kpis.find((k) => k.key === drill);
  const hotRegion = REGION_OF[inst];
  const vlabIncidents = alerts.filter((a) => a.source === 'V-Lab').length;

  const exportPack = async () => {
    const items = evals.map((e) => ({ learner: e.learner, lab: e.lab, mode: e.mode, score: e.score, passed: e.passed, gateFailures: e.gateFailures, at: e.at }));
    const hashed = await Promise.all(items.map(async (it) => ({ ...it, sha256: await sha256(JSON.stringify(it)) })));
    const body = { institution: inst, term, trade, generatedAt: new Date().toISOString(), evaluations: hashed };
    setPack(JSON.stringify({ ...body, packSha256: await sha256(JSON.stringify(body)) }, null, 2));
    setCopied(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(pack ?? ''); setCopied(true); }
    catch { (document.getElementById('iqa-pack') as HTMLTextAreaElement | null)?.select(); }
  };

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <p className="eyebrow">Director · Institutional health</p>
          <h1>{inst}</h1>
        </div>
        <div className="filters">
          <label className="field"><span>School</span>
            <select id="f-inst" value={inst} onChange={(e) => setInst(e.target.value)}>{INSTITUTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field"><span>Term</span>
            <select id="f-term" value={term} onChange={(e) => setTerm(e.target.value)}>{TERMS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="field"><span>Trade</span>
            <select id="f-trade" value={trade} onChange={(e) => setTrade(e.target.value)}>{TRADES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <button type="button" className="primary" onClick={() => void exportPack()}>Export IQA pack</button>
        </div>
      </div>

      <div className="kpis">
        {kpis.map((k) => {
          const good = k.delta === 0 ? null : (k.delta > 0) === k.upIsGood;
          return (
            <button key={k.key} type="button" className="kpi" aria-pressed={drill === k.key} onClick={() => setDrill(drill === k.key ? null : k.key)}>
              <span className="kpi-label">{k.label}</span>
              <span className="kpi-value">{fmtVal(k, k.value)}<small>{k.unit}</small></span>
              <span className={`kpi-delta ${good === null ? '' : good ? 'up-good' : 'up-bad'}`}>
                {k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '■'} {Math.abs(k.delta)}{k.unit === '%' ? ' pts' : ''} vs last term
              </span>
              <Spark data={k.trend} />
            </button>
          );
        })}
      </div>

      {drillK && (
        <section className="panel drill" aria-label={`${drillK.label} detail`}>
          <header className="panel-head">
            <h2>{drillK.label} · last 8 weeks</h2>
            <button type="button" className="ghost" onClick={() => setDrill(null)}>Close</button>
          </header>
          <p className="muted">{drillK.note}</p>
          <TrendBars k={drillK} />
        </section>
      )}

      <div className="dash-grid">
        <section className="panel" aria-label="Regional skill heatmap">
          <header className="panel-head"><h2>Regional skill heatmap</h2><span className="muted">% of learners at autonomous or above</span></header>
          <div className="scroll-x">
            <table className="heat">
              <thead><tr><th scope="col">Region</th>{UNITS.map((u) => <th key={u.code} scope="col" title={u.title}>{u.code}</th>)}</tr></thead>
              <tbody>
                {REGIONS.map((r, ri) => (
                  <tr key={r} className={hotRegion === r ? 'is-mine' : ''}>
                    <th scope="row">{r}{hotRegion === r && <span className="you">this school</span>}</th>
                    {heat[ri]!.map((v, ci) => (
                      <td key={ci} style={{ ['--v' as string]: v / 100 }} className={v >= 60 ? 'hi' : ''}
                        title={`${r} · ${UNITS[ci]!.code} ${UNITS[ci]!.title}: ${v}%`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="heat-legend" aria-hidden="true"><span>0%</span><i /><span>100%</span></div>
          <p className="muted small">Weakest cell: Upper Egypt · U04 Motor control fault finding. The DOL starter V-Lab is assigned there next term.</p>
        </section>

        <section className="panel" aria-label="Asset utilisation">
          <header className="panel-head"><h2>Asset utilisation · 30 days</h2><span className="muted">booked ÷ available hours</span></header>
          <ul className="bars">
            {assets.map((a) => {
              const flag = a.pct > 85 ? 'Bottleneck' : a.pct < 35 ? 'Under-used' : null;
              return (
                <li key={a.tag} title={`${a.tag} ${a.name}: ${a.pct}%`}>
                  <span className="bar-label"><b>{a.tag}</b><small>{a.name}</small></span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${a.pct}%` }} />
                    <span className="bar-mark" style={{ left: '35%' }} /><span className="bar-mark" style={{ left: '85%' }} />
                  </span>
                  <span className="bar-val">{a.pct}%</span>
                  {flag ? <span className={`flag ${a.pct > 85 ? 'flag-warn' : 'flag-info'}`}>{a.pct > 85 ? '▲' : '▽'} {flag}</span> : <span />}
                </li>
              );
            })}
          </ul>
          <p className="muted small">Ticks mark the 35% and 85% thresholds. Both CNC lathes run above 85%: add a Saturday CNC slot or move JC-121 to MILL-04.</p>
        </section>

        <section className="panel" aria-label="Compliance and IQA">
          <header className="panel-head"><h2>Compliance &amp; IQA</h2></header>
          <ul className="queue">
            {COMPLIANCE.map((c) => (
              <li key={c.id} className={c.severity === 'ok' || done[c.id] ? 'q-ok' : 'q-warn'}>
                <span className="q-icon" aria-hidden="true">{c.severity === 'ok' || done[c.id] ? '✓' : '▲'}</span>
                <span className="q-text">{c.text}</span>
                {c.action && (done[c.id]
                  ? <span className="muted small">{c.doneText} · just now</span>
                  : <button type="button" onClick={() => setDone((d) => ({ ...d, [c.id]: true }))}>{c.action}</button>)}
              </li>
            ))}
            {vlabIncidents > 0 && (
              <li className="q-warn"><span className="q-icon" aria-hidden="true">▲</span>
                <span className="q-text">{vlabIncidents} V-Lab safety-gate breach{vlabIncidents === 1 ? '' : 'es'} today (exam mode)</span></li>
            )}
          </ul>
        </section>

        <section className="panel" aria-label="Question bank quality">
          <header className="panel-head"><h2>Item quality</h2><span className="muted">1,240 items · 38 flagged</span></header>
          <p className="muted small">Flagged when difficulty p &lt; 0.2 or &gt; 0.85, or discrimination D &lt; 0.2.</p>
          <div className="scroll-x">
            <table className="items">
              <thead><tr><th>Item</th><th>Stem</th><th className="num">p</th><th className="num">D</th></tr></thead>
              <tbody>
                {FLAGGED_ITEMS.map((q) => (
                  <tr key={q.id}><td className="mono">{q.id}<small>{q.unit}</small></td><td>{q.stem}</td>
                    <td className={`num ${q.p < 0.2 || q.p > 0.85 ? 'bad' : ''}`}>{q.p.toFixed(2)}</td>
                    <td className={`num ${q.d < 0.2 ? 'bad' : ''}`}>{q.d.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel wide" aria-label="Latest V-Lab evaluations">
          <header className="panel-head"><h2>Latest V-Lab evaluations</h2><span className="muted">scored by the rubric engine · new attempts appear here live</span></header>
          <div className="scroll-x">
            <table className="evals">
              <thead><tr><th>Learner</th><th>Lab</th><th>Mode</th><th className="num">Score</th><th>Result</th><th>When</th></tr></thead>
              <tbody>
                {evals.map((e) => (
                  <tr key={e.id} className={e.live ? 'is-live' : ''}>
                    <td>{e.learner}{e.live && <span className="you">new</span>}</td><td>{e.lab}</td><td>{e.mode}</td>
                    <td className="num">{e.score}</td>
                    <td><span className={`res ${e.passed ? 'res-pass' : 'res-fail'}`}>{e.passed ? '✓ Pass' : `✗ Not yet${e.gateFailures.length ? ` · gate: ${e.gateFailures.join(', ')}` : ''}`}</span></td>
                    <td className="muted">{e.at}</td>
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
            <header className="panel-head"><h2 id="iqa-title">IQA evidence pack</h2><button type="button" className="ghost" onClick={() => setPack(null)}>Close</button></header>
            <p className="muted small">Each evaluation carries a SHA-256 hash, and the pack has its own, so an auditor can check nothing changed after export. The production build also attaches telemetry summaries and signed logbook entries.</p>
            <textarea id="iqa-pack" className="mono" readOnly value={pack} rows={14} />
            <button type="button" className="primary" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy JSON'}</button>
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

function TrendBars({ k }: { k: Kpi }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = k.unit === '%' ? 100 : k.unit === '/5' ? 5 : Math.max(...k.trend) + 1;
  const W = 640, H = 200, padL = 36, padB = 24, bw = (W - padL) / k.trend.length;
  const ticks = [0, max / 2, max];
  const y = (v: number) => H - padB - (v / max) * (H - padB - 10);
  return (
    <div className="scroll-x">
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${k.label} by week: ${k.trend.map((v) => fmtVal(k, v)).join(', ')}`}>
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
              <text x={x + w / 2} y={H - 6} textAnchor="middle" className="axis">{TREND_LABELS[i]}</text>
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
