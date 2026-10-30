/**
 * The WABYS student: a procedural trainee in navy WABYS coveralls who stands,
 * walks and works at the machine at true scale. Built in metres (1.75 m tall,
 * feet at the origin, facing +z) and placed in the machine's model space by
 * the scene, so a right hand can reach a real point on the machine (two-bone
 * IK). PPE is worn or not item by item, so the learner sees exactly what the
 * student has on: safety glasses, ear defenders, welding helmet, face shield,
 * respirator, gloves of three kinds, a leather apron, safety boots or
 * trainers, and the hazards (a watch and ring, loose cuffs).
 *
 * The student is driven through a mutable `StudentState` (updated per frame
 * by the explorer, a lesson timeline or the safety simulator), so walking and
 * poses never cause React re-renders.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ModelEnv, Pose, StationDef } from './kit';
import { wabysTex } from './textures';
import type { Vec3 } from '../components/MachineExplorer';

export type Gloves = 'leather' | 'nitrile' | 'insulated' | null;
export interface PPE {
  glasses?: boolean; earmuffs?: boolean; boots?: boolean; gloves?: Gloves;
  helmet?: 'welding' | 'visor' | null; mask?: boolean; apron?: boolean;
  /** Hazards: a watch and ring on, sleeves undone. */
  jewellery?: boolean; looseSleeves?: boolean;
}
export const BASIC_PPE: PPE = { boots: true, glasses: true };

/** What a careful student wears in each trade's bay. */
export function tradePpe(bay?: string): PPE {
  switch (bay) {
    case 'weld': return { boots: true, glasses: true, helmet: 'welding', gloves: 'leather', apron: true };
    case 'elec': return { boots: true, glasses: true, gloves: 'insulated' };
    case 'auto': return { boots: true, glasses: true, gloves: 'nitrile' };
    default: return { boots: true, glasses: true, earmuffs: true };
  }
}

export interface StudentState {
  /** Feet position in model units (y is ignored: the student stands on the floor). */
  pos: THREE.Vector3;
  yaw: number;
  pose: Pose;
  /** Right-hand target, model units. */
  reach: THREE.Vector3 | null;
  /** Where the head looks, model units. */
  look: THREE.Vector3 | null;
  ppe: PPE;
  /** Walking speed in m/s (drives the gait). */
  speed: number;
  /** Hide the head for the first-person camera. */
  firstPerson: boolean;
  visible: boolean;
}

export function newStudent(env: ModelEnv | undefined, ppe: PPE = { boots: true }): StudentState {
  const home = env?.stations[0];
  return {
    pos: new THREE.Vector3(home?.pos[0] ?? 2.5, 0, home?.pos[1] ?? 2), yaw: home?.face ?? Math.PI, pose: home?.pose ?? 'idle',
    reach: null, look: null, ppe, speed: 0, firstPerson: false, visible: true,
  };
}

// ---------------------------------------------------------------------------
// Proportions (metres)
// ---------------------------------------------------------------------------
const HIP_Y = 0.94, THIGH = 0.44, SHIN = 0.44, ANKLE = 0.06;
const UPPER = 0.29, FORE = 0.27, HAND = 0.07;
const SHOULDER: Vec3 = [0.19, 0.46, 0];
const EYE_Y = 1.62;
export const STUDENT_EYE = EYE_Y;

const NAVY = '#1c2d58', NAVY_DK = '#15213f', ORANGE = '#f06721', SILVER = '#d9dde1';
const SKIN = '#b67b55', HAIR = '#21170f';
const GLOVE: Record<Exclude<Gloves, null>, string> = { leather: '#a8743f', nitrile: '#3769d1', insulated: '#e0601a' };

function M({ color, rough = 0.75, metal = 0, emissive, glow = 0, opacity, map }: {
  color: string; rough?: number; metal?: number; emissive?: string; glow?: number; opacity?: number; map?: THREE.Texture | null;
}) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000'} emissiveIntensity={glow}
    transparent={opacity !== undefined || !!map} opacity={opacity ?? 1} depthWrite={opacity === undefined} map={map ?? null}
    alphaTest={map ? 0.05 : 0} side={opacity !== undefined ? THREE.DoubleSide : THREE.FrontSide} />;
}

