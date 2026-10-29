/**
 * LessonPlayer — interactive video lessons for VTC_LMS.
 *
 * A lesson is a timeline played over a machine's digital twin: camera shots,
 * exploded views, X-ray and cutaways, machine params (a door opening, a weld
 * bead growing), captions, chapters, timed hotspots and checkpoint stops.
 * It renders live in 3D, so it is sharp at any zoom and works offline. When a
 * filmed lesson exists, set `video.src` and the same chapters, hotspots,
 * stops and scoring play over the MP4 instead.
 *
 * Lessons are produced like workshop videos: the WABYS student walks to the
 * machine and does the job, callouts with leader lines name the parts,
 * dimension lines and flow arrows show sizes and what moves where, and
 * infographic cards (do / don't, key numbers, steps, safety signs, formulas)
 * slide in beside the action. Chapter title cards, a lower third and spoken
 * narration (the browser's own voices, English or Arabic) complete it.
 *
 * Learner controls: play/pause, ±10 s, scrub bar with chapter and checkpoint
 * markers, speed 0.5–2×, zoom (buttons, slider, mouse wheel), drag to look
 * around while paused, captions, chapters list, full screen and keyboard
 * (Space, ←/→, +/−, C, F).
 *
 * Checkpoints pause the lesson and must be answered before it continues; the
 * first answer is what counts towards the score. Telemetry uses the same
 * verb/objectRef/value shape as the explorer and the V-Lab.
 */
import { Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { ModelScene, type Vec3 } from './MachineExplorer';
import { CardStack, type LessonCard } from './Infographics';
import { Callouts, Dims, Flows, LessonStudent, type LessonCallout, type LessonDim, type LessonFlow, type ShotStudent } from './LessonFx';
import { toSection, type SectionSpec } from './section';
import { newStudent, tradePpe, type PPE, type StudentState } from '../models/avatar';
import { modelParts, type ModelDef, type Txt } from '../models/kit';
import './LessonPlayer.css';

// ---------------------------------------------------------------------------
// Lesson format
// ---------------------------------------------------------------------------
export interface LessonShot {
  /** Start time in seconds. A shot lasts until the next one starts. */
  at: number;
  camera: Vec3;
  target: Vec3;
  /** Seconds to glide in from the previous shot (default 1.6). */
  move?: number;
  explode?: number;
  xray?: boolean;
  /** Section view: `true` for lengthwise, or a mode with plane position and angle. */
  cutaway?: boolean | SectionSpec;
  /** Machine running (spindle, pistons, wire feed). */
  running?: boolean;
  rate?: number;
  /** Part to highlight. */
  highlight?: string | null;
  params?: Record<string, number>;
  /** Params that sweep across the shot, from → to. */
  sweep?: Record<string, [number, number]>;
  /** The WABYS student in this shot (carries on until changed). */
  avatar?: ShotStudent;
  caption: Txt;
}
export interface LessonChapter { at: number; title: Txt }
export interface LessonStop { id: string; at: number; question: Txt; options: Txt[]; answer: number; explain: Txt }
export interface LessonHotspot {
  id: string; at: number; until: number; title: Txt; body: Txt;
  /** Anchor in the model's space (3D lessons). */
  position: Vec3;
  /** Anchor as % of the frame, for filmed (MP4) lessons. */
  screen?: [number, number];
}
export interface Lesson {
  id: string;
  title: Txt;
  summary: Txt;
  model: ModelDef;
  duration: number;
  chapters: LessonChapter[];
  shots: LessonShot[];
  stops: LessonStop[];
  hotspots: LessonHotspot[];
  /** A filmed version. When set the player plays this and overlays the same interactions. */
  video?: { src: string; poster?: string };
  /** What the student wears (default: the trade's usual PPE); false leaves the student out. */
  student?: PPE | false;
  callouts?: LessonCallout[];
  dims?: LessonDim[];
  flows?: LessonFlow[];
  cards?: LessonCard[];
}
export type { LessonCallout, LessonDim, LessonFlow, LessonCard, ShotStudent };

export interface LessonEvent {
  verb: 'lesson_started' | 'chapter_reached' | 'checkpoint_answered' | 'hotspot_opened' | 'lesson_completed' | 'seeked' | 'speed_changed' | 'zoomed';
  objectRef?: string;
  value?: Record<string, unknown>;
}

type Lang = 'en' | 'ar';
const S = {
  en: {
    start: 'Start lesson', resume: 'Resume', play: 'Play', pause: 'Pause', back10: 'Back 10 s', fwd10: 'Forward 10 s',
    speed: 'Speed', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoom: 'Zoom', resetView: 'Reset view', captions: 'Captions',
    chapters: 'Chapters', checkpoints: 'Checkpoints', fullscreen: 'Full screen', exitFull: 'Exit full screen',
    checkpoint: 'Checkpoint', answerToGo: 'Answer to continue the lesson.', correct: 'Correct', notQuite: 'Not quite',
    continue: 'Continue', tryAgain: 'Try again', rewatch: 'Rewatch this chapter', hotspot: 'Hotspot', found: 'hotspots opened',
    pausedLook: 'Paused: drag to look around, scroll or use the slider to zoom.', complete: 'Lesson complete', score: 'Checkpoint score',
    firstTry: 'right first time', replay: 'Watch again', review: 'Review', min: 'min', stopsN: 'checkpoints', chaptersN: 'chapters',
    hotspotsN: 'hotspots', rendered: 'Rendered lesson on the 3D digital twin', filmed: 'Filmed lesson', locked: 'Answer the checkpoint first',
    answered: 'answered', pending: 'to do', time: 'Time', of: 'of', keys: 'Keys: Space play/pause · ←/→ 10 s · +/− zoom · C captions · N narration · F full screen',
    chapter: 'Chapter', narration: 'Narration', narrationOff: 'Narration off', brand: 'WABYS Technical Training', student: 'WABYS student',
  },
  ar: {
    start: 'ابدأ الدرس', resume: 'استئناف', play: 'تشغيل', pause: 'إيقاف مؤقت', back10: 'رجوع 10 ث', fwd10: 'تقديم 10 ث',
    speed: 'السرعة', zoomIn: 'تكبير', zoomOut: 'تصغير', zoom: 'التكبير', resetView: 'إعادة العرض', captions: 'الترجمة',
    chapters: 'الفصول', checkpoints: 'نقاط التحقق', fullscreen: 'ملء الشاشة', exitFull: 'الخروج من ملء الشاشة',
    checkpoint: 'نقطة تحقق', answerToGo: 'أجب لمتابعة الدرس.', correct: 'إجابة صحيحة', notQuite: 'ليست صحيحة',
    continue: 'متابعة', tryAgain: 'حاول مرة أخرى', rewatch: 'أعد مشاهدة هذا الفصل', hotspot: 'نقطة معلومات', found: 'نقاط معلومات مفتوحة',
    pausedLook: 'متوقف مؤقتًا: اسحب للنظر حولك، ومرّر العجلة أو استخدم الشريط للتكبير.', complete: 'اكتمل الدرس', score: 'درجة نقاط التحقق',
    firstTry: 'صحيحة من أول مرة', replay: 'شاهد مرة أخرى', review: 'مراجعة', min: 'دقيقة', stopsN: 'نقاط تحقق', chaptersN: 'فصول',
    hotspotsN: 'نقاط معلومات', rendered: 'درس مُصيَّر على التوأم الرقمي ثلاثي الأبعاد', filmed: 'درس مصوَّر', locked: 'أجب عن نقطة التحقق أولًا',
    answered: 'تمت الإجابة', pending: 'متبقية', time: 'الوقت', of: 'من', keys: 'المفاتيح: المسافة تشغيل/إيقاف · ←/→ ‏10 ث · +/− تكبير · C الترجمة · N التعليق الصوتي · F ملء الشاشة',
    chapter: 'الفصل', narration: 'التعليق الصوتي', narrationOff: 'إيقاف التعليق الصوتي', brand: 'WABYS للتدريب التقني', student: 'متدرب WABYS',
  },
};
type Strings = typeof S.en;

const SPEEDS = [0.5, 1, 1.5, 2];
const ZMIN = 1, ZMAX = 3;

// ---------------------------------------------------------------------------
// Timeline maths
// ---------------------------------------------------------------------------
const ease = (k: number) => k * k * (3 - 2 * k);
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function shotIndex(shots: LessonShot[], t: number) {
  let i = 0;
  while (i + 1 < shots.length && shots[i + 1]!.at <= t) i++;
  return i;
}

function shotParams(lesson: Lesson, i: number, u: number): Record<string, number> {
  const s = lesson.shots[i]!;
  const out: Record<string, number> = { ...lesson.model.params };
  // Params carry forward from earlier shots unless a shot sets them again.
  for (let j = 0; j <= i; j++) {
    Object.assign(out, lesson.shots[j]!.params);
    for (const [k, [, to]] of Object.entries(lesson.shots[j]!.sweep ?? {})) if (j < i) out[k] = to;
  }
  for (const [k, [from, to]] of Object.entries(s.sweep ?? {})) out[k] = from + (to - from) * u;
  return out;
}

export interface Frame {
  camera: Vec3; target: Vec3; explode: number; xray: boolean; cutaway: SectionSpec; running: boolean; rate: number;
  highlight: string | null; params: Record<string, number>; caption: Txt; shot: number;
}

export function frameAt(lesson: Lesson, t: number): Frame {
  const i = shotIndex(lesson.shots, t);
  const s = lesson.shots[i]!;
  const end = lesson.shots[i + 1]?.at ?? lesson.duration;
  const u = THREE.MathUtils.clamp((t - s.at) / Math.max(0.001, end - s.at), 0, 1);
  const p = lesson.shots[i - 1];
  const k = p ? ease(THREE.MathUtils.clamp((t - s.at) / (s.move ?? 1.6), 0, 1)) : 1;
  const params = shotParams(lesson, i, u);
  if (p && k < 1) {
    const prev = shotParams(lesson, i - 1, 1);
    for (const key of Object.keys(params)) if (key in prev && !(key in (s.sweep ?? {}))) params[key] = prev[key]! + (params[key]! - prev[key]!) * k;
  }
  return {
    camera: p ? lerp3(p.camera, s.camera, k) : s.camera,
    target: p ? lerp3(p.target, s.target, k) : s.target,
    explode: p ? (p.explode ?? 0) + ((s.explode ?? 0) - (p.explode ?? 0)) * k : s.explode ?? 0,
    xray: !!s.xray, cutaway: toSection(s.cutaway), running: !!s.running, rate: s.rate ?? 1,
    highlight: s.highlight ?? null, params, caption: s.caption, shot: i,
  };
}

const chapterAt = (lesson: Lesson, t: number) => {
  let c = 0;
  lesson.chapters.forEach((ch, i) => { if (ch.at <= t + 0.01) c = i; });
  return c;
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Inside the canvas
// ---------------------------------------------------------------------------
/** Advances lesson time while playing. */
function Ticker({ playing, speed, onTick }: { playing: boolean; speed: number; onTick: (dt: number) => void }) {
  useFrame((_, dt) => { if (playing) onTick(Math.min(dt, 0.1) * speed); });
  return null;
}

/** Flies the camera along the timeline while playing; the learner may orbit while paused. */
function CameraRig({ lesson, timeRef, follow, zoom, params }: {
  lesson: Lesson; timeRef: React.RefObject<number>; follow: boolean; zoom: number; params: Record<string, number>;
}) {
  const { camera, size, controls } = useThree();
  const want = useMemo(() => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3() }), []);
  const snapped = useRef(false);
  useFrame((_, dt) => {
    const f = frameAt(lesson, timeRef.current);
    // Per-frame params so a growing bead or opening door moves smoothly.
    for (const k of Object.keys(params)) delete params[k];
    Object.assign(params, f.params);
    const cam = camera as THREE.PerspectiveCamera;
    const z = zoom * Math.min(1, size.width / size.height / 1.5);
    if (Math.abs(cam.zoom - z) > 1e-3) { cam.zoom += (z - cam.zoom) * Math.min(1, dt * 10); cam.updateProjectionMatrix(); }
    if (!follow) { snapped.current = false; return; }
    want.pos.set(...f.camera); want.tgt.set(...f.target);
    const a = snapped.current ? 1 - Math.exp(-7 * dt) : 1;
    snapped.current = true;
    cam.position.lerp(want.pos, a);
    const oc = controls as unknown as OrbitImpl | null;
    if (oc) { oc.target.lerp(want.tgt, a); oc.update(); } else cam.lookAt(want.tgt);
  });
  return null;
}

