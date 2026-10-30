/**
 * Building blocks for the procedural digital twins (lathe, engine, MIG set,
 * starter panel). Units ≈ decimetres; the floor is at y = −1.25.
 *
 * Each model exports bilingual part definitions (`BiPart`) that `localize`
 * turns into the explorer's `PartSpec`s, so one file holds both languages.
 * In production a part's `render` returns a node from the asset's glTF.
 */
import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BRIEFS } from './briefs';
import { brushedTex, castTex, noiseTex, plateTex, signTex, type Pictogram, type PlateOpts, type SignKind } from './textures';
import type { AnimateState, PartSpec, Vec3 } from '../components/MachineExplorer';

export interface Txt { en: string; ar: string }
export const tx = (en: string, ar: string): Txt => ({ en, ar });

export interface BiPart {
  id: string;
  name: Txt;
  explode: Vec3;
  stage?: number;
  spin?: PartSpec['spin'];
  animate?: PartSpec['animate'];
  hotspot?: { position: Vec3; title: Txt; specs: [Txt, string | Txt][]; safety?: Txt };
  render: () => ReactNode;
}

/** A complete twin: its parts plus where the camera starts. */
export interface ModelDef {
  id: string;
  title: Txt;
  assetTag: string;
  parts: BiPart[];
  /** A model with its own translation table supplies ready-made specs instead. */
  specs?: (lang: 'en' | 'ar') => PartSpec[];
  view?: { camera: Vec3; target: Vec3 };
  /** Params while exploring (e.g. the panel door open, the weld bead finished). */
  params?: Record<string, number>;
  /** Params while the machine runs in the explorer (arc on, contactor in…). */
  runParams?: Record<string, number>;
  /** How the machine stands in the workshop and where the student works at it. */
  env?: ModelEnv;
}

/** What the WABYS student is doing. */
export type Pose = 'idle' | 'walk' | 'reach' | 'operate' | 'inspect' | 'measure' | 'weld' | 'crouch' | 'point' | 'hurt' | 'lift';

/** A place at the machine where the student stands to do something. Floor position in model units. */
export interface StationDef {
  id: string;
  label: Txt;
  /** [x, z] on the floor. */
  pos: [number, number];
  /** Heading in radians: 0 faces +z, π/2 faces +x. */
  face: number;
  pose?: Pose;
  /** Where the right hand goes, in model units. */
  reach?: Vec3;
}

export interface ModelEnv {
  /** Model units per metre, so the workshop and the student are at true scale next to the machine. */
  unitsPerM: number;
  /** Floor height in model units (default −1.25). */
  floorY?: number;
  /** What the machine stands on. */
  stand?: 'floor' | 'bench' | 'engine-stand' | 'wall' | 'skid' | 'trolley';
  /** Which trade's equipment fills the rest of the bay. */
  bay?: 'cnc' | 'auto' | 'elec' | 'weld';
  /** Where the student can go. The first is home; one called 'ppe' puts the PPE station there. */
  stations: StationDef[];
}

/** The model's parts in one language, each with its briefing (what it is, what it does). */
export function modelParts(m: ModelDef, lang: 'en' | 'ar'): PartSpec[] {
  const parts = m.specs?.(lang) ?? localize(m.parts, lang);
  const briefs = BRIEFS[m.id];
  if (!briefs) return parts;
  return parts.map((p) => {
    const b = briefs[p.id];
    return b && !p.brief ? { ...p, brief: { what: b.what[lang], does: b.does[lang] } } : p;
  });
}

export function localize(parts: BiPart[], lang: 'en' | 'ar'): PartSpec[] {
  const p = (t: Txt) => t[lang];
  return parts.map((b) => ({
    id: b.id, name: p(b.name), explode: b.explode, stage: b.stage, spin: b.spin, animate: b.animate, render: b.render,
    hotspot: b.hotspot && {
      position: b.hotspot.position, title: p(b.hotspot.title),
      specs: Object.fromEntries(b.hotspot.specs.map(([k, v]) => [p(k), typeof v === 'string' ? v : p(v)])),
      safety: b.hotspot.safety && p(b.hotspot.safety),
    },
  }));
}

// ---------------------------------------------------------------------------
// Materials and primitives
// ---------------------------------------------------------------------------
/**
 * Surface finish, picked from metalness and roughness unless given:
 *   paint     powder-coated or enamelled steel: clear-coat sheen over a slightly uneven base
 *   machined  ground or turned steel: anisotropic streaks, sharp reflections
 *   metal     cast or forged metal: speckled
 *   matte     plastics, rubber, cable sheaths
 *   glass     guards, lenses, windows
 *   glow      lamps and screens (no texture)
 */
export type Finish = 'paint' | 'machined' | 'metal' | 'matte' | 'glass' | 'glow';
export interface MatProps { color: string; metal?: number; rough?: number; emissive?: string; glow?: number; opacity?: number; finish?: Finish }

export function finishOf({ metal = 0.35, rough = 0.55, opacity, glow = 0, finish }: MatProps): Finish {
  if (finish) return finish;
  if (opacity !== undefined && opacity < 0.6) return 'glass';
  if (glow >= 0.6) return 'glow';
  if (metal >= 0.75) return 'machined';
  if (metal >= 0.5) return 'metal';
  if (rough >= 0.62 || metal <= 0.12) return 'matte';
  return 'paint';
}

