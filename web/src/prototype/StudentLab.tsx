/** Screen 2 — Student 3D Lab Explorer + V-Lab fault test (docs/ui-blueprint.md §2). */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FullscreenIcon, useFullscreen } from './fullscreen';
import { MachineExplorer, type ExplorerEvent } from '../components/MachineExplorer';
import { LessonPlayer, type LessonEvent } from '../components/LessonPlayer';
import { modelParts } from '../models/kit';
import { TradeIcon } from './TradeBar';
import { tx, type Txt } from './i18n';
import { TRADES, type Trade } from './trades';
import type { Diagram, Fault, Lab, RigState, TestPoint } from './trades/types';
import { detectGateViolations, evaluate, levelForScore, stepDone, toEvent, type EvaluationResult, type TelemetryEvent } from './vlab';
import { explorerStringsAr } from './motorAr';
import { useL, useStore } from './store';
import { CardHead, PageHeader } from './ui';

type Mode = 'Guided' | 'Sandbox' | 'Exam';
const MODE_LABEL: Record<Mode, Txt> = { Guided: tx('Guided', 'موجّه'), Sandbox: tx('Sandbox', 'تجريبي حر'), Exam: tx('Exam', 'امتحان') };
const TIME_LIMIT_S = 1800;

type Tab = '3d' | 'lessons' | 'vlab';

export function StudentLab() {
  const { L, pick } = useL();
  const { trade } = useStore();
  const { lab } = trade;
  // Tab per trade, so switching trade and back keeps where you were.
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const tab = tabs[trade.id] ?? '3d';
  const setTab = (t: Tab) => setTabs((m) => ({ ...m, [trade.id]: t }));
  // Each trade's panes mount on first visit and then stay mounted (hidden), so an
  // attempt or a lesson in progress survives switching. drei's <Html> pins also
  // throw a removeChild error if they unmount mid-session.
  const key = `${trade.id}:${tab}`;
  const [seen, setSeen] = useState<string[]>([key]);
  useEffect(() => { setSeen((v) => (v.includes(key) ? v : [...v, key])); }, [key]);
  const shown = (t: Trade, k: Tab) => seen.includes(`${t.id}:${k}`);
  const on = (t: Trade, k: Tab) => t.id === trade.id && tab === k;

  const TABS: { id: Tab; label: Txt; n?: number }[] = [
    { id: '3d', label: tx('3D & VR', 'ثلاثي الأبعاد والواقع الافتراضي'), n: trade.models.length },
    { id: 'lessons', label: tx('Video lessons', 'دروس الفيديو'), n: trade.lessons.length },
    { id: 'vlab', label: tx('V-Lab fault test', 'اختبار الأعطال الافتراضي') },
  ];
  const head: Record<Tab, { title: string; meta: string }> = {
    '3d': { title: L(`${trade.name.en}: 3D digital twins`, `${trade.name.ar}: التوائم الرقمية ثلاثية الأبعاد`),
      meta: L('Take the machine apart, X-ray it, run it, and open any part\'s specification. Enter VR to stand next to it.',
        'فكّك الماكينة، واعرضها بالأشعة، وشغّلها، وافتح مواصفات أي قطعة. ادخل الواقع الافتراضي لتقف بجوارها.') },
    lessons: { title: L(`${trade.name.en}: video lessons`, `${trade.name.ar}: دروس الفيديو`),
      meta: L('Each lesson stops at checkpoints for you to answer. Zoom in, change speed, open hotspots and jump between chapters.',
        'كل درس يتوقف عند نقاط تحقق لتجيب عنها. كبّر الصورة، وغيّر السرعة، وافتح نقاط المعلومات، وتنقّل بين الفصول.') },
    vlab: { title: pick(lab.intro), meta: L('Find and fix the fault safely. Your actions are scored against the unit rubric.', 'حدّد العطل وأصلحه بأمان. تُقيَّم إجراءاتك وفق معايير الوحدة.') },
  };
  return (
    <div className="lab" style={{ ['--trade-accent' as string]: trade.accent }}>
      <PageHeader
        crumbs={[L('My learning', 'تعلّمي'), pick(trade.name), lab.unit.code, pick(lab.unit.title)]}
        title={<span className="lab-title"><TradeIcon trade={trade} size={28} />{head[tab].title}</span>}
        meta={head[tab].meta}
        actions={
          <div className="tabs lab-tabs" role="tablist" aria-label={L('Lab activity', 'نشاط المعمل')}>
            {TABS.map((x, i) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
                {i + 1} · {pick(x.label)}{x.n ? <span className="tab-n">{x.n}</span> : null}
              </button>
            ))}
          </div>
        } />
      {TRADES.map((t) => (
        <div key={t.id} className="lab-panes">
          {shown(t, '3d') && <div hidden={!on(t, '3d')}><Explore trade={t} active={on(t, '3d')} /></div>}
          {shown(t, 'lessons') && <div hidden={!on(t, 'lessons')}><Lessons trade={t} active={on(t, 'lessons')} /></div>}
          {shown(t, 'vlab') && <div hidden={!on(t, 'vlab')}><FaultTest trade={t} /></div>}
        </div>
      ))}
    </div>
  );
}

