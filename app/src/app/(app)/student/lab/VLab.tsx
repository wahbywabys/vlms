'use client';
/**
 * Student V-Lab: the fault test of the learner's trade (DOL starter, no-crank,
 * CNC quality, MIG defect...), drawn from the lab's public catalogue and wired
 * to the VTC_LMS API.
 *
 * Every action is sent as telemetry; multimeter readings come from the API
 * (the injected fault never reaches the browser); guided mode is blocked by
 * the server's guardrail; the score comes from the server's rubric engine.
 */
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useL } from '@/components/LangProvider';
import { tx, type Txt } from '@/lib/i18n';
import { stepDone, type PublicLab, type RigState, type TestPoint } from '@/lib/lab';
import { Schematic } from './Schematic';
import { TelemetryStrip } from './TelemetryStrip';

const Explore = dynamic(() => import('./Explore'), { ssr: false, loading: () => <p className="muted">Loading 3D…</p> });

type Mode = 'guided' | 'sandbox' | 'assessment';
const MODE_LABEL: Record<Mode, Txt> = { guided: tx('Guided', 'موجّه'), sandbox: tx('Sandbox', 'تجريبي حر'), assessment: tx('Exam', 'امتحان') };

interface Ev { seq: number; verb: string; objectRef?: string | null; value: Record<string, unknown> }
interface CriterionResult { key: string; label: string; score: number; weight: number; isGate: boolean; gateFailed: boolean; detail: string }
interface Evaluation { totalScore: number; passed: boolean; gateFailures: string[]; criteria: CriterionResult[] }
interface SessionState {
  id: string; status: string; mode: Mode; startedAt: string; timeLimitS: number | null;
  rig: RigState; events: Ev[]; faults: { code: string; componentRef: string }[];
  criteria: { key: string; label: string; weight: number; isGate: boolean }[];
  evaluation: null | { totalScore: number; passed: boolean; gateFailures: string[]; criteria: Record<string, { score: number; gateFailed: boolean; detail: string }> };
}
interface IngestResponse {
  accepted: number; rejected: { seq: number; reason: string }[]; alerts: { criterionKey: string }[];
  guardrail: 'block' | null; rig: RigState; motorRuns?: boolean; observation?: Txt;
  meter?: { reading: number | null; unit: string; display: string; live?: boolean } | null;
}

