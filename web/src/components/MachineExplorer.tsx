/**
 * MachineExplorer — interactive 3D equipment explorer for VTC_LMS.
 *
 * Features
 *   • The machine stands in the WABYS training workshop at true scale, lit by
 *     workshop light panels so painted, cast and machined surfaces read as real
 *     (or in a plain studio for close study).
 *   • Exploded view driven by a slider (or animated), with per-part staging so
 *     parts come off in a realistic disassembly order.
 *   • Hotspot pins anchored to parts (they travel with the part) that open a
 *     spec / safety card: torque values, part numbers, MSDS links.
 *   • X-ray mode (everything translucent except the selected part), section
 *     views (longitudinal, cross, plan and quarter, with the plane slid
 *     through the machine and turned for oblique cuts; cut faces are hatched)
 *     and a kinetic "run" mode that spins rotating parts and drives animated
 *     ones (pistons, drive rolls…).
 *   • Camera presets: iso, front, side and top.
 *   • The WABYS student: walk them to a work position at the machine, or walk
 *     round it yourself (WASD / arrows / on-screen pad), in third person or
 *     through their eyes in first person.
 *   • VR: "Enter VR" opens an immersive WebXR session on a headset; on other
 *     devices it switches to a side-by-side stereo view for a phone viewer.
 *   • Emits xAPI-shaped telemetry (`onEvent`) using the same verb/objectRef/value
 *     shape the V-Lab telemetry endpoint accepts.
 *
 * The scene itself (`ModelScene`) is shared with the video-lesson player and
 * the safety simulator, which drive the same parts and student from a
 * timeline or a scenario instead of from these controls.
 *
 * Model-agnostic: each part renders whatever children you give it, so a glTF
 * digital twin plugs in as `{ render: () => <primitive object={nodes.Fan} /> }`.
 */