export function Mat(props: MatProps) {
  const { color, metal = 0.35, rough = 0.55, emissive, glow = 0, opacity } = props;
  const f = finishOf(props);
  const map = f === 'machined' ? brushedTex() : f === 'metal' ? castTex() : f === 'glass' || f === 'glow' ? null : noiseTex();
  const common = {
    color, side: THREE.DoubleSide, emissive: emissive ?? '#000000', emissiveIntensity: glow,
    transparent: opacity !== undefined, opacity: opacity ?? 1, depthWrite: opacity === undefined,
  };
  if (f === 'paint') {
    return <meshPhysicalMaterial {...common} metalness={Math.min(metal, 0.3)} roughness={Math.max(0.3, rough * 0.9)} roughnessMap={map}
      clearcoat={0.55} clearcoatRoughness={0.28} envMapIntensity={0.9} />;
  }
  if (f === 'glass') {
    return <meshPhysicalMaterial {...common} metalness={0} roughness={0.04} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.6}
      specularIntensity={1} />;
  }
  return <meshStandardMaterial {...common} metalness={metal} roughness={f === 'machined' ? Math.max(0.12, rough) : rough}
    roughnessMap={map} bumpMap={f === 'metal' ? map : null} bumpScale={f === 'metal' ? 0.6 : 0} envMapIntensity={f === 'machined' ? 1.25 : 1} />;
}

type MeshBase = MatProps & { position?: Vec3; rotation?: Vec3; name?: string; shadow?: boolean };

const boxCache = new Map<string, THREE.BufferGeometry>();
/** Boxes get a small bevel (cached per size), so edges catch the light like real sheet metal and castings. */
function boxGeometry([w, h, d]: Vec3, round?: number) {
  const min = Math.min(w, h, d);
  const r = round ?? (min < 0.035 ? 0 : Math.min(0.03, min * 0.14));
  const key = `${w}:${h}:${d}:${r}`;
  let g = boxCache.get(key);
  if (!g) {
    g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
    boxCache.set(key, g);
  }
  return g;
}

export function Box({ size, position = [0, 0, 0], rotation, name, shadow = true, round, ...m }: MeshBase & { size: Vec3; round?: number }) {
  return (
    <mesh name={name} position={position} rotation={rotation} castShadow={shadow} receiveShadow geometry={boxGeometry(size, round)}>
      <Mat {...m} />
    </mesh>
  );
}

/** A flat printed plate (nameplate, rating plate, sticker) facing +z. */
export function Plate({ lines, size, position = [0, 0, 0], rotation, ...o }: PlateOpts & { lines: string[]; size: [number, number]; position?: Vec3; rotation?: Vec3 }) {
  const tex = plateTex(lines, { w: 512, h: Math.round((512 * size[1]) / size[0]), ...o });
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.45} metalness={0.1} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

/** A safety sticker (ISO 7010 style) facing +z. */
export function Sticker({ kind, pic, caption = '', size = 0.16, position = [0, 0, 0], rotation }: {
  kind: SignKind; pic: Pictogram; caption?: string; size?: number; position?: Vec3; rotation?: Vec3;
}) {
  const tex = signTex(kind, pic, caption);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size, size * (340 / 256)]} />
      <meshStandardMaterial map={tex} roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

const AXIS_ROT: Record<'x' | 'y' | 'z', Vec3> = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] };

/** Cylinder whose axis lies along `axis` (default y). */
export function Cyl({ r, r2 = r, len, axis = 'y', position = [0, 0, 0], seg = 32, open = false, name, shadow = true, ...m }:
  MeshBase & { r: number; r2?: number; len: number; axis?: 'x' | 'y' | 'z'; seg?: number; open?: boolean }) {
  return (
    <mesh name={name} position={position} rotation={AXIS_ROT[axis]} castShadow={shadow} receiveShadow>
      <cylinderGeometry args={[r, r2, len, seg, 1, open]} />
      <Mat {...m} />
    </mesh>
  );
}

export function Sphere({ r, position = [0, 0, 0], name, ...m }: MeshBase & { r: number }) {
  return (
    <mesh name={name} position={position} castShadow>
      <sphereGeometry args={[r, 24, 16]} />
      <Mat {...m} />
    </mesh>
  );
}

/** A tube through the given points (hoses, cables, pipes). */
export function Tube({ points, r, seg = 48, ...m }: MatProps & { points: Vec3[]; r: number; seg?: number }) {
  const key = JSON.stringify(points);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, 10, false), [key, r, seg]);
  return (
    <mesh geometry={geo} castShadow>
      <Mat {...m} />
    </mesh>
  );
}

export function Radial({ count, children }: { count: number; children: (angle: number, i: number) => ReactNode }) {
  return <>{Array.from({ length: count }, (_, i) => children((i / count) * Math.PI * 2, i))}</>;
}

/** Look up a named child once and cache it on the group (for animate hooks). */
export function child(g: THREE.Object3D, name: string): THREE.Object3D | undefined {
  const cache = (g.userData.named ??= {}) as Record<string, THREE.Object3D | undefined>;
  if (!(name in cache)) cache[name] = g.getObjectByName(name);
  return cache[name];
}

export const param = (s: AnimateState, key: string, fallback = 0) => s.params[key] ?? fallback;

export const COLORS = {
  steel: '#9aa5b0', darkSteel: '#5b6670', alu: '#c3cbd3', black: '#22262b', rubber: '#1b1d20', copper: '#c27a3a',
  brass: '#c9a54a', red: '#c8312b', green: '#2f9e57', yellow: '#f2c230', orange: '#f06721', blue: '#2f5f93', navy: '#14234c',
  cream: '#e9e4d6', ral7035: '#d5d8d6', glass: '#9fd3ff',
};
