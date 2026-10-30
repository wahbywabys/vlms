'use client';
/**
 * What a lesson draws in 3D besides the machine: the WABYS student walking
 * from station to station and working, callout labels with leader lines,
 * dimension lines, and animated flow arrows (coolant, current, gas, force).
 * Everything is a pure function of lesson time, so scrubbing and seeking show
 * exactly the right frame. Labels stay mounted and are only shown or hidden
 * (drei's <Html> portals must not unmount mid-lesson).
 */
import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { alongPath, angleTo, pathLength, planPath, type PPE, type StudentState } from '../models/avatar';
import type { Pose, Txt } from '../models/kit';
import { useSceneInfo, type Vec3 } from './MachineExplorer';

type Lang = 'en' | 'ar';

export interface LessonCallout { id: string; at: number; until: number; anchor: Vec3; label: Txt; sub?: Txt; tone?: 'info' | 'warn' | 'ok' | 'bad'; dx?: number; dy?: number }
export interface LessonDim { id: string; at: number; until: number; from: Vec3; to: Vec3; label: string }
export interface LessonFlow { id: string; at: number; until: number; points: Vec3[]; color?: string; label?: Txt; speed?: number; size?: number }
/** Where the student is and what they are doing in a shot. Carries on to later shots until changed. */
export interface ShotStudent { at?: string; pose?: Pose; reach?: Vec3 | null; look?: Vec3 | null; ppe?: PPE; hidden?: boolean }

const WALK = 1.25; // m/s

/** Drives the student from the lesson timeline. */
export function LessonStudent({ state, shots, timeRef, ppe }: {
  state: React.RefObject<StudentState | null>;
  shots: { at: number; avatar?: ShotStudent }[];
  timeRef: React.RefObject<number>;
  ppe: PPE;
}) {
  const { env, box } = useSceneInfo();
  useFrame(() => {
    const s = state.current;
    if (!s || !env) return;
    const t = timeRef.current;
    const u = env.unitsPerM;
    const station = (id?: string) => env.stations.find((x) => x.id === id);
    // Replay the shots up to now: which station, since when, and what the student is doing there.
    let st = env.stations[0]!;
    let pose: Pose = st.pose ?? 'idle';
    let reach: Vec3 | null = st.reach ?? null;
    let look: Vec3 | null = null;
    let worn = ppe;
    let hidden = false;
    let from: [number, number] = st.pos;
    let walkStart = -Infinity;
    for (const sh of shots) {
      if (sh.at > t) break;
      const a = sh.avatar;
      if (!a) continue;
      const next = station(a.at);
      if (next && next !== st) { from = st.pos; walkStart = sh.at; st = next; pose = st.pose ?? 'idle'; reach = st.reach ?? null; look = null; }
      if (a.pose) pose = a.pose;
      if (a.reach !== undefined) reach = a.reach;
      if (a.look !== undefined) look = a.look;
      if (a.ppe) worn = { ...worn, ...a.ppe };
      if (a.hidden !== undefined) hidden = a.hidden;
    }
    const cur = { st, pose, reach, look, ppe: worn, hidden, start: walkStart };
    s.visible = !cur.hidden;
    s.ppe = cur.ppe;
    const path = planPath(from, cur.st.pos, box.current, 0.55 * u);
    const total = pathLength(from, path);
    const d = (t - cur.start) * WALK * u;
    if (total > 0.02 && d < total) {
      const at = alongPath(from, path, d);
      s.pos.set(at.x, 0, at.z);
      s.yaw += angleTo(s.yaw, at.yaw) * 0.25;
      s.speed = WALK; s.pose = 'walk'; s.reach = null; s.look = null;
    } else {
      s.pos.set(cur.st.pos[0], 0, cur.st.pos[1]);
      s.yaw += angleTo(s.yaw, cur.st.face) * 0.12;
      s.speed = 0; s.pose = cur.pose;
      s.reach = cur.reach ? new THREE.Vector3(...cur.reach) : null;
      s.look = cur.look ? new THREE.Vector3(...cur.look) : null;
    }
  });
  return null;
}