import { ContactShadows, Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { StereoEffect } from 'three/examples/jsm/effects/StereoEffect.js';
import { applySection, createSection, CUT_MODES, sectionMaterial, sectionPlanes, type CutMode, type SectionSpec, type SectionState } from './section';
import { newStudent, Student, STUDENT_EYE, tradePpe, Walker, angleTo, type Rect, type StudentState } from '../models/avatar';
import type { ModelEnv, StationDef } from '../models/kit';
import { ShopLighting, Workshop } from '../models/workshop';
import { LockerButton } from './LockerButton';
import './MachineExplorer.css';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export type Vec3 = [number, number, number];

export interface Hotspot {
  /** Pin position in the part's local space (moves with the part). */
  position: Vec3;
  title: string;
  specs: Record<string, string>;
  safety?: string;
  docUrl?: string;
}

/** What an animated part sees each frame. `t` only advances while the machine runs. */
export interface AnimateState { t: number; dt: number; running: boolean; params: Record<string, number> }

export interface PartSpec {
  id: string;
  name: string;
  /** Offset from the assembled position at 100% explosion. */
  explode: Vec3;
  /** 0..1 — point on the slider where this part starts moving (disassembly order). */
  stage?: number;
  /** Rotates about this local axis in kinetic mode (rad/s). */
  spin?: { axis: 'x' | 'y' | 'z'; speed: number };
  /** Per-frame hook for moving sub-parts (pistons, gauges, a growing weld bead). */
  animate?: (g: THREE.Group, s: AnimateState) => void;
  hotspot?: Hotspot;
  /** Briefing shown when the part is pressed: what it is and what it does. */
  brief?: { what: string; does: string };
  render: () => ReactNode;
}

export interface ExplorerEvent {
  verb: 'exploded' | 'hotspot_viewed' | 'part_selected' | 'view_mode_changed' | 'student_moved';
  objectRef?: string;
  value?: Record<string, unknown>;
}

/** UI copy, so the explorer can be localised (e.g. Arabic, with dir="rtl" on an ancestor). */
export interface ExplorerStrings {
  digitalTwin: string; viewModes: string; xray: string; cutaway: string; run: string; stop: string;
  assemble: string; explode: string; explodedView: string; component: string; datasheet: string; hint: string;
  vr: string; vrExit: string; vrStereoNote: string; vrHeadset: string;
  // Added with the workshop, sections and the student. Optional so older string tables still type-check.
  section?: string; cutOff?: string; cutLong?: string; cutCross?: string; cutPlan?: string; cutQuarter?: string; cutOffset?: string; cutAngle?: string;
  views?: string; viewIso?: string; viewFront?: string; viewSide?: string; viewTop?: string;
  workshop?: string; studio?: string; student?: string; studentOff?: string; third?: string; first?: string;
  walkTo?: string; keysHint?: string; sectionHint?: string;
  labels?: string; whatItIs?: string; whatItDoes?: string; specs?: string;
}
const EN: Required<ExplorerStrings> = {
  digitalTwin: 'Digital twin', viewModes: 'View modes', xray: 'X-ray', cutaway: 'Section', run: 'Run', stop: 'Stop',
  assemble: 'Assemble', explode: 'Explode', explodedView: 'Exploded view', component: 'Component',
  datasheet: 'Open datasheet →', hint: 'Tap any part, its label or its numbered pin for a briefing: what it is, what it does and its specification.',
  vr: 'Enter VR', vrExit: 'Exit VR',
  vrStereoNote: 'No VR headset found, so this is the stereo view: put the phone in a VR viewer (Cardboard-style) and drag to look around.',
  vrHeadset: 'Immersive VR on your headset. Take it off or press Exit VR to come back.',
  section: 'Section view', cutOff: 'Off', cutLong: 'Lengthwise', cutCross: 'Across', cutPlan: 'Plan', cutQuarter: 'Quarter',
  cutOffset: 'Plane position', cutAngle: 'Plane angle', views: 'Camera', viewIso: 'Iso', viewFront: 'Front', viewSide: 'Side', viewTop: 'Top',
  workshop: 'Workshop', studio: 'Studio', student: 'WABYS student', studentOff: 'Off', third: '3rd person', first: '1st person',
  walkTo: 'Walk to', keysHint: 'W A S D or arrows to walk · drag to look', sectionHint: 'Hatched faces are where the plane cuts solid metal.',
  labels: 'Labels', whatItIs: 'What it is', whatItDoes: 'What it does', specs: 'Specification',
};
const AR: Required<ExplorerStrings> = {
  digitalTwin: 'التوأم الرقمي', viewModes: 'أوضاع العرض', xray: 'أشعة', cutaway: 'مقطع', run: 'تشغيل', stop: 'إيقاف',
  assemble: 'تجميع', explode: 'تفكيك', explodedView: 'العرض المفكك', component: 'المكوّن',
  datasheet: 'افتح ورقة البيانات ←', hint: 'اضغط أي قطعة أو اسمها أو دبوسها المرقّم لعرض نبذة عنها: ما هي ووظيفتها ومواصفاتها.',
  vr: 'دخول الواقع الافتراضي', vrExit: 'خروج من الواقع الافتراضي',
  vrStereoNote: 'لا توجد نظارة واقع افتراضي، لذا هذا عرض مجسم مزدوج: ضع الهاتف في نظارة من نوع Cardboard واسحب للنظر حولك.',
  vrHeadset: 'واقع افتراضي غامر على نظارتك. انزعها أو اضغط الخروج للعودة.',
  section: 'عرض المقطع', cutOff: 'بدون', cutLong: 'طولي', cutCross: 'عرضي', cutPlan: 'أفقي', cutQuarter: 'ربع مقطع',
  cutOffset: 'موضع المستوى', cutAngle: 'زاوية المستوى', views: 'الكاميرا', viewIso: 'منظور', viewFront: 'أمامي', viewSide: 'جانبي', viewTop: 'علوي',
  workshop: 'الورشة', studio: 'استوديو', student: 'متدرب WABYS', studentOff: 'إخفاء', third: 'منظور ثالث', first: 'بعيني المتدرب',
  walkTo: 'اذهب إلى', keysHint: 'W A S D أو الأسهم للمشي · اسحب للنظر', sectionHint: 'الأوجه المخططة هي حيث يقطع المستوى المعدن المصمت.',
  labels: 'الأسماء', whatItIs: 'ما هو', whatItDoes: 'وظيفته', specs: 'المواصفات',
};
export const explorerStrings = (lang: 'en' | 'ar') => (lang === 'ar' ? AR : EN);

export interface ModelView { camera: Vec3; target: Vec3 }
const DEFAULT_VIEW: ModelView = { camera: [5.2, 3.2, 6.6], target: [0, 0.7, 0] };

export interface MachineExplorerProps {
  title: string;
  strings?: Partial<ExplorerStrings>;
  lang?: 'en' | 'ar';
  assetTag?: string;
  parts: PartSpec[];
  view?: ModelView;
  /** The workshop setting and the student's work positions. Without it the machine shows in the studio. */
  env?: ModelEnv;
  onEvent?: (e: ExplorerEvent) => void;
  height?: number | string;
  /** Extra controls in the header (e.g. a model switcher). */
  toolbar?: ReactNode;
  /** Machine params while exploring, and the ones applied while it runs. */
  params?: Record<string, number>;
  runParams?: Record<string, number>;
  /** False while the explorer is hidden: stops rendering to save the GPU. */
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Scene shared by the explorer, the lesson player and the safety simulator
// ---------------------------------------------------------------------------
interface SceneState {
  explode: number;
  xray: boolean;
  running: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  pins: boolean;
  /** Name labels next to every part's pin. */
  labels: boolean;
  params: React.RefObject<Record<string, number>>;
  clock: React.RefObject<number>;
  section: SectionState;
  setHovered: (id: string | null) => void;
  select: (id: string | null, via: 'pin' | 'mesh' | 'list') => void;
}
const SceneCtx = createContext<SceneState | null>(null);
const useScene = () => useContext(SceneCtx)!;

/** What controllers inside a ModelScene (student, lesson, simulator) can read. */
export interface SceneInfo {
  env?: ModelEnv;
  /** The machine's footprint on the floor, model units (null until measured). */
  box: React.RefObject<Rect | null>;
  section: SectionState;
}
const InfoCtx = createContext<SceneInfo | null>(null);
export const useSceneInfo = () => useContext(InfoCtx)!;

const STAGE_SPAN = 0.5; // each part travels over half the slider range
const HIGHLIGHT = new THREE.Color('#ff9f1c');
const HOVER = new THREE.Color('#3aa0ff');

/** Local 0..1 progress for a part given the global slider value. */
function partProgress(explode: number, stage = 0) {
  const t = THREE.MathUtils.clamp((explode - stage) / STAGE_SPAN, 0, 1);
  return t * t * (3 - 2 * t); // smoothstep easing
}

function ExplodablePart({ spec, index }: { spec: PartSpec; index: number }) {
  const { explode, xray, running, selectedId, hoveredId, pins, labels, params, clock, section, setHovered, select } = useScene();
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const target = useMemo(() => new THREE.Vector3(), []);
  const selected = selectedId === spec.id;
  const hovered = hoveredId === spec.id;
  // Parts without a hand-placed pin get one at the centre of their shape, in the part's own space so it travels with it.
  const [auto, setAuto] = useState<Vec3 | null>(null);
  useLayoutEffect(() => {
    if (spec.hotspot) return;
    outer.current.updateWorldMatrix(true, true);
    const c = new THREE.Box3().setFromObject(inner.current).getCenter(new THREE.Vector3());
    outer.current.worldToLocal(c);
    setAuto(c.toArray() as Vec3);
  }, [spec.hotspot]);
  const pinAt = spec.hotspot?.position ?? auto;

  // Damped motion toward the slider target keeps dragging smooth on tablets.
  useFrame((_, dt) => {
    const k = partProgress(explode, spec.stage);
    target.set(spec.explode[0] * k, spec.explode[1] * k, spec.explode[2] * k);
    outer.current.position.lerp(target, 1 - Math.exp(-10 * dt));
    if (running && spec.spin) inner.current.rotation[spec.spin.axis] += spec.spin.speed * dt;
    spec.animate?.(inner.current, { t: clock.current, dt, running, params: params.current });
  });

  // Material treatment for selection / hover / X-ray. Original values are
  // stashed in userData so toggling back is lossless.
  useLayoutEffect(() => {
    inner.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      for (const m of mats) {
        if (!m.userData.orig) {
          m.userData.orig = { emissive: m.emissive?.clone(), emissiveIntensity: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite };
        }
        sectionMaterial(section, m);
        const o = m.userData.orig;
        const translucent = xray && !selected;
        m.transparent = translucent || o.transparent;
        m.opacity = translucent ? Math.min(0.16, o.opacity) : o.opacity;
        m.depthWrite = translucent ? false : o.depthWrite;
        if (m.emissive) {
          m.emissive.copy(selected ? HIGHLIGHT : hovered ? HOVER : o.emissive);
          m.emissiveIntensity = selected ? 0.32 : hovered ? 0.22 : o.emissiveIntensity;
        }
        m.needsUpdate = true;
      }
    });
  }, [xray, selected, hovered, section]);

  return (
    <group ref={outer}>
      <group
        ref={inner}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(spec.id); }}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => { e.stopPropagation(); select(spec.id, 'mesh'); }}
      >
        {spec.render()}
      </group>
      {pins && pinAt && (
        <Html position={pinAt} center zIndexRange={[3, 0]}>
          <div className={`mx-pinwrap${labels ? ' has-label' : ''}${selected ? ' is-active' : ''}`}
            onMouseEnter={() => setHovered(spec.id)} onMouseLeave={() => setHovered(null)}>
            <button
              className={`mx-pin${selected ? ' is-active' : ''}`}
              aria-label={`${index + 1}: ${spec.name}`}
              onClick={(e) => { e.stopPropagation(); select(spec.id, 'pin'); }}
            >
              {index + 1}
            </button>
            <button type="button" className="mx-label" tabIndex={-1} style={{ display: labels || selected || hovered ? undefined : 'none' }}
              onClick={(e) => { e.stopPropagation(); select(spec.id, 'pin'); }}>{spec.name}</button>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Advances the machine clock while it runs (pistons, spools, the arc…). */
function Clock({ clock, running, rate = 1 }: { clock: React.RefObject<number>; running: boolean; rate?: number }) {
  useFrame((_, dt) => { if (running) clock.current += Math.min(dt, 0.1) * rate; });
  return null;
}

/** Orange outline of each section plane, sized to the machine. */
function SectionOutline({ box, spec }: { box: THREE.Box3; spec: SectionSpec }) {
  const rects = useMemo(() => {
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).addScalar(0.15);
    return sectionPlanes(box, spec).map((p) => {
      const n = p.normal.clone();
      const o = p.coplanarPoint(new THREE.Vector3());
      const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const a = new THREE.Vector3().crossVectors(up, n).normalize();
      const b = new THREE.Vector3().crossVectors(n, a).normalize();
      const ext = (v: THREE.Vector3) => Math.abs(v.x) * half.x + Math.abs(v.y) * half.y + Math.abs(v.z) * half.z;
      const ea = ext(a), eb = ext(b);
      const pt = (sa: number, sb: number) => o.clone().addScaledVector(a, sa * ea).addScaledVector(b, sb * eb);
      return [pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1), pt(-1, -1)];
    });
  }, [box, spec]);
  return (
    <>
      {rects.map((pts, i) => (
        <Line key={i} points={pts} color="#ff9f1c" lineWidth={2.5} dashed dashSize={0.12} gapSize={0.06} transparent opacity={0.9} />
      ))}
    </>
  );
}