async function api<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const r = await fetch(`/api/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T };
}

export interface RecentAttempt { id: string; mode: Mode; score: number | null; passed: boolean | null; at: string }

export function VLab({ lab, initialSessionId, examFromTrainer, recent }: { lab: PublicLab; initialSessionId: string | null; examFromTrainer: boolean; recent: RecentAttempt[] }) {
  const { L, pick } = useL();
  const [tab, setTab] = useState<'explore' | 'vlab'>('vlab');
  const [seenExplore, setSeenExplore] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  return (
    <div className="lab">
      <div className="lab-head">
        <div>
          <p className="eyebrow">{L('Student', 'الطالب')} · {L('Unit', 'الوحدة')} {lab.unit.code} · {pick(lab.unit.title)}</p>
          <h1>{tab === 'explore' && lab.explore ? pick(lab.explore.title) : `${pick(lab.rigTitle)} · ${pick(lab.title)}`}</h1>
        </div>
        {lab.explore && (
          <div className="tabs" role="tablist" aria-label={L('Lab activity', 'نشاط المعمل')}>
            <button type="button" role="tab" aria-selected={tab === 'explore'} onClick={() => { setTab('explore'); setSeenExplore(true); }}>{L('Explore in 3D', 'استكشف ثلاثي الأبعاد')}</button>
            <button type="button" role="tab" aria-selected={tab === 'vlab'} onClick={() => setTab('vlab')}>{L('V-Lab fault test', 'اختبار الأعطال الافتراضي')}</button>
          </div>
        )}
      </div>
      {/* The 3D explorer stays mounted once opened: unmounting drei's <Html> pins mid-session throws. */}
      {seenExplore && lab.explore && <div hidden={tab !== 'explore'}><Explore title={lab.explore.title} assetTag={lab.explore.assetTag} /></div>}
      <div hidden={tab !== 'vlab'}>
        {sessionId
          ? <FaultTest key={sessionId} lab={lab} sessionId={sessionId} onNew={() => setSessionId(null)} />
          : <StartPanel labCode={lab.code} intro={lab.intro} onStarted={setSessionId} examFromTrainer={examFromTrainer} recent={recent} />}
      </div>
    </div>
  );
}

function StartPanel({ labCode, intro, onStarted, recent }: { labCode: string; intro: Txt; onStarted: (id: string) => void; examFromTrainer: boolean; recent: RecentAttempt[] }) {
  const { L, pick, date, time } = useL();
  const [mode, setMode] = useState<'guided' | 'sandbox'>('guided');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true); setErr(null);
    const r = await api<{ sessionId: string }>('vlab/sessions', { labCode, mode });
    setBusy(false);
    if (r.ok) onStarted(r.data.sessionId);
    else setErr(L('Could not start the lab. Is the API running?', 'تعذّر بدء المعمل. هل خادم الواجهة البرمجية يعمل؟'));
  };
  return (
    <div className="start-grid">
      <section className="panel">
        <header className="panel-head"><h2>{L('Start a practice attempt', 'ابدأ محاولة تدريبية')}</h2></header>
        <p><strong>{pick(intro)}</strong></p>
        <p className="muted">{L('A fault is drawn at random from the library. Find it, prove it, fix it, and the rubric engine scores how you did it.',
          'يُختار عطل عشوائيًا من مكتبة الأعطال. اعثر عليه وأثبته وأصلحه، ويقيّم محرك المعايير طريقة عملك.')}</p>
        <div className="modes" role="radiogroup" aria-label={L('Mode', 'الوضع')}>
          {(['guided', 'sandbox'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>{pick(MODE_LABEL[m])}</button>
          ))}
        </div>
        <p className="muted mode-help">
          {mode === 'guided' ? L('Step prompts on. Unsafe actions are blocked by the server before they happen.', 'إرشادات الخطوات مفعّلة. يمنع الخادم الإجراءات غير الآمنة قبل حدوثها.')
            : L('Free practice. Nothing is blocked and your trainer is not alerted.', 'تدريب حر. لا يُمنع شيء ولا يصل تنبيه إلى مدربك.')}
        </p>
        <p className="muted small">{L('Exams are started by your trainer from their tablet; they appear here when ready.', 'يبدأ مدربك الامتحانات من جهازه اللوحي، وتظهر هنا عندما تكون جاهزة.')}</p>
        {err && <p className="notice notice-danger" role="alert">{err}</p>}
        <button type="button" className="primary" onClick={() => void start()} disabled={busy}>{busy ? L('Starting…', 'جارٍ البدء…') : L('Start attempt', 'ابدأ المحاولة')}</button>
      </section>
      <section className="panel">
        <header className="panel-head"><h2>{L('My attempts', 'محاولاتي')}</h2></header>
        {recent.length === 0 ? <p className="muted">{L('No attempts yet.', 'لا توجد محاولات بعد.')}</p> : (
          <table className="evals">
            <thead><tr><th>{L('When', 'الوقت')}</th><th>{L('Mode', 'الوضع')}</th><th className="num">{L('Score', 'الدرجة')}</th><th>{L('Result', 'النتيجة')}</th></tr></thead>
            <tbody>{recent.map((r) => (
              <tr key={r.id}><td className="muted"><span dir="ltr">{date(r.at)} {time(r.at)}</span></td><td>{pick(MODE_LABEL[r.mode])}</td>
                <td className="num">{r.score ?? '—'}</td>
                <td>{r.passed === null ? <span className="muted">{L('not submitted', 'لم يُرسل')}</span>
                  : <span className={`res ${r.passed ? 'res-pass' : 'res-fail'}`}>{r.passed ? `✓ ${L('Pass', 'ناجح')}` : `✗ ${L('Not yet', 'لم يجتز بعد')}`}</span>}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const fmt = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
function FaultTest({ lab, sessionId, onNew }: { lab: PublicLab; sessionId: string; onNew: () => void }) {
  const label = (ref: string) => lab.components.find((c) => c.ref === ref)?.label ?? tx(ref, ref);
  const { L, pick } = useL();
  const router = useRouter();
  const [s, setS] = useState<SessionState | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [events, setEvents] = useState<Ev[]>([]);
  const [rig, setRig] = useState<RigState>({ ppe: false, locked: false, panelOpen: false, replaced: [] });
  const [now, setNow] = useState(() => Date.now());
  const [meter, setMeter] = useState<{ tp: TestPoint; display: string; live?: boolean } | null>(null);
  const [notice, setNotice] = useState<{ kind: 'block' | 'info' | 'danger'; text: Txt } | null>(null);
  const [diag, setDiag] = useState({ component: '', condition: '' });
  const [swap, setSwap] = useState('');
  const [result, setResult] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    const r = await api<SessionState>(`vlab/sessions/${sessionId}`);
    if (!r.ok) { setLoadErr(true); return; }
    setS(r.data); setEvents(r.data.events); setRig(r.data.rig);
    seqRef.current = Math.max(seqRef.current, ...r.data.events.map((e) => e.seq), 0);
    if (r.data.evaluation) {
      const ev = r.data.evaluation;
      setResult({
        totalScore: ev.totalScore, passed: ev.passed, gateFailures: ev.gateFailures,
        criteria: r.data.criteria.map((c) => ({ ...c, score: ev.criteria[c.key]?.score ?? 0, gateFailed: ev.criteria[c.key]?.gateFailed ?? false, detail: ev.criteria[c.key]?.detail ?? '' })),
      });
    }
  }, [sessionId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  if (loadErr) return <p className="notice notice-danger">{L('This attempt could not be loaded.', 'تعذّر تحميل هذه المحاولة.')} <button type="button" onClick={onNew}>{L('Back', 'رجوع')}</button></p>;
  if (!s) return <p className="muted">{L('Loading the rig…', 'جارٍ تحميل اللوحة…')}</p>;

  const mode = s.mode;
  const elapsed = Math.floor((now - new Date(s.startedAt).getTime()) / 1000);
  const limit = s.timeLimitS;
  const timeUp = mode === 'assessment' && limit !== null && elapsed >= limit;
  const locked = result !== null || timeUp || s.status !== 'in_progress';
  const info = (en: string, ar: string) => setNotice({ kind: 'info', text: tx(en, ar) });
  const blockedNotice = (key?: string) => {
    const c = lab.criterionLabels[key ?? ''] ?? tx('safety rule', 'قاعدة أمان');
    setNotice({ kind: 'block', text: tx(`Blocked by safety guardrail: ${c.en}.`, `أوقفه حاجز الأمان: ${c.ar}.`) });
  };

  const record = (ev: Ev, r: IngestResponse) => {
    setRig(r.rig);
    if (r.accepted > 0) setEvents((l) => [...l, ev]);
  };

  /** Send one action as telemetry. Returns false when the guardrail blocked it. */
  const emit = async (verb: string, objectRef?: string, value: Record<string, unknown> = {}): Promise<IngestResponse | null> => {
    const ev: Ev = { seq: ++seqRef.current, verb, objectRef: objectRef ?? null, value };
    const r = await api<IngestResponse>(`vlab/sessions/${sessionId}/telemetry`, {
      events: [{ seq: ev.seq, occurredAt: new Date().toISOString(), verb, objectRef, value }],
    });
    if (!r.ok) { setNotice({ kind: 'danger', text: tx('The LMS did not accept that action.', 'لم يقبل النظام هذا الإجراء.') }); return null; }
    if (r.data.guardrail === 'block' && r.data.accepted === 0) { blockedNotice(r.data.alerts[0]?.criterionKey); return null; }
    record(ev, r.data);
    return r.data;
  };

  const act = (fn: () => Promise<void>) => async () => {
    if (locked || busy) return;
    setNotice(null); setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const donPpe = act(async () => { if (!rig.ppe) await emit('ppe_donned'); });
  const toggleLoto = act(async () => { await emit(rig.locked ? 'loto_removed' : 'loto_applied', lab.isolation.ref); });
  const togglePanel = act(async () => { await emit(rig.panelOpen ? 'panel_closed' : 'panel_opened', 'panel'); });
  const pressStart = act(async () => {
    if (rig.locked) { setNotice({ kind: 'info', text: lab.run.whileLocked }); return; }
    if (rig.panelOpen) { setNotice({ kind: 'info', text: lab.run.whileOpen }); return; }
    const r = await emit('start_pressed', 'run');
    if (r?.observation) setNotice({ kind: 'info', text: r.observation });
  });
  const measure = (tp: TestPoint) => void act(async () => {
    if (tp.inside && !rig.panelOpen) { info(`${tp.label.en} ${lab.enclosure.mustOpen.en}`, `${tp.label.ar} ${lab.enclosure.mustOpen.ar}`); return; }
    const seq = ++seqRef.current;
    const r = await api<IngestResponse>(`vlab/sessions/${sessionId}/probe`, { seq, occurredAt: new Date().toISOString(), testPoint: tp.ref });
    if (!r.ok) { setNotice({ kind: 'danger', text: tx('The meter could not be read.', 'تعذّرت قراءة جهاز القياس.') }); return; }
    if (!r.data.meter) { blockedNotice(r.data.alerts[0]?.criterionKey); return; }
    const m = r.data.meter;
    record({ seq, verb: m.live ? 'energized_contact' : 'measured', objectRef: tp.ref, value: m.live ? {} : { reading: m.reading, unit: m.unit } }, r.data);
    setMeter({ tp, display: m.live ? pick(lab.danger.display) : m.display, live: m.live });
    if (m.live) setNotice({ kind: 'danger', text: lab.danger.text });
  })();
  const submitDiagnosis = act(async () => {
    const code = lab.faults.find((f) => f.componentRef === diag.component && f.condition === diag.condition)?.code ?? `${diag.component}:${diag.condition}`;
    if (await emit('diagnosis_submitted', diag.component, { faultCode: code })) {
      info('Diagnosis recorded. You can still replace a part before submitting.', 'تم تسجيل التشخيص. ما زال بإمكانك استبدال قطعة قبل الإرسال.');
    }
  });
  const replacePart = act(async () => {
    if (!rig.panelOpen) { info(`The part ${lab.enclosure.mustOpen.en}`, `القطعة ${lab.enclosure.mustOpen.ar}`); return; }
    if (await emit('component_replaced', swap)) {
      const c = label(swap);
      info(`${c.en} replaced.`, `تم استبدال ${c.ar}.`);
    }
  });
  const submit = async () => {
    setBusy(true);
    const r = await api<Evaluation>(`vlab/sessions/${sessionId}/evaluate`, {});
    setBusy(false);
    if (!r.ok) { setNotice({ kind: 'danger', text: tx('Scoring failed. Try again.', 'فشل التقييم. حاول مرة أخرى.') }); return; }
    setResult(r.data);
    await load(); // reveals the injected fault
    router.refresh();
  };

  // Guided step pointer: first step whose evidence is not in the stream yet.
  const done = lab.steps.map((st) => stepDone(st.done, events, rig));
  const step = done.findIndex((d) => !d);
  const injected = s.faults.map((f) => lab.faults.find((x) => x.code === f.code)?.title ?? tx(f.code, f.code));

  return (
    <div className="vlab">
      <div className="vlab-bar">
        <span className={`mode-tag mode-${mode}`}>{pick(MODE_LABEL[mode])}</span>
        <p className="muted mode-help">
          {mode === 'guided' && L('Step prompts on. Unsafe actions are blocked before they happen.', 'إرشادات الخطوات مفعّلة. تُمنع الإجراءات غير الآمنة قبل حدوثها.')}
          {mode === 'sandbox' && L('Free practice. Nothing is blocked and your trainer is not alerted.', 'تدريب حر. لا يُمنع شيء ولا يصل تنبيه إلى مدربك.')}
          {mode === 'assessment' && L('Exam set by your trainer. No hints. Unsafe actions are recorded and sent to your trainer’s tablet.', 'امتحان من مدربك. بلا تلميحات. تُسجَّل الإجراءات غير الآمنة وتُرسل إلى جهاز مدربك.')}
        </p>
        <span className={`timer mono ${mode === 'assessment' && limit && limit - elapsed < 300 ? 'timer-low' : ''}`} aria-label={L('Timer', 'المؤقت')}>
          ⏱ <span dir="ltr">{mode === 'assessment' && limit ? fmt(limit - elapsed) : fmt(elapsed)}</span>
        </span>
      </div>
      {timeUp && !result && <p className="notice notice-block">{L('Time is up. Submit your attempt for scoring.', 'انتهى الوقت. أرسل محاولتك للتقييم.')}</p>}

      <div className="vlab-grid">
        <section className="rig" aria-label={pick(lab.rigTitle)} aria-busy={busy}>
          <div className="rig-status">
            <StatusChip on={rig.ppe} label={L('PPE', 'الوقاية')} onText={L('On', 'مرتداة')} offText={L('Not worn', 'غير مرتداة')} />
            <StatusChip on={rig.locked} label={lab.isolation.chip} onText={pick(lab.isolation.on)} offText={pick(lab.isolation.off)} danger={!rig.locked} />
            <StatusChip on={rig.panelOpen} label={pick(lab.enclosure.chip)} onText={L('Open', 'مفتوح')} offText={L('Closed', 'مغلق')} neutral />
          </div>
          <Schematic lab={lab} rig={rig} onMeasure={measure} active={meter?.tp.ref} />
          <div className="rig-actions">
            <button type="button" onClick={() => void donPpe()} disabled={rig.ppe || locked || busy}>{pick(lab.ppe.button)}</button>
            <button type="button" onClick={() => void pressStart()} disabled={locked || busy}>{pick(lab.run.button)}</button>
            <button type="button" onClick={() => void toggleLoto()} disabled={locked || busy}>{rig.locked ? pick(lab.isolation.unlock) : pick(lab.isolation.lock)}</button>
            <button type="button" onClick={() => void togglePanel()} disabled={locked || busy}>{rig.panelOpen ? pick(lab.enclosure.close) : pick(lab.enclosure.open)}</button>
          </div>
          {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === 'info' ? 'status' : 'alert'}>{pick(notice.text)}</p>}
        </section>

        <aside className="side">
          <div className={`meter ${meter?.live ? 'meter-live' : ''}`} aria-live="polite">
            <span className="meter-mode mono">{meter ? (meter.live ? L('DANGER', 'خطر') : meter.tp.instrument) : L('Meter', 'جهاز القياس')}</span>
            <span className="meter-value mono" dir="ltr">{meter?.display ?? '– – –'}</span>
            <span className="meter-tp">{meter ? pick(meter.tp.label) : L('Tap a test point on the drawing', 'اضغط نقطة قياس على المخطط')}</span>
          </div>

          {mode === 'guided' && !result && (
            <ol className="steps">
              {lab.steps.map((st, i) => (
                <li key={st.text.en} className={done[i] ? 'done' : i === step ? 'now' : ''}>
                  <span className="step-mark" aria-hidden="true">{done[i] ? '✓' : i + 1}</span>{pick(st.text)}
                </li>
              ))}
            </ol>
          )}

          {!result ? (
            <div className="diag">
              <p className="eyebrow">{L('Diagnosis', 'التشخيص')}</p>
              <label className="field"><span>{L('Faulty component', 'المكوّن المعطوب')}</span>
                <select value={diag.component} onChange={(e) => setDiag((d) => ({ ...d, component: e.target.value }))} disabled={locked}>
                  <option value="">{L('Choose…', 'اختر…')}</option>
                  {lab.components.map((c) => <option key={c.ref} value={c.ref}>{pick(c.label)}</option>)}
                </select>
              </label>
              <label className="field"><span>{L('Condition', 'الحالة')}</span>
                <select value={diag.condition} onChange={(e) => setDiag((d) => ({ ...d, condition: e.target.value }))} disabled={locked}>
                  <option value="">{L('Choose…', 'اختر…')}</option>
                  {lab.conditions.map((c) => <option key={c.value} value={c.value}>{pick(c.label)}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void submitDiagnosis()} disabled={!diag.component || !diag.condition || locked || busy}>{L('Record diagnosis', 'سجّل التشخيص')}</button>
              <div className="swap">
                <label className="field"><span>{L('Replace a part', 'استبدال قطعة')}</span>
                  <select value={swap} onChange={(e) => setSwap(e.target.value)} disabled={locked}>
                    <option value="">{L('Choose…', 'اختر…')}</option>
                    {lab.components.map((c) => <option key={c.ref} value={c.ref}>{pick(c.label)}</option>)}
                  </select>
                </label>
                <button type="button" className="btn-replace" onClick={() => void replacePart()} disabled={!swap || locked || busy}>{L('Replace', 'استبدل')}</button>
              </div>
              <button type="button" className="primary btn-submit" onClick={() => void submit()} disabled={events.length === 0 || busy || result !== null}>{L('Submit for scoring', 'أرسل للتقييم')}</button>
            </div>
          ) : (
            <ResultCard res={result} faults={injected} labels={lab.criterionLabels} pass={lab.passThreshold} onRetry={onNew} />
          )}
        </aside>
      </div>

      <TelemetryStrip items={[...events].reverse().slice(0, 8).map((e) => ({
        seq: e.seq, verb: e.verb, objectRef: e.objectRef,
        note: typeof e.value['reading'] === 'number' ? `${e.value['reading']} ${e.value['unit']}` : e.value['reading'] === null ? 'OL' : undefined,
      }))} title={L(`Telemetry stored by the LMS · ${events.length} events`, `أحداث القياس المحفوظة في النظام · ${events.length} حدث`)}
        empty={L('Every action you take is stored with a sequence number and scored by the server’s rubric engine.',
          'كل إجراء تقوم به يُحفظ برقم تسلسلي ويُقيَّم بمحرك معايير التقييم على الخادم.')} />
    </div>
  );
}

function StatusChip({ on, label, onText, offText, danger, neutral }: { on: boolean; label: string; onText: string; offText: string; danger?: boolean; neutral?: boolean }) {
  const cls = neutral ? 'chip-neutral' : on ? 'chip-on' : danger ? 'chip-danger' : 'chip-off';
  return <span className={`status-chip ${cls}`}><b>{label}</b> {on ? onText : offText}</span>;
}

const LEVELS: Record<string, Txt> = {
  not_yet: tx('not yet', 'لم يصل بعد'), novice: tx('novice', 'مبتدئ'), intermediate: tx('intermediate', 'متوسط'), autonomous: tx('autonomous', 'مستقل'),
};
const levelForScore = (s: number) => (s >= 85 ? 'autonomous' : s >= 70 ? 'intermediate' : s >= 50 ? 'novice' : 'not_yet');

function ResultCard({ res, faults, labels, pass, onRetry }: { res: Evaluation; faults: Txt[]; labels: Record<string, Txt>; pass: number; onRetry: () => void }) {
  const { L, pick } = useL();
  const level = res.gateFailures.length ? L('No credit (safety gate failed)', 'لا رصيد (رسوب في شرط أمان)') : pick(LEVELS[levelForScore(res.totalScore)]!);
  return (
    <div className="result">
      <div className={`result-head ${res.passed ? 'v-pass' : 'v-fail'}`}>
        <span className="v-score">{res.totalScore}</span>
        <span><strong>{res.passed ? L('Pass', 'ناجح') : L('Not yet', 'لم يجتز بعد')}</strong><br />
          <small>{L(`Pass mark ${pass} · competency`, `درجة النجاح ${pass} · مستوى الجدارة`)}: {level}</small></span>
      </div>
      {faults.length > 0 && <p className="muted">{L('Injected fault', 'العطل المزروع')}: {faults.map(pick).join(' · ')}</p>}
      <table className="crit">
        <thead><tr><th>{L('Criterion', 'المعيار')}</th><th>{L('Score', 'الدرجة')}</th><th>{L('Wt', 'الوزن')}</th></tr></thead>
        <tbody>
          {res.criteria.map((c) => (
            <tr key={c.key} className={c.gateFailed ? 'gate-failed' : ''}>
              <td>{pick(labels[c.key] ?? tx(c.label, c.label))}{c.isGate && <span className="gate">{L('Gate', 'شرط أمان')}</span>}
                <small dir="ltr" className="detail">{c.detail}</small></td>
              <td className="num">{c.score}</td>
              <td className="num">{c.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{L('Saved to your record and your competency profile.', 'حُفظت في سجلك وملف جداراتك.')}</p>
      <button type="button" onClick={onRetry}>{L('Start a new attempt', 'ابدأ محاولة جديدة')}</button>
    </div>
  );
}
