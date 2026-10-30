'use client';
/**
 * 3D consequences for the safety simulator: sparks, flying chips, a thrown
 * chuck key, an arc flash, an electric shock, escaping steam, fire, welding
 * fume and the warning beacon. Particles move on closed-form paths
 * (p = o + v·t + ½·g·t²), so each burst is cheap and identical every run.
 * Positions are model units; `u` (units per metre) keeps speeds real.
 */
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from './MachineExplorer';

export type Effect = 'projectile' | 'crash' | 'entangle' | 'chips' | 'cut' | 'arcflash' | 'shock' | 'steam' | 'burn' | 'spark'
  | 'fire' | 'fumes' | 'arceye' | 'fall' | 'alarm';

let dot: THREE.Texture | null = null;
/** Soft round sprite for particles. */
function dotTex() {
  if (dot || typeof document === 'undefined') return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export interface BurstProps {
  origin: Vec3; dir?: Vec3; spread?: number; speed: [number, number]; gravity?: number; count?: number;
  life?: number; color: string; size: number; additive?: boolean; t: React.RefObject<number>; delay?: number; seed?: number; grow?: number; opacity?: number;
}

/** A burst of particles at time t (seconds since the effect began). */
export function Burst({ origin, dir = [0, 1, 0], spread = 0.8, speed, gravity = -9.8, count = 80, life = 1.2, color, size, additive = true, t, delay = 0, seed = 1, grow = 0, opacity = 1 }: BurstProps) {
  const ref = useRef<THREE.Points>(null!);
  const mat = useRef<THREE.PointsMaterial>(null!);
  const seeds = useMemo(() => {
    const r = rng(seed);
    const d = new THREE.Vector3(...dir).normalize();
    const out: { v: THREE.Vector3; t0: number; l: number }[] = [];
    for (let i = 0; i < count; i++) {
      const v = d.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(spread * 2)).normalize();
      v.multiplyScalar(speed[0] + (speed[1] - speed[0]) * r());
      out.push({ v, t0: r() * 0.25, l: life * (0.6 + r() * 0.6) });
    }
    return out;
  }, [count, dir, spread, speed, life, seed]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  useFrame(() => {
    const tt = t.current - delay;
    const p = geo.attributes.position as THREE.BufferAttribute;
    let alive = 0;
    seeds.forEach((s, i) => {
      const k = tt - s.t0;
      if (k < 0 || k > s.l) { p.setXYZ(i, 0, -999, 0); return; }
      alive++;
      p.setXYZ(i, origin[0] + s.v.x * k, origin[1] + s.v.y * k + 0.5 * gravity * k * k, origin[2] + s.v.z * k);
    });
    p.needsUpdate = true;
    if (mat.current) {
      mat.current.opacity = opacity * (alive ? Math.max(0, 1 - Math.max(0, tt) / (life * 1.3)) : 0);
      mat.current.size = size * (1 + grow * Math.max(0, tt));
    }
    if (ref.current) ref.current.visible = tt >= 0;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial ref={mat} map={dotTex()} color={color} size={size} sizeAttenuation transparent depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} toneMapped={false} />
    </points>
  );
}

/** A flash of light (arc flash, short circuit) that fades over `dur`. */
function Flash({ at, t, color = '#dff1ff', power = 40, dur = 0.6, radius = 0.4 }: { at: Vec3; t: React.RefObject<number>; color?: string; power?: number; dur?: number; radius?: number }) {
  const light = useRef<THREE.PointLight>(null!);
  const ball = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const k = Math.max(0, 1 - t.current / dur);
    const flick = 0.75 + Math.random() * 0.25;
    light.current.intensity = power * k * k * flick;
    ball.current.scale.setScalar(radius * (0.4 + (1 - k) * 1.4));
    (ball.current.material as THREE.MeshBasicMaterial).opacity = k;
  });
  return (
    <group position={at}>
      <pointLight ref={light} color={color} distance={30} decay={1.6} />
      <mesh ref={ball}><sphereGeometry args={[1, 20, 14]} /><meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
    </group>
  );
}

/** Jagged electric arcs between two points, re-drawn each frame. */
function Lightning({ from, to, t, dur = 1.2 }: { from: Vec3; to: Vec3; t: React.RefObject<number>; dur?: number }) {
  const [a, b] = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  const make = () => {
    const pts: Vec3[] = [];
    const n = 10, len = a.distanceTo(b);
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i > 0 && i < n) p.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(len * 0.12));
      pts.push(p.toArray() as Vec3);
    }
    return pts;
  };
  const group = useRef<THREE.Group>(null!);
  const [p1, p2] = useMemo(() => [make(), make()], []); // eslint-disable-line react-hooks/exhaustive-deps
  const frame = useRef(0);
  useFrame(() => {
    group.current.visible = t.current < dur && Math.random() > 0.2;
    if (++frame.current % 3 === 0) {
      for (const l of group.current.children) {
        const line = l as unknown as { geometry: { setPositions: (a: number[]) => void } };
        line.geometry?.setPositions?.(make().flat());
      }
    }
  });
  return (
    <group ref={group}>
      <Line points={p1} color="#bfe3ff" lineWidth={3} toneMapped={false} />
      <Line points={p2} color="#7fc4ff" lineWidth={1.5} toneMapped={false} />
    </group>
  );
}

