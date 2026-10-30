'use client';
/**
 * What a lesson draws in 3D besides the machine: the WABYS student walking
 * from station to station and working, callout labels with leader lines,
 * dimension lines, and animated flow arrows (coolant, current, gas, force).
 * Everything is a pure function of lesson time, so scrubbing and seeking show
 * exactly the right frame. Labels stay mounted and are only shown or hidden
 * (drei's <Html> portals must not unmount mid-lesson).
 *
 * The student really does what the narration says: a shot can send the hand
 * to a named grip point on the machine (a door handle, a button, a valve),
 * which the hand follows as it moves, and the machine only responds once the
 * hand is there (see `planStudent`, which times each shot's action).
 */
import { Html, Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { alongPath, angleTo, pathLength, planPath, WALK_SPEED, type PPE, type Rect, type StudentState, type Tool } from '../models/avatar';
import type { ModelEnv, Pose, StationDef, Txt } from '../models/kit';
import { MODEL_SPACE, useSceneInfo, type Vec3 } from './MachineExplorer';

type Lang = 'en' | 'ar';

export interface LessonCallout { id: string; at: number; until: number; anchor: Vec3; label: Txt; sub?: Txt; tone?: 'info' | 'warn' | 'ok' | 'bad'; dx?: number; dy?: number }
export interface LessonDim { id: string; at: number; until: number; from: Vec3; to: Vec3; label: string }
export interface LessonFlow { id: string; at: number; until: number; points: Vec3[]; color?: string; label?: Txt; speed?: number; size?: number }
/** A point in model units, or the name of a grip point on the machine (followed as it moves). */
export type Aim = Vec3 | string;
/** Where the student is and what they are doing in a shot. Carries on to later shots until changed. */
export interface ShotStudent {
  at?: string; pose?: Pose; reach?: Aim | null; look?: Aim | null; ppe?: PPE; hidden?: boolean; hold?: Tool | null;
  /** Seconds into the shot when this move starts (for a sequence of moves in one shot). */
  after?: number;
  /** What the hand does to the machine once it gets there (params, until the next shot). */
  does?: Record<string, number>;
}

type StudentShot = { at: number; avatar?: ShotStudent | ShotStudent[]; cue?: number };
/** Every move of the student in time order, with the shot it belongs to. */
interface Move { t: number; shot: number; step: number; a: ShotStudent }
function movesOf(shots: StudentShot[]): Move[] {
  const out: Move[] = [];
  shots.forEach((sh, i) => {
    const list = sh.avatar ? (Array.isArray(sh.avatar) ? sh.avatar : [sh.avatar]) : [];
    list.forEach((a, k) => out.push({ t: sh.at + (a.after ?? 0), shot: i, step: k, a }));
  });
  return out.sort((x, y) => x.t - y.t);
}

const ACCEL = 1.4; // m/s², starting and stopping
const TURN = 0.35; // s to turn towards the way before setting off
const APPROACH = 0.95; // s for the hand to get to a new target and press or grip it
const MAX_STEP = 0.5; // m the student steps from a station towards what the hand is going for

/** Distance and speed `tau` seconds into a walk of `len` metres that eases in and out. */
function walkAt(len: number, tau: number): { d: number; v: number; dur: number } {
  const v = WALK_SPEED, a = ACCEL;
  const ramp = v / a, rampD = (v * v) / (2 * a);
  if (len <= 2 * rampD) {
    // Too short to reach full pace: accelerate half way, then slow down.
    const half = Math.sqrt(len / a), dur = 2 * half;
    if (tau <= 0) return { d: 0, v: 0, dur };
    if (tau < half) return { d: 0.5 * a * tau * tau, v: a * tau, dur };
    if (tau < dur) { const r = dur - tau; return { d: len - 0.5 * a * r * r, v: a * r, dur }; }
    return { d: len, v: 0, dur };
  }
  const cruise = (len - 2 * rampD) / v, dur = 2 * ramp + cruise;
  if (tau <= 0) return { d: 0, v: 0, dur };
  if (tau < ramp) return { d: 0.5 * a * tau * tau, v: a * tau, dur };
  if (tau < ramp + cruise) return { d: rampD + v * (tau - ramp), v, dur };
  if (tau < dur) { const r = dur - tau; return { d: len - 0.5 * a * r * r, v: a * r, dur }; }
  return { d: len, v: 0, dur };
}

interface Leg { from: [number, number]; to: StationDef; path: [number, number][]; len: number; start: number; dur: number }
/** When the machine responds to the student, for the player's timeline. */
export interface StudentTiming {
  /** Per shot: seconds after the shot starts when the student is in place and the machine should respond. */
  delays: number[];
  /** Params a move sets once the hand is there, held until `until` (the next shot). */
  does: { at: number; until: number; params: Record<string, number> }[];
}
interface Plan extends StudentTiming { legs: Leg[] }

/**
 * Times the lesson around the student: when each walk starts and ends, and
 * how long after each shot starts its action can happen (walk there, turn,
 * get the hand on the control). The player uses it so a door closes
 * or a spindle starts when the hand is on it, not before.
 */
export function planStudent(shots: StudentShot[], env: ModelEnv, box: Rect | null, duration: number): Plan {
  const u = env.unitsPerM;
  let st = env.stations[0]!;
  const legs: Leg[] = [];
  const delays = shots.map(() => 0);
  const does: StudentTiming['does'] = [];
  for (const m of movesOf(shots)) {
    const a = m.a;
    let ready = m.t;
    const next = a.at ? env.stations.find((x) => x.id === a.at) : undefined;
    if (next && next !== st) {
      const path = planPath(st.pos, next.pos, box, 0.55 * u);
      const len = pathLength(st.pos, path) / u;
      const dur = len > 0.02 ? TURN + walkAt(len, 0).dur : 0;
      legs.push({ from: st.pos, to: next, path, len, start: m.t, dur });
      ready += dur;
      st = next;
      if (st.reach || a.reach) ready += APPROACH;
    } else if (a.reach) ready += APPROACH;
    const sh = shots[m.shot]!;
    const end = shots[m.shot + 1]?.at ?? duration;
    if (m.shot > 0 && m.step === (sh.cue ?? 0)) delays[m.shot] = Math.min(ready - sh.at, 0.6 * (end - sh.at));
    if (a.does) does.push({ at: Math.min(ready, end - 0.5), until: end, params: a.does });
  }
  return { delays, does, legs };
}

const aimKey = (a: Aim | null | undefined) => (a == null ? '' : typeof a === 'string' ? a : a.map((x) => x.toFixed(2)).join(','));

/** Drives the student from the lesson timeline. */
export function LessonStudent({ state, shots, timeRef, ppe, timing, duration }: {
  state: React.RefObject<StudentState | null>;
  shots: StudentShot[];
  timeRef: React.RefObject<number>;
  ppe: PPE;
  /** Filled in with when the machine should respond, for the player's timeline. */
  timing?: React.RefObject<StudentTiming | null>;
  duration: number;
}) {
  const { env, box } = useSceneInfo();
  const scene = useThree((s) => s.scene);
  const anchors = useMemo(() => new Map<string, THREE.Object3D | null>(), []);
  const plan = useRef<{ box: Rect | null; plan: Plan } | null>(null);
  const moves = useMemo(() => movesOf(shots), [shots]);
  const m = useRef({ lastT: -1, follow: new THREE.Vector3(), legKey: '', prev: new THREE.Vector3(), yawSnap: true });
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  /** World position of an aim (model space is world space outside VR, and the parent group's transform is applied by the caller). */
  const resolve = (aim: Aim, out: THREE.Vector3): THREE.Vector3 | null => {
    if (typeof aim !== 'string') return out.set(...aim);
    let o = anchors.get(aim);
    if (!o?.parent) { o = scene.getObjectByName(aim) ?? null; anchors.set(aim, o); }
    if (!o) return null;
    o.getWorldPosition(out);
    // Into model space (the group that holds the machine and the student; it moves only in a headset).
    let space = anchors.get(MODEL_SPACE);
    if (!space?.parent) { space = scene.getObjectByName(MODEL_SPACE) ?? null; anchors.set(MODEL_SPACE, space); }
    if (space) space.worldToLocal(out);
    return out;
  };

  useFrame((_, rawDt) => {
    const s = state.current;
    if (!s || !env) return;
    const dt = Math.min(rawDt, 0.1);
    const t = timeRef.current;
    const u = env.unitsPerM;
    if (!plan.current || plan.current.box !== box.current) {
      plan.current = { box: box.current, plan: planStudent(shots, env, box.current, duration) };
      if (timing) timing.current = plan.current.plan;
    }
    const { legs } = plan.current.plan;
    const st = m.current;
    const jumped = Math.abs(t - st.lastT) > 0.4 || st.lastT < 0;
    st.lastT = t;

    // Replay the shots up to now.
    let station = env.stations[0]!;
    let pose: Pose = station.pose ?? 'idle';
    let reach: Aim | null = station.reach ?? null;
    let reachFrom = -1;
    let look: Aim | null = null;
    let worn = ppe;
    let hidden = false;
    let hold: Tool | null = null;
    moves.forEach(({ t: mt, a }, i) => {
      if (mt > t) return;
      const next = a.at ? env.stations.find((x) => x.id === a.at) : undefined;
      if (next && next !== station) { station = next; pose = next.pose ?? 'idle'; reach = next.reach ?? null; look = null; reachFrom = i; }
      if (a.pose) pose = a.pose;
      if (a.reach !== undefined) { reach = a.reach; reachFrom = i; }
      if (a.look !== undefined) look = a.look;
      if (a.ppe) worn = { ...worn, ...a.ppe };
      if (a.hidden !== undefined) hidden = a.hidden;
      if (a.hold !== undefined) hold = a.hold;
    });
    s.visible = !hidden;
    s.ppe = worn;
    s.hold = hold;

    // Walking: the leg in progress, if any.
    const leg = legs.find((l) => t >= l.start && t < l.start + l.dur);
    if (leg) {
      const tau = t - leg.start;
      const w = walkAt(leg.len, tau - TURN);
      const at = alongPath(leg.from, leg.path, w.d * u);
      // Any step taken towards the last job fades out as the walk begins.
      st.follow.multiplyScalar(jumped ? 0 : Math.exp(-4 * dt));
      s.pos.set(at.x + st.follow.x, 0, at.z + st.follow.z);
      // Turn towards the way first, then keep facing along the path; turn to the work as the walk ends.
      const left = leg.len - w.d;
      const want = left < 0.5 ? angleBlend(at.yaw, leg.to.face, 1 - left / 0.5) : at.yaw;
      s.yaw = jumped ? want : s.yaw + angleTo(s.yaw, want) * (1 - Math.exp(-(tau < TURN ? 9 : 7) * dt));
      s.speed = w.v;
      s.pose = 'walk'; s.reach = null; s.look = null; s.reachKey = '';
      st.legKey = '';
      return;
    }

    // At a station: stand, face the work, reach.
    s.pose = pose;
    s.reach = reach ? resolve(reach, s.reach ?? new THREE.Vector3()) : null;
    s.look = look ? resolve(look, s.look ?? new THREE.Vector3()) : null;
    s.reachKey = reach ? `${reachFrom}:${aimKey(reach)}` : '';
    const key = station.id;
    if (st.legKey !== key) { st.legKey = key; if (jumped) st.follow.set(0, 0, 0); }
    let want = station.face;
    const base = tmp.a.set(station.pos[0], 0, station.pos[1]);
    if (s.reach) {
      const dx = s.reach.x - (base.x + st.follow.x), dz = s.reach.z - (base.z + st.follow.z);
      const dist = Math.hypot(dx, dz) / u;
      const bearing = Math.atan2(dx, dz);
      // Turn partly towards the hand's target, so it is not reached over a shoulder.
      // If it is out of arm's reach (or moves away, like a sliding door), step along to it.
      want = angleBlend(station.face, bearing, THREE.MathUtils.clamp(Math.abs(angleTo(station.face, bearing)) / 1.6, 0, 0.5));
      // Step towards it (at most half a metre from the station, which is clear of the machine).
      const far = dist - 0.55;
      if (far > 0.02) {
        tmp.b.set(dx, 0, dz).normalize().multiplyScalar(far * u * (jumped ? 1 : Math.min(1, dt * 3)));
        st.follow.add(tmp.b);
      }
      if (st.follow.length() > MAX_STEP * u) st.follow.setLength(MAX_STEP * u);
    } else if (st.follow.lengthSq() > 0) {
      // Hands free: step back to the station.
      st.follow.multiplyScalar(jumped ? 0 : Math.exp(-2 * dt));
      if (st.follow.length() < 0.005 * u) st.follow.set(0, 0, 0);
    }
    const before = st.prev.copy(s.pos);
    s.pos.set(base.x + st.follow.x, 0, base.z + st.follow.z);
    const moved = jumped ? 0 : before.distanceTo(s.pos) / u / Math.max(dt, 1e-3);
    s.speed = moved > 0.05 ? Math.min(moved, 0.8) : 0;
    s.yaw = jumped ? want : s.yaw + angleTo(s.yaw, want) * (1 - Math.exp(-4 * dt));
  });
  return null;
}

/** Heading part way from a to b. */
const angleBlend = (a: number, b: number, k: number) => a + angleTo(a, b) * k;

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
