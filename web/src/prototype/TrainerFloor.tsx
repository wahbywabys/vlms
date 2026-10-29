/** Screen 1 — Trainer Tablet Floor View (docs/ui-blueprint.md §1). */
import { useEffect, useMemo, useState } from 'react';
import { withinTolerance } from '../../../api/src/services/rubricEngine';
import { OBS_PASS, type ObsCriterion, type StationStatus } from './data';
import { tx } from './i18n';
import type { Trade } from './trades';
import { useL, useStore } from './store';
import { CardHead, PageHeader, StatStrip } from './ui';

type Marks = Record<string, string | number | undefined>;
interface Evidence { name: string; url: string; hash: string }

const GLYPH: Record<StationStatus, string> = { done: '✓', working: '●', alert: '▲', idle: '○' };
const STATUS_LABEL = {
  done: tx('Signed off', 'تم الاعتماد'), working: tx('Working', 'يعمل'), alert: tx('Alert', 'تنبيه'), idle: tx('Idle', 'متوقف'),
};
const VLAB_STATUS = { idle: tx('idle', 'لم يبدأ'), 'in progress': tx('in progress', 'جارٍ'), submitted: tx('submitted', 'تم الإرسال') };

function toleranceScore(c: Extract<ObsCriterion, { kind: 'tolerance' }>, v: number) {
  // Same helper the API uses: centre of the band ± half its width.
  const expected = c.nominal + (c.lower + c.upper) / 2;
  const half = (c.upper - c.lower) / 2;
  return withinTolerance(v, expected, half) ? 100 : withinTolerance(v, expected, half * 2) ? 50 : 0;
}

function scoreMarks(rubric: ObsCriterion[], m: Marks) {
  let weighted = 0, weights = 0, complete = true, gateFail = false;
  for (const c of rubric) {
    const v = m[c.key];
    if (v === undefined || v === '') { complete = false; continue; }
    if (c.kind === 'gate') { if (v === 'fail') gateFail = true; continue; }
    const s = c.kind === 'rating' ? (Number(v) / 4) * 100 : toleranceScore(c, Number(v));
    weighted += s * c.weight; weights += c.weight;
  }
  const score = weights ? Math.round(weighted / weights) : 0;
  return { complete, gateFail, score, passed: !gateFail && score >= OBS_PASS };
}

const firstOpen = (t: Trade) => (t.stations.find((s) => s.status === 'alert') ?? t.stations.find((s) => s.status === 'working') ?? t.stations[0]!).no;

/** Bottom strip: tools out, the consumable nearest its reorder point, and the next session. */
function floorFooter(t: Trade) {
  const low = [...t.consumables].sort((a, b) => a.onHand / a.reorderAt - b.onHand / b.reorderAt)[0]!;
  const short = low.onHand <= low.reorderAt;
  return [
    { label: tx('Tools out', 'عُدد مُعارة'), value: tx('3', '3') },
    { label: low.name, warn: short,
      value: tx(`${low.onHand} ${low.unit.en} left${short ? ` · reorder at ${low.reorderAt} ${low.unit.en}` : ''}`,
        `${low.onHand} ${low.unit.ar} متبقية${short ? ` · إعادة الطلب عند ${low.reorderAt} ${low.unit.ar}` : ''}`) },
    { label: tx('Next session', 'الحصة التالية'), value: tx('10:30 · Y2-C', '10:30 · السنة الثانية ج') },
  ];
}