/** The thrown object: spins along a ballistic path. */
function Projectile({ from, dir, speed, t, u, children }: { from: Vec3; dir: Vec3; speed: number; t: React.RefObject<number>; u: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  const v = useMemo(() => new THREE.Vector3(...dir).normalize().multiplyScalar(speed * u), [dir, speed, u]);
  useFrame(() => {
    const k = Math.min(t.current, 1.4);
    g.current.position.set(from[0] + v.x * k, from[1] + v.y * k - 0.5 * 9.8 * u * k * k, from[2] + v.z * k);
    g.current.rotation.set(k * 31, k * 17, k * 23);
  });
  return <group ref={g}>{children}</group>;
}

/** Rotating amber beacon for a blocked (stopped) action. */
function Beacon({ at, t }: { at: Vec3; t: React.RefObject<number> }) {
  const light = useRef<THREE.SpotLight>(null!);
  const head = useRef<THREE.Group>(null!);
  useFrame(() => { head.current.rotation.y = t.current * 9; light.current.intensity = 30 + Math.sin(t.current * 18) * 10; });
  return (
    <group position={at}>
      <mesh><cylinderGeometry args={[0.08, 0.1, 0.06, 16]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.07, 0.07, 0.14, 16]} /><meshBasicMaterial color="#ffb020" transparent opacity={0.85} toneMapped={false} /></mesh>
      <group ref={head} position={[0, 0.1, 0]}>
        <spotLight ref={light} color="#ffb020" angle={0.5} penumbra={0.5} distance={12} position={[0, 0, 0]} target-position={[3, 0, 0]} />
      </group>
    </group>
  );
}

export interface FxSpec {
  effect: Effect;
  /** Where it starts, model units. */
  at: Vec3;
  /** Where it goes (the student's face or hand, usually). */
  to?: Vec3;
  /** Thrown object for 'projectile' (default: a chuck key). */
  object?: 'key' | 'part' | 'gauge';
}