/** A limb segment hanging down from its joint (capsule along −y). */
function Limb({ len, r, color, r2 }: { len: number; r: number; color: string; r2?: number }) {
  const geo = useMemo(() => {
    const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 6, 14);
    if (r2 && r2 !== r) {
      // Taper towards the far end.
      const p = g.attributes.position!;
      for (let i = 0; i < p.count; i++) { const k = THREE.MathUtils.clamp((p.getY(i) + len / 2) / len, 0, 1); const s = r2 / r + (1 - r2 / r) * k; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); }
      g.computeVertexNormals();
    }
    g.translate(0, -len / 2, 0);
    return g;
  }, [len, r, r2]);
  return <mesh geometry={geo} castShadow receiveShadow><M color={color} /></mesh>;
}

/** Reflective hi-vis band around a limb or the body. */
const Band = ({ y, r, h = 0.035 }: { y: number; r: number; h?: number }) => (
  <group position={[0, y, 0]}>
    <mesh><cylinderGeometry args={[r, r, h, 16, 1, true]} /><M color={ORANGE} rough={0.4} emissive={ORANGE} glow={0.15} /></mesh>
    <mesh><cylinderGeometry args={[r + 0.002, r + 0.002, h * 0.35, 16, 1, true]} /><M color={SILVER} rough={0.2} metal={0.6} /></mesh>
  </group>
);

