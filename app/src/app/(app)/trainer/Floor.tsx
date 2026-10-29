'use client';
/**
 * Trainer tablet floor view, wired to the API: live alert rail, one-tap
 * rubric scoring graded by the server's rubric engine, and an offline
 * outbox that replays sign-offs idempotently (clientMutationId) on reconnect.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { tx, type Txt } from '@/lib/i18n';

export interface FloorStation {
  learnerId: string; name: string; nameAr: string | null; assetTag: string | null; denied: string | null;
  score: number | null; passed: boolean | null; openAlerts: number;
}
export interface ObsCriterion {
  key: string; label: string; labelAr: string | null; weight: number; isGate: boolean;
  scoring: { rule: string; objectRef?: string; expected?: number; absTol?: number; unit?: string; measure?: Txt };
}
interface Alert {
  id: string; source: 'vlab' | 'rfid' | 'observation'; criterionKey: string | null; verb: string | null; detail: string;
  raisedAt: string; learnerId: string; learnerName: string; learnerNameAr: string | null;
}
type StationStatus = 'done' | 'working' | 'alert' | 'idle';
type Marks = Record<string, string | number | undefined>;
interface Outbound { clientMutationId: string; learnerId: string; rubricCode: string; assetTag?: string; taskRef: string;
  checks: Record<string, boolean>; ratings: Record<string, number>; measurements: Record<string, number>; note?: string }

const GLYPH: Record<StationStatus, string> = { done: '✓', working: '●', alert: '▲', idle: '○' };
const STATUS_LABEL: Record<StationStatus, Txt> = {
  done: tx('Signed off', 'تم الاعتماد'), working: tx('Working', 'يعمل'), alert: tx('Alert', 'تنبيه'), idle: tx('Idle', 'متوقف'),
};
/** Gate names for the alert rail (V-Lab rubric and floor rubric keys). */
const GATE_LABEL: Record<string, Txt> = {
  ppe: tx('PPE not worn before work', 'لم تُرتدَ معدات الوقاية قبل العمل'),
  loto: tx('Panel work before LOTO', 'عمل داخل اللوحة قبل تطبيق LOTO'),
  no_contact: tx('Touched live parts', 'لمس أجزاء حية'),
  safe_op: tx('Unsafe machine operation', 'تشغيل غير آمن للماكينة'),
  secured: tx('Vehicle not secured', 'المركبة غير مؤمّنة'),
  safe_iso: tx('Safe isolation not proved', 'لم يُثبت العزل الآمن'),
  hot_work: tx('Hot-work controls missing', 'ضوابط الأعمال الساخنة غير مطبّقة'),
};
const SOURCE: Record<Alert['source'], Txt> = { vlab: tx('V-Lab exam', 'امتحان افتراضي'), rfid: tx('RFID interlock', 'قفل RFID'), observation: tx('Floor observation', 'ملاحظة الورشة') };
const OUTBOX = 'vtc-outbox';
const PASS = 70;

const readOutbox = (): Outbound[] => { try { return JSON.parse(localStorage.getItem(OUTBOX) ?? '[]') as Outbound[]; } catch { return []; } };
const writeOutbox = (o: Outbound[]) => { try { localStorage.setItem(OUTBOX, JSON.stringify(o)); } catch { /* storage unavailable */ } };

/** Same bands as the API's measurement_tolerance rule: full inside, half inside 2×. */
function tolScore(c: ObsCriterion, v: number) {
  const e = c.scoring.expected ?? 0, t = c.scoring.absTol ?? 0, d = Math.abs(v - e);
  return d <= t + 1e-12 ? 100 : d <= 2 * t + 1e-12 ? 50 : 0;
}

/** Live preview only; the score that is saved comes from the server's rubric engine. */
function preview(rubric: ObsCriterion[], m: Marks) {
  let weighted = 0, weights = 0, complete = true, gateFail = false;
  for (const c of rubric) {
    const v = m[c.key];
    weights += c.weight;
    if (v === undefined || v === '') { complete = false; continue; }
    const s = c.scoring.rule === 'check' ? (v === 'pass' ? 100 : 0)
      : c.scoring.rule === 'rating' ? (Number(v) / 4) * 100 : tolScore(c, Number(v));
    if (c.isGate && s < 100) gateFail = true;
    weighted += s * c.weight;
  }
  const score = weights ? Math.round((weighted / weights) * 100) / 100 : 0;
  return { complete, gateFail, score, passed: !gateFail && score >= PASS };
}