/** Hotspot pins stay mounted and are shown or hidden, so drei's portals never unmount mid-lesson. */
function HotspotPins({ lesson, time, lang, opened, onOpen }: {
  lesson: Lesson; time: number; lang: Lang; opened: string[]; onOpen: (id: string) => void;
}) {
  return (
    <>
      {lesson.hotspots.map((h) => {
        const on = time >= h.at && time <= h.until;
        return (
          <Html key={h.id} position={h.position} center zIndexRange={[15, 0]}>
            <div style={{ display: on ? 'block' : 'none' }}>
              <button type="button" className={`lp-pin${opened.includes(h.id) ? ' is-seen' : ''}`}
                onClick={(e) => { e.stopPropagation(); onOpen(h.id); }} aria-label={h.title[lang]}>
                <span aria-hidden="true">i</span><em>{h.title[lang]}</em>
              </button>
            </div>
          </Html>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Full screen (native, with a CSS fallback where the API is refused)
// ---------------------------------------------------------------------------
function useFull(ref: React.RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [css, setCss] = useState(false);
  useEffect(() => {
    const on = () => setNative(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [ref]);
  const toggle = useCallback(async () => {
    if (native) return void (await document.exitFullscreen().catch(() => undefined));
    if (css) return setCss(false);
    try {
      if (!ref.current?.requestFullscreen || !document.fullscreenEnabled) throw new Error('no');
      await ref.current.requestFullscreen();
    } catch { setCss(true); }
  }, [native, css, ref]);
  return { full: native || css, css, toggle, exitCss: () => setCss(false) };
}

/** The browser's speech voices (they load asynchronously). */
function useVoices() {
  const [v, setV] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    const load = () => setV(synth.getVoices());
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, []);
  return v;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
type Answer = { picked: number; correct: boolean; attempts: number; firstCorrect: boolean };

export interface LessonPlayerProps {
  lesson: Lesson;
  lang?: Lang;
  onEvent?: (e: LessonEvent) => void;
  /** Called once with the result when the learner reaches the end. */
  onComplete?: (r: { score: number; answered: number; total: number; hotspots: number }) => void;
  height?: number | string;
  /** Extra content above the chapters list (e.g. a lesson switcher). */
  aside?: ReactNode;
  /** False while hidden: pauses the lesson and stops rendering. */
  active?: boolean;
}

export function LessonPlayer({ lesson, lang = 'en', onEvent, onComplete, height = 'min(600px, 70vh)', aside, active = true }: LessonPlayerProps) {
  const t: Strings = S[lang];
  const p = (x: Txt) => x[lang];
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [cc, setCc] = useState(true);
  const [follow, setFollow] = useState(true);
  const [stop, setStop] = useState<LessonStop | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [hot, setHot] = useState<string | null>(null);
  const [opened, setOpened] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fs = useFull(rootRef);
  const params = useMemo<Record<string, number>>(() => ({ ...lesson.model.params }), [lesson]);
  const parts = useMemo(() => modelParts(lesson.model, lang), [lesson, lang]);
  const emit = useRef(onEvent); emit.current = onEvent;
  const answersRef = useRef(answers); answersRef.current = answers;
  const chapterRef = useRef(-1);
  const uiAcc = useRef(0);
  const filmed = !!lesson.video?.src;
  const env = lesson.model.env;
  const withStudent = !!env && lesson.student !== false;
  const ppe = useMemo<PPE>(() => (lesson.student ? lesson.student : tradePpe(env?.bay)), [lesson, env]);
  const studentRef = useRef<StudentState | null>(null);
  if (withStudent && !studentRef.current) studentRef.current = newStudent(env, ppe);
  const [voice, setVoice] = useState(true);
  const voices = useVoices();
  const canSpeak = voices.some((v) => v.lang.toLowerCase().startsWith(lang));
  useEffect(() => { if (!active) setPlaying(false); }, [active]);

  // Reset when the lesson changes.
  useEffect(() => {
    timeRef.current = 0; setTime(0); setPlaying(false); setStarted(false); setEnded(false); setStop(null); setAnswers({});
    setOpened([]); setHot(null); setZoom(1); setFollow(true); chapterRef.current = -1;
  }, [lesson]);

  const finish = useCallback(() => {
    setPlaying(false); setEnded(true);
    const a = answersRef.current;
    const total = lesson.stops.length;
    const first = lesson.stops.filter((s) => a[s.id]?.firstCorrect).length;
    const score = total ? Math.round((first / total) * 100) : 100;
    emit.current?.({ verb: 'lesson_completed', objectRef: lesson.id, value: { score, firstTry: first, total } });
    onComplete?.({ score, answered: Object.values(a).filter((x) => x.correct).length, total, hotspots: 0 });
  }, [lesson, onComplete]);

  /** Move time forward, stopping at the first unanswered checkpoint crossed. */
  const advanceTo = useCallback((next: number, from = timeRef.current) => {
    const pending = lesson.stops.find((s) => !answersRef.current[s.id]?.correct && s.at > from - 1e-6 && s.at <= next);
    let to = Math.min(next, lesson.duration);
    if (pending) to = pending.at;
    timeRef.current = to;
    if (videoRef.current && Math.abs(videoRef.current.currentTime - to) > 0.3) videoRef.current.currentTime = to;
    const c = chapterAt(lesson, to);
    if (c !== chapterRef.current) {
      chapterRef.current = c;
      emit.current?.({ verb: 'chapter_reached', objectRef: `${lesson.id}#ch${c + 1}`, value: { at: Math.round(to) } });
    }
    if (pending) { setPlaying(false); setStop(pending); setTime(to); return; }
    if (to >= lesson.duration) { setTime(to); finish(); }
  }, [lesson, finish]);

  const onTick = useCallback((dt: number) => {
    advanceTo(timeRef.current + dt);
    uiAcc.current += dt;
    if (uiAcc.current > 0.066) { uiAcc.current = 0; setTime(timeRef.current); }
  }, [advanceTo]);

  // Filmed lessons: the video's clock drives the timeline.
  useEffect(() => {
    const v = videoRef.current;
    if (!filmed || !v) return;
    v.playbackRate = speed;
    if (playing) void v.play().catch(() => setPlaying(false)); else v.pause();
    let raf = 0;
    const loop = () => {
      if (!v.paused) { advanceTo(v.currentTime); setTime(timeRef.current); if (timeRef.current < v.currentTime - 0.05) v.pause(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [filmed, playing, speed, advanceTo]);

  const play = () => {
    if (stop) return;
    if (ended) { seek(0, true); setEnded(false); }
    if (!started) { setStarted(true); emit.current?.({ verb: 'lesson_started', objectRef: lesson.id }); }
    setHot(null); setFollow(true); setPlaying(true);
  };
  const pause = () => setPlaying(false);
  const toggle = () => (playing ? pause() : play());

  /** Seek. Going forward past an unanswered checkpoint stops at it. */
  const seek = (to: number, quiet = false) => {
    const target = THREE.MathUtils.clamp(to, 0, lesson.duration);
    if (target > timeRef.current) advanceTo(target);
    else { timeRef.current = target; if (videoRef.current) videoRef.current.currentTime = target; }
    setTime(timeRef.current); setFollow(true); setEnded(false);
    if (!quiet) emit.current?.({ verb: 'seeked', objectRef: lesson.id, value: { to: Math.round(timeRef.current) } });
  };

  const answer = (s: LessonStop, i: number) => {
    const prev = answersRef.current[s.id];
    const correct = i === s.answer;
    const next: Answer = { picked: i, correct, attempts: (prev?.attempts ?? 0) + 1, firstCorrect: prev ? prev.firstCorrect : correct };
    setAnswers((a) => ({ ...a, [s.id]: next }));
    answersRef.current = { ...answersRef.current, [s.id]: next };
    emit.current?.({ verb: 'checkpoint_answered', objectRef: `${lesson.id}#${s.id}`, value: { option: i, correct, attempt: next.attempts } });
  };
  const leaveStop = () => {
    const s = stop!;
    setStop(null);
    timeRef.current = s.at + 0.01; setPlaying(true);
  };
  /** Back to the start of the checkpoint's chapter; the checkpoint comes round again, and the first answer still counts. */
  const rewatch = () => {
    const s = stop!;
    setAnswers((a) => ({ ...a, [s.id]: { ...a[s.id]!, picked: -1 } }));
    const ch = lesson.chapters[chapterAt(lesson, s.at - 0.5)]!;
    setStop(null);
    timeRef.current = ch.at; setTime(ch.at); setFollow(true); setPlaying(true);
  };

  const openHot = (id: string) => {
    setPlaying(false); setHot(id);
    if (!opened.includes(id)) setOpened((o) => [...o, id]);
    emit.current?.({ verb: 'hotspot_opened', objectRef: `${lesson.id}#${id}` });
  };

  const setZ = (z: number) => {
    const v = THREE.MathUtils.clamp(Math.round(z * 10) / 10, ZMIN, ZMAX);
    setZoom(v);
  };
  const zoomTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(zoomTimer.current);
    if (zoom !== 1) zoomTimer.current = setTimeout(() => emit.current?.({ verb: 'zoomed', objectRef: lesson.id, value: { zoom } }), 500);
    return () => clearTimeout(zoomTimer.current);
  }, [zoom, lesson.id]);

  // Wheel zoom (non-passive so the page does not scroll under the lesson).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom((z) => THREE.MathUtils.clamp(Math.round((z - e.deltaY * 0.0015) * 100) / 100, ZMIN, ZMAX)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const k = e.key;
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowRight') { e.preventDefault(); seek(timeRef.current + 10); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seek(timeRef.current - 10); }
    else if (k === '+' || k === '=') setZ(zoom + 0.25);
    else if (k === '-') setZ(zoom - 0.25);
    else if (k === 'c' || k === 'C') setCc((c) => !c);
    else if (k === 'n' || k === 'N') setVoice((v) => !v);
    else if (k === 'f' || k === 'F') void fs.toggle();
    else if (k === 'Escape' && fs.css) fs.exitCss();
  };

  const frame = frameAt(lesson, time);
  const shotNo = frame.shot;
  // Spoken narration of each shot's caption, in the lesson language, while playing.
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth) return;
    if (!voice || !playing || !started || filmed || !active || !canSpeak) { synth.cancel(); return; }
    const text = lesson.shots[shotNo]?.caption[lang];
    if (!text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ar' ? 'ar-SA' : 'en-GB';
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(lang) && /natural|google|microsoft|premium|enhanced/i.test(x.name))
      ?? voices.find((x) => x.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    u.rate = Math.min(1.8, 1.05 * speed);
    synth.speak(u);
  }, [shotNo, playing, voice, lang, started, filmed, active, canSpeak]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); }, []);
  const chapter = chapterAt(lesson, time);
  const hotspot = lesson.hotspots.find((h) => h.id === hot) ?? null;
  const total = lesson.stops.length;
  const firstRight = lesson.stops.filter((s) => answers[s.id]?.firstCorrect).length;
  const nextStop = lesson.stops.find((s) => !answers[s.id]?.correct);
  const pct = (x: number) => `${(x / lesson.duration) * 100}%`;
  const stopAns = stop ? answers[stop.id] : undefined;
  const sinceChapter = time - lesson.chapters[chapter]!.at;
  const bumper = started && !ended && chapter > 0 && sinceChapter >= 0 && sinceChapter < 2.8;

  return (
    <div ref={rootRef} className={`lp-root${fs.full ? ' is-full' : ''}${fs.css ? ' is-max' : ''}`} style={{ height: fs.full ? undefined : height }}
      onKeyDown={onKey} tabIndex={-1}>
      <div className="lp-main">
        <div ref={stageRef} className="lp-stage" onClick={(e) => { if (e.target === e.currentTarget) toggle(); }}>
          {filmed ? (
            <div className="lp-video-wrap" style={{ transform: `scale(${zoom})` }}>
              <video ref={videoRef} src={lesson.video!.src} poster={lesson.video!.poster} playsInline preload="metadata" onClick={toggle} />
              {lesson.hotspots.filter((h) => h.screen && time >= h.at && time <= h.until).map((h) => (
                <button key={h.id} type="button" className="lp-pin" style={{ position: 'absolute', left: `${h.screen![0]}%`, top: `${h.screen![1]}%` }}
                  onClick={() => openHot(h.id)}><span aria-hidden="true">i</span><em>{p(h.title)}</em></button>
              ))}
            </div>
          ) : (
            <Canvas shadows="soft" camera={{ position: lesson.shots[0]!.camera, fov: 40, near: 0.05, far: 400 }} dpr={[1, 2]} frameloop={active ? 'always' : 'never'}>
              <ModelScene parts={parts} explode={frame.explode} xray={frame.xray} cutaway={frame.cutaway}
                running={frame.running && playing} rate={frame.rate * speed} selectedId={frame.highlight} pins={false} params={params}
                env={env} lang={lang} student={withStudent ? studentRef : undefined}>
                {withStudent && <LessonStudent state={studentRef} shots={lesson.shots} timeRef={timeRef} ppe={ppe} />}
                {lesson.callouts && <Callouts items={lesson.callouts} time={started ? time : -1} lang={lang} />}
                {lesson.dims && <Dims items={lesson.dims} time={started ? time : -1} />}
                {lesson.flows && <Flows items={lesson.flows} time={started ? time : -1} lang={lang} />}
              </ModelScene>
              <HotspotPins lesson={lesson} time={time} lang={lang} opened={opened} onOpen={openHot} />
              <CameraRig lesson={lesson} timeRef={timeRef} follow={follow} zoom={zoom} params={params} />
              <Ticker playing={playing} speed={speed} onTick={onTick} />
              <OrbitControls makeDefault enableDamping enableZoom={false} enablePan={false} enabled={!playing}
                onStart={() => setFollow(false)} target={lesson.shots[0]!.target} />
            </Canvas>
          )}

          <div className="lp-top">
            <span className="lp-badge">{filmed ? t.filmed : t.rendered}</span>
            <span className="lp-chapter">{chapter + 1}. {p(lesson.chapters[chapter]!.title)}</span>
          </div>

          {started && !ended && !stop && <CardStack cards={lesson.cards ?? []} t={time} lang={lang} />}
          {started && !ended && time < 6 && (
            <div className="lp-lower" key={lesson.id}>
              <span className="lp-lower-mark" aria-hidden="true" />
              <div><b>{t.brand}</b><small>{p(lesson.model.title)}{withStudent ? ` · ${t.student}` : ''}</small></div>
            </div>
          )}
          {bumper && (
            <div className="lp-bumper" key={chapter} aria-hidden="true">
              <small>{t.chapter} {chapter + 1}</small>
              <b>{p(lesson.chapters[chapter]!.title)}</b>
            </div>
          )}
          {cc && started && !ended && <p className="lp-caption" aria-live="polite">{p(frame.caption)}</p>}
          {started && !playing && !stop && !ended && !hot && !filmed && <p className="lp-paused">{t.pausedLook}</p>}

          {!started && (
            <div className="lp-cover">
              <div className="lp-cover-card">
                <p className="lp-eyebrow">{p(lesson.model.title)}</p>
                <h3>{p(lesson.title)}</h3>
                <p>{p(lesson.summary)}</p>
                <ul className="lp-facts">
                  <li><b>{Math.max(1, Math.round(lesson.duration / 60))}</b> {t.min}</li>
                  <li><b>{lesson.chapters.length}</b> {t.chaptersN}</li>
                  <li><b>{total}</b> {t.stopsN}</li>
                  <li><b>{lesson.hotspots.length}</b> {t.hotspotsN}</li>
                </ul>
                <button type="button" className="lp-primary" onClick={play}>▶ {t.start}</button>
              </div>
            </div>
          )}

          {stop && (
            <div className="lp-modal" role="dialog" aria-modal="true" aria-labelledby={`q-${stop.id}`}>
              <div className="lp-q">
                <p className="lp-eyebrow">{t.checkpoint} {lesson.stops.indexOf(stop) + 1} / {total}</p>
                <h3 id={`q-${stop.id}`}>{p(stop.question)}</h3>
                <div className="lp-options">
                  {stop.options.map((o, i) => {
                    const picked = stopAns?.picked === i;
                    const state = picked ? (stopAns!.correct ? 'is-right' : 'is-wrong') : '';
                    return (
                      <button key={i} type="button" className={`lp-opt ${state}`} disabled={!!stopAns?.correct}
                        onClick={() => answer(stop, i)}>
                        <span className="lp-letter">{String.fromCharCode(65 + i)}</span>{p(o)}
                      </button>
                    );
                  })}
                </div>
                {stopAns && stopAns.picked >= 0 ? (
                  <div className={`lp-feedback ${stopAns.correct ? 'ok' : 'bad'}`} role="status">
                    <b>{stopAns.correct ? `✓ ${t.correct}` : `✗ ${t.notQuite}`}</b> {p(stop.explain)}
                  </div>
                ) : <p className="lp-muted">{t.answerToGo}</p>}
                <div className="lp-q-actions">
                  {stopAns?.correct ? (
                    <button type="button" className="lp-primary" autoFocus onClick={leaveStop}>{t.continue} ▶</button>
                  ) : stopAns && stopAns.picked >= 0 ? (
                    <>
                      <button type="button" onClick={rewatch}>↺ {t.rewatch}</button>
                      <button type="button" className="lp-primary" onClick={() => setAnswers((a) => ({ ...a, [stop.id]: { ...a[stop.id]!, picked: -1 } }))}>{t.tryAgain}</button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {hotspot && (
            <div className="lp-hotcard" role="dialog" aria-label={p(hotspot.title)}>
              <p className="lp-eyebrow">{t.hotspot}</p>
              <h4>{p(hotspot.title)}</h4>
              <p>{p(hotspot.body)}</p>
              <button type="button" className="lp-primary" onClick={play}>▶ {t.resume}</button>
            </div>
          )}

          {ended && (
            <div className="lp-modal">
              <div className="lp-q lp-end">
                <p className="lp-eyebrow">{t.complete}</p>
                <h3>{p(lesson.title)}</h3>
                <div className="lp-score"><b>{total ? Math.round((firstRight / total) * 100) : 100}%</b><span>{t.score} · {firstRight} / {total} {t.firstTry}</span></div>
                <ol className="lp-results">
                  {lesson.stops.map((s) => (
                    <li key={s.id} className={answers[s.id]?.firstCorrect ? 'ok' : 'bad'}>
                      <span>{answers[s.id]?.firstCorrect ? '✓' : '✗'}</span>{p(s.question)}
                      <button type="button" onClick={() => { setEnded(false); seek(lesson.chapters[chapterAt(lesson, s.at - 0.5)]!.at); }}>{t.review}</button>
                    </li>
                  ))}
                </ol>
                <p className="lp-muted">{opened.length} / {lesson.hotspots.length} {t.found}</p>
                <button type="button" className="lp-primary" onClick={play}>↺ {t.replay}</button>
              </div>
            </div>
          )}
        </div>

        <div className="lp-bar">
          <div className="lp-scrub">
            <input type="range" min={0} max={lesson.duration} step={0.1} value={time} aria-label={t.time}
              aria-valuetext={`${fmt(time)} ${t.of} ${fmt(lesson.duration)}`}
              onChange={(e) => seek(Number(e.target.value))} style={{ ['--pct' as string]: pct(time) }} />
            <div className="lp-marks" aria-hidden="true">
              {lesson.chapters.slice(1).map((c) => <i key={c.at} className="lp-mark-ch" style={{ insetInlineStart: pct(c.at) }} />)}
              {lesson.stops.map((s) => <i key={s.id} className={`lp-mark-q${answers[s.id]?.correct ? ' done' : ''}`} style={{ insetInlineStart: pct(s.at) }} title={t.checkpoint} />)}
            </div>
          </div>
          <div className="lp-ctrls">
            <button type="button" onClick={() => seek(time - 10)} aria-label={t.back10} title={t.back10}>⟲ 10</button>
            <button type="button" className="lp-play" onClick={toggle} aria-label={playing ? t.pause : t.play} disabled={!!stop}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button type="button" onClick={() => seek(time + 10)} aria-label={t.fwd10} title={nextStop && nextStop.at < time + 10 ? t.locked : t.fwd10}>10 ⟳</button>
            <span className="lp-time" dir="ltr">{fmt(time)} / {fmt(lesson.duration)}</span>
            <span className="lp-spacer" />
            <div className="lp-zoom" role="group" aria-label={t.zoom}>
              <button type="button" onClick={() => setZ(zoom - 0.25)} aria-label={t.zoomOut} disabled={zoom <= ZMIN}>−</button>
              <input type="range" min={ZMIN} max={ZMAX} step={0.05} value={zoom} onChange={(e) => setZ(Number(e.target.value))} aria-label={t.zoom} />
              <button type="button" onClick={() => setZ(zoom + 0.25)} aria-label={t.zoomIn} disabled={zoom >= ZMAX}>+</button>
              <span className="lp-zv" dir="ltr">{zoom.toFixed(1)}×</span>
            </div>
            {(!follow || zoom !== 1) && <button type="button" onClick={() => { setFollow(true); setZoom(1); }}>{t.resetView}</button>}
            <label className="lp-speed">
              <span className="lp-sr">{t.speed}</span>
              <select value={speed} onChange={(e) => { const v = Number(e.target.value); setSpeed(v); emit.current?.({ verb: 'speed_changed', objectRef: lesson.id, value: { speed: v } }); }}>
                {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </label>
            <button type="button" aria-pressed={cc} onClick={() => setCc(!cc)} title={t.captions}>CC</button>
            {!filmed && canSpeak && (
              <button type="button" aria-pressed={voice} onClick={() => setVoice(!voice)} title={voice ? t.narrationOff : t.narration} aria-label={t.narration}>
                {voice ? '🔊' : '🔇'}
              </button>
            )}
            <button type="button" aria-pressed={fs.full} onClick={() => void fs.toggle()} title={fs.full ? t.exitFull : t.fullscreen} aria-label={fs.full ? t.exitFull : t.fullscreen}>⛶</button>
          </div>
        </div>
      </div>

      <aside className="lp-side">
        {aside}
        <h4>{t.chapters}</h4>
        <ol className="lp-chapters">
          {lesson.chapters.map((c, i) => {
            const end = lesson.chapters[i + 1]?.at ?? lesson.duration;
            const blocked = nextStop !== undefined && nextStop.at < c.at;
            return (
              <li key={c.at}>
                <button type="button" aria-current={i === chapter} disabled={blocked} title={blocked ? t.locked : undefined}
                  onClick={() => { seek(c.at); if (!started) play(); }}>
                  <span className="lp-ct" dir="ltr">{fmt(c.at)}</span>
                  <span>{p(c.title)}</span>
                  {i === chapter && <span className="lp-prog" style={{ width: `${THREE.MathUtils.clamp((time - c.at) / (end - c.at), 0, 1) * 100}%` }} />}
                </button>
              </li>
            );
          })}
        </ol>
        <h4>{t.checkpoints} <small>{Object.values(answers).filter((a) => a.correct).length} / {total}</small></h4>
        <ol className="lp-stops">
          {lesson.stops.map((s, i) => {
            const a = answers[s.id];
            return (
              <li key={s.id} className={a?.correct ? (a.firstCorrect ? 'ok' : 'bad') : ''}>
                <span className="lp-dot">{a?.correct ? (a.firstCorrect ? '✓' : '•') : i + 1}</span>
                <span>{p(s.question)}</span>
              </li>
            );
          })}
        </ol>
        <p className="lp-keys">{t.keys}</p>
      </aside>
    </div>
  );
}
