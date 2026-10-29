'use client';
/**
 * Trainer tablet floor view, wired to the API: live alert rail, one-tap
 * rubric scoring with instant photo capture (FloorRubric), graded by the
 * server's rubric engine, and an IndexedDB outbox that keeps sign-offs and
 * their photos while the workshop Wi-Fi is down and replays them through
 * /v1/sync, idempotently on clientMutationId, when it comes back.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { FloorRubric, previewScore, type Category, type Mark, type RubricCriterion, type RubricPhoto } from '@/components/modules/FloorRubric';
import { compressImage } from '@/components/modules/media';
import { flush as flushOutbox, pendingCount, queueMedia, queueMutation } from '@/components/modules/outbox';
import { tx, type Txt } from '@/lib/i18n';

export interface FloorStation {
  learnerId: string; name: string; nameAr: string | null; assetTag: string | null; denied: string | null;
  score: number | null; passed: boolean | null; openAlerts: number;
}
export interface ObsCriterion {
  key: string; label: string; labelAr: string | null; weight: number; isGate: boolean;
  scoring: { rule: string; objectRef?: string; expected?: number; absTol?: number; unit?: string; measure?: Txt };
  category: Category | null; descriptors: RubricCriterion['descriptors']; photoRule: RubricCriterion['photoRule']; passThreshold: number;
}
interface Alert {
  id: string; source: 'vlab' | 'rfid' | 'observation'; criterionKey: string | null; verb: string | null; detail: string;
  raisedAt: string; learnerId: string; learnerName: string; learnerNameAr: string | null;
}
type StationStatus = 'done' | 'working' | 'alert' | 'idle';
type Marks = Record<string, Mark>;
interface Outbound { clientMutationId: string; learnerId: string; rubricCode: string; assetTag?: string; taskRef: string;
  checks: Record<string, boolean>; ratings: Record<string, number>; measurements: Record<string, number>; note?: string;
  media?: { mediaId: string; criterionKey?: string }[] }
/** A photo on the tablet: the local copy (always in IndexedDB) and the server id once uploaded. */
type Photo = RubricPhoto & { localId: string; serverId?: string };

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
const API = '/api/v1';