function Hand({ side }: { side: 1 | -1 }) {
  return (
    <group>
      {/* Bare hand, and one variant per glove; the frame loop shows the right one. */}
      {(['skin', 'leather', 'nitrile', 'insulated'] as const).map((k) => {
        const c = k === 'skin' ? SKIN : GLOVE[k];
        return (
          <group key={k} name={`hand-${k}`} visible={k === 'skin'}>
            <mesh position={[0, -0.045, 0.005]} castShadow><boxGeometry args={[0.075, 0.09, 0.03]} /><M color={c} rough={k === 'nitrile' ? 0.35 : 0.8} /></mesh>
            <mesh position={[0, -0.1, 0.012]} rotation={[0.35, 0, 0]} castShadow><boxGeometry args={[0.07, 0.05, 0.025]} /><M color={c} rough={0.8} /></mesh>
            <mesh position={[side * -0.045, -0.04, 0.02]} rotation={[0.3, 0, side * 0.5]}><capsuleGeometry args={[0.012, 0.035, 4, 8]} /><M color={c} /></mesh>
            {k !== 'skin' && (
              <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[k === 'nitrile' ? 0.034 : 0.05, k === 'nitrile' ? 0.034 : 0.045, k === 'nitrile' ? 0.05 : 0.12, 14, 1, true]} />
                <M color={c} rough={0.7} opacity={0.999} /></mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Arm({ side, name }: { side: 1 | -1; name: 'R' | 'L' }) {
  return (
    <group name={`shoulder${name}`} position={[SHOULDER[0] * side, SHOULDER[1], SHOULDER[2]]}>
      <mesh castShadow><sphereGeometry args={[0.062, 14, 10]} /><M color={NAVY} /></mesh>
      <Limb len={UPPER} r={0.052} r2={0.045} color={NAVY} />
      <Band y={-0.17} r={0.051} />
      <group name={`elbow${name}`} position={[0, -UPPER, 0]}>
        <Limb len={FORE} r={0.045} r2={0.036} color={NAVY} />
        <group name={`cuff${name}`} position={[0, -FORE + 0.02, 0]} visible={false}>
          {/* A loose, undone cuff that can catch on a rotating chuck */}
          <mesh rotation={[0.25, 0, 0]}><cylinderGeometry args={[0.045, 0.075, 0.11, 12, 1, true]} /><M color={NAVY} opacity={0.999} /></mesh>
        </group>
        <group name={`watch${name}`} position={[0, -FORE + 0.035, 0]} visible={false}>
          <mesh><torusGeometry args={[0.037, 0.008, 6, 16]} /><M color="#d4af37" metal={0.9} rough={0.25} /></mesh>
        </group>
        <group name={`hand${name}`} position={[0, -FORE, 0]}>
          <Hand side={side} />
        </group>
      </group>
    </group>
  );
}

function Leg({ side, name }: { side: 1 | -1; name: 'R' | 'L' }) {
  return (
    <group name={`hip${name}`} position={[0.1 * side, -0.02, 0]}>
      <Limb len={THIGH} r={0.075} r2={0.058} color={NAVY} />
      <group name={`knee${name}`} position={[0, -THIGH, 0]}>
        <Limb len={SHIN - 0.02} r={0.058} r2={0.048} color={NAVY} />
        <Band y={-0.3} r={0.054} h={0.045} />
        <group name={`ankle${name}`} position={[0, -SHIN + ANKLE, 0]}>
          <group name="boots">
            <mesh position={[0, -0.03, 0.05]} castShadow><boxGeometry args={[0.11, 0.1, 0.27]} /><M color="#17191c" rough={0.6} /></mesh>
            <mesh position={[0, -0.02, 0.165]} castShadow><sphereGeometry args={[0.058, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><M color="#3c4148" metal={0.6} rough={0.35} /></mesh>
            <mesh position={[0, -0.075, 0.05]}><boxGeometry args={[0.12, 0.02, 0.29]} /><M color="#c8a227" rough={0.9} /></mesh>
          </group>
          <group name="trainers" visible={false}>
            <mesh position={[0, -0.035, 0.05]} castShadow><boxGeometry args={[0.1, 0.08, 0.26]} /><M color="#eef0f2" rough={0.7} /></mesh>
            <mesh position={[0, -0.07, 0.05]}><boxGeometry args={[0.105, 0.02, 0.27]} /><M color="#8a8f95" rough={0.9} /></mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function Head() {
  return (
    <group name="head" position={[0, 0.14, 0]}>
      <mesh scale={[1, 1.12, 1.04]} castShadow><sphereGeometry args={[0.105, 24, 18]} /><M color={SKIN} rough={0.6} /></mesh>
      {/* Hair */}
      <mesh position={[0, 0.02, -0.006]} scale={[1.04, 1.1, 1.08]}><sphereGeometry args={[0.105, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.46]} /><M color={HAIR} rough={0.9} /></mesh>
      {/* Face */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0.037 * s, 0.012, 0.094]}><sphereGeometry args={[0.012, 10, 8]} /><M color="#f4f1ea" rough={0.3} /></mesh>
          <mesh position={[0.037 * s, 0.012, 0.104]}><sphereGeometry args={[0.0065, 8, 6]} /><M color="#1d140e" rough={0.2} /></mesh>
          <mesh position={[0.038 * s, 0.038, 0.098]} rotation={[0, 0, s * -0.12]}><boxGeometry args={[0.03, 0.007, 0.008]} /><M color={HAIR} /></mesh>
          <mesh position={[0.104 * s, 0, 0]} scale={[0.4, 1, 0.7]}><sphereGeometry args={[0.025, 10, 8]} /><M color={SKIN} /></mesh>
        </group>
      ))}
      <mesh position={[0, -0.012, 0.107]} rotation={[0.3, 0, 0]}><boxGeometry args={[0.02, 0.04, 0.025]} /><M color="#a86f4b" /></mesh>
      <mesh position={[0, -0.05, 0.096]}><boxGeometry args={[0.035, 0.006, 0.006]} /><M color="#7a3f33" /></mesh>
      {/* Short beard line */}
      <mesh position={[0, -0.062, 0.035]} scale={[1, 0.55, 1]}><sphereGeometry args={[0.092, 18, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} /><M color="#3a281b" rough={0.95} /></mesh>

      <group name="ppe-glasses" visible={false}>
        <mesh position={[0, 0.012, 0.004]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.118, 0.115, 0.05, 24, 1, true, Math.PI * 0.68, Math.PI * 0.64]} />
          <meshPhysicalMaterial color="#cfeaff" transparent opacity={0.35} roughness={0.05} metalness={0} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0.04, 0.004]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.12, 0.12, 0.008, 24, 1, true, Math.PI * 0.66, Math.PI * 0.68]} /><M color="#1b1e22" /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[0.112 * s, 0.03, -0.04]}><boxGeometry args={[0.006, 0.01, 0.1]} /><M color="#1b1e22" /></mesh>)}
      </group>
      <group name="ppe-earmuffs" visible={false}>
        <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.125, 0.012, 8, 24, Math.PI]} /><M color="#222" /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[0.118 * s, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.04, 18]} /><M color={ORANGE} rough={0.45} /></mesh>)}
      </group>
      <group name="ppe-welding" visible={false}>
        <mesh position={[0, -0.005, 0.02]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.135, 0.125, 0.3, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9]} /><M color="#24272b" rough={0.5} opacity={0.999} /></mesh>
        <mesh position={[0, 0.015, 0.14]}><boxGeometry args={[0.11, 0.055, 0.01]} /><M color="#0e3b1e" rough={0.1} metal={0.5} emissive="#0b2a14" glow={0.4} /></mesh>
        <mesh position={[0, 0.115, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.11, 0.01, 6, 20]} /><M color="#333" /></mesh>
        <Plate3 text="WABYS" y={-0.08} />
      </group>
      <group name="ppe-visor" visible={false}>
        <mesh position={[0, 0.0, 0.01]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.145, 0.15, 0.25, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
          <meshPhysicalMaterial color="#d9f0ff" transparent opacity={0.28} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0.12, 0.0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.112, 0.012, 6, 20]} /><M color="#2c3e66" /></mesh>
      </group>
      <group name="ppe-mask" visible={false}>
        <mesh position={[0, -0.045, 0.085]} scale={[1, 0.8, 0.7]}><sphereGeometry args={[0.06, 14, 10]} /><M color="#5c6168" rough={0.6} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[0.055 * s, -0.06, 0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.03, 14]} /><M color="#e889a7" rough={0.6} /></mesh>)}
      </group>
    </group>
  );
}

