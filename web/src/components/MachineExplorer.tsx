/**
 * MachineExplorer — interactive 3D equipment explorer for the VLMS.
 *
 * Features
 *   • Exploded view driven by a slider (or animated), with per-part staging so
 *     parts come off in a realistic disassembly order.
 *   • Hotspot pins anchored to parts (they travel with the part) that open a
 *     spec / safety card: torque values, part numbers, MSDS links.
 *   • X-ray mode (everything translucent except the selected part),
 *     cross-section cutaway (clipping plane), and a kinetic "run" mode that
 *     spins rotating parts.
 *   • Emits xAPI-shaped telemetry (`onEvent`) using the same verb/objectRef/value
 *     shape the V-Lab telemetry endpoint accepts.
 *
 * Model-agnostic: each <part> renders whatever children you give it, so a glTF
 * digital twin plugs in as `{ render: () => <primitive object={nodes.Fan} /> }`.
 */
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import * as THREE from 'three';
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

export interface PartSpec {
  id: string;
  name: string;
  /** Offset from the assembled position at 100% explosion. */
  explode: Vec3;
  /** 0..1 — point on the slider where this part starts moving (disassembly order). */
  stage?: number;
  /** Rotates about this local axis in kinetic mode (rad/s). */
  spin?: { axis: 'x' | 'y' | 'z'; speed: number };
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
}
const EN: ExplorerStrings = {
  digitalTwin: 'Digital twin', viewModes: 'View modes', xray: 'X-ray', cutaway: 'Cutaway', run: 'Run', stop: 'Stop',
  assemble: 'Assemble', explode: 'Explode', explodedView: 'Exploded view', component: 'Component',
  datasheet: 'Open datasheet →', hint: 'Tap a numbered pin or a part to see its specification.',
};

export interface MachineExplorerProps {
  title: string;
  strings?: Partial<ExplorerStrings>;
  assetTag?: string;
  parts: PartSpec[];
  onEvent?: (e: ExplorerEvent) => void;
  height?: number | string;
}

// ---------------------------------------------------------------------------
// Internal state shared with parts in the scene graph
// ---------------------------------------------------------------------------
interface SceneState {
  explode: number;
  xray: boolean;
  running: boolean;
  selectedId: string | null;
  hoveredId: string | null;
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

// ---------------------------------------------------------------------------
// A single explodable part
// ---------------------------------------------------------------------------
function ExplodablePart({ spec, index }: { spec: PartSpec; index: number }) {
  const { explode, xray, running, selectedId, hoveredId, setHovered, select } = useScene();
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
  });

  // Material treatment for selection / hover / X-ray. Original values are
  // stashed in userData so toggling back is lossless.
  useLayoutEffect(() => {
    inner.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
      for (const m of mats) {
        if (!m.userData.orig) m.userData.orig = { emissive: m.emissive?.clone(), opacity: m.opacity, transparent: m.transparent };
        const translucent = xray && !selected;
        m.transparent = translucent || m.userData.orig.transparent;
        m.opacity = translucent ? 0.16 : m.userData.orig.opacity;
        m.depthWrite = !translucent;
        if (m.emissive) {
          m.emissive.copy(selected ? HIGHLIGHT : hovered ? HOVER : m.userData.orig.emissive);
          m.emissiveIntensity = selected ? 0.28 : hovered ? 0.22 : 1;
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
      {spec.hotspot && (
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

/** Keep the whole exploded assembly in frame on portrait phones/tablets. */
function FitToAspect() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.zoom = Math.min(1, size.width / size.height / 1.5);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MachineExplorer({ title, assetTag, parts, onEvent, height = 560, strings }: MachineExplorerProps) {
  const t = { ...EN, ...strings };
  const [explode, setExplode] = useState(0);
  const [xray, setXray] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHovered] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);

  const emit = useRef(onEvent);
  emit.current = onEvent;

  // Debounce slider telemetry: one 'exploded' event once the learner settles.
  const explodeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(explodeTimer.current);
    explodeTimer.current = setTimeout(
      () => emit.current?.({ verb: 'exploded', value: { factor: Math.round(explode * 100) / 100 } }), 400);
    return () => clearTimeout(explodeTimer.current);
  }, [explode]);

  const select = useCallback((id: string | null, via: 'pin' | 'mesh' | 'list') => {
    setSelectedId((prev) => (prev === id ? null : id));
    if (id) emit.current?.({ verb: via === 'pin' ? 'hotspot_viewed' : 'part_selected', objectRef: id, value: { via } });
  }, []);

  const toggle = (mode: 'xray' | 'cutaway' | 'kinetic', on: boolean, set: (b: boolean) => void) => {
    set(on);
    emit.current?.({ verb: 'view_mode_changed', value: { mode, on } });
  };

  /** Animate the slider to 0 or 1 (Assemble / Explode buttons). */
  const animateTo = (to: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const from = explode;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 1400);
      setExplode(from + (to - from) * t);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  const selected = parts.find((p) => p.id === selectedId) ?? null;
  const ctx: SceneState = { explode, xray, running, selectedId, hoveredId, setHovered, select };

  return (
    <div className="mx-root" style={{ height }}>
      <div className="mx-stage">
        <Canvas shadows camera={{ position: [5.2, 3.2, 6.6], fov: 40 }} dpr={[1, 2]}
          onPointerMissed={() => setSelectedId(null)}>
          <color attach="background" args={['#0f1720']} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
          <hemisphereLight args={['#dbe7ff', '#1b2430', 0.9]} />
          <directionalLight position={[-6, 3, -4]} intensity={0.5} />
          <SceneCtx.Provider value={ctx}>
            {parts.map((p, i) => <ExplodablePart key={p.id} spec={p} index={i} />)}
          </SceneCtx.Provider>
          <CutawayPlane enabled={cutaway} />
          <FitToAspect />
          <ContactShadows position={[0, -1.25, 0]} opacity={0.45} scale={12} blur={2.4} far={4} />
          <OrbitControls makeDefault enableDamping minDistance={2.5} maxDistance={14} target={[0, 0.7, 0]} />
        </Canvas>

        <header className="mx-header">
          <div>
            <h2>{title}</h2>
            {assetTag && <span className="mx-tag">{t.digitalTwin} · {assetTag}</span>}
          </div>
          <div className="mx-modes" role="group" aria-label={t.viewModes}>
            <button aria-pressed={xray} onClick={() => toggle('xray', !xray, setXray)}>{t.xray}</button>
            <button aria-pressed={cutaway} onClick={() => toggle('cutaway', !cutaway, setCutaway)}>{t.cutaway}</button>
            <button aria-pressed={running} onClick={() => toggle('kinetic', !running, setRunning)}>
              {running ? t.stop : t.run}
            </button>
          </div>
        </header>

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