function Explore({ trade, active }: { trade: Trade; active: boolean }) {
  const { lang, L, pick } = useL();
  const [log, setLog] = useState<(ExplorerEvent & { seq: number })[]>([]);
  const onEvent = useCallback((e: ExplorerEvent) => setLog((l) => [{ ...e, seq: (l[0]?.seq ?? 0) + 1 }, ...l].slice(0, 5)), []);
  const [modelId, setModelId] = useState(trade.models[0]!.id);
  const [opened, setOpened] = useState<string[]>([modelId]);
  const choose = (id: string) => { setModelId(id); setOpened((o) => (o.includes(id) ? o : [...o, id])); onEvent({ verb: 'part_selected', objectRef: `model:${id}` }); };
  const stageRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(stageRef);
  return (
    <div className="explore">
      {trade.models.length > 1 && (
        <div className="model-switch" role="radiogroup" aria-label={L('Choose a machine', 'اختر الماكينة')}>
          {trade.models.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === modelId} onClick={() => choose(m.id)}>
              <b>{pick(m.title).split(' · ')[0]}</b><small>{m.assetTag}</small>
            </button>
          ))}
        </div>
      )}
      <div ref={stageRef} className={`explore-stage ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
        <button type="button" className="fs-btn fs-float" aria-pressed={fs.isFull} onClick={() => void fs.toggle()}
          title={fs.isFull ? L('Exit full screen (Esc)', 'الخروج من ملء الشاشة (Esc)') : L('Full-screen 3D view', 'عرض ثلاثي الأبعاد بملء الشاشة')}>
          <FullscreenIcon exit={fs.isFull} />
          <span className="fs-text">{fs.isFull ? L('Exit', 'خروج') : L('Full screen', 'ملء الشاشة')}</span>
        </button>
        {trade.models.filter((m) => opened.includes(m.id)).map((m) => (
          <div key={m.id} hidden={m.id !== modelId} className="explore-model">
            <MachineExplorer title={pick(m.title)} assetTag={m.assetTag} parts={modelParts(m, lang)} view={m.view}
              params={m.params} runParams={m.runParams} active={active && m.id === modelId}
              strings={lang === 'ar' ? explorerStringsAr : undefined}
              onEvent={onEvent} height="min(620px, 72vh)" />
          </div>
        ))}
      </div>
      <div className="explore-foot">
        <section className="card vr-card">
          <CardHead title={L('Virtual reality', 'الواقع الافتراضي')} sub={L('Press Enter VR in the 3D view', 'اضغط «دخول الواقع الافتراضي» في العرض ثلاثي الأبعاد')} />
          <ul>
            <li><b>{L('Headset', 'نظارة VR')}</b> {L('Meta Quest, Pico or a PC headset: open this page in the headset browser and the machine stands on the workshop floor in front of you, at real scale.', 'Meta Quest أو Pico أو نظارة حاسوب: افتح الصفحة في متصفح النظارة فتظهر الماكينة على أرض الورشة أمامك بحجمها الحقيقي.')}</li>
            <li><b>{L('Phone', 'الهاتف')}</b> {L('Without a headset you get a side-by-side stereo view for a Cardboard-style viewer. Turn the phone sideways.', 'دون نظارة يظهر عرض مجسم مزدوج لنظارة من نوع Cardboard. أدر الهاتف أفقيًا.')}</li>
          </ul>
        </section>
        <TelemetryStrip items={log.map((e) => ({ seq: e.seq, verb: e.verb, objectRef: e.objectRef }))}
          empty={L('Drag the explode slider, tap a numbered pin or switch view mode to see the events this sends.',
            'حرّك شريط التفكيك أو اضغط دبوسًا مرقّمًا أو غيّر وضع العرض لترى الأحداث المرسلة.')} />
      </div>
    </div>
  );
}

function Lessons({ trade, active }: { trade: Trade; active: boolean }) {
  const { lang, L, pick } = useL();
  const [current, setCurrent] = useState(trade.lessons[0]!.id);
  const [opened, setOpened] = useState<string[]>([current]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [log, setLog] = useState<{ seq: number; verb: string; objectRef?: string; note?: string }[]>([]);
  const onEvent = useCallback((e: LessonEvent) => setLog((l) => [{ seq: (l[0]?.seq ?? 0) + 1, verb: e.verb, objectRef: e.objectRef,
    note: e.value && 'correct' in e.value ? (e.value.correct ? 'correct' : 'wrong') : e.value && 'score' in e.value ? `${e.value.score}%` : undefined }, ...l].slice(0, 6)), []);
  const choose = (id: string) => { setCurrent(id); setOpened((o) => (o.includes(id) ? o : [...o, id])); };
  return (
    <div className="lessons">
      <ol className="lesson-list">
        {trade.lessons.map((ls, i) => (
          <li key={ls.id}>
            <button type="button" aria-current={ls.id === current} onClick={() => choose(ls.id)}>
              <span className="lesson-no">{i + 1}</span>
              <span className="lesson-body">
                <b>{pick(ls.title)}</b>
                <small>{Math.round(ls.duration / 60)} {L('min', 'دقيقة')} · {ls.chapters.length} {L('chapters', 'فصول')} · {ls.stops.length} {L('checkpoints', 'نقاط تحقق')} · {pick(ls.model.title).split(' · ')[0]}</small>
              </span>
              <span className={`lesson-state ${scores[ls.id] !== undefined ? 'done' : ''}`}>
                {scores[ls.id] !== undefined ? `${scores[ls.id]}%` : ls.id === current ? L('Now', 'الآن') : L('Start', 'ابدأ')}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {trade.lessons.filter((ls) => opened.includes(ls.id)).map((ls) => (
        <div key={ls.id} hidden={ls.id !== current}>
          <LessonPlayer lesson={ls} lang={lang} active={active && ls.id === current} onEvent={onEvent}
            onComplete={(r) => setScores((m) => ({ ...m, [ls.id]: r.score }))} />
        </div>
      ))}
      <p className="lesson-note muted">{L('These lessons are rendered live on the 3D digital twin, so you can pause and look around any frame. Filmed workshop video can be dropped in later and keeps the same checkpoints, hotspots and scoring.',
        'هذه الدروس تُعرض مباشرة على التوأم الرقمي ثلاثي الأبعاد، فيمكنك الإيقاف والنظر حول أي لقطة. ويمكن لاحقًا إضافة فيديو مصوّر من الورشة مع الاحتفاظ بنفس نقاط التحقق والمعلومات والتقييم.')}</p>
      <TelemetryStrip items={log} empty={L('Start a lesson: checkpoint answers, hotspots and chapters are sent as telemetry.', 'ابدأ درسًا: إجابات نقاط التحقق والمعلومات والفصول تُرسل كأحداث قياس.')} />
    </div>
  );
}

function TelemetryStrip({ items, empty }: { items: { seq: number; verb: string; objectRef?: string | null; note?: string }[]; empty: string }) {
  const { L } = useL();
  return (
    <section className="card telemetry" aria-label={L('Telemetry', 'القياس عن بعد')}>
      <CardHead title={L('Activity log', 'سجل النشاط')} sub={L('Telemetry sent to VTC_LMS, newest first', 'أحداث القياس المرسلة إلى VTC_LMS، الأحدث أولًا')} />
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

function FaultTest({ trade }: { trade: Trade }) {
  const { faultCodes, raiseAlert, addEval, setVlab: setVlabFor } = useStore();
  const { L, pick } = useL();
  const { lab } = trade;
  const LEARNER = trade.learner.name;
  const faultCode = faultCodes[trade.id]!;
  const setVlab = (v: Parameters<typeof setVlabFor>[1]) => setVlabFor(trade.id, v);
  const label = (ref: string) => lab.components.find((c) => c.ref === ref)?.label ?? tx(ref, ref);
  const [mode, setMode] = useState<Mode>('Guided');
  const [fault, setFault] = useState<Fault>(() => lab.faults.find((f) => f.code === faultCode)!);
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
    setMode(m); setFault(lab.faults.find((f) => f.code === faultCode)!); setEvents([]); setRig(INITIAL_RIG);
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
    const violations = detectGateViolations(lab.rubric, prior, [ev], { startedAt, faults: [fault] });
    if (violations.length && mode === 'Guided') {
      const c = lab.criterionLabels[violations[0]!.criterionKey]!;
      setNotice({ kind: 'block', text: tx(`Blocked by safety guardrail: ${c.en}.`, `أوقفه حاجز الأمان: ${c.ar}.`) });
      return false;
    }
    const next = [...prior, ev];
    eventsRef.current = next;
    setEvents(next);
    setVlab({ events: next.length, status: 'in progress', mode: mode === 'Exam' ? 'Exam' : 'Guided' });
    if (violations.length && mode === 'Exam') {
      const broken = violations.map((v) => lab.criterionLabels[v.criterionKey]!);
      raiseAlert({
        trade: trade.id, learner: LEARNER, source: 'V-Lab',
        text: tx(`Exam: ${verb.replace('_', ' ')} broke ${broken.map((b) => b.en.toLowerCase()).join('; ')}`,
          `امتحان: الإجراء (${verb}) خالف ${broken.map((b) => b.ar).join('؛ ')}`),
      });
    }
    return true;
  };

  const act = (fn: () => void) => () => { if (!locked) { setNotice(null); fn(); } };

  const donPpe = act(() => { if (!rig.ppe && emit('ppe_donned')) setRig((r) => ({ ...r, ppe: true })); });
  const toggleLoto = act(() => {
    if (!rig.locked) { if (emit('loto_applied', lab.isolation.ref)) setRig((r) => ({ ...r, locked: true })); }
    else if (emit('loto_removed', lab.isolation.ref)) setRig((r) => ({ ...r, locked: false }));
  });
  const togglePanel = act(() => {
    if (!rig.panelOpen) { if (emit('panel_opened', 'panel')) setRig((r) => ({ ...r, panelOpen: true })); }
    else if (emit('panel_closed', 'panel')) setRig((r) => ({ ...r, panelOpen: false }));
  });
  const say = (t: Txt) => setNotice({ kind: 'info', text: t });
  const pressStart = act(() => {
    if (rig.locked) { say(lab.run.whileLocked); return; }
    if (rig.panelOpen) { say(lab.run.whileOpen); return; }
    if (!emit('start_pressed', 'run')) return;
    if (rig.replaced.includes(fault.componentRef)) say(lab.run.repaired);
    else say(tx(`Symptom: ${fault.symptom.en}`, `العَرَض: ${fault.symptom.ar}`));
  });
  const measure = (tp: TestPoint) => act(() => {
    if (tp.inside && !rig.panelOpen) { info(`${tp.label.en} ${lab.enclosure.mustOpen.en}`, `${tp.label.ar} ${lab.enclosure.mustOpen.ar}`); return; }
    if (tp.inside && !rig.locked) {
      if (emit('energized_contact', tp.ref)) {
        setMeter({ tp, display: pick(lab.danger.display), live: true });
        setNotice({ kind: 'danger', text: lab.danger.text });
      }
      return;
    }
    const r = tp.read({ isFaulty: (c) => c === fault.componentRef && !rig.replaced.includes(c), rig });
    if (emit('measured', tp.ref, { reading: r.reading, unit: r.unit })) setMeter({ tp, display: r.display });
  })();
  const submitDiagnosis = act(() => {
    const code = lab.faults.find((f) => f.componentRef === diag.component && f.condition === diag.condition)?.code
      ?? `${diag.component}:${diag.condition}`;
    if (emit('diagnosis_submitted', diag.component, { faultCode: code })) {
      info('Diagnosis recorded. You can still replace a part before submitting.', 'تم تسجيل التشخيص. ما زال بإمكانك استبدال قطعة قبل الإرسال.');
    }
  });
  const replacePart = act(() => {
    if (!rig.panelOpen) { info(`The part ${lab.enclosure.mustOpen.en}`, `القطعة ${lab.enclosure.mustOpen.ar}`); return; }
    if (emit('component_replaced', swap)) {
      setRig((r) => ({ ...r, replaced: [...r.replaced, swap] }));
      const c = label(swap);
      info(`${c.en}: fixed or replaced.`, `${c.ar}: تم الإصلاح أو الاستبدال.`);
    }
  });
  const submit = () => {
    const res = evaluate(lab.rubric, eventsRef.current, { startedAt, submittedAt: new Date(), faults: [fault] });
    setResult(res);
    setVlab({ status: 'submitted' });
    addEval({ trade: trade.id, learner: LEARNER, mode: mode === 'Exam' ? 'Exam' : 'Guided', score: res.totalScore, passed: res.passed, gateFailures: res.gateFailures });
  };

  // Guided step pointer: first step whose evidence is not in the stream yet.
  const done = lab.steps.map((s) => stepDone(s.done, events, rig));
  const nSteps = lab.steps.length;
  const step = done.findIndex((d) => !d);

  return (
    <div className="vlab">
      <div className="vlab-bar card">
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
        <section className="card rig" aria-labelledby="rig-title">
          <CardHead id={`rig-title-${trade.id}`} title={pick(lab.rigTitle)} sub={L('Tap a blue test point to measure or inspect it.', 'اضغط نقطة قياس زرقاء لقياسها أو فحصها.')}
            actions={<div className="rig-status">
              <StatusChip on={rig.ppe} label={L('PPE', 'الوقاية')} onText={L('On', 'مرتداة')} offText={L('Not worn', 'غير مرتداة')} />
              <StatusChip on={rig.locked} label={lab.isolation.chip} onText={pick(lab.isolation.on)} offText={pick(lab.isolation.off)} danger={!rig.locked} />
              <StatusChip on={rig.panelOpen} label={pick(lab.enclosure.chip)} onText={L('Open', 'مفتوح')} offText={L('Closed', 'مغلق')} neutral />
            </div>} />
          {lab.diagram === 'dol'
            ? <Schematic lab={lab} rig={rig} onMeasure={measure} active={meter?.tp.ref} />
            : <BlockDiagram lab={lab} d={lab.diagram} rig={rig} onMeasure={measure} active={meter?.tp.ref} />}
          <div className="rig-actions">
            <button type="button" onClick={donPpe} disabled={rig.ppe || locked}>{pick(lab.ppe.button)}</button>
            <button type="button" onClick={pressStart} disabled={locked}>{pick(lab.run.button)}</button>
            <button type="button" onClick={toggleLoto} disabled={locked}>{rig.locked ? pick(lab.isolation.unlock) : pick(lab.isolation.lock)}</button>
            <button type="button" onClick={togglePanel} disabled={locked}>{rig.panelOpen ? pick(lab.enclosure.close) : pick(lab.enclosure.open)}</button>
          </div>
          {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === 'info' ? 'status' : 'alert'}>{pick(notice.text)}</p>}
        </section>

        <aside className="side">
          <div className={`meter ${meter?.live ? 'meter-live' : ''}`} aria-live="polite">
            <span className="meter-mode mono">{meter ? (meter.live ? L('DANGER', 'خطر') : meter.tp.instrument) : L('Meter & gauges', 'أجهزة القياس')}</span>
            <span className="meter-value mono" dir="ltr">{meter?.display ?? '– – –'}</span>
            <span className="meter-tp">{meter ? pick(meter.tp.label) : L('Tap a test point on the drawing', 'اضغط نقطة قياس على المخطط')}</span>
          </div>

          {mode === 'Guided' && !result && (
            <section className="card" aria-labelledby={`steps-title-${trade.id}`}>
            <CardHead id={`steps-title-${trade.id}`} title={L('Procedure', 'خطوات العمل')}
              sub={L(`Step ${step === -1 ? nSteps : step + 1} of ${nSteps}`, `الخطوة ${step === -1 ? nSteps : step + 1} من ${nSteps}`)} />
            <ol className="steps">
              {lab.steps.map((s, i) => (
                <li key={s.text.en} className={done[i] ? 'done' : i === step ? 'now' : ''}>
                  <span className="step-mark" aria-hidden="true">{done[i] ? '✓' : i + 1}</span>{pick(s.text)}
                </li>
              ))}
            </ol>
            </section>
          )}

          {!result ? (
            <section className="card diag" aria-labelledby={`diag-title-${trade.id}`}>
              <CardHead id={`diag-title-${trade.id}`} title={L('Diagnosis & repair', 'التشخيص والإصلاح')} sub={L('Record what you found, then submit.', 'سجّل ما وجدته ثم أرسل.')} />
              <label className="field"><span>{L('Faulty component', 'المكوّن المعطوب')}</span>
                <select id={`diag-component-${trade.id}`} value={diag.component} onChange={(e) => setDiag((d) => ({ ...d, component: e.target.value }))} disabled={locked}>
                  <option value="">{L('Choose…', 'اختر…')}</option>
                  {lab.components.map((c) => <option key={c.ref} value={c.ref}>{pick(c.label)}</option>)}
                </select>
              </label>
              <label className="field"><span>{L('Condition', 'الحالة')}</span>
                <select id={`diag-condition-${trade.id}`} value={diag.condition} onChange={(e) => setDiag((d) => ({ ...d, condition: e.target.value }))} disabled={locked}>
                  <option value="">{L('Choose…', 'اختر…')}</option>
                  {lab.conditions.map((c) => <option key={c.value} value={c.value}>{pick(c.label)}</option>)}
                </select>
              </label>
              <button type="button" onClick={submitDiagnosis} disabled={!diag.component || !diag.condition || locked}>{L('Record diagnosis', 'سجّل التشخيص')}</button>
              <div className="swap">
                <label className="field"><span>{L('Fix or replace', 'إصلاح أو استبدال')}</span>
                  <select id={`swap-part-${trade.id}`} value={swap} onChange={(e) => setSwap(e.target.value)} disabled={locked}>
                    <option value="">{L('Choose…', 'اختر…')}</option>
                    {lab.components.map((c) => <option key={c.ref} value={c.ref}>{pick(c.label)}</option>)}
                  </select>
                </label>
                <button type="button" className="btn-replace" onClick={replacePart} disabled={!swap || locked}>{L('Fix', 'أصلح')}</button>
              </div>
              <button type="button" className="primary btn-submit" onClick={submit} disabled={events.length === 0 || result !== null}>{L('Submit for scoring', 'أرسل للتقييم')}</button>
            </section>
          ) : (
            <Result lab={lab} res={result} fault={fault.title} onRetry={() => reset()} />
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

function StatusChip({ on, label, onText, offText, danger, neutral }: { on: boolean; label: string; onText: string; offText: string; danger?: boolean; neutral?: boolean }) {
  const cls = neutral ? 'chip-neutral' : on ? 'chip-on' : danger ? 'chip-danger' : 'chip-off';
  return <span className={`status-chip ${cls}`}><b>{label}</b> {on ? onText : offText}</span>;
}

const LEVELS: Record<string, Txt> = {
  not_yet: tx('not yet', 'لم يصل بعد'), novice: tx('novice', 'مبتدئ'), intermediate: tx('intermediate', 'متوسط'), autonomous: tx('autonomous', 'مستقل'),
};

function Result({ lab, res, fault, onRetry }: { lab: Lab; res: EvaluationResult; fault: Txt; onRetry: () => void }) {
  const { L, pick } = useL();
  const level = res.gateFailures.length ? L('No credit (safety gate failed)', 'لا رصيد (رسوب في شرط أمان)') : pick(LEVELS[levelForScore(res.totalScore)]!);
  return (
    <section className="card result">
      <div className={`result-head ${res.passed ? 'v-pass' : 'v-fail'}`}>
        <span className="v-score">{res.totalScore}</span>
        <span><strong>{res.passed ? L('Pass', 'ناجح') : L('Not yet', 'لم يجتز بعد')}</strong><br />
          <small>{L(`Pass mark ${lab.rubric.passThreshold} · competency`, `درجة النجاح ${lab.rubric.passThreshold} · مستوى الجدارة`)}: {level}</small></span>
      </div>
      <p className="muted">{L('Injected fault', 'العطل المزروع')}: {pick(fault)}</p>
      <table className="crit">
        <thead><tr><th>{L('Criterion', 'المعيار')}</th><th>{L('Score', 'الدرجة')}</th><th>{L('Wt', 'الوزن')}</th></tr></thead>
        <tbody>
          {res.criteria.map((c) => (
            <tr key={c.key} className={c.gateFailed ? 'gate-failed' : ''}>
              <td>{pick(lab.criterionLabels[c.key] ?? tx(c.label, c.label))}{c.isGate && <span className="gate">{L('Gate', 'شرط أمان')}</span>}
                <small dir="ltr" className="detail">{c.detail}</small></td>
              <td className="num">{c.score}</td>
              <td className="num">{c.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onRetry}>{L('Start a new attempt', 'ابدأ محاولة جديدة')}</button>
    </section>
  );
}

/** Ladder drawing of the starter, always drawn left-to-right as on a real panel. Test points are the tappable circles. */
function Schematic({ lab, rig, onMeasure, active }: { lab: Lab; rig: RigState; onMeasure: (tp: TestPoint) => void; active?: string }) {
  const { lang, L, pick } = useL();
  const tp = (ref: string) => lab.testPoints.find((t) => t.ref === ref)!;
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
        <Cover x={30} y={132} w={596} h={194} text={L('Panel door closed · open it to reach the control circuit', 'باب اللوحة مغلق · افتحه للوصول إلى دائرة التحكم')} />
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

/**
 * A closed cover over part of a drawing. Light hatching and a dashed edge keep
 * the parts underneath readable; the pill says what to do.
 */
function Cover({ x, y, w, h, text }: { x: number; y: number; w: number; h: number; text: string }) {
  const id = useId().replace(/:/g, '');
  // Short label on the top edge, at the end corner where drawings keep fewest test points; the full text is the tooltip.
  const label = text.split(' · ')[0]!;
  const pill = Math.min(w - 16, label.length * 7 + 40);
  return (
    <g className="door">
      <title>{text}</title>
      <defs>
        <pattern id={`hatch${id}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" className="door-hatch" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} rx="8" className="door-fill" />
      <rect x={x} y={y} width={w} height={h} rx="8" fill={`url(#hatch${id})`} />
      <rect x={x} y={y} width={w} height={h} rx="8" className="door-edge" />
      <g transform={`translate(${x + w - pill / 2 - 12} ${y})`}>
        <rect x={-pill / 2} y={-13} width={pill} height={26} rx={13} className="door-pill" />
        <path d={`M${-pill / 2 + 14} -4h8v8h-8z M${-pill / 2 + 15.5} -4v-2.5a2.5 2.5 0 0 1 5 0v2.5`} className="door-lock" />
        <text x={10} y={4.5} textAnchor="middle">{label}</text>
      </g>
    </g>
  );
}