/** A small printed label on the welding helmet. */
function Plate3({ text, y }: { text: string; y: number }) {
  const tex = useMemo(() => wabysTex('patch', text), [text]);
  return <mesh position={[0, y, 0.15]}><planeGeometry args={[0.09, 0.045]} /><M color="#ffffff" map={tex} rough={0.5} /></mesh>;
}

function Body() {
  const patch = useMemo(() => wabysTex('patch'), []);
  const back = useMemo(() => wabysTex('back', 'WABYS STUDENT · متدرب'), []);
  return (
    <>
      {/* Pelvis and belt */}
      <mesh position={[0, 0.02, 0]} scale={[1, 0.8, 0.72]} castShadow><sphereGeometry args={[0.152, 18, 12]} /><M color={NAVY} /></mesh>
      <mesh position={[0, 0.08, 0]} scale={[1, 1, 0.72]}><cylinderGeometry args={[0.152, 0.152, 0.045, 20]} /><M color="#1a1a1a" rough={0.5} /></mesh>
      <mesh position={[0, 0.08, 0.11]}><boxGeometry args={[0.05, 0.035, 0.03]} /><M color="#9aa3ab" metal={0.8} rough={0.3} /></mesh>
      <group name="spine" position={[0, 0.06, 0]}>
        <mesh position={[0, 0.22, 0]} scale={[1, 1, 0.66]} castShadow receiveShadow>
          <cylinderGeometry args={[0.178, 0.148, 0.42, 22]} /><M color={NAVY} />
        </mesh>
        <mesh position={[0, 0.43, 0]} scale={[1, 0.42, 0.66]} castShadow><sphereGeometry args={[0.178, 22, 12]} /><M color={NAVY} /></mesh>
        <group scale={[1, 1, 0.66]}><Band y={0.3} r={0.17} h={0.04} /><Band y={0.08} r={0.156} h={0.04} /></group>
        {/* Zip, chest patch, back print, collar */}
        <mesh position={[0, 0.25, 0.112]}><boxGeometry args={[0.012, 0.38, 0.006]} /><M color="#0e1630" /></mesh>
        <mesh position={[-0.075, 0.36, 0.111]} rotation={[-0.12, 0.2, 0]}><planeGeometry args={[0.12, 0.06]} /><M color="#ffffff" map={patch} rough={0.6} /></mesh>
        <mesh position={[0, 0.3, -0.116]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.28, 0.14]} /><M color="#ffffff" map={back} rough={0.6} /></mesh>
        <mesh position={[0, 0.5, 0]}><torusGeometry args={[0.075, 0.025, 8, 18]} /><M color={NAVY_DK} /></mesh>
        <group name="ppe-apron" visible={false}>
          <mesh position={[0, 0.05, 0.125]}><boxGeometry args={[0.3, 0.62, 0.012]} /><M color="#7a4a2a" rough={0.85} /></mesh>
          <mesh position={[0, 0.48, 0.07]} rotation={[0.9, 0, 0]}><torusGeometry args={[0.09, 0.008, 6, 16, Math.PI]} /><M color="#5b3820" /></mesh>
        </group>
        <group name="neck" position={[0, 0.5, 0]}>
          <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.048, 0.055, 0.1, 14]} /><M color={SKIN} rough={0.6} /></mesh>
          <Head />
        </group>
        <Arm side={-1} name="R" />
        <Arm side={1} name="L" />
      </group>
      <Leg side={-1} name="R" />
      <Leg side={1} name="L" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Pose solver