async function sha256(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function TrainerFloor() {
  const { online, toggleOnline, queued, queueWrite, stations, updateStation, alerts, resolveAlert, faultCodes, setFaultCode, vlabs, trade } = useStore();
  const { L, pick } = useL();
  // Selection, marks, evidence and notes are kept per trade, so switching trade mid-assessment loses nothing.
  const [sels, setSels] = useState<Record<string, number>>({ cnc: 4 });
  const sel = sels[trade.id] ?? firstOpen(trade);
  const setSel = (no: number) => setSels((s) => ({ ...s, [trade.id]: no }));
  const key = `${trade.id}:${sel}`;
  const [marks, setMarks] = useState<Record<string, Marks>>({ 'cnc:4': { ppe: 'pass', setup: 3 } });
  const [evidence, setEvidence] = useState<Record<string, Evidence[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState<{ en: string; ar: string } | null>(null);
  const { bay, obsRubric, lab } = trade;
  const faultCode = faultCodes[trade.id]!;
  const vlab = vlabs[trade.id]!;

  const openAlerts = alerts.filter((a) => !a.resolution && a.trade === trade.id);
  const alertStations = new Set(openAlerts.map((a) => a.stationNo));
  const statusOf = (no: number, s: StationStatus): StationStatus => (alertStations.has(no) ? 'alert' : s === 'alert' ? 'working' : s);

  const station = stations.find((s) => s.no === sel)!;
  const m = marks[key] ?? {};
  const result = useMemo(() => scoreMarks(obsRubric, m), [obsRubric, m]);
  const setMark = (k: string, v: string | number) => setMarks((all) => ({ ...all, [key]: { ...all[key], [k]: v } }));

  useEffect(() => { setNoteOpen(false); }, [key]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const signOff = () => {
    updateStation(sel, { status: 'done', score: result.score, passed: result.passed });
    if (online) setToast(tx(`Station ${sel} signed off · saved`, `تم اعتماد المحطة ${sel} · حُفظ`));
    else { queueWrite(); setToast(tx(`Station ${sel} signed off · queued until online`, `تم اعتماد المحطة ${sel} · في الانتظار حتى عودة الاتصال`)); }
    const next = stations.find((s) => s.no > sel && s.status !== 'done') ?? stations.find((s) => s.status !== 'done' && s.no !== sel);
    if (next) setSel(next.no);
  };

  const addEvidence = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const hash = await sha256(f);
    setEvidence((e) => ({ ...e, [key]: [...(e[key] ?? []), { name: f.name, url: URL.createObjectURL(f), hash }] }));
    if (!online) queueWrite();
  };

  const counts = { done: 0, working: 0, alert: 0, idle: 0 } as Record<StationStatus, number>;
  for (const s of stations) counts[statusOf(s.no, s.status)]++;
  const done = counts.done;

  return (
    <div className="floor">
      <PageHeader
        crumbs={[L('Workshops', 'الورش'), pick(trade.name), pick(bay.name)]}
        title={<><span className="nowrap">{pick(bay.cohort)}</span> <span className="title-soft">· {L('Practical assessment', 'التقييم العملي')}</span></>}
        meta={<>{pick(bay.trainer)} · {L('Today', 'اليوم')} 09:40 · <span dir="ltr">{bay.jobCards}</span></>}
        actions={
          <button type="button" className={`pill ${online ? 'pill-ok' : 'pill-off'}`} onClick={toggleOnline}
            title={L('Tap to simulate losing the workshop Wi-Fi', 'اضغط لمحاكاة انقطاع شبكة الورشة')}>
            <span className="dot" aria-hidden="true" /> {online ? L('Online', 'متصل') : L('Offline', 'غير متصل')}
            <span className="pill-sub">
              {queued > 0 ? (online ? L(`syncing ${queued}…`, `جارٍ مزامنة ${queued}…`) : L(`${queued} queued`, `${queued} في الانتظار`)) : L('all saved', 'كل شيء محفوظ')}
            </span>
          </button>
        }
      />

      <StatStrip label={L('Bay summary', 'ملخص الورشة')} items={[
        { label: L('Signed off', 'تم الاعتماد'), value: <>{done}<small>/{stations.length}</small></>, tone: 'ok', icon: '✓' },
        { label: L('Working', 'يعمل'), value: counts.working, tone: 'info', icon: '●' },
        { label: L('Needs attention', 'يحتاج انتباهك'), value: openAlerts.length, tone: openAlerts.length ? 'warn' : 'neutral', icon: '▲',
          sub: openAlerts.length ? L('Resolve before you continue', 'عالجها قبل المتابعة') : L('Nothing open', 'لا شيء مفتوح') },
        { label: L('Idle', 'متوقف'), value: counts.idle, tone: 'neutral', icon: '○' },
      ]} />

      <div className="floor-grid">
        <div className="floor-left">
          {openAlerts.length > 0 && (
            <section className="card card-warn" aria-labelledby="alerts-title" role="alert">
              <CardHead id="alerts-title" title={<><span className="tri" aria-hidden="true">▲</span> {L('Needs attention', 'يحتاج انتباهك')}</>}
                sub={L('Safety alerts stay here until you record an action.', 'تبقى تنبيهات السلامة هنا حتى تسجّل إجراءً.')} />
              <div className="alerts">
                {openAlerts.map((a) => (
                  <div key={a.id} className="alert-card">
                    <button type="button" className="alert-main" onClick={() => a.stationNo && setSel(a.stationNo)}>
                      <span className="alert-icon" aria-hidden="true">▲</span>
                      <span>
                        <strong>{a.stationNo ? L(`Stn ${a.stationNo} · `, `محطة ${a.stationNo} · `) : ''}{pick(a.learner)}</strong>
                        <span className="alert-text">{pick(a.text)}</span>
                        <small>{a.source} · <span dir="ltr">{a.at}</span></small>
                      </span>
                    </button>
                    <div className="alert-actions">
                      <button type="button" onClick={() => resolveAlert(a.id, 'stopped')}>{L('Stopped & briefed', 'أوقفت العمل ووجّهت المتدرب')}</button>
                      <button type="button" className="ghost" onClick={() => resolveAlert(a.id, 'false_alarm')}>{L('False alarm', 'إنذار كاذب')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card" aria-labelledby="stations-title">
            <CardHead id="stations-title" title={L('Stations', 'المحطات')} sub={L('Tap a station to assess it.', 'اضغط على محطة لتقييمها.')}
              actions={
                <ul className="legend" aria-label={L('Legend', 'دليل الرموز')}>
                  {(['done', 'working', 'alert', 'idle'] as StationStatus[]).map((k) => (
                    <li key={k}><span className={`lg lg-${k}`} aria-hidden="true">{GLYPH[k]}</span>{pick(STATUS_LABEL[k])}</li>
                  ))}
                </ul>
              } />
            <div className="stations" role="listbox" aria-label={L('Stations', 'المحطات')}>
              {stations.map((s) => {
                const st = statusOf(s.no, s.status);
                return (
                  <button key={s.no} type="button" role="option" aria-selected={s.no === sel}
                    className={`stn stn-${st}`} onClick={() => setSel(s.no)}>
                    <span className="stn-no">{s.no}</span>
                    <span className="stn-glyph" aria-hidden="true">{GLYPH[st]}</span>
                    <span className="stn-name">{pick(s.learner)}</span>
                    <span className="stn-state">
                      {st === 'done' && s.score !== undefined ? `${s.score} · ${s.passed ? L('Pass', 'ناجح') : L('Not yet', 'لم يجتز بعد')}` : pick(STATUS_LABEL[st])}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card" aria-labelledby="vlab-title">
            <CardHead id="vlab-title" title={L('V-Lab · live session', 'المعمل الافتراضي · جلسة مباشرة')}
              sub={<>{pick(vlab.learner)} · {pick(lab.title)}</>}
              actions={<span className={`status-chip ${vlab.status === 'in progress' ? 'chip-on' : 'chip-neutral'}`}>{pick(VLAB_STATUS[vlab.status])}</span>} />
            <div className="vlab-card">
              <dl className="kv">
                <div><dt>{L('Mode', 'الوضع')}</dt><dd>{vlab.mode === 'Exam' ? L('Exam', 'امتحان') : L('Guided', 'موجّه')}</dd></div>
                <div><dt>{L('Telemetry events', 'أحداث القياس')}</dt><dd>{vlab.events}</dd></div>
              </dl>
              <label className="field">
                <span>{L('Fault injected for the next attempt', 'العطل المزروع للمحاولة القادمة')}</span>
                <select id="inject-fault" value={faultCode} onChange={(e) => setFaultCode(trade.id, e.target.value)}>
                  {lab.faults.map((f) => <option key={f.code} value={f.code}>{f.code} · {pick(f.title)}</option>)}
                </select>
              </label>
            </div>
          </section>
        </div>

        <section className="card obs" aria-labelledby="obs-title">
          <header className="obs-head">
            <div>
              <p className="obs-kicker">{L(`Station ${station.no} · Job card ${station.jobCard}`, `المحطة ${station.no} · بطاقة العمل ${station.jobCard}`)}</p>
              <h2 id="obs-title">{pick(station.learner)}</h2>
              <p className="muted">{pick(station.task)}</p>
            </div>
            <span className={`status-chip ${station.status === 'done' ? 'chip-on' : 'chip-neutral'}`}>{pick(STATUS_LABEL[statusOf(station.no, station.status)])}</span>
          </header>

          <div className="rubric">
            <p className="rubric-group">{L('Safety gates · must pass', 'شروط الأمان · يجب اجتيازها')}</p>
            {obsRubric.filter((c) => c.kind === 'gate').map((c) => (
              <div key={c.key} className="row row-gate">
                <div className="row-label">{pick(c.label)}</div>
                <div className="seg" role="radiogroup" aria-label={pick(c.label)}>
                  <button type="button" role="radio" aria-checked={m[c.key] === 'pass'} className="seg-pass" onClick={() => setMark(c.key, 'pass')}>✓ {L('Pass', 'ناجح')}</button>
                  <button type="button" role="radio" aria-checked={m[c.key] === 'fail'} className="seg-fail" onClick={() => setMark(c.key, 'fail')}>✗ {L('Fail', 'راسب')}</button>
                </div>
              </div>
            ))}
            <p className="rubric-group">{L('Performance · 1 = not yet, 4 = excellent', 'الأداء · 1 = لم يصل بعد، 4 = ممتاز')}</p>
            {obsRubric.filter((c) => c.kind !== 'gate').map((c) => (
              <div key={c.key} className="row">
                <div className="row-label">{pick(c.label)}<span className="weight">{c.weight}%</span></div>
                {c.kind === 'rating' && (
                  <div className="seg" role="radiogroup" aria-label={pick(c.label)}>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={m[c.key] === n} onClick={() => setMark(c.key, n)}>{n}</button>
                    ))}
                  </div>
                )}
                {c.kind === 'tolerance' && <ToleranceInput c={c} value={m[c.key]} onChange={(v) => setMark(c.key, v)} id={`tol-${trade.id}-${sel}`} />}
              </div>
            ))}
          </div>

          <div className="evidence">
            <label className="btn-file">
              <input id={`ev-${trade.id}-${sel}`} type="file" accept="image/*" capture="environment" onChange={(e) => { void addEvidence(e.target.files); e.target.value = ''; }} />
              <span aria-hidden="true">◉</span> {L('Add evidence photo', 'أضف صورة إثبات')}
            </label>
            <button type="button" className="ghost" aria-expanded={noteOpen} onClick={() => setNoteOpen((o) => !o)}>✎ {L('Note', 'ملاحظة')}</button>
            {(evidence[key] ?? []).map((e) => (
              <figure key={e.hash} className="thumb">
                <img src={e.url} alt={L(`Evidence: ${e.name}`, `إثبات: ${e.name}`)} />
                <figcaption className="mono" dir="ltr" title={e.hash}>sha256 {e.hash.slice(0, 10)}…</figcaption>
              </figure>
            ))}
          </div>
          {noteOpen && (
            <textarea id={`note-${trade.id}-${sel}`} className="note" rows={2} placeholder={pick(trade.obsNote)}
              value={notes[key] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))} />
          )}

          <footer className="obs-foot">
            <div className={`verdict ${!result.complete ? '' : result.passed ? 'v-pass' : 'v-fail'}`} aria-live="polite">
              <span className="v-score">{result.complete ? result.score : '—'}</span>
              <span className="v-text">
                <strong>{!result.complete ? L('In progress', 'قيد التقييم') : result.passed ? L('Pass', 'ناجح') : L('Not yet', 'لم يجتز بعد')}</strong>
                <small>{!result.complete ? L('Score every row to sign off', 'قيّم كل البنود للاعتماد')
                  : result.gateFail ? L('A safety gate failed', 'رسب في شرط أمان')
                  : L(`Pass mark ${OBS_PASS}`, `درجة النجاح ${OBS_PASS}`)}</small>
              </span>
            </div>
            <button type="button" className="primary" disabled={!result.complete || station.status === 'done'} onClick={signOff}>
              {station.status === 'done' ? L('Signed off', 'تم الاعتماد') : L('Sign off & next station', 'اعتماد والانتقال للمحطة التالية')}
            </button>
          </footer>
        </section>
      </div>

      <footer className="resources" aria-label={L('Bay resources', 'موارد الورشة')}>
        {floorFooter(trade).map((f) => (
          <span key={f.label.en} className={f.warn ? 'warn' : ''}><b>{pick(f.label)}</b> {pick(f.value)}</span>
        ))}
      </footer>
      {toast && <div className="toast" role="status">{pick(toast)}</div>}
    </div>
  );
}

function ToleranceInput({ c, value, onChange, id }: {
  c: Extract<ObsCriterion, { kind: 'tolerance' }>; value: string | number | undefined; onChange: (v: string) => void; id: string;
}) {
  const { L, pick } = useL();
  const v = value === undefined || value === '' ? null : Number(value);
  const s = v === null || Number.isNaN(v) ? null : toleranceScore(c, v);
  const lo = (c.nominal + c.lower).toFixed(3), hi = (c.nominal + c.upper).toFixed(3);
  return (
    <div className="tol">
      <label htmlFor={id} className="sr-only">{pick(c.measure)}</label>
      <input id={id} dir="ltr" inputMode="decimal" placeholder={c.nominal.toFixed(3)} value={value ?? ''}
        onChange={(e) => onChange(e.target.value.replace(',', '.').replace('٫', '.'))}
        className={s === null ? '' : s === 100 ? 'in' : s === 50 ? 'near' : 'out'} />
      <span className="mono tol-band" dir="ltr">{lo}–{hi} {c.unit}</span>
      {s !== null && <span className={`tol-flag ${s === 100 ? 'ok' : 'bad'}`}>
        {s === 100 ? `✓ ${L('In tolerance', 'ضمن التفاوت')}` : s === 50 ? `◐ ${L('Within 2×', 'ضمن ضعف التفاوت')}` : `✗ ${L('Out', 'خارج التفاوت')}`}
      </span>}
    </div>
  );
}
