/**
 * SafetySim — learn safety by trial and error, without anyone getting hurt.
 *
 * The WABYS student walks into the workshop to do a real job at the machine.
 * The learner decides what PPE to put on at the PPE station and in what order
 * to do the work. Each choice plays out in 3D: the student walks to the
 * machine and does it. A wrong choice has its real consequence (a chuck key
 * thrown from the chuck, chips in an unprotected eye, an arc flash, a shock,
 * steam from a hot radiator, a fire from rags near the weld) with sound and a
 * screen effect, then an incident card: what happened, the harm it does in
 * real workshops and the rule that prevents it. The learner rewinds and tries
 * again until the job is done safely, and gets a debrief and a score.
 *
 * Telemetry uses the same verb/objectRef/value shape as the explorer and the
 * V-Lab, so attempts can be stored with the learner's record.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SimFx, type FxSpec } from './fx';
import { SignIcon } from './Infographics';
import { ModelScene, StudentRig, useWalkKeys, type StudentView, type Vec3 } from './MachineExplorer';
import { sfx, setMuted } from './sfx';
import { newStudent, type PPE, type StudentState } from '../models/avatar';
import { modelParts, type Txt } from '../models/kit';
import type { Pictogram, SignKind } from '../models/textures';
import { holds, type Outcome, type PpeKey, type Scenario, type SimAction, type SimView } from '../safety/types';
import { LockerButton } from './LockerButton';
import { recordAttempt } from './locker';
import './SafetySim.css';

type Lang = 'en' | 'ar';
const tx = (en: string, ar: string): Txt => ({ en, ar });

export const PPE_INFO: Record<PpeKey, { label: Txt; sign: SignKind; pic: Pictogram }> = {
  glasses: { label: tx('Safety glasses', 'نظارة السلامة'), sign: 'mandatory', pic: 'glasses' },
  earmuffs: { label: tx('Ear defenders', 'واقي السمع'), sign: 'mandatory', pic: 'ear' },
  boots: { label: tx('Safety boots', 'حذاء السلامة'), sign: 'mandatory', pic: 'boots' },
  'gloves-leather': { label: tx('Leather welding gauntlets', 'قفازات لحام جلدية'), sign: 'mandatory', pic: 'gloves' },
  'gloves-nitrile': { label: tx('Nitrile gloves', 'قفازات نيتريل'), sign: 'mandatory', pic: 'gloves' },
  'gloves-insulated': { label: tx('Insulated gloves (1000 V)', 'قفازات عازلة (1000 فولت)'), sign: 'mandatory', pic: 'gloves' },
  'helmet-welding': { label: tx('Welding helmet', 'خوذة اللحام'), sign: 'mandatory', pic: 'welding' },
  visor: { label: tx('Face shield', 'واقي الوجه'), sign: 'mandatory', pic: 'visor' },
  mask: { label: tx('Respirator (FFP3)', 'كمامة تنفس FFP3'), sign: 'mandatory', pic: 'mask' },
  apron: { label: tx('Leather apron', 'مريلة جلدية'), sign: 'mandatory', pic: 'apron' },
  'no-jewellery': { label: tx('Take off watch and ring', 'اخلع الساعة والخاتم'), sign: 'prohibition', pic: 'noJewel' },
  cuffs: { label: tx('Fasten cuffs, tuck in loose clothing', 'اربط الأكمام وأدخل الملابس الفضفاضة'), sign: 'warning', pic: 'rotating' },
};
const GLOVES: PpeKey[] = ['gloves-leather', 'gloves-nitrile', 'gloves-insulated'];
const HEAD: PpeKey[] = ['helmet-welding', 'visor'];

export function toPPE(w: Set<PpeKey>): PPE {
  return {
    glasses: w.has('glasses'), earmuffs: w.has('earmuffs'), boots: w.has('boots'), mask: w.has('mask'), apron: w.has('apron'),
    gloves: w.has('gloves-insulated') ? 'insulated' : w.has('gloves-leather') ? 'leather' : w.has('gloves-nitrile') ? 'nitrile' : null,
    helmet: w.has('helmet-welding') ? 'welding' : w.has('visor') ? 'visor' : null,
    jewellery: !w.has('no-jewellery'), looseSleeves: !w.has('cuffs'),
  };
}

const S = {
  en: {
    sim: 'Safety simulator', start: 'Start the job', brief: 'Briefing', task: 'The job', mins: 'min in the workshop',
    getReady: 'Get ready', getReadySub: 'You are at the PPE station. Choose what to wear and what to take off. Nobody will stop you: the job will show you.',
    toMachine: 'Go to the machine', changePpe: 'Back to the PPE station', actions: 'What do you do next?', actionsSub: 'Pick the next step. The order is up to you.',
    done: 'Done so far', none: 'Nothing yet', notYet: 'Not yet', first: 'First', rewind: 'Rewind and try again', carryOn: 'Carry on',
    incident: 'Incident', blocked: 'Stopped by a safeguard', what: 'What happened', harm: 'In real workshops', rule: 'The rule',
    sev: ['', 'Minor injury', 'Lost-time injury', 'Serious, life-changing injury'], mistakes: 'mistakes', incidents: 'incidents',
    complete: 'Job finished', completeSafe: 'Job finished safely', score: 'Safety score', retry: 'Start again', learned: 'What you learned',
    ppeCheck: 'PPE check at the end', missing: 'Not worn', shouldNot: 'Should not be worn', allGood: 'Right PPE, nothing extra.',
    third: '3rd person', firstP: '1st person', overview: 'Overview', sound: 'Sound', walking: 'Walking…', working: 'Working…',
    wear: 'Wear', wearing: 'Wearing', remove: 'Done', perfect: 'No incidents and the right PPE: ready for the real workshop.',
    tryForBetter: 'Try again for a clean run with no incidents.', stars: 'stars',
  },
  ar: {
    sim: 'محاكي السلامة', start: 'ابدأ المهمة', brief: 'الإحاطة', task: 'المهمة', mins: 'دقيقة في الورشة',
    getReady: 'استعد', getReadySub: 'أنت عند محطة معدات الوقاية. اختر ما ترتديه وما تخلعه. لن يوقفك أحد: المهمة ستُظهر لك النتيجة.',
    toMachine: 'اذهب إلى الماكينة', changePpe: 'ارجع إلى محطة الوقاية', actions: 'ماذا تفعل الآن؟', actionsSub: 'اختر الخطوة التالية. الترتيب يعود إليك.',
    done: 'ما تم حتى الآن', none: 'لا شيء بعد', notYet: 'ليس بعد', first: 'أولًا', rewind: 'ارجع وحاول مرة أخرى', carryOn: 'تابع',
    incident: 'حادث', blocked: 'أوقفه نظام حماية', what: 'ماذا حدث', harm: 'في الورش الحقيقية', rule: 'القاعدة',
    sev: ['', 'إصابة بسيطة', 'إصابة تعطل عن العمل', 'إصابة خطيرة تغيّر الحياة'], mistakes: 'أخطاء', incidents: 'حوادث',
    complete: 'انتهت المهمة', completeSafe: 'انتهت المهمة بأمان', score: 'درجة السلامة', retry: 'ابدأ من جديد', learned: 'ما تعلمته',
    ppeCheck: 'فحص معدات الوقاية في النهاية', missing: 'لم تُرتدَ', shouldNot: 'لا يجب ارتداؤها', allGood: 'معدات الوقاية صحيحة ولا شيء زائد.',
    third: 'منظور ثالث', firstP: 'بعيني المتدرب', overview: 'نظرة عامة', sound: 'الصوت', walking: 'يمشي…', working: 'يعمل…',
    wear: 'ارتدِ', wearing: 'يرتديها', remove: 'تم', perfect: 'بلا حوادث وبمعدات الوقاية الصحيحة: جاهز للورشة الحقيقية.',
    tryForBetter: 'حاول مرة أخرى لإنجاز المهمة دون أي حادث.', stars: 'نجوم',
  },
};

export interface SimEvent { verb: 'sim_started' | 'ppe_changed' | 'action_done' | 'incident' | 'blocked' | 'sim_completed'; objectRef?: string; value?: Record<string, unknown> }
export interface SimResult { score: number; stars: number; incidents: number; blocked: number; ppeErrors: number }

type Phase = 'brief' | 'ppe' | 'job' | 'done';
interface Played { outcome: Outcome; spec: FxSpec; action: SimAction; showCard: boolean }

/** Advances the effect clock. */
function FxClock({ t, on }: { t: React.RefObject<number>; on: boolean }) {
  useFrame((_, dt) => { if (on) t.current += Math.min(dt, 0.1); });
  return null;
}

