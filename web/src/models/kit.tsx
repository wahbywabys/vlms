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
}

export const modelParts = (m: ModelDef, lang: 'en' | 'ar') => m.specs?.(lang) ?? localize(m.parts, lang);

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
export interface MatProps { color: string; metal?: number; rough?: number; emissive?: string; glow?: number; opacity?: number }
export function Mat({ color, metal = 0.35, rough = 0.55, emissive, glow = 0, opacity }: MatProps) {
  return (
    <meshStandardMaterial color={color} metalness={metal} roughness={rough} side={THREE.DoubleSide}
      emissive={emissive ?? '#000000'} emissiveIntensity={glow}
      transparent={opacity !== undefined} opacity={opacity ?? 1} depthWrite={opacity === undefined} />
  );
}

type MeshBase = MatProps & { position?: Vec3; rotation?: Vec3; name?: string; shadow?: boolean };

export function Box({ size, position = [0, 0, 0], rotation, name, shadow = true, ...m }: MeshBase & { size: Vec3 }) {
  return (
    <mesh name={name} position={position} rotation={rotation} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <Mat {...m} />
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
