/** Compare: any two of my attempts criterion by criterion, two machines side by side in 3D, or two parts. */
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { ModelScene } from '../MachineExplorer';
import { modelParts, type ModelDef } from '../../models/kit';
import { usePv } from './ctx';
import { KIND_ATTEMPT } from './Desk';
import { noteFor } from './Study';
import { allModels, diffCriteria, machineName, MASTERED_BOX, partsOf, type AttemptRecord, type PartInfo } from './model';

type Mode = 'attempts' | 'machines' | 'parts';

export function Compare() {
  const { L, focus } = usePv();
  const [mode, setMode] = useState<Mode>('attempts');
  useEffect(() => { if (focus.part) setMode('parts'); else if (focus.compare) setMode('attempts'); }, [focus]);
  return (
    <div className="pv-compare">
      <div className="pv-seg pv-seg-lg" role="radiogroup" aria-label={L('What to compare', 'ماذا تقارن')}>
        <button type="button" role="radio" aria-checked={mode === 'attempts'} onClick={() => setMode('attempts')}>{L('My attempts', 'محاولاتي')}</button>
        <button type="button" role="radio" aria-checked={mode === 'machines'} onClick={() => setMode('machines')}>{L('Machines', 'الماكينات')}</button>
        <button type="button" role="radio" aria-checked={mode === 'parts'} onClick={() => setMode('parts')}>{L('Parts', 'القطع')}</button>
      </div>
      <div hidden={mode !== 'attempts'}><Attempts /></div>
      {mode === 'machines' && <Machines />}
      <div hidden={mode !== 'parts'}><Parts /></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------
function Attempts() {
  const { L, pick, attempts, focus, date } = usePv();
  const [kind, setKind] = useState<AttemptRecord['kind'] | 'all'>('all');
  const groups = useMemo(() => {
    const m = new Map<string, AttemptRecord[]>();
    for (const a of attempts) if (kind === 'all' || a.kind === kind) m.set(a.ref, [...(m.get(a.ref) ?? []), a]);
    return [...m.entries()].map(([ref, list]) => ({ ref, list, title: list[0]!.title, kind: list[0]!.kind })).sort((a, b) => b.list.length - a.list.length);
  }, [attempts, kind]);
  const [ref, setRef] = useState<string | undefined>(focus.compare);
  useEffect(() => { if (focus.compare) { setRef(focus.compare); setKind('all'); } }, [focus.compare]);
  const group = groups.find((g) => g.ref === ref) ?? groups[0];
  const list = group?.list ?? [];
  const [pair, setPair] = useState<[string | undefined, string | undefined]>([undefined, undefined]);
  // Default: the attempt before last against the latest.
  const aId = list.some((x) => x.id === pair[0]) ? pair[0] : list[1]?.id ?? list[0]?.id;
  const bId = list.some((x) => x.id === pair[1]) ? pair[1] : list[0]?.id;
  const A = list.find((x) => x.id === aId);
  const B = list.find((x) => x.id === bId);
  const kinds = (['vlab', 'lesson', 'safety', 'practice'] as const).filter((k) => attempts.some((a) => a.kind === k));

  if (!attempts.length) {
    return <div className="pv-card pv-empty-big"><b>{L('No attempts yet', 'لا توجد محاولات بعد')}</b>
      <span>{L('Every lesson, safety run, V-Lab attempt and practice round you finish is kept here, so you can see how you improve.',
        'كل درس أو محاكاة سلامة أو محاولة في المعمل الافتراضي أو جولة تدريب تُكملها تُحفظ هنا لترى كيف تتحسن.')}</span></div>;
  }
  return (
    <div className="pv-attempts">
      <div className="pv-chips" role="radiogroup" aria-label={L('Kind', 'النوع')}>
        <button type="button" role="radio" aria-checked={kind === 'all'} onClick={() => setKind('all')}>{L('All', 'الكل')} <span>{attempts.length}</span></button>
        {kinds.map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{pick(KIND_ATTEMPT[k])} <span>{attempts.filter((a) => a.kind === k).length}</span></button>)}
      </div>
      <div className="pv-grid pv-grid-2-1">
        <section className="pv-card">
          <label className="pv-field">
            <span>{L('Activity', 'النشاط')}</span>
            <select value={group?.ref} onChange={(e) => { setRef(e.target.value); setPair([undefined, undefined]); }}>
              {groups.map((g) => <option key={g.ref} value={g.ref}>{g.kind === 'practice' ? '' : `${pick(KIND_ATTEMPT[g.kind])} · `}{pick(g.title)} ({g.list.length})</option>)}
            </select>
          </label>
          {list.length > 1 ? <Trend points={[...list].reverse().map((a) => ({ at: a.at, score: a.score, mark: a.id === aId ? 'A' : a.id === bId ? 'B' : undefined }))} />
            : <p className="pv-empty">{L('Do this one again to see a trend and compare two tries.', 'أعد هذا النشاط لترى الاتجاه وتقارن محاولتين.')}</p>}
        </section>
        <section className="pv-card">
          <h3>{L('Pick two', 'اختر محاولتين')}</h3>
          <table className="pv-pick">
            <thead><tr><th>A</th><th>B</th><th>{L('When', 'الوقت')}</th><th className="num">{L('Score', 'الدرجة')}</th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td><input type="radio" name="pv-a" aria-label={`A · ${date(x.at, true)}`} checked={x.id === aId} onChange={() => setPair([x.id, bId])} /></td>
                  <td><input type="radio" name="pv-b" aria-label={`B · ${date(x.at, true)}`} checked={x.id === bId} onChange={() => setPair([aId, x.id])} /></td>
                  <td>{date(x.at, true)}{x.mode ? <small> · {x.mode}</small> : null}</td>
                  <td className="num">{Math.round(x.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {A && B && <SideBySide a={A} b={B} />}
    </div>
  );
}

function SideBySide({ a, b }: { a: AttemptRecord; b: AttemptRecord }) {
  const { L, pick, date } = usePv();
  const rows = diffCriteria(a, b);
  const d = Math.round(b.score - a.score);
  const scored = rows.filter((r) => r.delta !== undefined);
  const gain = [...scored].sort((x, y) => y.delta! - x.delta!)[0];
  const weak = [...rows].filter((r) => r.b !== undefined).sort((x, y) => x.b! - y.b!)[0];
  const card = (x: AttemptRecord, tag: string) => (
    <div className="pv-vs-card">
      <span className="pv-vs-tag">{tag}</span>
      <span className={`pv-score big ${x.score >= 80 ? 'ok' : x.score >= 50 ? 'mid' : 'low'}`}>{Math.round(x.score)}</span>
      <span><b>{date(x.at, true)}</b><small>{[x.mode, x.passed === undefined ? '' : x.passed ? L('passed', 'ناجح') : L('not yet', 'لم يجتز'), pick(x.detail)].filter(Boolean).join(' · ')}</small></span>
    </div>
  );
  return (
    <section className="pv-card pv-vs">
      <div className="pv-vs-head">
        {card(a, 'A')}
        <div className={`pv-delta ${d > 0 ? 'pv-up' : d < 0 ? 'pv-down' : ''}`}><b>{d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d)}</b><small>{L('B against A', 'ب مقابل أ')}</small></div>
        {card(b, 'B')}
      </div>
      {a.id === b.id ? <p className="pv-hint">{L('Pick two different attempts.', 'اختر محاولتين مختلفتين.')}</p> : (
        <p className="pv-insight">
          {d > 0 ? L(`You improved by ${d} points.`, `تحسّنت بمقدار ${d} نقطة.`) : d < 0 ? L(`This one was ${-d} points lower.`, `هذه أقل بمقدار ${-d} نقطة.`) : L('Same score both times.', 'الدرجة نفسها في المرتين.')}{' '}
          {gain && gain.delta! > 0 && L(`Biggest gain: ${gain.label.en}.`, `أكبر تحسن: ${gain.label.ar}.`)}{' '}
          {weak && weak.b! < 100 && L(`Work on next: ${weak.label.en} (${weak.b}).`, `ركّز بعد ذلك على: ${weak.label.ar} (${weak.b}).`)}
        </p>
      )}
      {rows.length > 0 && (
        <table className="pv-crit">
          <thead><tr><th>{L('Criterion', 'المعيار')}</th><th className="num">A</th><th className="num">B</th><th className="num">Δ</th><th aria-hidden="true" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{pick(r.label)}</th>
                <td className="num">{r.a ?? '—'}</td>
                <td className="num">{r.b ?? '—'}</td>
                <td className={`num ${r.delta! > 0 ? 'pv-up' : r.delta! < 0 ? 'pv-down' : ''}`}>{r.delta === undefined ? '' : r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                <td className="pv-bars"><span className="a" style={{ inlineSize: `${r.a ?? 0}%` }} /><span className="b" style={{ inlineSize: `${r.b ?? 0}%` }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Scores over time, 0–100, with the pass band shaded. */
export function Trend({ points }: { points: { at: string; score: number; mark?: string }[] }) {
  const { date, L } = usePv();
  const W = 320, H = 130, P = 22, PX = 34;
  const x = (i: number) => PX + (points.length < 2 ? (W - 2 * PX) / 2 : (i * (W - 2 * PX)) / (points.length - 1));
  const y = (s: number) => H - P - (s / 100) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  return (
    <svg className="pv-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L(`Scores: ${points.map((p) => Math.round(p.score)).join(', ')}`, `الدرجات: ${points.map((p) => Math.round(p.score)).join('، ')}`)}>
      <rect x={PX} y={y(100)} width={W - 2 * PX} height={y(80) - y(100)} className="pv-band" />
      {[0, 50, 100].map((g) => <g key={g}><line x1={PX} x2={W - PX} y1={y(g)} y2={y(g)} className="pv-grid-l" /><text x={PX - 8} y={y(g) + 3} textAnchor="end">{g}</text></g>)}
      <path d={path} className="pv-line" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.score)} r={p.mark ? 5.5 : 3.5} className={p.mark ? 'pv-dot is-mark' : 'pv-dot'}><title>{`${date(p.at, true)} · ${Math.round(p.score)}`}</title></circle>
          {p.mark && <text x={x(i)} y={y(p.score) - 9} textAnchor="middle" className="pv-mark">{p.mark}</text>}
        </g>
      ))}
      {points.length > 0 && <>
        <text x={PX} y={H - 4} className="pv-axis">{date(points[0]!.at)}</text>
        <text x={W - PX} y={H - 4} textAnchor="end" className="pv-axis">{date(points[points.length - 1]!.at)}</text>
      </>}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Machines, side by side in 3D
// ---------------------------------------------------------------------------
function Machines() {
  const { L, pick, catalog, trade, state, go } = usePv();
  const models = useMemo(() => allModels(catalog), [catalog]);
  const mine = models.filter((m) => m.trade.id === trade.id);
  const [ids, setIds] = useState<[string, string]>([mine[0]?.model.id ?? models[0]!.model.id, (mine[1] ?? models.find((m) => m.trade.id !== trade.id) ?? models[1] ?? models[0]!).model.id]);
  const [explode, setExplode] = useState(0);
  const [sel, setSel] = useState<[string | null, string | null]>([null, null]);
  const pickM = (i: 0 | 1) => models.find((m) => m.model.id === ids[i]) ?? models[0]!;
  const sides = [pickM(0), pickM(1)] as const;
  const facts = sides.map(({ model, trade: t }) => {
    const parts = partsOf(model, t);
    const known = parts.filter((p) => (state.cards[p.key]?.box ?? 0) >= MASTERED_BOX).length;
    return {
      parts, known,
      lessons: catalog.trades.flatMap((x) => x.lessons).filter((l) => l.model.id === model.id).length,
      safety: catalog.trades.flatMap((x) => x.safety).filter((s) => s.model.id === model.id).length,
      trades: catalog.trades.filter((x) => x.models.some((m) => m.id === model.id)).map((x) => pick(x.name)).join(', '),
    };
  });
  const shared = facts[0]!.parts.filter((p) => facts[1]!.parts.some((q) => q.id === p.id || q.name.en === p.name.en)).length;
  const STAND: Record<string, [string, string]> = { floor: ['On the floor', 'على الأرض'], bench: ['On a bench', 'على طاولة'], 'engine-stand': ['Engine stand', 'حامل محرك'], wall: ['Wall-mounted', 'مثبت على الحائط'], skid: ['On a skid', 'على قاعدة'], trolley: ['On a trolley', 'على عربة'] };
  return (
    <div className="pv-machines">
      <div className="pv-twins">
        {sides.map(({ model, trade: t }, i) => (
          <section key={i} className="pv-card pv-twin">
            <label className="pv-field">
              <span>{i ? 'B' : 'A'}</span>
              <select value={model.id} onChange={(e) => { const v = e.target.value; setIds((x) => (i ? [x[0], v] : [v, x[1]])); setSel((s) => (i ? [s[0], null] : [null, s[1]])); }}>
                {catalog.trades.map((tr) => (
                  <optgroup key={tr.id} label={pick(tr.name)}>
                    {models.filter((m) => m.trade.id === tr.id).map((m) => <option key={m.model.id} value={m.model.id}>{pick(machineName(m.model))} · {m.model.assetTag}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <ModelThumb model={model} explode={explode} selected={sel[i] ?? null} onSelect={(id) => setSel((s) => (i ? [s[0], id] : [id, s[1]]))} />
            <p className="pv-twin-cap">{pick(machineName(model))} <small>{pick(t.name)}</small></p>
            {sel[i] && (() => {
              const p = facts[i]!.parts.find((x) => x.id === sel[i]);
              return p ? <p className="pv-twin-sel"><b>{pick(p.name)}</b> {pick(p.does)} <button type="button" className="pv-link" onClick={() => go('compare', { part: p.key })}>{L('Compare this part', 'قارن هذه القطعة')}</button></p> : null;
            })()}
          </section>
        ))}
      </div>
      <label className="pv-explode">
        <span>{L('Take both apart', 'فكّك الماكينتين')} <b>{Math.round(explode * 100)}%</b></span>
        <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
      </label>
      <section className="pv-card">
        <table className="pv-facts">
          <thead><tr><th /><th>A · {pick(machineName(sides[0].model))}</th><th>B · {pick(machineName(sides[1].model))}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{L('Trade', 'التخصص')}</th><td>{facts[0]!.trades}</td><td>{facts[1]!.trades}</td></tr>
            <tr><th scope="row">{L('Asset tag', 'رقم الأصل')}</th><td dir="ltr">{sides[0].model.assetTag}</td><td dir="ltr">{sides[1].model.assetTag}</td></tr>
            <tr><th scope="row">{L('Stands', 'التركيب')}</th>{sides.map(({ model }, i) => { const s = STAND[model.env?.stand ?? 'floor']!; return <td key={i}>{L(s[0], s[1])}</td>; })}</tr>
            <tr><th scope="row">{L('Parts', 'القطع')}</th><td>{facts[0]!.parts.length}</td><td>{facts[1]!.parts.length}</td></tr>
            <tr><th scope="row">{L('Parts I know', 'قطع أعرفها')}</th>{facts.map((f, i) => <td key={i}><span className="pv-meter"><span style={{ inlineSize: `${(100 * f.known) / Math.max(1, f.parts.length)}%` }} /></span> {f.known}/{f.parts.length}</td>)}</tr>
            <tr><th scope="row">{L('Video lessons', 'دروس الفيديو')}</th><td>{facts[0]!.lessons}</td><td>{facts[1]!.lessons}</td></tr>
            <tr><th scope="row">{L('Safety simulations', 'محاكاة السلامة')}</th><td>{facts[0]!.safety}</td><td>{facts[1]!.safety}</td></tr>
            <tr><th scope="row">{L('Parts in common', 'قطع مشتركة')}</th><td colSpan={2}>{shared ? L(`${shared} parts appear in both`, `${shared} قطع موجودة في الاثنتين`) : L('None: each machine is built differently', 'لا يوجد: كل ماكينة مبنية بشكل مختلف')}</td></tr>
            <tr className="pv-parts-row"><th scope="row">{L('Parts list', 'قائمة القطع')}</th>
              {facts.map((f, i) => (
                <td key={i}><ol>{f.parts.map((p) => <li key={p.id}><button type="button" className={`pv-link ${sel[i] === p.id ? 'is-on' : ''}`} onClick={() => setSel((s) => (i ? [s[0], p.id] : [p.id, s[1]]))}>{pick(p.name)}</button></li>)}</ol></td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** A turntable view of a twin in the studio, with no pins or workshop: enough to see the shape and what goes where. */
function ModelThumb({ model, explode, selected, onSelect }: { model: ModelDef; explode: number; selected: string | null; onSelect: (id: string | null) => void }) {
  const { lang, active, tab } = usePv();
  const parts = useMemo(() => modelParts(model, lang), [model, lang]);
  const view = model.view ?? { camera: [5.2, 3.2, 6.6] as [number, number, number], target: [0, 0.7, 0] as [number, number, number] };
  const live = active && tab === 'compare';
  return (
    <div className="pv-thumb">
      <Canvas key={model.id} camera={{ position: view.camera, fov: 40, near: 0.05, far: 400 }} dpr={[1, 1.5]} frameloop={live ? 'always' : 'never'}
        onPointerMissed={() => onSelect(null)}>
        <ModelScene parts={parts} explode={explode} pins={false} workshop={false} params={model.params} lang={lang} selectedId={selected}
          select={(id) => onSelect(id)} />
        <OrbitControls target={view.target} enableDamping autoRotate={!selected} autoRotateSpeed={0.6} makeDefault />
      </Canvas>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------
function Parts() {
  const { L, pick, catalog, trade, state, focus, go } = usePv();
  const models = useMemo(() => allModels(catalog), [catalog]);
  const all = useMemo(() => models.flatMap(({ model, trade: t }) => partsOf(model, t)), [models]);
  const mine = all.filter((p) => p.trade.id === trade.id);
  const [keys, setKeys] = useState<[string, string]>(() => [mine[0]?.key ?? all[0]!.key, (all.find((p) => p.model !== mine[0]?.model && p.what) ?? all[1] ?? all[0]!).key]);
  useEffect(() => { if (focus.part && all.some((p) => p.key === focus.part)) setKeys((k) => [focus.part!, k[1] === focus.part ? k[0] : k[1]]); }, [focus.part, all]);
  const side = (i: 0 | 1) => all.find((p) => p.key === keys[i]) ?? all[0]!;
  const set = (i: 0 | 1, key: string) => setKeys((k) => (i ? [k[0], key] : [key, k[1]]));
  return (
    <div className="pv-twins">
      {([0, 1] as const).map((i) => {
        const p = side(i);
        return (
          <section key={i} className="pv-card pv-partcard">
            <div className="pv-field-row">
              <label className="pv-field"><span>{i ? 'B' : 'A'} · {L('Machine', 'الماكينة')}</span>
                <select value={p.model.id} onChange={(e) => set(i, all.find((x) => x.model.id === e.target.value)!.key)}>
                  {models.map((m) => <option key={m.model.id} value={m.model.id}>{pick(machineName(m.model))}</option>)}
                </select>
              </label>
              <label className="pv-field"><span>{L('Part', 'القطعة')}</span>
                <select value={p.key} onChange={(e) => set(i, e.target.value)}>
                  {all.filter((x) => x.model === p.model).map((x) => <option key={x.key} value={x.key}>{pick(x.name)}</option>)}
                </select>
              </label>
            </div>
            <PartFacts p={p} />
            <div className="pv-actions">
              <button type="button" className="pv-ghost" onClick={() => go('study', { part: p.key })}>{L('Study this card', 'ذاكر هذه البطاقة')}</button>
            </div>
            {noteFor(state.items, p.key)?.body && <p className="pv-note">✎ {noteFor(state.items, p.key)!.body}</p>}
          </section>
        );
      })}
    </div>
  );
}

function PartFacts({ p }: { p: PartInfo }) {
  const { L, pick, state, lang } = usePv();
  const c = state.cards[p.key];
  return (
    <div className="pv-partfacts">
      <h3>{pick(p.name)}</h3>
      <p className="pv-eyebrow">{pick(machineName(p.model))} · {pick(p.trade.name)} · {c ? (c.box >= MASTERED_BOX ? L('I know it ★', 'أعرفها ★') : L(`Box ${c.box}`, `صندوق ${c.box}`)) : L('Not studied yet', 'لم تُذاكر بعد')}</p>
      <h4>{L('What it is', 'ما هي')}</h4><p>{pick(p.what) || '—'}</p>
      <h4>{L('What it does', 'ماذا تفعل')}</h4><p>{pick(p.does) || '—'}</p>
      {p.specs[lang].length > 0 && <dl>{p.specs[lang].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {p.safety && <p className="pv-safety">⚠ {pick(p.safety)}</p>}
    </div>
  );
}