function seededOrder<T>(xs: T[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
  return xs.map((x) => ({ x, k: r() })).sort((a, b) => a.k - b.k).map((o) => o.x);
}

export interface SafetySimProps {
  scenario: Scenario;
  lang?: Lang;
  active?: boolean;
  height?: number | string;
  onEvent?: (e: SimEvent) => void;
  onComplete?: (r: SimResult) => void;
}

export function SafetySim({ scenario, lang = 'en', active = true, height = 'min(680px, 78vh)', onEvent, onComplete }: SafetySimProps) {
  const t = S[lang];
  const p = (x: Txt) => x[lang];
  const model = scenario.model;
  const env = model.env!;
  const u = env.unitsPerM;
  const floor = env.floorY ?? -1.25;
  const parts = useMemo(() => modelParts(model, lang), [model, lang]);
  const emit = useRef(onEvent); emit.current = onEvent;

  const [phase, setPhase] = useState<Phase>('brief');
  const [worn, setWorn] = useState<Set<PpeKey>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);
  const [params, setParams] = useState<Record<string, number>>({ ...model.params, ...scenario.params });
  const [running, setRunning] = useState(!!scenario.startRunning);
  const [busy, setBusy] = useState<'walk' | 'work' | null>(null);
  const [played, setPlayed] = useState<Played | null>(null);
  const [log, setLog] = useState<Outcome[]>([]);
  const [note, setNote] = useState<{ text: string; kind: 'ok' | 'info' } | null>(null);
  const [view, setView] = useState<StudentView>('third');
  const [sound, setSound] = useState(true);
  const [go, setGo] = useState<{ id: string; n: number } | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const student = useRef<StudentState | null>(null);
  if (!student.current) student.current = newStudent(env, toPPE(new Set()));
  const fxT = useRef(0);
  const pending = useRef<SimAction | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, f: () => void) => { timers.current.push(setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { setMuted(!sound); }, [sound]);
  const keys = useWalkKeys(active && phase !== 'brief' && !busy && (view === 'third' || view === 'first'));

  // Keep the student's kit in step with the choices.
  useEffect(() => { if (student.current) student.current.ppe = toPPE(worn); }, [worn]);

  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setPhase('brief'); setWorn(new Set()); setDone(new Set()); setOrder([]); setParams({ ...model.params, ...scenario.params });
    setRunning(!!scenario.startRunning); setBusy(null); setPlayed(null); setLog([]); setNote(null); setResult(null); pending.current = null;
    const s = student.current!;
    const home = env.stations[0]!;
    s.pos.set(home.pos[0], 0, home.pos[1]); s.yaw = home.face; s.pose = 'idle'; s.reach = null; s.speed = 0;
    setGo({ id: home.id, n: Date.now() });
  };

  const start = () => {
    setPhase('ppe');
    setGo({ id: 'ppe', n: Date.now() });
    setBusy('walk');
    pending.current = null;
    emit.current?.({ verb: 'sim_started', objectRef: scenario.id });
  };

  const toggleWear = (k: PpeKey) => {
    setWorn((w) => {
      const n = new Set(w);
      if (n.has(k)) n.delete(k);
      else {
        if (GLOVES.includes(k)) GLOVES.forEach((g) => n.delete(g));
        if (HEAD.includes(k)) HEAD.forEach((g) => n.delete(g));
        n.add(k);
      }
      emit.current?.({ verb: 'ppe_changed', objectRef: `${scenario.id}#ppe:${k}`, value: { on: n.has(k) } });
      return n;
    });
  };

  const toMachine = () => {
    setPhase('job');
    setGo({ id: env.stations[0]!.id, n: Date.now() });
    setBusy('walk');
  };
  const backToPpe = () => {
    if (busy) return;
    setPhase('ppe');
    setGo({ id: 'ppe', n: Date.now() });
    setBusy('walk');
  };

  const doAction = (a: SimAction) => {
    if (busy || played) return;
    setNote(null);
    pending.current = a;
    setBusy('walk');
    setGo({ id: a.station, n: Date.now() });
  };

  const faceAt = (): Vec3 => {
    const s = student.current!;
    return [s.pos.x + Math.sin(s.yaw) * 0.12 * u, floor + 1.6 * u, s.pos.z + Math.cos(s.yaw) * 0.12 * u];
  };

  const resolve = (a: SimAction) => {
    const s = student.current!;
    const missing = (a.needs ?? []).filter((n) => !done.has(n));
    if (missing.length) {
      const names = missing.map((m) => p(scenario.actions.find((x) => x.id === m)?.label ?? tx(m, m))).join(lang === 'ar' ? '، ' : ', ');
      setNote({ kind: 'info', text: `${t.notYet}. ${t.first}: ${names}` });
      setBusy(null); s.pose = 'idle'; s.reach = null;
      return;
    }
    const hit = a.hazards?.find((h) => holds(h.when, done, worn));
    if (hit) {
      const o = hit.outcome;
      const to: Vec3 = o.toward === 'face' || !o.toward ? faceAt() : o.toward === 'hand' ? (s.reach ? s.reach.toArray() as Vec3 : faceAt()) : o.toward;
      fxT.current = 0;
      setPlayed({ outcome: o, spec: { effect: o.effect, at: o.at, to, object: o.object }, action: a, showCard: false });
      const sound: Record<string, Parameters<typeof sfx>[0]> = {
        projectile: 'bang', crash: 'bang', entangle: 'bang', chips: 'clang', cut: 'clang', arcflash: 'bang', shock: 'zap', steam: 'hiss',
        burn: 'hiss', spark: 'zap', fire: 'whoosh', fumes: 'hiss', arceye: 'arc', fall: 'clang', alarm: 'alarm',
      };
      sfx(sound[o.effect] ?? 'bang');
      if (o.kind === 'incident') later(300, () => { s.pose = 'hurt'; s.reach = null; });
      later(o.effect === 'fire' || o.effect === 'fumes' ? 2600 : 2100, () => setPlayed((pl) => (pl ? { ...pl, showCard: true } : pl)));
      emit.current?.({ verb: o.kind === 'incident' ? 'incident' : 'blocked', objectRef: `${scenario.id}#${o.id}`, value: { action: a.id, severity: o.severity ?? 0 } });
      return;
    }
    // Safe: apply it.
    const nd = new Set(done);
    nd.add(a.id);
    for (const x of a.undoes ?? []) nd.delete(x);
    setDone(nd);
    setOrder((o) => [...o, a.id]);
    if (a.set) setParams((pr) => ({ ...pr, ...a.set }));
    if (a.running !== undefined) { setRunning(a.running); if (a.running) sfx('hum'); }
    setNote({ kind: 'ok', text: p(a.ok) });
    emit.current?.({ verb: 'action_done', objectRef: `${scenario.id}#${a.id}` });
    later(a.goal ? 900 : 700, () => { setBusy(null); if (!a.goal) { s.pose = 'idle'; } });
    if (a.goal) later(1600, () => finish(nd));
  };

  const finish = (nd: Set<string>) => {
    void nd;
    sfx('ok');
    setPhase('done');
    setLog((lg) => {
      const r = scoreOf(lg, worn);
      setResult(r);
      emit.current?.({ verb: 'sim_completed', objectRef: scenario.id, value: { ...r } });
      onComplete?.(r);
      recordAttempt({ kind: 'safety', ref: scenario.id, title: scenario.title, score: r.score, passed: r.incidents === 0,
        detail: { en: `${r.stars}/3 stars · ${r.incidents} incidents · ${r.ppeErrors} PPE errors`, ar: `${r.stars}/3 نجوم · ${r.incidents} حوادث · ${r.ppeErrors} أخطاء وقاية` } });
      return lg;
    });
  };

  const scoreOf = (lg: Outcome[], w: Set<PpeKey>): SimResult => {
    const incidents = lg.filter((o) => o.kind === 'incident');
    const blocked = lg.filter((o) => o.kind === 'blocked').length;
    const ppeErrors = scenario.ppe.filter((i) => (i.need === 'required' && !w.has(i.key)) || (i.need === 'forbidden' && w.has(i.key))).length;
    const score = Math.max(0, 100 - incidents.reduce((n, o) => n + (o.severity ?? 2) * 12, 0) - blocked * 5 - ppeErrors * 8);
    return { score, stars: score >= 90 ? 3 : score >= 70 ? 2 : 1, incidents: incidents.length, blocked, ppeErrors };
  };

  const closeCard = () => {
    const pl = played!;
    setLog((l) => [...l, pl.outcome]);
    setPlayed(null);
    setBusy(null);
    const s = student.current!;
    s.pose = 'idle'; s.reach = null;
    if (pl.outcome.kind === 'incident') setGo({ id: pl.action.station, n: Date.now() });
  };

  const onArrive = useCallback((id: string) => {
    const a = pending.current;
    const s = student.current!;
    if (a && id === a.station) {
      pending.current = null;
      setBusy('work');
      if (a.pose) s.pose = a.pose;
      if (a.reach) s.reach = new THREE.Vector3(...a.reach);
      later(950, () => resolveRef.current(a));
    } else {
      setBusy(null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const resolveRef = useRef(resolve); resolveRef.current = resolve;

  const visible = scenario.actions.filter((a) => (a.repeat || !done.has(a.id)) && !(a.hideWhen && holds(a.hideWhen, done, worn)));
  const shown = useMemo(() => seededOrder(visible, scenario.id + order.length), [visible.map((a) => a.id).join(','), order.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const view3: SimView = { done, worn, fx: played?.spec.effect ?? null, fxT, running };
  const incidents = log.filter((o) => o.kind === 'incident').length;
  const fxClass = played ? ` fx-${played.spec.effect}${played.outcome.kind === 'blocked' ? ' fx-blocked' : ''}` : '';
  const fxRunning = played ? played.action.running ?? running : running;

  return (
    <div className={`ss-root${fxClass}`} style={{ height }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="ss-stage">
        <Canvas shadows="soft" camera={{ position: model.view?.camera ?? [5, 3, 6], fov: 45, near: 0.05, far: 400 }} dpr={[1, 2]} frameloop={active ? 'always' : 'never'}>
          <ModelScene parts={parts} explode={0} running={fxRunning} params={params} pins={false} env={env} lang={lang} student={student}>
            {(scenario.props ?? []).filter((pr) => holds(pr.when, done, worn)).map((pr) => <group key={pr.id}>{pr.render(view3)}</group>)}
            <StudentRig state={student} view={view} go={go} onArrive={onArrive} keys={keys} orbitBias={0.6} distance={3.4} />
            {played && <SimFx fx={played.spec} t={fxT} u={u} key={played.outcome.id + log.length} />}
          </ModelScene>
          <FxClock t={fxT} on={!!played} />
          <OrbitControls makeDefault enableDamping enabled={view === 'orbit'} target={model.view?.target ?? [0, 0, 0]} maxDistance={Math.min(16, 9 * u)} />
        </Canvas>
        <div className="ss-screen" aria-hidden="true" />

        <header className="ss-head">
          <div>
            <p className="ss-eyebrow">{t.sim} · {p(model.title).split(' · ')[0]}</p>
            <h3>{p(scenario.title)}</h3>
          </div>
          <div className="ss-tools">
            <span className={`ss-count${incidents ? ' is-bad' : ''}`}>{incidents} {t.incidents} · {log.length} {t.mistakes}</span>
            <div className="ss-seg" role="radiogroup" aria-label="View">
              {([['third', t.third], ['first', t.firstP], ['orbit', t.overview]] as const).map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>
            <button type="button" className="ss-icon" aria-pressed={sound} onClick={() => setSound(!sound)} title={t.sound} aria-label={t.sound}>{sound ? '🔊' : '🔇'}</button>
          </div>
        </header>

        {busy && !played && <p className="ss-busy">{busy === 'walk' ? t.walking : t.working}</p>}
        {note && !played && <p className={`ss-note is-${note.kind}`} role="status">{note.kind === 'ok' ? '✓ ' : 'ⓘ '}{note.text}</p>}

        {phase === 'brief' && (
          <div className="ss-cover">
            <div className="ss-card">
              <p className="ss-eyebrow">{t.brief}</p>
              <h3>{p(scenario.title)}</h3>
              <p>{p(scenario.brief)}</p>
              <p className="ss-task"><b>{t.task}:</b> {p(scenario.task)}{scenario.minutes ? <small> · {scenario.minutes} {t.mins}</small> : null}</p>
              <button type="button" className="ss-primary" onClick={start}>▶ {t.start}</button>
            </div>
          </div>
        )}

        {played?.showCard && (
          <div className="ss-modal" role="alertdialog" aria-modal="true" aria-labelledby="ss-inc-title">
            <div className={`ss-incident is-${played.outcome.kind} sev-${played.outcome.severity ?? 0}`}>
              <div className="ss-inc-head">
                {played.outcome.sign && <SignIcon kind={played.outcome.sign.kind} pic={played.outcome.sign.pic} size={56} />}
                <div>
                  <p className="ss-eyebrow">{played.outcome.kind === 'incident' ? `${t.incident} · ${t.sev[played.outcome.severity ?? 2]}` : t.blocked}</p>
                  <h3 id="ss-inc-title">{p(played.outcome.title)}</h3>
                </div>
              </div>
              <h4>{t.what}</h4><p>{p(played.outcome.what)}</p>
              {played.outcome.harm && <><h4>{t.harm}</h4><p>{p(played.outcome.harm)}</p></>}
              <div className="ss-rule"><h4>{t.rule}</h4><p>{p(played.outcome.rule)}</p>{played.outcome.ref && <small dir="ltr">{played.outcome.ref}</small>}</div>
              <button type="button" className="ss-primary" autoFocus onClick={closeCard}>{played.outcome.kind === 'incident' ? `↺ ${t.rewind}` : `${t.carryOn} ▶`}</button>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="ss-modal">
            <div className="ss-incident ss-debrief">
              <p className="ss-eyebrow">{result.incidents ? t.complete : t.completeSafe}</p>
              <h3>{p(scenario.title)}</h3>
              <div className="ss-score">
                <b>{result.score}</b><span>{t.score}</span>
                <span className="ss-stars" aria-label={`${result.stars} ${t.stars}`}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</span>
              </div>
              <p className="ss-muted">{result.score >= 90 && !result.incidents ? t.perfect : t.tryForBetter}</p>
              {log.length > 0 && (
                <>
                  <h4>{t.learned}</h4>
                  <ul className="ss-learned">
                    {log.filter((o, i) => log.findIndex((x) => x.id === o.id) === i).map((o) => (
                      <li key={o.id} className={`is-${o.kind}`}><b>{p(o.title)}</b><span>{p(o.rule)}</span></li>
                    ))}
                  </ul>
                </>
              )}
              <h4>{t.ppeCheck}</h4>
              <ul className="ss-learned">
                {scenario.ppe.filter((i) => (i.need === 'required' && !worn.has(i.key)) || (i.need === 'forbidden' && worn.has(i.key))).map((i) => (
                  <li key={i.key} className="is-incident"><b>{p(PPE_INFO[i.key].label)} · {i.need === 'required' ? t.missing : t.shouldNot}</b><span>{p(i.why)}</span></li>
                ))}
                {!result.ppeErrors && <li className="is-ok"><b>✓ {t.allGood}</b></li>}
              </ul>
              <div className="lk-row">
                <button type="button" className="ss-primary" onClick={reset}>↺ {t.retry}</button>
                <LockerButton lang={lang} drop={{ kind: 'safety', title: scenario.title, body: scenario.brief, ref: { scenario: scenario.id },
                  value: { score: result.score, stars: result.stars, incidents: result.incidents },
                  tags: log.filter((o) => o.kind === 'incident').map((o) => o.title[lang]).slice(0, 3) }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="ss-side">
        {phase === 'ppe' && (
          <>
            <h4>{t.getReady}</h4>
            <p className="ss-muted">{t.getReadySub}</p>
            <div className="ss-ppe">
              {scenario.ppe.map((i) => {
                const info = PPE_INFO[i.key];
                const on = worn.has(i.key);
                return (
                  <button key={i.key} type="button" aria-pressed={on} onClick={() => toggleWear(i.key)} disabled={busy === 'walk'}>
                    <SignIcon kind={info.sign} pic={info.pic} size={34} />
                    <span>{p(info.label)}</span>
                    <em>{on ? (i.key === 'no-jewellery' || i.key === 'cuffs' ? t.remove : t.wearing) : ''}</em>
                  </button>
                );
              })}
            </div>
            <button type="button" className="ss-primary ss-wide" onClick={toMachine} disabled={busy === 'walk'}>{t.toMachine} →</button>
          </>
        )}
        {(phase === 'job' || phase === 'done') && (
          <>
            <p className="ss-task"><b>{t.task}:</b> {p(scenario.task)}</p>
            <h4>{t.actions}</h4>
            <p className="ss-muted">{t.actionsSub}</p>
            <ol className="ss-actions">
              {shown.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => doAction(a)} disabled={!!busy || !!played || phase === 'done'}>
                    <b>{p(a.label)}</b>{a.detail && <small>{p(a.detail)}</small>}
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="ss-link" onClick={backToPpe} disabled={!!busy || !!played || phase === 'done'}>← {t.changePpe}</button>
            <h4>{t.done}</h4>
            <ol className="ss-done">
              {order.length ? order.map((id, i) => <li key={`${id}${i}`}>✓ {p(scenario.actions.find((a) => a.id === id)!.label)}</li>) : <li className="ss-muted">{t.none}</li>}
            </ol>
          </>
        )}
        {phase === 'brief' && (
          <>
            <h4>{t.brief}</h4>
            <p>{p(scenario.brief)}</p>
            <button type="button" className="ss-primary ss-wide" onClick={start}>▶ {t.start}</button>
          </>
        )}
      </aside>
    </div>
  );
}