/** Callout labels with a leader line from the point on the machine. */
export function Callouts({ items, time, lang }: { items: LessonCallout[]; time: number; lang: Lang }) {
  return (
    <>
      {items.map((c) => {
        const on = time >= c.at && time <= c.until;
        const dx = c.dx ?? 90, dy = c.dy ?? -70;
        const w = Math.abs(dx), h = Math.abs(dy);
        return (
          <Html key={c.id} position={c.anchor} zIndexRange={[14, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`lp-callout is-${c.tone ?? 'info'}${on ? ' is-on' : ''}`} style={{ display: on ? 'block' : 'none' }}>
              <span className="lp-co-dot" />
              <svg className="lp-co-line" width={w + 4} height={h + 4} style={{ left: dx < 0 ? dx - 2 : -2, top: dy < 0 ? dy - 2 : -2 }} aria-hidden="true">
                <polyline points={`${dx < 0 ? w + 2 : 2},${dy < 0 ? h + 2 : 2} ${dx < 0 ? 2 + w * 0.25 : w * 0.75 + 2},${dy < 0 ? 2 : h + 2} ${dx < 0 ? 2 : w + 2},${dy < 0 ? 2 : h + 2}`} />
              </svg>
              <div className="lp-co-label" style={{ left: dx, top: dy, transform: `translate(${dx < 0 ? '-100%' : '0'}, -50%)` }}>
                <b>{c.label[lang]}</b>{c.sub && <small>{c.sub[lang]}</small>}
              </div>
            </div>
          </Html>
        );
      })}
    </>
  );
}

/** Dimension lines with arrowheads and a value. */
export function Dims({ items, time }: { items: LessonDim[]; time: number }) {
  return (
    <>
      {items.map((d) => {
        const on = time >= d.at && time <= d.until;
        const a = new THREE.Vector3(...d.from), b = new THREE.Vector3(...d.to);
        const dir = b.clone().sub(a).normalize();
        const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize().multiplyScalar(0.05);
        if (side.lengthSq() < 1e-6) side.set(0.05, 0, 0);
        const head = (p: THREE.Vector3, s: number): [number, number, number][] => [
          p.clone().addScaledVector(dir, 0.08 * s).add(side).toArray() as Vec3, p.toArray() as Vec3, p.clone().addScaledVector(dir, 0.08 * s).sub(side).toArray() as Vec3,
        ];
        const mid = a.clone().lerp(b, 0.5);
        return (
          <group key={d.id} visible={on}>
            <Line points={[d.from, d.to]} color="#ffd34d" lineWidth={2} depthTest={false} renderOrder={10} />
            <Line points={head(a, 1)} color="#ffd34d" lineWidth={2} depthTest={false} renderOrder={10} />
            <Line points={head(b, -1)} color="#ffd34d" lineWidth={2} depthTest={false} renderOrder={10} />
            <Html position={mid.toArray() as Vec3} center zIndexRange={[13, 0]} style={{ pointerEvents: 'none' }}>
              <span className="lp-dim" dir="ltr" style={{ display: on ? 'inline-block' : 'none' }}>{d.label}</span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

const CHEVRONS = 14;
/** Arrows streaming along a path: what flows where (coolant, current, gas, force). */
function Flow({ f, time, lang }: { f: LessonFlow; time: number; lang: Lang }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(f.points.map((p) => new THREE.Vector3(...p))), [f.points]);
  const len = useMemo(() => curve.getLength(), [curve]);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0) }), []);
  const clock = useRef(0);
  const on = time >= f.at && time <= f.until;
  const size = f.size ?? 0.06;
  useFrame((_, dt) => {
    if (!on || !mesh.current) return;
    clock.current += dt * (f.speed ?? 0.6);
    const n = Math.max(4, Math.min(CHEVRONS, Math.round(len / (size * 4))));
    for (let i = 0; i < CHEVRONS; i++) {
      if (i >= n) { tmp.m.makeScale(0, 0, 0); mesh.current.setMatrixAt(i, tmp.m); continue; }
      const u = (i / n + (clock.current * 0.6) / Math.max(0.5, len)) % 1;
      curve.getPointAt(u, tmp.p);
      const tan = curve.getTangentAt(u);
      tmp.q.setFromUnitVectors(tmp.up, tan);
      const fade = Math.sin(u * Math.PI);
      tmp.s.setScalar(0.4 + fade * 0.8);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      mesh.current.setMatrixAt(i, tmp.m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  const mid = curve.getPointAt(0.5);
  return (
    <group visible={on}>
      <instancedMesh ref={mesh} args={[undefined, undefined, CHEVRONS]} frustumCulled={false} renderOrder={9}>
        <coneGeometry args={[size * 0.6, size * 1.6, 3]} />
        <meshBasicMaterial color={f.color ?? '#3ad1ff'} depthTest={false} transparent opacity={0.95} toneMapped={false} />
      </instancedMesh>
      {f.label && (
        <Html position={[mid.x, mid.y + size * 2.5, mid.z]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
          <span className="lp-flowlabel" style={{ display: on ? 'inline-block' : 'none', borderColor: f.color ?? '#3ad1ff' }}>{f.label[lang]}</span>
        </Html>
      )}
    </group>
  );
}

export function Flows({ items, time, lang }: { items: LessonFlow[]; time: number; lang: Lang }) {
  return <>{items.map((f) => <Flow key={f.id} f={f} time={time} lang={lang} />)}</>;
}