/** Block drawing for rigs described as data (trades/*.ts). Same test-point behaviour as the DOL ladder. */
function BlockDiagram({ lab, d, rig, onMeasure, active }: { lab: Lab; d: Diagram; rig: RigState; onMeasure: (tp: TestPoint) => void; active?: string }) {
  const { lang, L, pick } = useL();
  const pt = (p: Diagram['points'][number]) => {
    const t = lab.testPoints.find((x) => x.ref === p.ref)!;
    const reachable = !t.inside || rig.panelOpen;
    return (
      <g key={p.ref} className={`tp ${active === p.ref ? 'tp-active' : ''} ${reachable ? '' : 'tp-blocked'}`} role="button" tabIndex={0}
        aria-label={L(`Measure ${t.label.en}`, `قِس ${t.label.ar}`)} data-tp={p.ref} onClick={() => onMeasure(t)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMeasure(t); } }}>
        <title>{pick(t.label)}</title>
        <circle cx={p.x} cy={p.y} r={18} className="tp-hit" />
        <circle cx={p.x} cy={p.y} r={7} className="tp-dot" />
        <text x={p.x + (p.dx ?? 0)} y={p.y + (p.dy ?? -16)} textAnchor="middle" className="tp-label">{pick(p.label)}</text>
      </g>
    );
  };
  return (
    <svg className="schematic" viewBox="0 0 640 330" role="group" aria-label={L(`${lab.rigTitle.en} with test points`, `${lab.rigTitle.ar} مع نقاط القياس`)}>
      {d.captions.map((c) => (
        <text key={c.text.en} x={lang === 'ar' ? 320 : c.x} y={c.y} textAnchor={lang === 'ar' ? 'middle' : 'start'} className="sch-cap">{pick(c.text)}</text>
      ))}
      <path d={d.wires} className="sch-wire" fill="none" />
      {d.boxes.map((b) => (
        <g key={b.label + b.x}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.round ? Math.min(b.w, b.h) / 2 : 4}
            className={`sch-box ${b.isolator && rig.locked ? 'sch-locked' : ''}`} />
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + (b.sub ? -2 : 5)} textAnchor="middle" className="sch-txt">{b.label}</text>
          {b.sub && <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 14} textAnchor="middle" className="sch-small">{b.sub}</text>}
          {b.isolator && rig.locked && (
            <g><rect x={b.x + b.w / 2 - 24} y={b.y + b.h + 4} width="48" height="22" rx="3" className="tag" />
              <text x={b.x + b.w / 2} y={b.y + b.h + 19} textAnchor="middle" className="tag-txt">{L('LOCKED', 'مقفول')}</text></g>
          )}
        </g>
      ))}
      {!rig.panelOpen && (
        <Cover x={d.cover.x} y={d.cover.y} w={d.cover.w} h={d.cover.h} text={pick(d.cover.text)} />
      )}
      {d.points.map(pt)}
    </svg>
  );
}