// ---------------------------------------------------------------------------
interface Joints { spine: number; head: number; hipR: number; hipL: number; kneeR: number; kneeL: number; shR: Vec3; shL: Vec3; elR: number; elL: number; lean: number }
const REST: Joints = { spine: 0.02, head: 0.05, hipR: 0, hipL: 0, kneeR: 0.04, kneeL: 0.04, shR: [0.05, 0, -0.1], shL: [0.05, 0, 0.1], elR: -0.18, elL: -0.18, lean: 0 };

function poseJoints(pose: Pose, phase: number, t: number): Joints {
  const j: Joints = { ...REST, shR: [...REST.shR], shL: [...REST.shL] };
  const breathe = Math.sin(t * 1.6) * 0.012;
  j.spine += breathe;
  switch (pose) {
    case 'walk': {
      const s = Math.sin(phase);
      j.hipR = -0.42 * s; j.hipL = 0.42 * s;
      j.kneeR = 0.15 + Math.max(0, Math.sin(phase + 1.2)) * 0.75; j.kneeL = 0.15 + Math.max(0, Math.sin(phase + Math.PI + 1.2)) * 0.75;
      j.shR = [0.38 * s, 0, -0.08]; j.shL = [-0.38 * s, 0, 0.08]; j.elR = -0.35 - Math.max(0, s) * 0.2; j.elL = -0.35 - Math.max(0, -s) * 0.2;
      j.spine = 0.06; j.head = 0.02;
      break;
    }
    case 'inspect': j.spine = 0.42; j.head = 0.35; j.hipR = j.hipL = -0.22; j.kneeR = j.kneeL = 0.32; j.shL = [-0.35, 0, 0.15]; j.elL = -0.6; break;
    case 'measure': j.spine = 0.28; j.head = 0.4; j.hipR = j.hipL = -0.12; j.kneeR = j.kneeL = 0.18; break;
    case 'weld': j.spine = 0.3; j.head = 0.45; j.hipR = -0.3; j.hipL = -0.2; j.kneeR = 0.45; j.kneeL = 0.35; break;
    case 'crouch': j.spine = 0.35; j.head = 0.25; j.hipR = -1.35; j.hipL = -1.2; j.kneeR = 2.1; j.kneeL = 1.9; j.shL = [-0.6, 0, 0.12]; j.elL = -0.5; break;
    case 'lift': j.spine = 0.25; j.head = 0.1; j.hipR = j.hipL = -0.9; j.kneeR = j.kneeL = 1.4; j.shR = [-0.7, 0, -0.1]; j.shL = [-0.7, 0, 0.1]; j.elR = j.elL = -0.3; break;
    case 'point': j.spine = 0.05; j.head = 0.1; break;
    case 'operate': j.spine = 0.1; j.head = 0.15; break;
    case 'reach': j.spine = 0.2; j.head = 0.25; j.hipR = -0.08; j.kneeR = 0.12; break;
    case 'hurt': {
      const shake = Math.sin(t * 30) * 0.03;
      j.spine = -0.18 + shake; j.head = -0.25; j.hipR = 0.12; j.hipL = -0.2; j.kneeR = 0.25; j.kneeL = 0.35; j.lean = -0.06;
      break;
    }
    default: break;
  }
  return j;
}

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/** Point an arm's shoulder and elbow so its hand lands on `target` (in the spine's space). */
function solveArm(shoulder: THREE.Object3D, elbow: THREE.Object3D, target: THREE.Vector3, side: 1 | -1, k: number) {
  const d = tmpV.copy(target).sub(shoulder.position);
  const L1 = UPPER, L2 = FORE + HAND;
  const dist = THREE.MathUtils.clamp(d.length(), 0.08, L1 + L2 - 0.002);
  const dir = d.normalize();
  const a1 = Math.acos(THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  const a2 = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
  // Elbows point down, back and a little outward.
  const pole = tmpW.set(side * 0.55, -0.5, -1).normalize();
  const n = new THREE.Vector3().crossVectors(dir, pole);
  if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
  n.normalize();
  const q0 = new THREE.Quaternion().setFromUnitVectors(DOWN, dir);
  const qs = new THREE.Quaternion().setFromAxisAngle(n, a1).multiply(q0);
  shoulder.quaternion.slerp(qs, k);
  const nLocal = n.clone().applyQuaternion(qs.clone().invert());
  const qe = new THREE.Quaternion().setFromAxisAngle(nLocal, -(Math.PI - a2));
  elbow.quaternion.slerp(qe, k);
}

function setRot(o: THREE.Object3D | undefined, x: number, y: number, z: number, k: number) {
  if (!o) return;
  tmpQ.setFromEuler(tmpE.set(x, y, z));
  o.quaternion.slerp(tmpQ, k);
}

interface Rig {
  hips: THREE.Object3D; spine: THREE.Object3D; neck: THREE.Object3D; head: THREE.Object3D;
  shR: THREE.Object3D; shL: THREE.Object3D; elR: THREE.Object3D; elL: THREE.Object3D;
  hipR: THREE.Object3D; hipL: THREE.Object3D; knR: THREE.Object3D; knL: THREE.Object3D;
  ppe: Record<string, THREE.Object3D[]>;
}

function findRig(root: THREE.Object3D): Rig {
  const g = (n: string) => root.getObjectByName(n)!;
  const all = (n: string) => { const out: THREE.Object3D[] = []; root.traverse((o) => { if (o.name === n) out.push(o); }); return out; };
  return {
    hips: g('hips'), spine: g('spine'), neck: g('neck'), head: g('head'),
    shR: g('shoulderR'), shL: g('shoulderL'), elR: g('elbowR'), elL: g('elbowL'),
    hipR: g('hipR'), hipL: g('hipL'), knR: g('kneeR'), knL: g('kneeL'),
    ppe: Object.fromEntries(['ppe-glasses', 'ppe-earmuffs', 'ppe-welding', 'ppe-visor', 'ppe-mask', 'ppe-apron', 'boots', 'trainers',
      'hand-skin', 'hand-leather', 'hand-nitrile', 'hand-insulated', 'cuffR', 'cuffL', 'watchL', 'watchR'].map((n) => [n, all(n)])),
  };
}

const show = (r: Rig, n: string, v: boolean) => { for (const o of r.ppe[n] ?? []) o.visible = v; };

/**
 * The student, placed in the machine's model space. Put it inside the same
 * group as the machine's parts, so `state` positions are model units.
 */
export function Student({ state, env }: { state: React.RefObject<StudentState | null>; env: ModelEnv }) {
  const root = useRef<THREE.Group>(null!);
  const rig = useRef<Rig | null>(null);
  const phase = useRef(0);
  const clock = useRef(0);
  const u = env.unitsPerM;
  const floor = env.floorY ?? -1.25;
  const local = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const s = state.current;
    const g = root.current;
    if (!s || !g) return;
    g.visible = s.visible;
    if (!s.visible) return;
    const dt = Math.min(rawDt, 0.1);
    clock.current += dt;
    rig.current ??= findRig(g);
    const r = rig.current;
    g.position.set(s.pos.x, floor, s.pos.z);
    g.rotation.y = s.yaw;
    g.scale.setScalar(u);
    phase.current += dt * (s.speed / 0.62) * Math.PI;

    // PPE
    const p = s.ppe;
    show(r, 'ppe-glasses', !!p.glasses && p.helmet !== 'welding');
    show(r, 'ppe-earmuffs', !!p.earmuffs && p.helmet !== 'welding');
    show(r, 'ppe-welding', p.helmet === 'welding');
    show(r, 'ppe-visor', p.helmet === 'visor');
    show(r, 'ppe-mask', !!p.mask && p.helmet !== 'welding');
    show(r, 'ppe-apron', !!p.apron);
    show(r, 'boots', p.boots !== false);
    show(r, 'trainers', p.boots === false);
    for (const k of ['skin', 'leather', 'nitrile', 'insulated']) show(r, `hand-${k}`, (p.gloves ?? 'skin') === k);
    show(r, 'cuffR', !!p.looseSleeves); show(r, 'cuffL', !!p.looseSleeves);
    show(r, 'watchL', !!p.jewellery && !p.gloves);
    r.head.visible = !s.firstPerson;

    // Body pose
    const moving = s.speed > 0.05;
    const pose: Pose = moving ? 'walk' : s.pose;
    const j = poseJoints(pose, phase.current, clock.current);
    const k = 1 - Math.exp(-(moving ? 14 : 8) * dt);
    setRot(r.spine, j.spine, 0, 0, k);
    setRot(r.hipR, j.hipR, 0, 0.02, k); setRot(r.hipL, j.hipL, 0, -0.02, k);
    setRot(r.knR, j.kneeR, 0, 0, k); setRot(r.knL, j.kneeL, 0, 0, k);
    // Keep the feet on the floor whatever the legs do.
    const legH = (h: number, kn: number) => ANKLE + THIGH * Math.cos(h) + SHIN * Math.cos(h + kn);
    const hipY = Math.min(legH(j.hipR, j.kneeR), legH(j.hipL, j.kneeL)) + 0.02 + (moving ? Math.abs(Math.sin(phase.current)) * 0.025 : 0);
    r.hips.position.y += (hipY - r.hips.position.y) * k;
    r.hips.position.z += (j.lean - r.hips.position.z) * k;

    // Head looks towards the look target (or the hand's target).
    const look = s.look ?? s.reach;
    let headYaw = 0, headPitch = j.head;
    if (look && !moving) {
      local.copy(look).sub(g.position).divideScalar(u).applyAxisAngle(new THREE.Vector3(0, 1, 0), -s.yaw);
      const dy = local.y - EYE_Y;
      headYaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.0, 1.0);
      headPitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(local.x, local.z)) - j.spine, -0.5, 0.75);
    }
    setRot(r.neck, headPitch * 0.4, headYaw * 0.5, 0, k);
    setRot(r.head, headPitch * 0.6, headYaw * 0.5, 0, k);

    // Arms: IK to the reach target, else the pose's angles.
    const ikR = !moving && s.reach && ['reach', 'operate', 'measure', 'weld', 'point', 'inspect'].includes(pose);
    const ikBoth = !moving && (pose === 'measure' || pose === 'weld' || pose === 'hurt');
    if (ikR || ikBoth) g.updateWorldMatrix(true, true);
    if (ikR && s.reach) {
      const tw = g.parent ? g.parent.localToWorld(local.copy(s.reach)) : local.copy(s.reach);
      const tSpine = r.spine.worldToLocal(tw.clone());
      solveArm(r.shR, r.elR, tSpine, -1, k);
      if (ikBoth) solveArm(r.shL, r.elL, tSpine.clone().add(new THREE.Vector3(0.13, 0.02, -0.04)), 1, k);
      else { setRot(r.shL, j.shL[0], j.shL[1], j.shL[2], k); setRot(r.elL, j.elL, 0, 0, k); }
    } else if (pose === 'hurt') {
      // Hands to the face.
      const face = new THREE.Vector3(0, 0.62, 0.14);
      solveArm(r.shR, r.elR, face.clone().add(new THREE.Vector3(-0.04, 0, 0)), -1, k);
      solveArm(r.shL, r.elL, face.clone().add(new THREE.Vector3(0.04, 0, 0)), 1, k);
    } else {
      setRot(r.shR, j.shR[0], j.shR[1], j.shR[2], k); setRot(r.elR, j.elR, 0, 0, k);
      setRot(r.shL, j.shL[0], j.shL[1], j.shL[2], k); setRot(r.elL, j.elL, 0, 0, k);
    }
  });

  return (
    <group ref={root}>
      <group name="hips" position={[0, HIP_Y, 0]}>
        <Body />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Walking between stations, round the machine
// ---------------------------------------------------------------------------
export type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Does the segment a→b pass through the rectangle? (Liang–Barsky) */
function hits(ax: number, az: number, bx: number, bz: number, r: Rect) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, ax - r.minX) && clip(dx, r.maxX - ax) && clip(-dz, az - r.minZ) && clip(dz, r.maxZ - az) && t1 - t0 > 1e-4;
}