export function Floor({ bay, job, stations, rubric, stock, toolsOut, lab, liveExams, trainer }: {
  bay: { name: string; name_ar: string | null; cohort: string; cohort_ar: string | null };
  /** The job card being observed: its rubric code, card number and task. */
  job: { rubricCode: string; code: string; task: string; taskAr: string | null };
  lab: { title: string; titleAr: string | null } | null;
  stations: FloorStation[]; rubric: ObsCriterion[];
  stock: { name: string; on_hand: number; reorder_point: number; unit: string }[];
  toolsOut: number; liveExams: number; trainer: { name: string; nameAr: string | null };
}) {
  const { L, pick, ar, time } = useL();
  const router = useRouter();
  const [sel, setSel] = useState(() => stations.find((s) => s.score === null && s.assetTag)?.learnerId ?? stations[0]?.learnerId ?? '');
  const [marks, setMarks] = useState<Record<string, Marks>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [toast, setToast] = useState<Txt | null>(null);
  const [allAlerts, setAlerts] = useState<Alert[]>([]);
  const [simOffline, setSimOffline] = useState(false);
  const [netOnline, setNetOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [signed, setSigned] = useState<Record<string, { score: number; passed: boolean }>>({});
  const online = netOnline && !simOffline;

  // Alert rail: persisted in Postgres, polled so a Redis outage never hides one.
  const loadAlerts = useCallback(async () => {
    const r = await fetch('/api/v1/alerts?status=open', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setAlerts(((await r.json()) as { alerts: Alert[] }).alerts);
  }, []);
  useEffect(() => { void loadAlerts(); const t = setInterval(loadAlerts, 5000); return () => clearInterval(t); }, [loadAlerts]);

  useEffect(() => {
    setNetOnline(navigator.onLine); setQueued(readOutbox().length);
    const on = () => setNetOnline(navigator.onLine);
    addEventListener('online', on); addEventListener('offline', on);
    return () => { removeEventListener('online', on); removeEventListener('offline', on); };
  }, []);

  // Replay the outbox when back online. Replays are idempotent on clientMutationId.
  const flush = useCallback(async () => {
    const box = readOutbox();
    if (!box.length) return;
    setSyncing(true);
    const left: Outbound[] = [];
    for (const item of box) {
      const r = await fetch('/api/v1/workshop/observations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) }).catch(() => null);
      if (!r || (!r.ok && r.status >= 500)) left.push(item);
    }
    writeOutbox(left); setQueued(left.length); setSyncing(false);
    if (left.length < box.length) { router.refresh(); void loadAlerts(); }
  }, [router, loadAlerts]);
  useEffect(() => { if (online && queued > 0) { const t = setTimeout(() => void flush(), 800); return () => clearTimeout(t); } }, [online, queued, flush]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { setNoteOpen(false); }, [sel]);

  // The rail shows this trade's learners only; the badge in the top bar counts every open alert.
  const alerts = allAlerts.filter((a) => stations.some((s) => s.learnerId === a.learnerId));
  const alertByLearner = new Set(alerts.map((a) => a.learnerId));
  const statusOf = (s: FloorStation): StationStatus =>
    alertByLearner.has(s.learnerId) ? 'alert' : signed[s.learnerId] || s.score !== null ? 'done' : s.assetTag ? 'working' : 'idle';
  const station = stations.find((s) => s.learnerId === sel);
  const m = marks[sel] ?? {};
  const result = useMemo(() => preview(rubric, m), [rubric, m]);
  const setMark = (k: string, v: string | number) => setMarks((all) => ({ ...all, [sel]: { ...all[sel], [k]: v } }));
  const done = stations.filter((s) => statusOf(s) === 'done').length;
  const stationNo = (s: FloorStation) => (s.assetTag ? Number(/(\d+)$/.exec(s.assetTag)?.[1] ?? NaN) || null : null);

  const resolve = async (a: Alert, resolution: string) => {
    setAlerts((l) => l.filter((x) => x.id !== a.id));
    await fetch(`/api/v1/alerts/${a.id}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resolution }) });
    void loadAlerts(); router.refresh();
  };

  const signOff = async () => {
    if (!station) return;
    const body: Outbound = {
      clientMutationId: crypto.randomUUID(), learnerId: station.learnerId, rubricCode: job.rubricCode, taskRef: job.code,
      ...(station.assetTag ? { assetTag: station.assetTag } : {}),
      checks: {}, ratings: {}, measurements: {}, ...(notes[sel] ? { note: notes[sel] } : {}),
    };
    for (const c of rubric) {
      const v = m[c.key];
      if (c.scoring.rule === 'check') body.checks[c.key] = v === 'pass';
      else if (c.scoring.rule === 'rating') body.ratings[c.key] = Number(v);
      else body.measurements[c.key] = Number(v);
    }
    const who = ar(station.name, station.nameAr);
    const next = stations.find((s) => s.learnerId !== sel && statusOf(s) === 'working');
    if (!online) {
      const box = [...readOutbox(), body]; writeOutbox(box); setQueued(box.length);
      setSigned((x) => ({ ...x, [sel]: { score: result.score, passed: result.passed } }));
      setToast(tx(`${station.name} signed off · queued until online`, `تم اعتماد ${who} · في الانتظار حتى عودة الاتصال`));
    } else {
      const r = await fetch('/api/v1/workshop/observations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
      if (!r?.ok) { setToast(tx('Could not save. Check the connection and try again.', 'تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى.')); return; }
      const saved = (await r.json()) as { totalScore: number; passed: boolean };
      setSigned((x) => ({ ...x, [sel]: { score: saved.totalScore, passed: saved.passed } }));
      setToast(tx(`${station.name} signed off · ${saved.totalScore} saved`, `تم اعتماد ${who} · حُفظت الدرجة ${saved.totalScore}`));
      void loadAlerts(); router.refresh();
    }
    if (next) setSel(next.learnerId);
  };

  const sigOf = (s: FloorStation) => signed[s.learnerId] ?? (s.score !== null ? { score: s.score, passed: Boolean(s.passed) } : null);

  return (
    <div className="floor">
      <div className="floor-head">
        <div>
          <p className="eyebrow">{L('Trainer · Floor view', 'المدرب · عرض أرضية الورشة')}</p>
          <h1>{ar(bay.name, bay.name_ar)} · {ar(bay.cohort, bay.cohort_ar)}</h1>
          <p className="muted">
            {L(`${done} of ${stations.length} stations signed off`, `تم اعتماد ${done} من ${stations.length} محطة`)} · {ar(trainer.name, trainer.nameAr)}
          </p>
        </div>
        <div className="head-pills">
          <button type="button" className={`pill ${online ? 'pill-ok' : 'pill-off'}`} onClick={() => setSimOffline((o) => !o)}
            title={L('Tap to simulate losing the workshop Wi-Fi', 'اضغط لمحاكاة انقطاع شبكة الورشة')}>
            <span aria-hidden="true">{online ? '●' : '○'}</span> {online ? L('Online', 'متصل') : L('Offline', 'غير متصل')}
            <span className="pill-sub">
              {syncing ? L(`syncing ${queued}…`, `جارٍ مزامنة ${queued}…`) : L(`${queued} queued`, `${queued} في الانتظار`)}
            </span>
          </button>
          <span className={`pill ${alerts.length ? 'pill-alert' : ''}`}>
            <span aria-hidden="true">▲</span> {L(`${alerts.length} alert${alerts.length === 1 ? '' : 's'}`, `${alerts.length} تنبيه`)}
          </span>
        </div>
      </div>

      <div className="floor-grid">
        <section className="floor-left" aria-label={L('Workshop floor', 'أرضية الورشة')}>
          {alerts.length > 0 && (
            <div className="alerts" role="alert">
              {alerts.map((a) => {
                const st = stations.find((s) => s.learnerId === a.learnerId);
                const no = st ? stationNo(st) : null;
                return (
                  <div key={a.id} className="alert-card">
                    <button type="button" className="alert-main" onClick={() => st && setSel(st.learnerId)}>
                      <span className="alert-icon" aria-hidden="true">▲</span>
                      <span>
                        <strong>{no ? L(`Stn ${no} · `, `محطة ${no} · `) : ''}{ar(a.learnerName, a.learnerNameAr)}</strong>
                        <span className="alert-text">{a.criterionKey && GATE_LABEL[a.criterionKey] && a.source !== 'rfid' ? pick(GATE_LABEL[a.criterionKey]!) : <span dir="auto">{a.detail}</span>}</span>
                        <small>{pick(SOURCE[a.source])} · <span dir="ltr">{time(a.raisedAt)}</span></small>
                      </span>
                    </button>
                    <div className="alert-actions">
                      <button type="button" onClick={() => void resolve(a, 'Stopped work and briefed the learner')}>{L('Stopped & briefed', 'أوقفت العمل ووجّهت المتدرب')}</button>
                      <button type="button" className="ghost" onClick={() => void resolve(a, 'False alarm')}>{L('False alarm', 'إنذار كاذب')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="stations" role="listbox" aria-label={L('Stations', 'المحطات')}>
            {stations.map((s) => {
              const st = statusOf(s);
              const sig = sigOf(s);
              return (
                <button key={s.learnerId} type="button" role="option" aria-selected={s.learnerId === sel}
                  className={`stn stn-${st}`} onClick={() => setSel(s.learnerId)} title={s.denied ?? s.assetTag ?? ''}>
                  <span className="stn-no">{stationNo(s) ?? "–"}</span>
                  <span className="stn-glyph" aria-hidden="true">{GLYPH[st]}</span>
                  <span className="stn-name">{ar(s.name, s.nameAr).split(' ')[0]}</span>
                  <span className="stn-state">
                    {st === 'done' && sig ? `${sig.score} · ${sig.passed ? L('Pass', 'ناجح') : L('Not yet', 'لم يجتز بعد')}` : pick(STATUS_LABEL[st])}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="legend" aria-label={L('Legend', 'دليل الرموز')}>
            {(['done', 'working', 'alert', 'idle'] as StationStatus[]).map((k) => (
              <li key={k}><span className={`lg lg-${k}`} aria-hidden="true">{GLYPH[k]}</span>{pick(STATUS_LABEL[k])}</li>
            ))}
          </ul>

          <div className="vlab-card">
            <div>
              <p className="eyebrow">{L('V-Lab · live', 'المعمل الافتراضي · مباشر')}</p>
              <strong>{L(`${liveExams} exam${liveExams === 1 ? '' : 's'} in progress`, `${liveExams} امتحان جارٍ`)}</strong>
              {lab && <p className="muted">{L(`Start a “${lab.title}” exam for a learner and choose the injected fault.`, `ابدأ امتحان «${ar(lab.title, lab.titleAr)}» لمتدرب واختر العطل المزروع.`)}</p>}
            </div>
            <Link className="button" href="/trainer/vlab">{L('Open V-Lab exams', 'افتح امتحانات المعمل')}</Link>
          </div>
        </section>

        {station ? (
          <section className="obs" aria-label={L('Observation', 'الملاحظة')}>
            <header className="obs-head">
              <p className="eyebrow">{station.assetTag ? `${station.assetTag} · ` : ''}{L(`Job card ${job.code}`, `بطاقة العمل ${job.code}`)}</p>
              <h2>{ar(station.name, station.nameAr)}</h2>
              <p className="muted">{L('Task', 'المهمة')}: {ar(job.task, job.taskAr)}
                {station.denied && <><br /><span className="bad-text">{L(`Badge refused at the station today: ${station.denied}`, `رُفضت البطاقة عند المحطة اليوم: ${station.denied}`)}</span></>}</p>
            </header>

            <div className="rubric">
              {rubric.map((c) => (
                <div key={c.key} className={`row ${c.isGate ? 'row-gate' : ''}`}>
                  <div className="row-label">
                    {ar(c.label, c.labelAr)}
                    {c.isGate && <span className="gate">{L('Gate', 'شرط أمان')}</span>}
                  </div>
                  {c.scoring.rule === 'check' && (
                    <div className="seg" role="radiogroup" aria-label={c.label}>
                      <button type="button" role="radio" aria-checked={m[c.key] === 'pass'} className="seg-pass" onClick={() => setMark(c.key, 'pass')}>✓ {L('Pass', 'ناجح')}</button>
                      <button type="button" role="radio" aria-checked={m[c.key] === 'fail'} className="seg-fail" onClick={() => setMark(c.key, 'fail')}>✗ {L('Fail', 'راسب')}</button>
                    </div>
                  )}
                  {c.scoring.rule === 'rating' && (
                    <div className="seg" role="radiogroup" aria-label={c.label}>
                      {[1, 2, 3, 4].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={m[c.key] === n} onClick={() => setMark(c.key, n)}>{n}</button>
                      ))}
                    </div>
                  )}
                  {c.scoring.rule === 'measurement_tolerance' && <ToleranceInput c={c} value={m[c.key]} onChange={(v) => setMark(c.key, v)} id={`tol-${sel}`} />}
                </div>
              ))}
            </div>

            <div className="evidence">
              <button type="button" className="ghost" aria-expanded={noteOpen} onClick={() => setNoteOpen((o) => !o)}>✎ {L('Note', 'ملاحظة')}</button>
            </div>
            {noteOpen && (
              <textarea className="note" rows={2}
                placeholder={L('e.g. Good method; remind about housekeeping', 'مثال: منهجية جيدة؛ ذكّره بالنظافة والترتيب')}
                value={notes[sel] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [sel]: e.target.value }))} />
            )}

            <footer className="obs-foot">
              <div className={`verdict ${!result.complete ? '' : result.passed ? 'v-pass' : 'v-fail'}`} aria-live="polite">
                <span className="v-score">{result.complete ? Math.round(result.score) : '—'}</span>
                <span>
                  {!result.complete ? L('Score every row to sign off', 'قيّم كل البنود للاعتماد')
                    : result.gateFail ? L('Not yet · safety gate failed', 'لم يجتز بعد · رسب في شرط أمان')
                    : result.passed ? L('Pass', 'ناجح') : L(`Not yet · below ${PASS}`, `لم يجتز بعد · أقل من ${PASS}`)}
                </span>
              </div>
              <button type="button" className="primary" disabled={!result.complete || Boolean(signed[sel])} onClick={() => void signOff()}>
                {signed[sel] ? L('Signed off', 'تم الاعتماد') : L('Sign off & next station →', 'اعتماد والانتقال للمحطة التالية ←')}
              </button>
            </footer>
          </section>
        ) : <section className="obs"><p className="muted">{L('No learners in your cohort yet.', 'لا يوجد متدربون في مجموعتك بعد.')}</p></section>}
      </div>

      <footer className="floor-foot">
        <span><b>{L('Tools out', 'عُدد مُعارة')}</b> {toolsOut}</span>
        {stock.map((c) => (
          <span key={c.name} className="warn"><b>{c.name}</b> <span dir="ltr">{c.on_hand} {c.unit}</span> · {L(`reorder at ${c.reorder_point}`, `إعادة الطلب عند ${c.reorder_point}`)}</span>
        ))}
      </footer>
      {toast && <div className="toast" role="status">{pick(toast)}</div>}
    </div>
  );
}

function ToleranceInput({ c, value, onChange, id }: { c: ObsCriterion; value: string | number | undefined; onChange: (v: string) => void; id: string }) {
  const { L, pick } = useL();
  const v = value === undefined || value === '' ? null : Number(value);
  const s = v === null || Number.isNaN(v) ? null : tolScore(c, v);
  const e = c.scoring.expected ?? 0, t = c.scoring.absTol ?? 0;
  const unit = c.scoring.unit ?? 'mm';
  const digits = t < 0.05 ? 3 : 2;
  return (
    <div className="tol">
      <label htmlFor={id} className="sr-only">{c.scoring.measure ? pick(c.scoring.measure) : L(`Measured value in ${unit}`, `القيمة المقاسة (${unit})`)}</label>
      <input id={id} dir="ltr" inputMode="decimal" placeholder={(e + t).toFixed(digits)} value={value ?? ''}
        onChange={(ev) => onChange(ev.target.value.replace(',', '.').replace('٫', '.'))}
        className={s === null ? '' : s === 100 ? 'in' : s === 50 ? 'near' : 'out'} />
      <span className="mono tol-band" dir="ltr">{(e - t).toFixed(digits)}–{(e + t).toFixed(digits)} {unit}</span>
      {s !== null && <span className={`tol-flag ${s === 100 ? 'ok' : 'bad'}`}>
        {s === 100 ? `✓ ${L('In tolerance', 'ضمن التفاوت')}` : s === 50 ? `◐ ${L('Within 2×', 'ضمن ضعف التفاوت')}` : `✗ ${L('Out', 'خارج التفاوت')}`}
      </span>}
    </div>
  );
}