export interface ModelSceneProps {
  parts: PartSpec[];
  explode: number;
  xray?: boolean;
  /** Section view. `true` is the classic lengthwise section. */
  cutaway?: boolean | SectionSpec;
  running?: boolean;
  /** Machine speed while running (1 = normal). */
  rate?: number;
  selectedId?: string | null;
  hoveredId?: string | null;
  pins?: boolean;
  /** Name labels beside the pins. */
  labels?: boolean;
  params?: Record<string, number>;
  setHovered?: (id: string | null) => void;
  select?: (id: string | null, via: 'pin' | 'mesh' | 'list') => void;
  /** The machine's place in the workshop. */
  env?: ModelEnv;
  /** Show the workshop around the machine (needs `env`); otherwise a studio backdrop. */
  workshop?: boolean;
  lang?: 'en' | 'ar';
  /** Show the student (needs `env`). */
  student?: React.RefObject<StudentState | null>;
  /** Extra lights or props, in model space (e.g. the welding arc, scenario props) */
  children?: ReactNode;
}

/** Lights, setting and the parts. Place inside a <Canvas>. */
export function ModelScene({
  parts, explode, xray = false, cutaway = false, running = false, rate = 1, selectedId = null, hoveredId = null, pins = true, labels = false,
  params = {}, setHovered = () => {}, select = () => {}, env, workshop = true, lang = 'en', student, children,
}: ModelSceneProps) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const clock = useRef(0);
  const vr = useXrPresenting();
  const gl = useThree((s) => s.gl);
  const section = useMemo(() => createSection(), []);
  const box = useRef<Rect | null>(null);
  const partsRef = useRef<THREE.Group>(null!);
  const [measured, setMeasured] = useState(0);
  const spec: SectionSpec = cutaway === true ? { mode: 'long' } : cutaway || { mode: 'off' };
  const specKey = `${spec.mode}:${(spec.offset ?? 0).toFixed(3)}:${(spec.angle ?? 0).toFixed(3)}`;
  const ctx: SceneState = { explode, xray, running, selectedId, hoveredId, pins: pins && !vr, labels, params: paramsRef, clock, section, setHovered, select };
  const info = useMemo<SceneInfo>(() => ({ env, box, section }), [env, section]);
  const shop = !!env && workshop;

  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);
  // Measure the assembled machine once: section planes and the student's walking routes use it.
  useLayoutEffect(() => {
    const b = new THREE.Box3().setFromObject(partsRef.current);
    if (b.isEmpty()) return;
    section.box.copy(b);
    box.current = { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
    setMeasured((n) => n + 1);
  }, [section, parts]);
  useEffect(() => { applySection(section, spec); }, [section, specKey, measured]); // eslint-disable-line react-hooks/exhaustive-deps

  const floorY = env?.floorY ?? -1.25;
  const u = env?.unitsPerM ?? 1;
  return (
    <>
      <color attach="background" args={[shop ? '#2b3036' : '#0f1720']} />
      {shop && <fog attach="fog" args={['#2b3036', 16 * u, 40 * u]} />}
      <ShopLighting studio={!shop} />
      <ambientLight intensity={shop ? 0.18 : 0.25} />
      <directionalLight position={[5, 8, 5]} intensity={shop ? 1.6 : 1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-far={40} />
      {!shop && <hemisphereLight args={['#dbe7ff', '#1b2430', 0.6]} />}
      <directionalLight position={[-6, 3, -4]} intensity={0.45} />
      {/* In a headset the machine stands on the floor about two metres in front of you, at bench scale. */}
      <group position={vr ? [0, 0.55, -2.4] : [0, 0, 0]} scale={vr ? 0.42 : 1}>
        <InfoCtx.Provider value={info}>
          <group ref={partsRef}>
            <SceneCtx.Provider value={ctx}>
              {parts.map((p, i) => <ExplodablePart key={p.id} spec={p} index={i} />)}
            </SceneCtx.Provider>
          </group>
          {spec.mode !== 'off' && <SectionOutline box={section.box} spec={spec} key={`${specKey}:${measured}`} />}
          {shop && <Workshop env={env!} lang={lang} box={box.current} key={measured} />}
          {env && student && <Student state={student} env={env} />}
          {children}
        </InfoCtx.Provider>
        <ContactShadows position={[0, floorY + 0.006, 0]} opacity={shop ? 0.55 : 0.45} scale={12 * Math.max(1, u * 0.8)} blur={2.4} far={4 * Math.max(1, u * 0.6)} />
      </group>
      <Clock clock={clock} running={running} rate={rate} />
    </>
  );
}

/** Keep the whole exploded assembly in frame on portrait phones/tablets. */
export function FitToAspect({ base = 1 }: { base?: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.zoom = base * Math.min(1, size.width / size.height / 1.5);
    cam.updateProjectionMatrix();
  }, [camera, size, base]);
  return null;
}