/** Shortest walk from a to b that goes round the machine's footprint (corner waypoints, Dijkstra). */
export function planPath(a: [number, number], b: [number, number], box: Rect | null, margin: number): [number, number][] {
  if (!box) return [b];
  const r = { minX: box.minX - margin * 0.6, maxX: box.maxX + margin * 0.6, minZ: box.minZ - margin * 0.6, maxZ: box.maxZ + margin * 0.6 };
  if (!hits(a[0], a[1], b[0], b[1], r)) return [b];
  const c = { minX: box.minX - margin, maxX: box.maxX + margin, minZ: box.minZ - margin, maxZ: box.maxZ + margin };
  const nodes: [number, number][] = [a, b, [c.minX, c.minZ], [c.maxX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ]];
  const n = nodes.length;
  const dist = Array(n).fill(Infinity); const prev = Array(n).fill(-1); const done = Array(n).fill(false);
  dist[0] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || hits(nodes[u]![0], nodes[u]![1], nodes[v]![0], nodes[v]![1], r)) continue;
      const w = Math.hypot(nodes[u]![0] - nodes[v]![0], nodes[u]![1] - nodes[v]![1]);
      if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
  }
  if (prev[1] < 0) return [b];
  const out: [number, number][] = [];
  for (let v = 1; v > 0; v = prev[v]) out.unshift(nodes[v]!);
  return out;
}

