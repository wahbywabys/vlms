/** Screen 1 — Trainer Tablet Floor View (docs/ui-blueprint.md §1). */
import { useEffect, useMemo, useState } from 'react';
import { OBS_PASS, type ObsCriterion, type StationStatus } from './data';
import { tx } from './i18n';
import type { Trade } from './trades';
import { useL, useStore } from './store';
import { CardHead, PageHeader, StatStrip } from './ui';
import { FloorRubric, previewScore, type Category, type Mark, type RubricCriterion, type RubricPhoto } from '../modules/FloorRubric';
import { compressImage } from '../modules/media';
import '../modules/tw.css';

type Marks = Record<string, Mark>;

const GLYPH: Record<StationStatus, string> = { done: '✓', working: '●', alert: '▲', idle: '○' };
const STATUS_LABEL = {
  done: tx('Signed off', 'تم الاعتماد'), working: tx('Working', 'يعمل'), alert: tx('Alert', 'تنبيه'), idle: tx('Idle', 'متوقف'),
};
const VLAB_STATUS = { idle: tx('idle', 'لم يبدأ'), 'in progress': tx('in progress', 'جارٍ'), submitted: tx('submitted', 'تم الإرسال') };

/** The trade's observation rubric in the shape the shared FloorRubric takes: gates are checks, tolerances carry their band. */
function toCriteria(rubric: ObsCriterion[]): RubricCriterion[] {
  return rubric.map((c): RubricCriterion => {
    const base = { key: c.key, label: c.label.en, labelAr: c.label.ar };
    if (c.kind === 'gate') return { ...base, weight: 0, isGate: true, rule: 'check', photoRule: 'on_fail', category: (c.key === 'ppe' ? 'ppe' : 'safety') as Category,
      descriptors: [{ value: 'pass', en: 'Met', ar: 'مستوفى' }, { value: 'fail', en: 'Not met · stop work', ar: 'غير مستوفى · أوقف العمل' }] };
    if (c.kind === 'rating') return { ...base, weight: c.weight, isGate: false, rule: 'rating', photoRule: 'on_fail',
      category: (/finish|bead|quality|appear/i.test(c.key + c.label.en) ? 'quality' : /clean|house|tidy/i.test(c.key + c.label.en) ? 'hygiene' : 'method') as Category };
    return { ...base, weight: c.weight, isGate: false, rule: 'measurement_tolerance', category: 'precision', photoRule: 'always',
      expected: c.nominal + (c.lower + c.upper) / 2, absTol: (c.upper - c.lower) / 2, unit: c.unit };
  });
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

export function TrainerFloor() {
  const { online, toggleOnline, queued, queueWrite, stations, updateStation, alerts, resolveAlert, faultCodes, setFaultCode, vlabs, trade } = useStore();
  const { L, pick, lang } = useL();
  // Selection, marks, evidence and notes are kept per trade, so switching trade mid-assessment loses nothing.
  const [sels, setSels] = useState<Record<string, number>>({ cnc: 4 });
  const sel = sels[trade.id] ?? firstOpen(trade);
  const setSel = (no: number) => setSels((s) => ({ ...s, [trade.id]: no }));
  const key = `${trade.id}:${sel}`;
  const [marks, setMarks] = useState<Record<string, Marks>>({ 'cnc:4': { ppe: 'pass', setup: 3 } });
  const [photos, setPhotos] = useState<Record<string, RubricPhoto[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ en: string; ar: string } | null>(null);
  const { bay, obsRubric, lab } = trade;
  const faultCode = faultCodes[trade.id]!;
  const vlab = vlabs[trade.id]!;

  const openAlerts = alerts.filter((a) => !a.resolution && a.trade === trade.id);
  const alertStations = new Set(openAlerts.map((a) => a.stationNo));
  const statusOf = (no: number, s: StationStatus): StationStatus => (alertStations.has(no) ? 'alert' : s === 'alert' ? 'working' : s);

  const station = stations.find((s) => s.no === sel)!;
  const m = marks[key] ?? {};
  const criteria = useMemo(() => toCriteria(obsRubric), [obsRubric]);
  const result = useMemo(() => previewScore(criteria, m, OBS_PASS), [criteria, m]);
  const setMark = (k: string, v: Mark) => setMarks((all) => ({ ...all, [key]: { ...all[key], [k]: v } }));

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const signOff = () => {
    updateStation(sel, { status: 'done', score: Math.round(result.score), passed: result.passed });
    if (online) setToast(tx(`Station ${sel} signed off · saved`, `تم اعتماد المحطة ${sel} · حُفظ`));
    else { queueWrite(); setToast(tx(`Station ${sel} signed off · queued until online`, `تم اعتماد المحطة ${sel} · في الانتظار حتى عودة الاتصال`)); }
    const next = stations.find((s) => s.no > sel && s.status !== 'done') ?? stations.find((s) => s.status !== 'done' && s.no !== sel);
    if (next) setSel(next.no);
  };

  // Instant capture: compressed on the tablet; offline it waits in the queue like the sign-off.
  const capture = async (file: File, criterionKey?: string) => {
    const c = await compressImage(file);
    setPhotos((p) => ({ ...p, [key]: [...(p[key] ?? []), { id: crypto.randomUUID(), url: c.url, criterionKey, state: online ? 'saved' : 'queued' }] }));
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

        <section className="obs-tw" aria-label={L('Observation', 'الملاحظة')}>
          <FloorRubric ui={{ L, lang }} criteria={criteria} marks={m} onMark={setMark}
            photos={photos[key] ?? []} onCapture={(f, k) => void capture(f, k)} onRemovePhoto={(id) => setPhotos((p) => ({ ...p, [key]: (p[key] ?? []).filter((x) => x.id !== id) }))}
            note={notes[key] ?? ''} onNote={(n) => setNotes((x) => ({ ...x, [key]: n }))} onSignOff={signOff} passThreshold={OBS_PASS}
            signedOff={station.status === 'done' && station.score !== undefined ? { score: station.score, passed: Boolean(station.passed) } : null}
            header={{ learner: pick(station.learner), station: L(`Station ${station.no}`, `المحطة ${station.no}`), job: station.jobCard, task: pick(station.task),
              warning: alertStations.has(station.no) ? L('Open safety alert at this station', 'تنبيه سلامة مفتوح في هذه المحطة') : null }}
            status={online ? L('Saved on sign-off', 'يُحفظ عند الاعتماد') : L('Offline · kept on this tablet until the Wi-Fi is back', 'غير متصل · يُحفظ على هذا الجهاز حتى عودة الشبكة')} />
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