// ---------------------------------------------------------------------------
// The student's camera and walking (explorer and simulator)
// ---------------------------------------------------------------------------
export type StudentView = 'orbit' | 'third' | 'first';

export interface StudentRigProps {
  state: React.RefObject<StudentState | null>;
  view: StudentView;
  /** Walk to this station (change `n` to send them again). */
  go?: { id: string; n: number } | null;
  onArrive?: (id: string) => void;
  /** Keys held (WASD/arrows), for walking freely. */
  keys?: React.RefObject<Set<string>>;
  /** In third person, keep the camera on this side of the work (radians added to the student's heading). */
  orbitBias?: number;
  /** Third-person distance in metres. */
  distance?: number;
}

/** Walks the student and, in third or first person, drives the camera from them. Place inside a ModelScene. */
export function StudentRig({ state, view, go, onArrive, keys, orbitBias = 0.5, distance = 3.1 }: StudentRigProps) {
  const { env, box } = useSceneInfo();
  const { camera, gl, controls } = useThree();
  const walker = useRef<Walker | null>(null);
  const look = useRef({ yaw: 0, pitch: -0.18, dragged: false, dist: distance });
  const arrivedRef = useRef<string | null>(null);
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fwd: new THREE.Vector3() }), []);
  const onArriveRef = useRef(onArrive); onArriveRef.current = onArrive;

  useEffect(() => {
    const s = state.current;
    if (!s || !env) return;
    walker.current = new Walker(s, env, () => box.current);
    look.current.yaw = s.yaw;
  }, [state, env, box]);

  useEffect(() => {
    if (!go || !env || !walker.current) return;
    const st = env.stations.find((x) => x.id === go.id);
    if (!st) return;
    arrivedRef.current = null;
    walker.current.go(st);
    look.current.dragged = false;
  }, [go, env]);

  // Drag to look, wheel to change the third-person distance.
  useEffect(() => {
    if (view === 'orbit') return;
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = { x: e.clientX, y: e.clientY };
      look.current.yaw -= dx * 0.006;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - dy * 0.005, -1.1, 0.7);
      look.current.dragged = true;
    };
    const pu = () => { down = null; };
    const wheel = (e: WheelEvent) => { if (view === 'third') { e.preventDefault(); look.current.dist = THREE.MathUtils.clamp(look.current.dist + e.deltaY * 0.004, 1.6, 7); } };
    el.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); el.removeEventListener('wheel', wheel); };
  }, [view, gl]);

  useEffect(() => {
    const oc = controls as unknown as OrbitImpl | null;
    if (oc) oc.enabled = view === 'orbit';
    const s = state.current;
    if (s) s.firstPerson = view === 'first';
    if (s && view !== 'orbit') { look.current.yaw = s.yaw; look.current.pitch = view === 'first' ? -0.3 : -0.18; look.current.dragged = false; }
  }, [view, controls, state]);

  useFrame((_, rawDt) => {
    const s = state.current;
    const w = walker.current;
    if (!s || !env || !w) return;
    const dt = Math.min(rawDt, 0.1);
    const u = env.unitsPerM;

    // Free walking with the keys (relative to where the camera looks).
    const k = keys?.current;
    let mx = 0, mz = 0;
    if (k && k.size && view !== 'orbit') {
      if (k.has('w') || k.has('arrowup')) mz += 1;
      if (k.has('s') || k.has('arrowdown')) mz -= 1;
      if (k.has('a') || k.has('arrowleft')) mx += 1;
      if (k.has('d') || k.has('arrowright')) mx -= 1;
    }
    if (mx || mz) {
      w.target = null; w.arrived = true;
      const yaw = look.current.yaw;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const len = Math.hypot(mx, mz);
      const vx = (fx * mz + fz * mx) / len, vz = (fz * mz - fx * mx) / len;
      const step = 1.4 * u * dt;
      const nx = s.pos.x + vx * step, nz = s.pos.z + vz * step;
      const b = box.current, m = 0.3 * u;
      const inside = (x: number, z: number) => !!b && x > b.minX - m && x < b.maxX + m && z > b.minZ - m && z < b.maxZ + m;
      const lim = (v: number, h: number) => THREE.MathUtils.clamp(v, -h * u, h * u);
      if (!inside(nx, nz)) s.pos.set(lim(nx, 12), 0, lim(nz, 10));
      else if (!inside(nx, s.pos.z)) s.pos.x = lim(nx, 12);
      else if (!inside(s.pos.x, nz)) s.pos.z = lim(nz, 10);
      const heading = Math.atan2(vx, vz);
      s.yaw += angleTo(s.yaw, view === 'first' ? yaw : heading) * Math.min(1, dt * 10);
      s.speed = 1.4; s.pose = 'walk'; s.reach = null;
    } else {
      if (!w.target && s.speed > 0) { s.speed = 0; s.pose = 'idle'; }
      w.step(dt);
      if (w.arrived && w.target && arrivedRef.current !== w.target.id) {
        arrivedRef.current = w.target.id;
        onArriveRef.current?.(w.target.id);
      }
    }

    if (view === 'orbit') return;
    // While walking, the view swings round behind the student unless the learner is looking around.
    if (!look.current.dragged || s.speed > 0.05) look.current.yaw += angleTo(look.current.yaw, s.yaw + (view === 'third' && s.speed < 0.05 ? orbitBias : 0)) * Math.min(1, dt * (s.speed > 0.05 ? 3 : 1.6));
    const yaw = look.current.yaw, pitch = look.current.pitch;
    const floor = env.floorY ?? -1.25;
    const cam = camera as THREE.PerspectiveCamera;
    if (view === 'first') {
      tmp.fwd.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      tmp.pos.set(s.pos.x + Math.sin(s.yaw) * 0.09 * u, floor + STUDENT_EYE * u, s.pos.z + Math.cos(s.yaw) * 0.09 * u);
      // When working at a station, look at the work.
      if (!look.current.dragged && s.reach && s.speed < 0.05) {
        const want = s.reach.clone().sub(tmp.pos);
        look.current.yaw += angleTo(look.current.yaw, Math.atan2(want.x, want.z)) * Math.min(1, dt * 3);
        look.current.pitch += (Math.atan2(want.y, Math.hypot(want.x, want.z)) - look.current.pitch) * Math.min(1, dt * 3);
      }
      cam.position.lerp(tmp.pos, 1 - Math.exp(-18 * dt));
      cam.lookAt(tmp.tgt.copy(cam.position).add(tmp.fwd));
    } else {
      const d = look.current.dist * u;
      const chest = tmp.tgt.set(s.pos.x, floor + 1.35 * u, s.pos.z);
      tmp.pos.set(
        s.pos.x - Math.sin(yaw) * d * Math.cos(pitch * 0.8) + Math.cos(yaw) * 0.35 * u,
        floor + 1.35 * u - Math.sin(pitch) * d + 0.5 * u,
        s.pos.z - Math.cos(yaw) * d * Math.cos(pitch * 0.8) - Math.sin(yaw) * 0.35 * u,
      );
      tmp.pos.y = Math.max(tmp.pos.y, floor + 0.4 * u);
      cam.position.lerp(tmp.pos, 1 - Math.exp(-6 * dt));
      const focus = s.reach && s.speed < 0.05 ? chest.clone().lerp(s.reach, 0.5) : chest.addScaledVector(new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw)), 0.6 * u);
      cam.lookAt(focus);
    }
  });
  return null;
}