export const pathLength = (from: [number, number], path: [number, number][]) => {
  let l = 0, p = from;
  for (const q of path) { l += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
  return l;
};

/** Position and heading a distance `d` along a path. */
export function alongPath(from: [number, number], path: [number, number][], d: number): { x: number; z: number; yaw: number; done: boolean } {
  let p = from;
  for (const q of path) {
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    if (d <= l) { const k = l ? d / l : 1; return { x: p[0] + (q[0] - p[0]) * k, z: p[1] + (q[1] - p[1]) * k, yaw, done: false }; }
    d -= l; p = q;
  }
  const last = path.length ? path[path.length - 1]! : from;
  const before = path.length > 1 ? path[path.length - 2]! : from;
  return { x: last[0], z: last[1], yaw: Math.atan2(last[0] - before[0], last[1] - before[1]), done: true };
}

/** Shortest signed angle from a to b. */
export const angleTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * Walks the student to a station at a steady pace, then turns to face the work
 * and takes the station's pose. Call `step` every frame.
 */
export class Walker {
  private path: [number, number][] = [];
  private from: [number, number] = [0, 0];
  private d = 0;
  private total = 0;
  target: StationDef | null = null;
  arrived = true;
  constructor(private s: StudentState, private env: ModelEnv, private box: () => Rect | null) {}

  go(st: StationDef) {
    this.target = st;
    this.from = [this.s.pos.x, this.s.pos.z];
    this.path = planPath(this.from, st.pos, this.box(), 0.55 * this.env.unitsPerM);
    this.total = pathLength(this.from, this.path);
    this.d = 0;
    this.arrived = this.total < 0.02;
    if (this.arrived) this.arrive();
  }

  private arrive() {
    const st = this.target!;
    this.s.pos.set(st.pos[0], 0, st.pos[1]);
    this.s.speed = 0;
    this.s.pose = st.pose ?? 'idle';
    this.s.reach = st.reach ? new THREE.Vector3(...st.reach) : null;
    this.arrived = true;
  }

  step(dt: number, pace = 1) {
    const s = this.s;
    if (!this.arrived && this.target) {
      const v = 1.25 * pace; // m/s
      this.d += v * this.env.unitsPerM * dt;
      const at = alongPath(this.from, this.path, this.d);
      s.pos.set(at.x, 0, at.z);
      s.yaw += angleTo(s.yaw, at.yaw) * Math.min(1, dt * 10);
      s.speed = v; s.reach = null; s.pose = 'walk';
      if (at.done || this.d >= this.total) this.arrive();
    } else if (this.target) {
      s.yaw += angleTo(s.yaw, this.target.face) * Math.min(1, dt * 6);
    }
  }
}
