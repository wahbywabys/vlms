'use client';
/**
 * MachineExplorer — interactive 3D equipment explorer for VTC_LMS.
 *
 * Features
 *   • Exploded view driven by a slider (or animated), with per-part staging so
 *     parts come off in a realistic disassembly order.
 *   • Hotspot pins anchored to parts (they travel with the part) that open a
 *     spec / safety card: torque values, part numbers, MSDS links.
 *   • X-ray mode (everything translucent except the selected part),
 *     cross-section cutaway (clipping plane), and a kinetic "run" mode that
 *     spins rotating parts and drives animated ones (pistons, drive rolls…).
 *   • VR: "Enter VR" opens an immersive WebXR session on a headset; on other
 *     devices it switches to a side-by-side stereo view for a phone viewer.
 *   • Emits xAPI-shaped telemetry (`onEvent`) using the same verb/objectRef/value
 *     shape the V-Lab telemetry endpoint accepts.
 *
 * The scene itself (`ModelScene`) is shared with the video-lesson player,
 * which drives the same parts from a timeline instead of from these controls.
 *
 * Model-agnostic: each part renders whatever children you give it, so a glTF
 * digital twin plugs in as `{ render: () => <primitive object={nodes.Fan} /> }`.
 */
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import * as THREE from 'three';
import { StereoEffect } from 'three/examples/jsm/effects/StereoEffect.js';
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
  render: () => ReactNode;
}

export interface ExplorerEvent {
  verb: 'exploded' | 'hotspot_viewed' | 'part_selected' | 'view_mode_changed';
  objectRef?: string;
  value?: Record<string, unknown>;
}

/** UI copy, so the explorer can be localised (e.g. Arabic, with dir="rtl" on an ancestor). */
export interface ExplorerStrings {
  digitalTwin: string; viewModes: string; xray: string; cutaway: string; run: string; stop: string;
  assemble: string; explode: string; explodedView: string; component: string; datasheet: string; hint: string;
  vr: string; vrExit: string; vrStereoNote: string; vrHeadset: string;
}
const EN: ExplorerStrings = {
  digitalTwin: 'Digital twin', viewModes: 'View modes', xray: 'X-ray', cutaway: 'Cutaway', run: 'Run', stop: 'Stop',
  assemble: 'Assemble', explode: 'Explode', explodedView: 'Exploded view', component: 'Component',
  datasheet: 'Open datasheet →', hint: 'Tap a numbered pin or a part to see its specification.',
  vr: 'Enter VR', vrExit: 'Exit VR',
  vrStereoNote: 'No VR headset found, so this is the stereo view: put the phone in a VR viewer (Cardboard-style) and drag to look around.',
  vrHeadset: 'Immersive VR on your headset. Take it off or press Exit VR to come back.',
};

export interface ModelView { camera: Vec3; target: Vec3 }
const DEFAULT_VIEW: ModelView = { camera: [5.2, 3.2, 6.6], target: [0, 0.7, 0] };

export interface MachineExplorerProps {
  title: string;
  strings?: Partial<ExplorerStrings>;
  assetTag?: string;
  parts: PartSpec[];
  view?: ModelView;
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
// Scene shared by the explorer and the lesson player
// ---------------------------------------------------------------------------
interface SceneState {
  explode: number;
  xray: boolean;
  running: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  pins: boolean;
  params: React.RefObject<Record<string, number>>;
  clock: React.RefObject<number>;
  setHovered: (id: string | null) => void;
  select: (id: string | null, via: 'pin' | 'mesh' | 'list') => void;
}
const SceneCtx = createContext<SceneState | null>(null);
const useScene = () => useContext(SceneCtx)!;

const STAGE_SPAN = 0.5; // each part travels over half the slider range
const HIGHLIGHT = new THREE.Color('#ff9f1c');
const HOVER = new THREE.Color('#3aa0ff');

/** Local 0..1 progress for a part given the global slider value. */
function partProgress(explode: number, stage = 0) {
  const t = THREE.MathUtils.clamp((explode - stage) / STAGE_SPAN, 0, 1);
  return t * t * (3 - 2 * t); // smoothstep easing
}

function ExplodablePart({ spec, index }: { spec: PartSpec; index: number }) {
  const { explode, xray, running, selectedId, hoveredId, pins, params, clock, setHovered, select } = useScene();
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const target = useMemo(() => new THREE.Vector3(), []);
  const selected = selectedId === spec.id;
  const hovered = hoveredId === spec.id;

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
  }, [xray, selected, hovered]);

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
      {pins && spec.hotspot && (
        <Html position={spec.hotspot.position} center zIndexRange={[20, 0]}>
          <button
            className={`mx-pin${selected ? ' is-active' : ''}`}
            aria-label={`Hotspot ${index + 1}: ${spec.hotspot.title}`}
            onClick={(e) => { e.stopPropagation(); select(spec.id, 'pin'); }}
          >
            {index + 1}
          </button>
        </Html>
      )}
    </group>
  );
}

/** Cross-section cutaway: a global clipping plane through the machine's mid-plane. */
function CutawayPlane({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.clippingPlanes = enabled ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)] : [];
    return () => void (gl.clippingPlanes = []);
  }, [gl, enabled]);
  return null;
}