/** Tracks the WASD / arrow keys and the on-screen pad while `on`. */
export function useWalkKeys(on: boolean) {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    if (!on) { keys.current.clear(); return; }
    const ok = (e: KeyboardEvent) => !(e.target as HTMLElement)?.closest?.('input, select, textarea') && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase());
    const kd = (e: KeyboardEvent) => { if (ok(e)) { keys.current.add(e.key.toLowerCase()); e.preventDefault(); } };
    const ku = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, [on]);
  return keys;
}

/** On-screen walking pad for touch screens. */
export function WalkPad({ keys }: { keys: React.RefObject<Set<string>> }) {
  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); keys.current.add(k); },
    onPointerUp: () => keys.current.delete(k), onPointerLeave: () => keys.current.delete(k), onPointerCancel: () => keys.current.delete(k),
  });
  return (
    <div className="mx-pad" dir="ltr" aria-hidden="true">
      <button type="button" className="up" {...hold('w')}>▲</button>
      <button type="button" className="lt" {...hold('a')}>◀</button>
      <button type="button" className="rt" {...hold('d')}>▶</button>
      <button type="button" className="dn" {...hold('s')}>▼</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------
type Preset = 'iso' | 'front' | 'side' | 'top';
function presetPose(view: ModelView, p: Preset): { pos: THREE.Vector3; tgt: THREE.Vector3 } {
  const tgt = new THREE.Vector3(...view.target);
  const d = new THREE.Vector3(...view.camera).distanceTo(tgt);
  const pos = p === 'iso' ? new THREE.Vector3(...view.camera)
    : p === 'front' ? tgt.clone().add(new THREE.Vector3(0, d * 0.18, d))
      : p === 'side' ? tgt.clone().add(new THREE.Vector3(d, d * 0.18, 0))
        : tgt.clone().add(new THREE.Vector3(0, d, 0.01));
  return { pos, tgt };
}

function CameraTween({ to }: { to: { pos: THREE.Vector3; tgt: THREE.Vector3; n: number } | null }) {
  const { camera, controls } = useThree();
  const left = useRef(0);
  useEffect(() => { if (to) left.current = 1.1; }, [to]);
  useFrame((_, dt) => {
    if (!to || left.current <= 0) return;
    left.current -= dt;
    const k = 1 - Math.exp(-6 * dt);
    camera.position.lerp(to.pos, k);
    const oc = controls as unknown as OrbitImpl | null;
    if (oc) { oc.target.lerp(to.tgt, k); oc.update(); } else camera.lookAt(to.tgt);
  });
  return null;
}

// ---------------------------------------------------------------------------
// VR: immersive WebXR on a headset, stereo split-screen elsewhere
// ---------------------------------------------------------------------------
type VrMode = 'off' | 'immersive' | 'stereo';

function useXrPresenting() {
  const gl = useThree((s) => s.gl);
  const [on, setOn] = useState(gl.xr.isPresenting);
  useEffect(() => {
    const start = () => setOn(true);
    const end = () => setOn(false);
    gl.xr.addEventListener('sessionstart', start);
    gl.xr.addEventListener('sessionend', end);
    return () => { gl.xr.removeEventListener('sessionstart', start); gl.xr.removeEventListener('sessionend', end); };
  }, [gl]);
  return on;
}

/** Whether this browser can open an immersive VR session (a headset browser, or a desktop with a headset attached). */
export function useImmersiveVrSupported() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    xr?.isSessionSupported('immersive-vr').then(setOk).catch(() => setOk(false));
  }, []);
  return ok;
}

