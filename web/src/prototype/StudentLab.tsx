/** Screen 2 — Student 3D Lab Explorer + V-Lab fault test (docs/ui-blueprint.md §2). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MachineExplorer, type ExplorerEvent } from '../components/MachineExplorer';
import { inductionMotorParts } from '../models/inductionMotor';
import { DOL_LAB } from './data';
import {
  COMPONENTS, CRITERION_LABELS, DOL_RUBRIC, FAULTS, GUIDED_STEPS, TEST_POINTS, detectGateViolations, evaluate, levelForScore, readMeter, toEvent,
  type EvaluationResult, type Fault, type RigState, type TelemetryEvent, type TestPoint,
} from './dolStarter';
import { tx, type Txt } from './i18n';
import { explorerStringsAr, inductionMotorPartsAr } from './motorAr';
import { useL, useStore } from './store';

type Mode = 'Guided' | 'Sandbox' | 'Exam';
const MODE_LABEL: Record<Mode, Txt> = { Guided: tx('Guided', 'موجّه'), Sandbox: tx('Sandbox', 'تجريبي حر'), Exam: tx('Exam', 'امتحان') };
const TIME_LIMIT_S = 1800;
const LEARNER = tx('Omar Lotfy', 'عمر لطفي');

export function StudentLab() {
  const { L } = useL();
  const [tab, setTab] = useState<'explore' | 'vlab'>('vlab');
  const [seenExplore, setSeenExplore] = useState(false);
  return (
    <div className="lab">
      <div className="lab-head">
        <div>
          <p className="eyebrow">{L('Student · Unit ELEC-L3-U04 · Diagnose faults in motor control circuits', 'الطالب · الوحدة ELEC-L3-U04 · تشخيص أعطال دوائر تحكم المحركات')}</p>
          <h1>{tab === 'vlab' ? L('DOL Motor Starter · Fault test', 'بادئ المحرك المباشر DOL · اختبار الأعطال') : L('3-Phase Induction Motor · IEC 132M', 'محرك حثي ثلاثي الأطوار · IEC 132M')}</h1>
        </div>
        <div className="tabs" role="tablist" aria-label={L('Lab activity', 'نشاط المعمل')}>
          <button type="button" role="tab" aria-selected={tab === 'explore'} onClick={() => { setTab('explore'); setSeenExplore(true); }}>{L('Explore the motor', 'استكشف المحرك')}</button>
          <button type="button" role="tab" aria-selected={tab === 'vlab'} onClick={() => setTab('vlab')}>{L('V-Lab fault test', 'اختبار الأعطال الافتراضي')}</button>
        </div>
      </div>
      {/* The 3D explorer mounts on first visit and then stays mounted: unmounting
          drei's <Html> pins mid-session throws a removeChild error. */}
      {seenExplore && <div hidden={tab !== 'explore'}><Explore /></div>}
      <div hidden={tab !== 'vlab'}><FaultTest /></div>
    </div>
  );
}

function Explore() {
  const { lang, L } = useL();
  const [log, setLog] = useState<(ExplorerEvent & { seq: number })[]>([]);
  const onEvent = useCallback((e: ExplorerEvent) => setLog((l) => [{ ...e, seq: (l[0]?.seq ?? 0) + 1 }, ...l].slice(0, 5)), []);
  return (
    <div className="explore">
      <MachineExplorer title={L('3-Phase Induction Motor · IEC 132M', 'محرك حثي ثلاثي الأطوار · IEC 132M')} assetTag="WS-ELEC-07 / MTR-0132"
        parts={lang === 'ar' ? inductionMotorPartsAr : inductionMotorParts} strings={lang === 'ar' ? explorerStringsAr : undefined}
        onEvent={onEvent} height="min(620px, 72vh)" />
      <TelemetryStrip items={log.map((e) => ({ seq: e.seq, verb: e.verb, objectRef: e.objectRef }))}
        empty={L('Drag the explode slider, tap a numbered pin or switch view mode to see the events this sends.',
          'حرّك شريط التفكيك أو اضغط دبوسًا مرقّمًا أو غيّر وضع العرض لترى الأحداث المرسلة.')} />
    </div>
  );
}