/** Plays one effect; `t` is seconds since it started (advanced by the simulator). */
export function SimFx({ fx, t, u }: { fx: FxSpec; t: React.RefObject<number>; u: number }) {
  const { effect, at } = fx;
  const to = fx.to ?? [at[0], at[1] + 0.5 * u, at[2] + 1.0 * u];
  const dir: Vec3 = [to[0] - at[0], to[1] - at[1], to[2] - at[2]];
  const len = Math.hypot(...dir) || 1;
  const toward: Vec3 = [dir[0] / len, dir[1] / len, dir[2] / len];
  const g = -9.8 * u;
  const sparks = (o: Vec3, n = 120, sp: [number, number] = [2, 6], seed = 3, d: Vec3 = [0, 0.6, 0.6]) => (
    <Burst t={t} origin={o} dir={d} spread={0.9} speed={[sp[0] * u, sp[1] * u]} gravity={g} count={n} life={1.1} color="#ffb347" size={0.035 * u} seed={seed} />
  );
  switch (effect) {
    case 'projectile':
      return (
        <group>
          {sparks(at, 60, [1.5, 4])}
          <Projectile from={at} dir={[toward[0], toward[1] + 0.25, toward[2]]} speed={11} t={t} u={u}>
            {fx.object === 'gauge'
              ? <mesh><boxGeometry args={[0.15 * u, 0.02 * u, 0.04 * u]} /><meshStandardMaterial color="#c3cbd3" metalness={0.9} roughness={0.3} /></mesh>
              : fx.object === 'part'
                ? <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015 * u, 0.015 * u, 0.12 * u, 14]} /><meshStandardMaterial color="#d8dde2" metalness={0.95} roughness={0.15} /></mesh>
                : (
                  <group>
                    <mesh><boxGeometry args={[0.022 * u, 0.12 * u, 0.022 * u]} /><meshStandardMaterial color="#9aa5b0" metalness={0.9} roughness={0.3} /></mesh>
                    <mesh position={[0, 0.06 * u, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.01 * u, 0.01 * u, 0.12 * u, 10]} /><meshStandardMaterial color="#9aa5b0" metalness={0.9} roughness={0.3} /></mesh>
                  </group>
                )}
          </Projectile>
        </group>
      );
    case 'crash':
      return <group>{sparks(at, 160, [2, 7], 5)}<Flash at={at} t={t} color="#ffd9a0" power={12} dur={0.4} radius={0.08 * u} /></group>;
    case 'spark':
      return <group>{sparks(at, 90, [1, 4], 7)}<Flash at={at} t={t} color="#cfe8ff" power={25} dur={0.35} radius={0.05 * u} /></group>;
    case 'chips':
      return (
        <group>
          <Burst t={t} origin={at} dir={toward} spread={0.18} speed={[3 * u, 6 * u]} gravity={g * 0.3} count={70} life={0.8} color="#d7dde3" size={0.018 * u} additive={false} seed={11} />
          {sparks(at, 40, [1, 3], 13)}
        </group>
      );
    case 'entangle':
      return (
        <group position={at}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[(0.09 + i * 0.03) * u, 0.008 * u, 6, 24]} />
              <meshBasicMaterial color={i === 1 ? '#1c2d58' : '#ff4d4d'} transparent opacity={0.8} />
            </mesh>
          ))}
          <Burst t={t} origin={[0, 0, 0]} dir={[0, 0, 1]} spread={1} speed={[0.5 * u, 1.5 * u]} gravity={g * 0.2} count={30} life={0.8} color="#ff3b30" size={0.03 * u} additive={false} seed={17} />
        </group>
      );
    case 'cut':
    case 'burn':
      return (
        <group>
          <Flash at={to} t={t} color={effect === 'burn' ? '#ff8a3c' : '#ff3b30'} power={6} dur={0.8} radius={0.05 * u} />
          {effect === 'burn' && <Burst t={t} origin={to} dir={[0, 1, 0]} spread={0.4} speed={[0.2 * u, 0.6 * u]} gravity={0.5 * u} count={40} life={1.8} color="#8c9399" size={0.12 * u} additive={false} grow={1.2} opacity={0.5} seed={21} />}
        </group>
      );
    case 'arcflash':
      return (
        <group>
          <Flash at={at} t={t} color="#e8f4ff" power={160} dur={0.9} radius={0.25 * u} />
          {sparks(at, 220, [3, 9], 23, toward)}
          <Burst t={t} origin={at} dir={toward} spread={0.6} speed={[0.5 * u, 1.6 * u]} gravity={0.4 * u} count={60} life={2.2} color="#5c636b" size={0.25 * u} additive={false} grow={1.5} opacity={0.6} delay={0.15} seed={29} />
        </group>
      );
    case 'shock':
      return (
        <group>
          <Lightning from={at} to={to} t={t} dur={1.4} />
          <Flash at={at} t={t} color="#9fd3ff" power={30} dur={1.2} radius={0.04 * u} />
        </group>
      );
    case 'steam':
      return <Burst t={t} origin={at} dir={[0, 1, 0.25]} spread={0.35} speed={[0.8 * u, 2.4 * u]} gravity={0.6 * u} count={140} life={2.4} color="#f2f6fa" size={0.16 * u} additive={false} grow={1.6} opacity={0.7} seed={31} />;
    case 'fire':
      return (
        <group>
          {[0, 0.35, 0.7, 1.05, 1.4].map((d, i) => (
            <Burst key={i} t={t} origin={at} dir={[0, 1, 0]} spread={0.25} speed={[0.6 * u, 1.4 * u]} gravity={0.8 * u} count={70} life={0.9} color={i % 2 ? '#ff7a1a' : '#ffc23d'} size={0.12 * u} delay={d} seed={40 + i} />
          ))}
          <Burst t={t} origin={[at[0], at[1] + 0.3 * u, at[2]]} dir={[0, 1, 0]} spread={0.3} speed={[0.4 * u, 0.9 * u]} gravity={0.3 * u} count={50} life={2.6} color="#2d3136" size={0.3 * u} additive={false} grow={1} opacity={0.55} delay={0.4} seed={47} />
          <Flash at={at} t={t} color="#ff8a2a" power={18} dur={2.6} radius={0.001} />
        </group>
      );
    case 'fumes':
      return <Burst t={t} origin={at} dir={[0, 1, 0]} spread={0.5} speed={[0.2 * u, 0.6 * u]} gravity={0.15 * u} count={90} life={2.8} color="#9aa0a6" size={0.28 * u} additive={false} grow={0.9} opacity={0.55} seed={53} />;
    case 'alarm':
      return <Beacon at={[at[0], at[1] + 0.4 * u, at[2]]} t={t} />;
    case 'arceye':
      return <Flash at={at} t={t} color="#e8f4ff" power={90} dur={1.2} radius={0.06 * u} />;
    case 'fall':
      return sparks(at, 50, [1, 3], 59);
  }
}