/** Inside the Canvas: opens the XR session, or renders side-by-side stereo. */
function VrDriver({ mode, onEnd }: { mode: VrMode; onEnd: () => void }) {
  const { gl, scene, camera, size } = useThree();
  const effect = useMemo(() => new StereoEffect(gl), [gl]);
  useEffect(() => { effect.setSize(size.width, size.height); }, [effect, size]);

  useEffect(() => {
    if (mode !== 'immersive') return;
    gl.xr.enabled = true;
    let session: XRSession | null = null;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    xr?.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }).then(async (s) => {
      session = s;
      s.addEventListener('end', onEnd);
      await gl.xr.setSession(s);
    }).catch(onEnd);
    return () => { void session?.end().catch(() => {}); };
  }, [mode, gl, onEnd]);

  // Rendering with priority 1 takes over from R3F's own render while stereo is on.
  useFrame(() => { if (mode === 'stereo') effect.render(scene, camera); }, mode === 'stereo' ? 1 : 0);
  useEffect(() => {
    if (mode !== 'stereo') return;
    return () => { gl.setScissorTest(false); gl.setViewport(0, 0, size.width, size.height); };
  }, [mode, gl, size]);
  return null;
}

export function VrButton({ mode, setMode, strings, onChange }: {
  mode: VrMode; setMode: (m: VrMode) => void; strings: ExplorerStrings; onChange?: (on: boolean, kind: VrMode) => void;
}) {
  const immersive = useImmersiveVrSupported();
  const on = mode !== 'off';
  return (
    <button type="button" className="mx-vr" aria-pressed={on}
      title={immersive ? strings.vrHeadset : strings.vrStereoNote}
      onClick={() => {
        const next: VrMode = on ? 'off' : immersive ? 'immersive' : 'stereo';
        setMode(next);
        onChange?.(next !== 'off', next);
      }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 8h18v8h-5l-2-3h-4l-2 3H3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="8" cy="11.5" r="1.4" fill="currentColor" /><circle cx="16" cy="11.5" r="1.4" fill="currentColor" /></svg>
      {on ? strings.vrExit : strings.vr}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MachineExplorer({ title, assetTag, parts, onEvent, height = 560, strings, lang = 'en', view = DEFAULT_VIEW, env, toolbar, params, runParams, active = true }: MachineExplorerProps) {
  const t = { ...explorerStrings(lang), ...strings } as Required<ExplorerStrings>;
  const [explode, setExplode] = useState(0);
  const [xray, setXray] = useState(false);
  const [cut, setCut] = useState<SectionSpec>({ mode: 'off', offset: 0, angle: 0 });
  const [running, setRunning] = useState(false);
  const [vr, setVr] = useState<VrMode>('off');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHovered] = useState<string | null>(null);
  const [shop, setShop] = useState(true);
  const [labels, setLabels] = useState(true);
  const [sview, setSview] = useState<StudentView | 'off'>('off');
  const [go, setGo] = useState<{ id: string; n: number } | null>(null);
  const [preset, setPreset] = useState<{ pos: THREE.Vector3; tgt: THREE.Vector3; n: number } | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const student = useRef<StudentState | null>(null);
  if (!student.current && env) student.current = newStudent(env, tradePpe(env.bay));
  if (student.current) student.current.visible = sview !== 'off';
  const keys = useWalkKeys(active && (sview === 'third' || sview === 'first'));
  const animRef = useRef<number | null>(null);

  const emit = useRef(onEvent);
  emit.current = onEvent;

  // Debounce slider telemetry: one 'exploded' event once the learner settles.
  const explodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const firstExplode = useRef(true);
  useEffect(() => {
    if (firstExplode.current) { firstExplode.current = false; return; }
    clearTimeout(explodeTimer.current);
    explodeTimer.current = setTimeout(
      () => emit.current?.({ verb: 'exploded', value: { factor: Math.round(explode * 100) / 100 } }), 400);
    return () => clearTimeout(explodeTimer.current);
  }, [explode]);

  const select = useCallback((id: string | null, via: 'pin' | 'mesh' | 'list') => {
    setSelectedId((prev) => (prev === id ? null : id));
    if (id) emit.current?.({ verb: via === 'pin' ? 'hotspot_viewed' : 'part_selected', objectRef: id, value: { via } });
  }, []);

  const toggle = (mode: string, on: boolean | string, set?: () => void) => {
    set?.();
    emit.current?.({ verb: 'view_mode_changed', value: { mode, on } });
  };

  /** Animate the slider to 0 or 1 (Assemble / Explode buttons). */
  const animateTo = (to: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const from = explode;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1400);
      setExplode(from + (to - from) * k);
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);
  const endVr = useCallback(() => setVr('off'), []);
  const goPreset = (p: Preset) => {
    if (sview === 'third' || sview === 'first') setSview('orbit');
    setPreset({ ...presetPose(view, p), n: Date.now() });
    toggle('camera', p);
  };
  const walk = (st: StationDef) => {
    if (sview === 'off') setSview('third');
    setGo({ id: st.id, n: Date.now() });
    setAt(st.id);
    emit.current?.({ verb: 'student_moved', objectRef: `station:${st.id}` });
  };

  const selected = parts.find((p) => p.id === selectedId) ?? null;
  const cutLabel: Record<CutMode, string> = { off: t.cutOff, long: t.cutLong, cross: t.cutCross, plan: t.cutPlan, quarter: t.cutQuarter };
  const walking = sview === 'third' || sview === 'first';

  return (
    <div className={`mx-root ${vr === 'stereo' ? 'is-stereo' : ''}`} style={{ height }}>
      <div className="mx-stage">
        <Canvas shadows="soft" camera={{ position: view.camera, fov: 40, near: 0.05, far: 400 }} dpr={[1, 2]} frameloop={active || vr !== 'off' ? 'always' : 'never'}
          onCreated={({ gl }) => { gl.xr.enabled = true; }}
          onPointerMissed={() => setSelectedId(null)}>
          <ModelScene parts={parts} explode={explode} xray={xray} cutaway={cut} running={running}
            params={running ? { ...params, ...runParams } : params} env={env} workshop={shop} lang={lang}
            student={env ? student : undefined}
            selectedId={selectedId} hoveredId={hoveredId} setHovered={setHovered} select={select} labels={labels}>
            {env && <StudentRig state={student} view={walking ? sview : 'orbit'} go={go} keys={keys} />}
          </ModelScene>
          <FitToAspect />
          <CameraTween to={preset} />
          <VrDriver mode={vr} onEnd={endVr} />
          <OrbitControls makeDefault enableDamping minDistance={1.2} maxDistance={env ? Math.min(16, 9 * env.unitsPerM) : 14} target={view.target} />
        </Canvas>

        <header className="mx-header">
          <div>
            <h2>{title}</h2>
            {assetTag && <span className="mx-tag">{t.digitalTwin} · {assetTag}</span>}
          </div>
          <div className="mx-modes" role="group" aria-label={t.viewModes}>
            {toolbar}
            <button aria-pressed={xray} onClick={() => toggle('xray', !xray, () => setXray(!xray))}>{t.xray}</button>
            <button aria-pressed={cut.mode !== 'off'} onClick={() => toggle('section', cut.mode === 'off' ? 'long' : 'off', () => setCut((c) => ({ ...c, mode: c.mode === 'off' ? 'long' : 'off' })))}>{t.cutaway}</button>
            <button aria-pressed={running} onClick={() => toggle('kinetic', !running, () => setRunning(!running))}>
              {running ? t.stop : t.run}
            </button>
            <VrButton mode={vr} setMode={setVr} strings={t} onChange={(on) => toggle('vr', on)} />
          </div>
        </header>

        <div className="mx-dock" role="toolbar" aria-label={t.views}>
          <div className="mx-seg" role="group" aria-label={t.views}>
            {(['iso', 'front', 'side', 'top'] as Preset[]).map((p) => (
              <button key={p} type="button" onClick={() => goPreset(p)}>{({ iso: t.viewIso, front: t.viewFront, side: t.viewSide, top: t.viewTop })[p]}</button>
            ))}
          </div>
          <div className="mx-seg">
            <button type="button" aria-pressed={labels} onClick={() => { setLabels(!labels); toggle('labels', labels ? 'off' : 'on'); }}>🏷 {t.labels}</button>
          </div>
          {env && (
            <>
              <div className="mx-seg" role="radiogroup" aria-label={t.workshop}>
                <button type="button" role="radio" aria-checked={shop} onClick={() => { setShop(true); toggle('scene', 'workshop'); }}>{t.workshop}</button>
                <button type="button" role="radio" aria-checked={!shop} onClick={() => { setShop(false); toggle('scene', 'studio'); }}>{t.studio}</button>
              </div>
              <div className="mx-seg" role="radiogroup" aria-label={t.student}>
                <span className="mx-seg-label">{t.student}</span>
                {(['off', 'third', 'first'] as const).map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={sview === v}
                    onClick={() => { setSview(v); toggle('student', v); }}>
                    {v === 'off' ? t.studentOff : v === 'third' ? t.third : t.first}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {cut.mode !== 'off' && (
          <div className="mx-cutbar">
            <div className="mx-seg" role="radiogroup" aria-label={t.section}>
              {CUT_MODES.filter((m) => m !== 'off').map((m) => (
                <button key={m} type="button" role="radio" aria-checked={cut.mode === m} onClick={() => { setCut((c) => ({ ...c, mode: m })); toggle('section', m); }}>{cutLabel[m]}</button>
              ))}
            </div>
            <label>{t.cutOffset}<input type="range" min={-0.9} max={0.9} step={0.01} value={cut.offset ?? 0} onChange={(e) => setCut((c) => ({ ...c, offset: Number(e.target.value) }))} /></label>
            {(cut.mode === 'long' || cut.mode === 'cross') && (
              <label>{t.cutAngle} <b dir="ltr">{Math.round(((cut.angle ?? 0) * 180) / Math.PI)}°</b>
                <input type="range" min={-Math.PI / 3} max={Math.PI / 3} step={0.01} value={cut.angle ?? 0} onChange={(e) => setCut((c) => ({ ...c, angle: Number(e.target.value) }))} /></label>
            )}
            <small>{t.sectionHint}</small>
          </div>
        )}

        {env && sview !== 'off' && (
          <div className="mx-walk">
            <span>{t.walkTo}</span>
            {env.stations.map((st) => (
              <button key={st.id} type="button" aria-pressed={at === st.id} onClick={() => walk(st)}>{st.label[lang]}</button>
            ))}
            {walking && <small>{t.keysHint}</small>}
          </div>
        )}
        {walking && <WalkPad keys={keys} />}
        {vr === 'stereo' && <p className="mx-vr-note" role="status">{t.vrStereoNote}</p>}

        <footer className="mx-controls">
          <button onClick={() => animateTo(0)}>{t.assemble}</button>
          <label className="mx-slider">
            <span>{t.explodedView} <b>{Math.round(explode * 100)}%</b></span>
            <input type="range" min={0} max={1} step={0.005} value={explode}
              onChange={(e) => {
                if (animRef.current) cancelAnimationFrame(animRef.current);
                setExplode(Number(e.target.value));
              }} />
          </label>
          <button onClick={() => animateTo(1)}>{t.explode}</button>
        </footer>
      </div>

      <aside className="mx-panel" aria-live="polite">
        {selected ? (
          <div className="mx-card">
            <p className="mx-eyebrow">{t.component} {parts.indexOf(selected) + 1} · {selected.name}</p>
            <h3>{selected.hotspot?.title ?? selected.name}</h3>
            {selected.brief && (
              <div className="mx-brief">
                <h4>{t.whatItIs}</h4><p>{selected.brief.what}</p>
                <h4>{t.whatItDoes}</h4><p>{selected.brief.does}</p>
              </div>
            )}
            {selected.hotspot && Object.keys(selected.hotspot.specs).length > 0 && (
              <>
                <h4 className="mx-spec-h">{t.specs}</h4>
                <dl>
                  {Object.entries(selected.hotspot.specs).map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </>
            )}
            {selected.hotspot?.safety && <p className="mx-safety">⚠ {selected.hotspot.safety}</p>}
            {selected.hotspot?.docUrl && <a href={selected.hotspot.docUrl} target="_blank" rel="noreferrer">{t.datasheet}</a>}
            <LockerButton lang={lang} className="mx-save" drop={{ kind: 'part', title: { en: selected.name, ar: selected.name },
              body: selected.brief ? `${selected.brief.what}\n${selected.brief.does}` : undefined, ref: { asset: assetTag ?? title, part: selected.id } }} />
          </div>
        ) : (
          <p className="mx-hint">{t.hint}</p>
        )}
        <ol className="mx-parts">
          {parts.map((p, i) => (
            <li key={p.id}>
              <button aria-current={p.id === selectedId} onClick={() => select(p.id, 'list')}
                onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}>
                <span className="mx-num">{i + 1}</span>{p.name}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