/** Advances the machine clock while it runs (pistons, spools, the arc…). */
function Clock({ clock, running, rate = 1 }: { clock: React.RefObject<number>; running: boolean; rate?: number }) {
  useFrame((_, dt) => { if (running) clock.current += Math.min(dt, 0.1) * rate; });
  return null;
}

export interface ModelSceneProps {
  parts: PartSpec[];
  explode: number;
  xray?: boolean;
  cutaway?: boolean;
  running?: boolean;
  /** Machine speed while running (1 = normal). */
  rate?: number;
  selectedId?: string | null;
  hoveredId?: string | null;
  pins?: boolean;
  params?: Record<string, number>;
  setHovered?: (id: string | null) => void;
  select?: (id: string | null, via: 'pin' | 'mesh' | 'list') => void;
  /** Extra lights or props (e.g. the welding arc) */
  children?: ReactNode;
}

/** Lights, floor shadow and the parts. Place inside a <Canvas>. */
export function ModelScene({
  parts, explode, xray = false, cutaway = false, running = false, rate = 1, selectedId = null, hoveredId = null, pins = true,
  params = {}, setHovered = () => {}, select = () => {}, children,
}: ModelSceneProps) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const clock = useRef(0);
  const vr = useXrPresenting();
  const ctx: SceneState = { explode, xray, running, selectedId, hoveredId, pins: pins && !vr, params: paramsRef, clock, setHovered, select };
  return (
    <>
      <color attach="background" args={['#0f1720']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} />
      <hemisphereLight args={['#dbe7ff', '#1b2430', 0.9]} />
      <directionalLight position={[-6, 3, -4]} intensity={0.5} />
      {/* In a headset the machine stands on the floor about two metres in front of you, at bench scale. */}
      <group position={vr ? [0, 0.55, -2.4] : [0, 0, 0]} scale={vr ? 0.42 : 1}>
        <SceneCtx.Provider value={ctx}>
          {parts.map((p, i) => <ExplodablePart key={p.id} spec={p} index={i} />)}
        </SceneCtx.Provider>
        {children}
        <ContactShadows position={[0, -1.25, 0]} opacity={0.45} scale={12} blur={2.4} far={4} />
      </group>
      <Clock clock={clock} running={running} rate={rate} />
      <CutawayPlane enabled={cutaway} />
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
export function MachineExplorer({ title, assetTag, parts, onEvent, height = 560, strings, view = DEFAULT_VIEW, toolbar, params, runParams, active = true }: MachineExplorerProps) {
  const t = { ...EN, ...strings };
  const [explode, setExplode] = useState(0);
  const [xray, setXray] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [running, setRunning] = useState(false);
  const [vr, setVr] = useState<VrMode>('off');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHovered] = useState<string | null>(null);
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

  const toggle = (mode: 'xray' | 'cutaway' | 'kinetic' | 'vr', on: boolean, set?: (b: boolean) => void) => {
    set?.(on);
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

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  return (
    <div className={`mx-root ${vr === 'stereo' ? 'is-stereo' : ''}`} style={{ height }}>
      <div className="mx-stage">
        <Canvas shadows camera={{ position: view.camera, fov: 40 }} dpr={[1, 2]} frameloop={active || vr !== 'off' ? 'always' : 'never'}
          onCreated={({ gl }) => { gl.xr.enabled = true; }}
          onPointerMissed={() => setSelectedId(null)}>
          <ModelScene parts={parts} explode={explode} xray={xray} cutaway={cutaway} running={running}
            params={running ? { ...params, ...runParams } : params}
            selectedId={selectedId} hoveredId={hoveredId} setHovered={setHovered} select={select} />
          <FitToAspect />
          <VrDriver mode={vr} onEnd={endVr} />
          <OrbitControls makeDefault enableDamping minDistance={2.5} maxDistance={14} target={view.target} />
        </Canvas>

        <header className="mx-header">
          <div>
            <h2>{title}</h2>
            {assetTag && <span className="mx-tag">{t.digitalTwin} · {assetTag}</span>}
          </div>
          <div className="mx-modes" role="group" aria-label={t.viewModes}>
            {toolbar}
            <button aria-pressed={xray} onClick={() => toggle('xray', !xray, setXray)}>{t.xray}</button>
            <button aria-pressed={cutaway} onClick={() => toggle('cutaway', !cutaway, setCutaway)}>{t.cutaway}</button>
            <button aria-pressed={running} onClick={() => toggle('kinetic', !running, setRunning)}>
              {running ? t.stop : t.run}
            </button>
            <VrButton mode={vr} setMode={setVr} strings={t} onChange={(on) => toggle('vr', on)} />
          </div>
        </header>
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
        {selected?.hotspot ? (
          <div className="mx-card">
            <p className="mx-eyebrow">{t.component} {parts.indexOf(selected) + 1}</p>
            <h3>{selected.hotspot.title}</h3>
            <dl>
              {Object.entries(selected.hotspot.specs).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            {selected.hotspot.safety && <p className="mx-safety">⚠ {selected.hotspot.safety}</p>}
            {selected.hotspot.docUrl && <a href={selected.hotspot.docUrl} target="_blank" rel="noreferrer">{t.datasheet}</a>}
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