function TelemetryStrip({ items, empty }: { items: { seq: number; verb: string; objectRef?: string | null; note?: string }[]; empty: string }) {
  const { L } = useL();
  return (
    <section className="telemetry" aria-label={L('Telemetry', 'القياس عن بعد')}>
      <strong>{L('Telemetry sent to the LMS', 'أحداث القياس المرسلة إلى نظام إدارة التعلم')}</strong>
      {items.length === 0 ? <p className="muted">{empty}</p> : (
        <ol reversed dir="ltr">
          {items.map((e) => (
            <li key={e.seq} className="mono">#{e.seq} {e.verb}{e.objectRef ? ` → ${e.objectRef}` : ''}{e.note ? ` · ${e.note}` : ''}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

const fmt = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const INITIAL_RIG: RigState = { ppe: false, locked: false, panelOpen: false, replaced: [] };
const label = (ref: string) => COMPONENTS.find((c) => c.ref === ref)?.label ?? tx(ref, ref);

function FaultTest() {
  const { faultCode, raiseAlert, addEval, setVlab } = useStore();
  const { L, pick } = useL();
  const [mode, setMode] = useState<Mode>('Guided');
  const [fault, setFault] = useState<Fault>(() => FAULTS.find((f) => f.code === faultCode)!);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [rig, setRig] = useState<RigState>(INITIAL_RIG);
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());
  const [meter, setMeter] = useState<{ tp: TestPoint; display: string; live?: boolean } | null>(null);
  const [notice, setNotice] = useState<{ kind: 'block' | 'info' | 'danger'; text: Txt } | null>(null);
  const [diag, setDiag] = useState({ component: '', condition: '' });
  const [swap, setSwap] = useState('');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const reset = (m: Mode = mode) => {
    setMode(m); setFault(FAULTS.find((f) => f.code === faultCode)!); setEvents([]); setRig(INITIAL_RIG);
    setStartedAt(new Date()); setMeter(null); setNotice(null); setDiag({ component: '', condition: '' }); setSwap(''); setResult(null);
    setVlab({ mode: m === 'Exam' ? 'Exam' : 'Guided', events: 0, status: 'idle' });
  };

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const elapsed = Math.floor((now - startedAt.getTime()) / 1000);
  const locked = result !== null || (mode === 'Exam' && elapsed >= TIME_LIMIT_S);
  const info = (en: string, ar: string) => setNotice({ kind: 'info', text: tx(en, ar) });

  /** Record one telemetry event. Guided mode blocks actions that would break a safety gate. */
  const emit = (verb: string, objectRef?: string, value: Record<string, unknown> = {}): boolean => {
    const prior = eventsRef.current;
    const ev = toEvent((prior.at(-1)?.seq ?? 0) + 1, verb, objectRef, value);
    const violations = detectGateViolations(DOL_RUBRIC, prior, [ev], { startedAt, faults: [fault] });
    if (violations.length && mode === 'Guided') {
      const c = CRITERION_LABELS[violations[0]!.criterionKey]!;
      setNotice({ kind: 'block', text: tx(`Blocked by safety guardrail: ${c.en}.`, `أوقفه حاجز الأمان: ${c.ar}.`) });
      return false;
    }
    const next = [...prior, ev];
    eventsRef.current = next;
    setEvents(next);
    setVlab({ events: next.length, status: 'in progress', mode: mode === 'Exam' ? 'Exam' : 'Guided' });
    if (violations.length && mode === 'Exam') {
      const broken = violations.map((v) => CRITERION_LABELS[v.criterionKey]!);
      raiseAlert({
        learner: LEARNER, source: 'V-Lab',
        text: tx(`Exam: ${verb.replace('_', ' ')} broke ${broken.map((b) => b.en.toLowerCase()).join('; ')}`,
          `امتحان: الإجراء (${verb}) خالف ${broken.map((b) => b.ar).join('؛ ')}`),
      });
    }
    return true;
  };

  const act = (fn: () => void) => () => { if (!locked) { setNotice(null); fn(); } };

  const donPpe = act(() => { if (!rig.ppe && emit('ppe_donned')) setRig((r) => ({ ...r, ppe: true })); });
  const toggleLoto = act(() => {
    if (!rig.locked) { if (emit('loto_applied', 'Q1')) setRig((r) => ({ ...r, locked: true })); }
    else if (emit('loto_removed', 'Q1')) setRig((r) => ({ ...r, locked: false }));
  });
  const togglePanel = act(() => {
    if (!rig.panelOpen) { if (emit('panel_opened', 'panel')) setRig((r) => ({ ...r, panelOpen: true })); }
    else if (emit('panel_closed', 'panel')) setRig((r) => ({ ...r, panelOpen: false }));
  });
  const pressStart = act(() => {
    if (rig.locked) { info('Nothing happens: Q1 is locked off, so there is no supply.', 'لا شيء يحدث: Q1 مقفول، فلا توجد تغذية.'); return; }
    if (rig.panelOpen) { info('Close the panel door before operating the starter.', 'أغلق باب اللوحة قبل تشغيل البادئ.'); return; }
    if (!emit('start_pressed', 'S2')) return;
    if (rig.replaced.includes(fault.componentRef)) info('KM1 pulls in and the motor runs. Press stop when done.', 'يجذب KM1 ويدور المحرك. اضغط الإيقاف عند الانتهاء.');
    else info('Symptom: nothing happens. KM1 does not pull in and the motor stays still.', 'العَرَض: لا شيء يحدث. لا يجذب KM1 ويبقى المحرك ساكنًا.');
  });
  const measure = (tp: TestPoint) => act(() => {
    if (tp.inside && !rig.panelOpen) { info(`${tp.label.en} is inside the panel. Open the panel door first.`, `${tp.label.ar} داخل اللوحة. افتح باب اللوحة أولًا.`); return; }
    if (tp.inside && !rig.locked) {
      if (emit('energized_contact', tp.ref)) {
        setMeter({ tp, display: '230 V AC', live: true });
        setNotice({ kind: 'danger', text: tx('You touched live terminals. The control circuit is energised because Q1 is not locked off.',
          'لمست أطرافًا مكهربة. دائرة التحكم ما زالت موصولة بالتغذية لأن Q1 غير مقفول.') });
      }
      return;
    }
    const r = readMeter(tp, fault, rig);
    if (emit('measured', tp.ref, { reading: r.reading, unit: r.unit })) setMeter({ tp, display: r.display });
  })();
  const submitDiagnosis = act(() => {
    const code = FAULTS.find((f) => f.componentRef === diag.component && conditionOf(f.code) === diag.condition)?.code
      ?? `${diag.component}:${diag.condition}`;
    if (emit('diagnosis_submitted', diag.component, { faultCode: code })) {
      info('Diagnosis recorded. You can still replace a part before submitting.', 'تم تسجيل التشخيص. ما زال بإمكانك استبدال قطعة قبل الإرسال.');
    }
  });
  const replacePart = act(() => {
    if (!rig.panelOpen) { info('Open the panel door to reach the part.', 'افتح باب اللوحة للوصول إلى القطعة.'); return; }
    if (emit('component_replaced', swap)) {
      setRig((r) => ({ ...r, replaced: [...r.replaced, swap] }));
      const c = label(swap);
      info(`${c.en} replaced.`, `تم استبدال ${c.ar}.`);
    }
  });
  const submit = () => {
    const res = evaluate(DOL_RUBRIC, eventsRef.current, { startedAt, submittedAt: new Date(), faults: [fault] });
    setResult(res);
    setVlab({ status: 'submitted' });
    addEval({ learner: LEARNER, lab: DOL_LAB, mode: mode === 'Exam' ? 'Exam' : 'Guided', score: res.totalScore, passed: res.passed, gateFailures: res.gateFailures });
  };

  // Guided step pointer: first step whose evidence is not in the stream yet.
  const has = (verb: string, ref?: string) => events.some((e) => e.verb === verb && (!ref || e.objectRef === ref));
  const stepDone = [
    rig.ppe, has('start_pressed') && has('measured', 'X1:L1-L2'), has('loto_applied'), has('measured', 'Q1:load_side'),
    has('panel_opened'), ['Q1:control_supply', 'S1:stop_pb', 'F2:95-96'].every((r) => has('measured', r)) || has('measured', 'KM1:A1-A2'),
    has('diagnosis_submitted'), has('component_replaced'),
  ];
  const step = stepDone.findIndex((d) => !d);

  return (
    <div className="vlab">
      <div className="vlab-bar">
        <div className="modes" role="radiogroup" aria-label={L('Mode', 'الوضع')}>
          {(['Guided', 'Sandbox', 'Exam'] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => reset(m)}>{pick(MODE_LABEL[m])}</button>
          ))}
        </div>
        <p className="muted mode-help">
          {mode === 'Guided' && L('Step prompts on. Unsafe actions are blocked before they happen.', 'إرشادات الخطوات مفعّلة. تُمنع الإجراءات غير الآمنة قبل حدوثها.')}
          {mode === 'Sandbox' && L('Free practice. Nothing is blocked and your trainer is not alerted.', 'تدريب حر. لا يُمنع شيء ولا يصل تنبيه إلى مدربك.')}
          {mode === 'Exam' && L('No hints. Unsafe actions are recorded and sent to your trainer’s tablet.', 'بلا تلميحات. تُسجَّل الإجراءات غير الآمنة وتُرسل إلى جهاز مدربك.')}
        </p>
        <span className={`timer mono ${mode === 'Exam' && TIME_LIMIT_S - elapsed < 300 ? 'timer-low' : ''}`} aria-label={L('Timer', 'المؤقت')}>
          ⏱ <span dir="ltr">{mode === 'Exam' ? fmt(TIME_LIMIT_S - elapsed) : fmt(elapsed)}</span>
        </span>
      </div>

      <div className="vlab-grid">
        <section className="rig" aria-label={L('Starter panel', 'لوحة البادئ')}>
          <div className="rig-status">
            <StatusChip on={rig.ppe} label={L('PPE', 'الوقاية')} onText={L('On', 'مرتداة')} offText={L('Not worn', 'غير مرتداة')} />
            <StatusChip on={rig.locked} label={L('Q1 isolator', 'المفصل Q1')} onText={L('Locked off', 'مفصول ومقفول')} offText={L('Live', 'موصول')} danger={!rig.locked} />
            <StatusChip on={rig.panelOpen} label={L('Panel door', 'باب اللوحة')} onText={L('Open', 'مفتوح')} offText={L('Closed', 'مغلق')} neutral />
          </div>
          <Schematic rig={rig} onMeasure={measure} active={meter?.tp.ref} />
          <div className="rig-actions">
            <button type="button" onClick={donPpe} disabled={rig.ppe || locked}>{L('Put on PPE', 'ارتدِ معدات الوقاية')}</button>
            <button type="button" onClick={pressStart} disabled={locked}>{L('Press START', 'اضغط START')}</button>
            <button type="button" onClick={toggleLoto} disabled={locked}>{rig.locked ? L('Remove lock & tag', 'إزالة القفل والبطاقة') : L('Lock off Q1 (LOTO)', 'افصل واقفل Q1 (LOTO)')}</button>
            <button type="button" onClick={togglePanel} disabled={locked}>{rig.panelOpen ? L('Close panel door', 'أغلق باب اللوحة') : L('Open panel door', 'افتح باب اللوحة')}</button>
          </div>
          {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === 'info' ? 'status' : 'alert'}>{pick(notice.text)}</p>}
        </section>

        <aside className="side">
          <div className={`meter ${meter?.live ? 'meter-live' : ''}`} aria-live="polite">
            <span className="meter-mode mono">{meter ? (meter.live ? L('DANGER', 'خطر') : meter.tp.mode === 'V' ? 'V AC' : 'Ω') : L('Multimeter', 'جهاز القياس المتعدد')}</span>
            <span className="meter-value mono" dir="ltr">{meter?.display ?? '– – –'}</span>
            <span className="meter-tp">{meter ? pick(meter.tp.label) : L('Tap a test point on the drawing', 'اضغط نقطة قياس على المخطط')}</span>
          </div>

          {mode === 'Guided' && !result && (
            <ol className="steps">
              {GUIDED_STEPS.map((s, i) => (
                <li key={s.en} className={stepDone[i] ? 'done' : i === step ? 'now' : ''}>
                  <span className="step-mark" aria-hidden="true">{stepDone[i] ? '✓' : i + 1}</span>{pick(s)}
                </li>
              ))}
            </ol>
          )}

          {!result ? (
            <div className="diag">
              <p className="eyebrow">{L('Diagnosis', 'التشخيص')}</p>
              <label className="field"><span>{L('Faulty component', 'المكوّن المعطوب')}</span>
                <select id="diag-component" value={diag.component} onChange={(e) => setDiag((d) => ({ ...d, component: e.target.value }))} disabled={locked}>
                  <option value="">{L('Choose…', 'اختر…')}</option>
                  {COMPONENTS.map((c) => <option key={c.ref} value={c.ref}>{pick(c.label)}</option>)}
                </select>
              </label>
              <label className="field"><span>{L('Condition', 'الحالة')}</span>
                <select id="diag-condition" value={diag.condition} onChange={(e) => setDiag((d) => ({ ...d, condition: e.target.value }))} disabled={locked}>
                  <option value="">{L('Choose…', 'اختر…')}</option>
                  <option value="open">{L('Open circuit / contact open', 'دائرة مفتوحة / تلامس مفتوح')}</option>
                  <option value="blown">{L('Blown', 'محروق')}</option>
                  <option value="welded">{L('Contacts welded shut', 'تلامسات ملتحمة')}</option>
                  <option value="short">{L('Short circuit', 'قصر')}</option>
                </select>
              </label>
              <button type="button" onClick={submitDiagnosis} disabled={!diag.component || !diag.condition || locked}>{L('Record diagnosis', 'سجّل التشخيص')}</button>
              <div className="swap">
                <label className="field"><span>{L('Replace a part', 'استبدال قطعة')}</span>
                  <select id="swap-part" value={swap} onChange={(e) => setSwap(e.target.value)} disabled={locked}>
                    <option value="">{L('Choose…', 'اختر…')}</option>
                    {COMPONENTS.map((c) => <option key={c.ref} value={c.ref}>{pick(c.label)}</option>)}
                  </select>
                </label>
                <button type="button" className="btn-replace" onClick={replacePart} disabled={!swap || locked}>{L('Replace', 'استبدل')}</button>
              </div>
              <button type="button" className="primary btn-submit" onClick={submit} disabled={events.length === 0 || result !== null}>{L('Submit for scoring', 'أرسل للتقييم')}</button>
            </div>
          ) : (
            <Result res={result} fault={fault.title} onRetry={() => reset()} />
          )}
        </aside>
      </div>

      <TelemetryStrip items={[...events].reverse().slice(0, 8).map((e) => ({
        seq: e.seq, verb: e.verb, objectRef: e.objectRef,
        note: typeof e.value['reading'] === 'number' ? `${e.value['reading']} ${e.value['unit']}` : e.value['reading'] === null ? 'OL' : undefined,
      }))} empty={L('Every action you take is recorded with a sequence number and scored by the same rubric engine the server uses.',
        'كل إجراء تقوم به يُسجَّل برقم تسلسلي ويُقيَّم بنفس محرك معايير التقييم المستخدم على الخادم.')} />
    </div>
  );
}

function conditionOf(code: string) { return code === 'F-F1-BLOWN' ? 'blown' : 'open'; }

function StatusChip({ on, label, onText, offText, danger, neutral }: { on: boolean; label: string; onText: string; offText: string; danger?: boolean; neutral?: boolean }) {
  const cls = neutral ? 'chip-neutral' : on ? 'chip-on' : danger ? 'chip-danger' : 'chip-off';
  return <span className={`status-chip ${cls}`}><b>{label}</b> {on ? onText : offText}</span>;
}

const LEVELS: Record<string, Txt> = {
  not_yet: tx('not yet', 'لم يصل بعد'), novice: tx('novice', 'مبتدئ'), intermediate: tx('intermediate', 'متوسط'), autonomous: tx('autonomous', 'مستقل'),
};

function Result({ res, fault, onRetry }: { res: EvaluationResult; fault: Txt; onRetry: () => void }) {
  const { L, pick } = useL();
  const level = res.gateFailures.length ? L('No credit (safety gate failed)', 'لا رصيد (رسوب في شرط أمان)') : pick(LEVELS[levelForScore(res.totalScore)]!);
  return (
    <div className="result">
      <div className={`result-head ${res.passed ? 'v-pass' : 'v-fail'}`}>
        <span className="v-score">{res.totalScore}</span>
        <span><strong>{res.passed ? L('Pass', 'ناجح') : L('Not yet', 'لم يجتز بعد')}</strong><br />
          <small>{L('Pass mark 70 · competency', 'درجة النجاح 70 · مستوى الجدارة')}: {level}</small></span>
      </div>
      <p className="muted">{L('Injected fault', 'العطل المزروع')}: {pick(fault)}</p>
      <table className="crit">
        <thead><tr><th>{L('Criterion', 'المعيار')}</th><th>{L('Score', 'الدرجة')}</th><th>{L('Wt', 'الوزن')}</th></tr></thead>
        <tbody>
          {res.criteria.map((c) => (
            <tr key={c.key} className={c.gateFailed ? 'gate-failed' : ''}>
              <td>{pick(CRITERION_LABELS[c.key] ?? tx(c.label, c.label))}{c.isGate && <span className="gate">{L('Gate', 'شرط أمان')}</span>}
                <small dir="ltr" className="detail">{c.detail}</small></td>
              <td className="num">{c.score}</td>
              <td className="num">{c.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onRetry}>{L('Start a new attempt', 'ابدأ محاولة جديدة')}</button>
    </div>
  );
}

/** Ladder drawing of the starter, always drawn left-to-right as on a real panel. Test points are the tappable circles. */
function Schematic({ rig, onMeasure, active }: { rig: RigState; onMeasure: (tp: TestPoint) => void; active?: string }) {
  const { lang, L, pick } = useL();
  const tp = (ref: string) => TEST_POINTS.find((t) => t.ref === ref)!;
  // A render helper rather than a component, so points keep focus across renders.
  const pt = ({ r, x, y, label, dx = 0, dy = -16 }: { r: string; x: number; y: number; label: string; dx?: number; dy?: number }) => {
    const t = tp(r);
    const reachable = !t.inside || rig.panelOpen;
    return (
      <g key={r} className={`tp ${active === r ? 'tp-active' : ''} ${reachable ? '' : 'tp-blocked'}`} role="button" tabIndex={0}
        aria-label={L(`Measure ${t.label.en}`, `قِس ${t.label.ar}`)} data-tp={r} onClick={() => onMeasure(t)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMeasure(t); } }}>
        <title>{pick(t.label)}</title>
        <circle cx={x} cy={y} r={18} className="tp-hit" />
        <circle cx={x} cy={y} r={7} className="tp-dot" />
        <text x={x + dx} y={y + dy} textAnchor="middle" className="tp-label">{label}</text>
      </g>
    );
  };
  return (
    <svg className="schematic" viewBox="0 0 640 330" role="group" aria-label={L('DOL starter circuit with test points', 'دائرة بادئ DOL مع نقاط القياس')}>
      {/* Power circuit */}
      {/* Arabic captions are centred so their right-to-left runs (see .schematic text in CSS) stay inside the frame. */}
      <text x={L('16', '320')} y="22" textAnchor={lang === 'ar' ? 'middle' : 'start'} className="sch-cap">{L('POWER · 400 V 3~', 'دائرة القدرة · 400 فولت ثلاثي الأطوار')}</text>
      <rect x="20" y="44" width="56" height="40" rx="4" className="sch-box" /><text x="48" y="69" textAnchor="middle" className="sch-txt">X1</text>
      <line x1="76" y1="64" x2="128" y2="64" className="sch-wire" />
      <rect x="128" y="44" width="64" height="40" rx="4" className={`sch-box ${rig.locked ? 'sch-locked' : ''}`} />
      <text x="160" y="69" textAnchor="middle" className="sch-txt">Q1</text>
      {rig.locked && <g><rect x="136" y="88" width="48" height="22" rx="3" className="tag" /><text x="160" y="103" textAnchor="middle" className="tag-txt">{L('LOCKED', 'مقفول')}</text></g>}
      <line x1="192" y1="64" x2="300" y2="64" className="sch-wire" />
      <rect x="300" y="48" width="70" height="32" rx="4" className="sch-box" /><text x="335" y="69" textAnchor="middle" className="sch-txt">KM1</text>
      <line x1="370" y1="64" x2="420" y2="64" className="sch-wire" />
      <rect x="420" y="48" width="64" height="32" rx="4" className="sch-box" /><text x="452" y="69" textAnchor="middle" className="sch-txt">F2</text>
      <line x1="484" y1="64" x2="548" y2="64" className="sch-wire" />
      <circle cx="574" cy="64" r="26" className="sch-box" /><text x="574" y="62" textAnchor="middle" className="sch-txt">M</text>
      <text x="574" y="77" textAnchor="middle" className="sch-small">3~</text>

      {/* Control circuit (inside the panel) */}
      <text x={L('16', '500')} y="320" textAnchor={lang === 'ar' ? 'middle' : 'start'} className="sch-cap">{L('CONTROL · 230 V', 'دائرة التحكم · 230 فولت')}</text>
      <line x1="210" y1="64" x2="210" y2="120" className="sch-wire" />
      <line x1="60" y1="120" x2="210" y2="120" className="sch-wire" />
      <line x1="60" y1="120" x2="60" y2="226" className="sch-wire" />
      <rect x="48" y="160" width="24" height="40" rx="3" className="sch-box" /><text x="88" y="185" className="sch-txt">F1</text>
      <line x1="60" y1="226" x2="140" y2="226" className="sch-wire" />
      {/* S1 NC */}
      <line x1="140" y1="226" x2="150" y2="226" className="sch-wire" /><line x1="150" y1="218" x2="176" y2="228" className="sch-wire" />
      <line x1="176" y1="218" x2="176" y2="232" className="sch-wire" /><text x="163" y="256" textAnchor="middle" className="sch-txt">S1</text>
      <line x1="176" y1="226" x2="236" y2="226" className="sch-wire" />
      {/* S2 NO, KM1 13-14 hold-in in parallel */}
      <line x1="236" y1="226" x2="246" y2="226" className="sch-wire" /><line x1="246" y1="226" x2="270" y2="212" className="sch-wire" />
      <line x1="272" y1="226" x2="300" y2="226" className="sch-wire" /><text x="259" y="256" textAnchor="middle" className="sch-txt">S2</text>
      <line x1="236" y1="226" x2="236" y2="296" className="sch-wire" /><line x1="300" y1="226" x2="300" y2="296" className="sch-wire" />
      <line x1="236" y1="296" x2="252" y2="296" className="sch-wire" /><line x1="252" y1="296" x2="276" y2="284" className="sch-wire" />
      <line x1="278" y1="296" x2="300" y2="296" className="sch-wire" /><text x="268" y="318" textAnchor="middle" className="sch-small">KM1 13-14</text>
      <line x1="300" y1="226" x2="380" y2="226" className="sch-wire" />
      {/* F2 95-96 NC */}
      <line x1="380" y1="226" x2="390" y2="226" className="sch-wire" /><line x1="390" y1="218" x2="416" y2="228" className="sch-wire" />
      <line x1="416" y1="218" x2="416" y2="232" className="sch-wire" /><text x="403" y="256" textAnchor="middle" className="sch-txt">F2</text>
      <line x1="416" y1="226" x2="470" y2="226" className="sch-wire" />
      {/* KM1 coil */}
      <rect x="470" y="210" width="44" height="32" rx="3" className="sch-box" /><text x="492" y="231" textAnchor="middle" className="sch-txt">KM1</text>
      <line x1="514" y1="226" x2="600" y2="226" className="sch-wire" /><line x1="600" y1="226" x2="600" y2="120" className="sch-wire" />
      <text x="606" y="116" className="sch-small">N</text>

      {!rig.panelOpen && (
        <g className="door">
          <rect x="30" y="132" width="596" height="194" rx="8" />
          <text x="328" y="236" textAnchor="middle">{L('Panel door closed · open it to reach the control circuit', 'باب اللوحة مغلق · افتحه للوصول إلى دائرة التحكم')}</text>
        </g>
      )}

      {pt({ r: 'X1:L1-L2', x: 102, y: 64, label: 'X1 L1–L2', dy: 30 })}
      {pt({ r: 'Q1:load_side', x: 210, y: 92, label: L('Q1 load', 'مخرج Q1'), dx: 34, dy: 4 })}
      {pt({ r: 'Q1:control_supply', x: 60, y: 142, label: L('F1 supply', 'تغذية F1'), dx: 48, dy: 4 })}
      {pt({ r: 'S1:stop_pb', x: 163, y: 200, label: 'S1' })}
      {pt({ r: 'S2:start_pb', x: 259, y: 196, label: 'S2' })}
      {pt({ r: 'F2:95-96', x: 403, y: 200, label: '95–96' })}
      {pt({ r: 'KM1:A1-A2', x: 492, y: 188, label: 'A1–A2' })}
    </svg>
  );
}