export function Floor({ bay, job, stations, rubric, stock, toolsOut, lab, liveExams, trainer }: {
  bay: { name: string; name_ar: string | null; cohort: string; cohort_ar: string | null };
  /** The job card being observed: its rubric code, card number and task. */
  job: { rubricCode: string; code: string; task: string; taskAr: string | null };
  lab: { title: string; titleAr: string | null } | null;
  stations: FloorStation[]; rubric: ObsCriterion[];
  stock: { name: string; on_hand: number; reorder_point: number; unit: string }[];
  toolsOut: number; liveExams: number; trainer: { name: string; nameAr: string | null };
}) {
  const { L, pick, ar, time, lang } = useL();
  const router = useRouter();
  const [sel, setSel] = useState(() => stations.find((s) => s.score === null && s.assetTag)?.learnerId ?? stations[0]?.learnerId ?? '');
  const [marks, setMarks] = useState<Record<string, Marks>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [busy, setBusy] = useState(false);
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
    setNetOnline(navigator.onLine); void pendingCount().then(setQueued).catch(() => undefined);
    const on = () => setNetOnline(navigator.onLine);
    addEventListener('online', on); addEventListener('offline', on);
    return () => { removeEventListener('online', on); removeEventListener('offline', on); };
  }, []);

  // Replay the outbox when back online: photos first, then one /v1/sync batch.
  const flush = useCallback(async () => {
    setSyncing(true);
    const r = await flushOutbox(API).catch(() => null);
    setSyncing(false);
    if (!r) return;
    setQueued(r.left);
    if (r.rejected.length) setToast(tx(`${r.rejected.length} queued sign-off(s) were refused: ${r.rejected[0]!.rejected?.code}`, `رُفض ${r.rejected.length} اعتماد من قائمة الانتظار: ${r.rejected[0]!.rejected?.code}`));
    if (r.applied) { router.refresh(); void loadAlerts(); }
  }, [router, loadAlerts]);
  useEffect(() => { if (online && queued > 0) { const t = setTimeout(() => void flush(), 800); return () => clearTimeout(t); } }, [online, queued, flush]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);

  // The rail shows this trade's learners only; the badge in the top bar counts every open alert.
  const alerts = allAlerts.filter((a) => stations.some((s) => s.learnerId === a.learnerId));
  const alertByLearner = new Set(alerts.map((a) => a.learnerId));
  const statusOf = (s: FloorStation): StationStatus =>
    alertByLearner.has(s.learnerId) ? 'alert' : signed[s.learnerId] || s.score !== null ? 'done' : s.assetTag ? 'working' : 'idle';
  const station = stations.find((s) => s.learnerId === sel);
  const m = marks[sel] ?? {};
  const pass = rubric[0]?.passThreshold ?? 70;
  const criteria = useMemo<RubricCriterion[]>(() => rubric.map((c) => ({
    key: c.key, label: c.label, labelAr: c.labelAr, weight: c.weight, isGate: c.isGate, category: c.category,
    rule: c.scoring.rule as RubricCriterion['rule'], expected: c.scoring.expected, absTol: c.scoring.absTol, unit: c.scoring.unit,
    descriptors: c.descriptors, photoRule: c.photoRule,
  })), [rubric]);
  const result = useMemo(() => previewScore(criteria, m, pass), [criteria, m, pass]);
  const setMark = (k: string, v: Mark) => setMarks((all) => ({ ...all, [sel]: { ...all[sel], [k]: v } }));
  const mine = photos[sel] ?? [];
  const setPhoto = (learner: string, id: string, patch: Partial<Photo>) =>
    setPhotos((all) => ({ ...all, [learner]: (all[learner] ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  // Instant capture: compress on the tablet, keep a copy in IndexedDB, upload straight away when online.
  const capture = async (file: File, criterionKey?: string) => {
    const learner = sel, localId = crypto.randomUUID();
    const c = await compressImage(file);
    setPhotos((all) => ({ ...all, [learner]: [...(all[learner] ?? []), { id: localId, localId, url: c.url, criterionKey, state: online ? 'uploading' : 'queued' }] }));
    await queueMedia({ localId, blob: c.blob, capturedAt: c.capturedAt, width: c.width, height: c.height, kind: 'photo' }).catch(() => undefined);
    if (!online) return;
    const r = await fetch(`${API}/media`, { method: 'POST', body: c.blob, headers: { 'content-type': c.blob.type || 'image/jpeg',
      'x-client-mutation-id': localId, 'x-captured-at': c.capturedAt, 'x-kind': 'photo', 'x-width': String(c.width), 'x-height': String(c.height) } }).catch(() => null);
    if (r?.ok) {
      const serverId = ((await r.json()) as { id: string }).id;
      await queueMedia({ localId, blob: c.blob, capturedAt: c.capturedAt, width: c.width, height: c.height, kind: 'photo', serverId }).catch(() => undefined);
      setPhoto(learner, localId, { serverId, state: 'saved' });
    } else setPhoto(learner, localId, { state: 'queued' });
  };
  const removePhoto = (id: string) => setPhotos((all) => ({ ...all, [sel]: (all[sel] ?? []).filter((p) => p.id !== id) }));
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
    const refs = mine.map((p) => ({ localId: p.localId, ...(p.criterionKey ? { criterionKey: p.criterionKey } : {}) }));
    for (const c of rubric) {
      const v = m[c.key];
      if (c.scoring.rule === 'check') body.checks[c.key] = v === 'pass';
      else if (c.scoring.rule === 'rating') body.ratings[c.key] = Number(v);
      else body.measurements[c.key] = Number(v);
    }
    const who = ar(station.name, station.nameAr);
    const next = stations.find((s) => s.learnerId !== sel && statusOf(s) === 'working');
    const queue = async () => {
      await queueMutation({ clientMutationId: body.clientMutationId, type: 'observation', payload: { ...body }, media: refs });
      setQueued(await pendingCount());
      setSigned((x) => ({ ...x, [sel]: { score: result.score, passed: result.passed } }));
      setToast(tx(`${station.name} signed off · queued until online`, `تم اعتماد ${who} · في الانتظار حتى عودة الاتصال`));
    };
    setBusy(true);
    if (!online || mine.some((p) => !p.serverId)) await queue();
    else {
      body.media = mine.map((p) => ({ mediaId: p.serverId!, ...(p.criterionKey ? { criterionKey: p.criterionKey } : {}) }));
      const r = await fetch(`${API}/workshop/observations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
      if (!r) await queue();
      else if (!r.ok) { setBusy(false); setToast(tx('Could not save. Check the marks and try again.', 'تعذّر الحفظ. راجع التقييم وحاول مرة أخرى.')); return; }
      else {
        const saved = (await r.json()) as { totalScore: number; passed: boolean; lowStock?: { name: string }[] };
        setSigned((x) => ({ ...x, [sel]: { score: saved.totalScore, passed: saved.passed } }));
        const low = saved.lowStock?.length ? ` · ${saved.lowStock.map((i) => i.name).join(', ')} low` : '';
        setToast(tx(`${station.name} signed off · ${saved.totalScore} saved${low}`, `تم اعتماد ${who} · حُفظت الدرجة ${saved.totalScore}`));
        void loadAlerts(); router.refresh();
      }
    }
    setBusy(false);
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
          <div className="obs obs-tw">
            <FloorRubric ui={{ L, lang }} criteria={criteria} marks={m} onMark={setMark}
              photos={mine} onCapture={(f, k) => void capture(f, k)} onRemovePhoto={removePhoto}
              note={notes[sel] ?? ''} onNote={(n) => setNotes((x) => ({ ...x, [sel]: n }))}
              onSignOff={() => void signOff()} passThreshold={pass} busy={busy} signedOff={signed[sel] ?? null}
              header={{ learner: ar(station.name, station.nameAr), station: station.assetTag, job: job.code, task: ar(job.task, job.taskAr),
                warning: station.denied ? L(`Badge refused at the station today: ${station.denied}`, `رُفضت البطاقة عند المحطة اليوم: ${station.denied}`) : null }}
              status={online ? (queued ? L(`${queued} waiting to sync`, `${queued} في انتظار المزامنة`) : L('Saved to the server on sign-off', 'يُحفظ على الخادم عند الاعتماد'))
                : L('Offline · sign-off and photos are kept on this tablet', 'غير متصل · يُحفظ الاعتماد والصور على هذا الجهاز')} />
          </div>
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
