/**
 * The WABYS student, modelled on the student's photo (short dark curly hair,
 * navy WABYS coverall with a shirt collar over a white T-shirt, chest pockets
 * and a leg pocket with pens), who stands, walks and works at the machine at
 * true scale. Built in metres (1.75 m tall,
 * feet at the origin, facing +z) and placed in the machine's model space by
 * the scene, so a right hand can reach a real point on the machine (two-bone
 * IK). PPE is worn or not item by item, so the learner sees exactly what the
 * student has on: safety glasses, ear defenders, welding helmet, face shield,
 * respirator, gloves of three kinds, a leather apron, safety boots or
 * trainers, and the hazards (a watch and ring, loose cuffs). The right hand
 * can hold a tool (chuck key, chip hook, tester, torch…) whose tip, not the
 * palm, lands on the target, and gloved or bare fingers close round a grip.
 *
 * Motion is blended, never switched: a heel-to-toe walk whose stride grows
 * with speed, breathing and a slow weight shift when standing, feet that
 * shuffle when turning on the spot, a hand that travels on a spring, stops
 * short and then presses or grips, and a body that leans and bends to reach.
 *
 * The student is driven through a mutable `StudentState` (updated per frame
 * by the explorer, a lesson timeline or the safety simulator), so walking and
 * poses never cause React re-renders.
 */
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
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
  /** A hand tool in the right hand. */
  hold?: Tool | null;
  /** Changes whenever the hand goes for something new, so it approaches it afresh (a moving target keeps its key). */
  reachKey?: string;
}

export function newStudent(env: ModelEnv | undefined, ppe: PPE = { boots: true }): StudentState {
  const home = env?.stations[0];
  return {
    pos: new THREE.Vector3(home?.pos[0] ?? 2.5, 0, home?.pos[1] ?? 2), yaw: home?.face ?? Math.PI, pose: home?.pose ?? 'idle',
    reach: null, look: null, ppe, speed: 0, firstPerson: false, visible: true, hold: null,
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
/** The student's head (for a camera that looks through their eyes). */
export const STUDENT_HEAD = 'wabys-student-head';
/** Comfortable walking pace, m/s. */
export const WALK_SPEED = 1.25;

// Matched to the WABYS student's photo: navy coverall with a shirt collar, a
// white T-shirt at the neck, chest pockets, short dark curly hair.
const NAVY = '#26365c', NAVY_DK = '#1b2745', NAVY_SEAM = '#1f2d4f', ORANGE = '#f06721';
const SKIN = '#c08a66', SKIN_DK = '#a8714f', HAIR = '#16110d', TEE = '#eeeae4';
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

/** A stitched seam or buttoned cuff round a limb. */
const Seam = ({ y, r, h = 0.03, color = NAVY_SEAM }: { y: number; r: number; h?: number; color?: string }) => (
  <mesh position={[0, y, 0]}><cylinderGeometry args={[r, r, h, 16, 1, true]} /><M color={color} rough={0.85} /></mesh>
);

// ---------------------------------------------------------------------------
// Hands and what they hold
// ---------------------------------------------------------------------------
/** Hand tools the student can hold in the right hand. */
export type Tool = 'chuckkey' | 'hook' | 'brush' | 'micrometer' | 'tester' | 'spanner' | 'irgun' | 'padlock' | 'key' | 'torch' | 'gauge' | 'pliers';
/** How far each tool's working end sits beyond the palm, so the tip (not the palm) lands on the target. */
const TOOL_LEN: Record<Tool, number> = {
  chuckkey: 0.13, hook: 0.36, brush: 0.2, micrometer: 0.07, tester: 0.15, spanner: 0.16, irgun: 0.1, padlock: 0.04, key: 0.04, torch: 0.22, gauge: 0.06, pliers: 0.15,
};
const TOOLS = Object.keys(TOOL_LEN) as Tool[];

function Hand({ side }: { side: 1 | -1 }) {
  // The palm faces the body (x towards the midline), the thumb forward (+z).
  const toward = -side;
  return (
    <group>
      {/* Bare hand, and one variant per glove; the frame loop shows the right one. Every variant has fingers that close round a grip. */}
      {(['skin', 'leather', 'nitrile', 'insulated'] as const).map((k) => {
        const c = k === 'skin' ? SKIN : GLOVE[k];
        const rough = k === 'nitrile' ? 0.35 : k === 'skin' ? 0.6 : 0.85;
        const fat = k === 'skin' ? 1 : k === 'nitrile' ? 1.08 : 1.25;
        return (
          <group key={k} name={`hand-${k}`} visible={k === 'skin'}>
            <mesh position={[0, -0.042, 0]} castShadow><boxGeometry args={[0.03 * fat, 0.085, 0.078 * fat]} /><M color={c} rough={rough} /></mesh>
            <group name="fingers" position={[0, -0.085, 0]}>
              {[-0.027, -0.009, 0.009, 0.027].map((z, i) => (
                <mesh key={z} position={[0, -0.024 + (i === 0 ? 0.006 : 0), z * fat]} castShadow>
                  <capsuleGeometry args={[0.0088 * fat, i === 0 ? 0.03 : 0.04, 4, 8]} /><M color={c} rough={rough} />
                </mesh>
              ))}
            </group>
            <group name="thumb" position={[toward * 0.01, -0.03, 0.04 * fat]} rotation={[0.5, 0, toward * -0.25]}>
              <mesh position={[0, -0.022, 0]} castShadow><capsuleGeometry args={[0.011 * fat, 0.03, 4, 8]} /><M color={c} rough={rough} /></mesh>
            </group>
            {k !== 'skin' && (
              // Gauntlet cuff over the sleeve
              <mesh position={[0, k === 'nitrile' ? 0.02 : 0.05, 0]}><cylinderGeometry args={[k === 'nitrile' ? 0.036 : 0.052, k === 'nitrile' ? 0.034 : 0.044, k === 'nitrile' ? 0.05 : 0.13, 14, 1, true]} />
                <M color={c} rough={rough} opacity={0.999} /></mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** The tools, held in the right fist. Their working end points on down the forearm's line. */
function Tools() {
  const steel = '#b9c0c7', dark = '#2a2d31';
  const at: Vec3 = [0.008, -0.09, 0];
  const S = ({ c = steel, m = 0.85 }: { c?: string; m?: number }) => <M color={c} metal={m} rough={0.3} />;
  return (
    <group name="tools" position={at}>
      <group name="tool-chuckkey" visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.011, 0.011, 0.17, 8]} /><S /></mesh>
        <mesh position={[0, -0.07, 0]}><cylinderGeometry args={[0.009, 0.009, 0.13, 8]} /><S /></mesh>
        <mesh position={[0, -0.14, 0]}><boxGeometry args={[0.016, 0.022, 0.016]} /><S c="#8d949b" /></mesh>
      </group>
      <group name="tool-hook" visible={false}>
        <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.016, 0.016, 0.11, 10]} /><M color="#d63b22" rough={0.5} /></mesh>
        <mesh position={[0, -0.19, 0]}><cylinderGeometry args={[0.005, 0.005, 0.32, 6]} /><S /></mesh>
        <mesh position={[0.012, -0.355, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.014, 0.005, 6, 10, Math.PI]} /><S /></mesh>
      </group>
      <group name="tool-brush" visible={false}>
        <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.013, 0.013, 0.22, 8]} /><M color="#9a6a3a" rough={0.7} /></mesh>
        <mesh position={[0, -0.19, 0]}><boxGeometry args={[0.03, 0.06, 0.05]} /><M color="#3a3026" rough={0.95} /></mesh>
      </group>
      <group name="tool-micrometer" visible={false}>
        <mesh position={[0.03, -0.04, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.035, 0.008, 6, 14, Math.PI]} /><M color="#3d4b8a" rough={0.5} /></mesh>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.011, 0.011, 0.07, 10]} /><S /></mesh>
      </group>
      <group name="tool-tester" visible={false}>
        <mesh position={[0, -0.01, 0]}><boxGeometry args={[0.03, 0.12, 0.05]} /><M color="#f2c230" rough={0.5} /></mesh>
        <mesh position={[0, -0.02, 0.026]}><boxGeometry args={[0.02, 0.03, 0.004]} /><M color="#1f6e3a" emissive="#2fbf5f" glow={0.6} /></mesh>
        <mesh position={[0, -0.11, 0.012]}><cylinderGeometry args={[0.004, 0.004, 0.09, 6]} /><M color="#c8312b" /></mesh>
        <mesh position={[0, -0.11, -0.012]}><cylinderGeometry args={[0.004, 0.004, 0.09, 6]} /><M color={dark} /></mesh>
      </group>
      <group name="tool-spanner" visible={false}>
        <mesh position={[0, -0.06, 0]}><boxGeometry args={[0.008, 0.2, 0.024]} /><S /></mesh>
        <mesh position={[0, -0.165, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.018, 0.006, 6, 12]} /><S /></mesh>
      </group>
      <group name="tool-irgun" visible={false}>
        <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.03, 0.09, 0.035]} /><M color="#d8dbe0" rough={0.5} /></mesh>
        <mesh position={[0, -0.06, 0.02]} rotation={[-0.6, 0, 0]}><boxGeometry args={[0.035, 0.08, 0.05]} /><M color="#e05a1c" rough={0.5} /></mesh>
        <mesh position={[0, -0.095, 0.045]}><sphereGeometry args={[0.006, 8, 6]} /><M color="#ff3030" emissive="#ff2020" glow={2} /></mesh>
      </group>
      <group name="tool-padlock" visible={false}>
        <mesh position={[0, -0.02, 0]}><boxGeometry args={[0.025, 0.04, 0.04]} /><M color="#c8312b" rough={0.5} /></mesh>
        <mesh position={[0, -0.05, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.013, 0.004, 6, 10, Math.PI]} /><S /></mesh>
      </group>
      <group name="tool-key" visible={false}>
        <mesh position={[0, -0.01, 0]}><boxGeometry args={[0.008, 0.03, 0.025]} /><M color={dark} rough={0.5} /></mesh>
        <mesh position={[0, -0.035, 0]}><boxGeometry args={[0.004, 0.03, 0.008]} /><S c="#d9c27a" /></mesh>
      </group>
      <group name="tool-torch" visible={false}>
        <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.017, 0.015, 0.12, 10]} /><M color={dark} rough={0.6} /></mesh>
        <mesh position={[0, -0.09, 0.012]} rotation={[0.25, 0, 0]}><cylinderGeometry args={[0.008, 0.008, 0.09, 8]} /><S c="#8a8f95" /></mesh>
        <mesh position={[0, -0.16, 0.03]} rotation={[0.25, 0, 0]}><cylinderGeometry args={[0.012, 0.016, 0.06, 10]} /><S c="#c9a24a" /></mesh>
        <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.012, 0.012, 0.04, 8]} /><M color="#111" /></mesh>
      </group>
      <group name="tool-gauge" visible={false}>
        <mesh position={[0, -0.03, 0]}><boxGeometry args={[0.003, 0.08, 0.05]} /><S /></mesh>
      </group>
      <group name="tool-pliers" visible={false}>
        {[-1, 1].map((s) => <mesh key={s} position={[0, -0.03, s * 0.008]} rotation={[s * 0.08, 0, 0]}><boxGeometry args={[0.012, 0.13, 0.01]} /><M color="#c8312b" rough={0.5} /></mesh>)}
        <mesh position={[0, -0.12, 0]}><boxGeometry args={[0.01, 0.06, 0.016]} /><S /></mesh>
      </group>
    </group>
  );
}

function Arm({ side, name }: { side: 1 | -1; name: 'R' | 'L' }) {
  return (
    <group name={`shoulder${name}`} position={[SHOULDER[0] * side, SHOULDER[1], SHOULDER[2]]}>
      <mesh castShadow><sphereGeometry args={[0.062, 14, 10]} /><M color={NAVY} /></mesh>
      <Limb len={UPPER} r={0.054} r2={0.046} color={NAVY} />
      <group name={`elbow${name}`} position={[0, -UPPER, 0]}>
        <Limb len={FORE} r={0.046} r2={0.038} color={NAVY} />
        {/* Buttoned cuff */}
        <Seam y={-FORE + 0.035} r={0.04} h={0.04} />
        <group name={`cuff${name}`} position={[0, -FORE + 0.02, 0]} visible={false}>
          {/* A loose, undone cuff that can catch on a rotating chuck */}
          <mesh rotation={[0.25, 0, 0]}><cylinderGeometry args={[0.045, 0.075, 0.11, 12, 1, true]} /><M color={NAVY} opacity={0.999} /></mesh>
        </group>
        <group name={`watch${name}`} position={[0, -FORE + 0.035, 0]} visible={false}>
          <mesh><torusGeometry args={[0.041, 0.008, 6, 16]} /><M color="#d4af37" metal={0.9} rough={0.25} /></mesh>
        </group>
        <group name={`hand${name}`} position={[0, -FORE, 0]}>
          <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.03, 0.033, 0.03, 12]} /><M color={SKIN} rough={0.6} /></mesh>
          <Hand side={side} />
          {name === 'R' && <Tools />}
        </group>
      </group>
    </group>
  );
}

function Leg({ side, name }: { side: 1 | -1; name: 'R' | 'L' }) {
  return (
    <group name={`hip${name}`} position={[0.1 * side, -0.02, 0]}>
      <Limb len={THIGH} r={0.078} r2={0.06} color={NAVY} />
      {name === 'R' && (
        // Leg pocket with two pens, as in the photo
        <group position={[-0.055, -0.13, 0.04]} rotation={[0, -0.75, 0]}>
          <mesh><boxGeometry args={[0.012, 0.15, 0.1]} /><M color={NAVY_SEAM} /></mesh>
          <mesh position={[0.008, 0.06, 0.02]}><cylinderGeometry args={[0.005, 0.005, 0.05, 6]} /><M color="#2747b8" rough={0.4} /></mesh>
          <mesh position={[0.008, 0.06, -0.02]}><cylinderGeometry args={[0.005, 0.005, 0.045, 6]} /><M color="#111" rough={0.4} /></mesh>
        </group>
      )}
      <group name={`knee${name}`} position={[0, -THIGH, 0]}>
        <Limb len={SHIN - 0.02} r={0.06} r2={0.052} color={NAVY} />
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

/** Short, tight dark curls: tall on top, faded at the sides (one instanced mesh). */
function Curls() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const N = 230;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < N; i++) {
      // Golden-angle spiral over the crown, front hairline a little higher.
      const y = 1 - (i / (N - 1)) * 0.95;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (z > 0.45 && y < 0.72) continue; // forehead: the hairline sits high
      if (y < 0.18) continue; // sides are faded short
      const lift = 1 + Math.max(0, y - 0.4) * 0.32; // volume on top
      p.set(x * 0.105 * 1.02, 0.02 + y * 0.118 * lift, z * 0.108 * 1.02 - 0.004);
      const s = 0.017 + ((i * 7919) % 13) / 13 * 0.007;
      sc.setScalar(s);
      q.setFromEuler(new THREE.Euler(i * 0.7, i * 1.3, 0));
      m.compose(p, q, sc);
      ref.current.setMatrixAt(n++, m);
    }
    ref.current.count = n;
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} castShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={HAIR} roughness={0.95} />
    </instancedMesh>
  );
}

function Head() {
  return (
    <group name={STUDENT_HEAD} position={[0, 0.14, 0]}>
      <mesh scale={[0.93, 1.12, 1.02]} castShadow><sphereGeometry args={[0.105, 28, 20]} /><M color={SKIN} rough={0.55} /></mesh>
      {/* Jaw and chin */}
      <mesh position={[0, -0.058, 0.018]} scale={[0.76, 0.6, 0.8]}><sphereGeometry args={[0.09, 18, 12]} /><M color={SKIN} rough={0.55} /></mesh>
      {/* Hair: a close-cropped cap with curls on top */}
      <mesh position={[0, 0.012, -0.006]} rotation={[-0.42, 0, 0]} scale={[0.97, 1.08, 1.04]}><sphereGeometry args={[0.106, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><M color={HAIR} rough={0.95} /></mesh>
      <Curls />
      {/* Face */}
      <group name="eyes">
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[0.034 * s, 0.014, 0.092]} scale={[1.2, 0.8, 0.7]}><sphereGeometry args={[0.011, 10, 8]} /><M color="#f4f1ea" rough={0.3} /></mesh>
            <mesh position={[0.034 * s, 0.014, 0.1]}><sphereGeometry args={[0.0062, 8, 6]} /><M color="#24160e" rough={0.15} /></mesh>
          </group>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0.036 * s, 0.037, 0.096]} rotation={[0, s * 0.15, s * -0.08]}><boxGeometry args={[0.034, 0.008, 0.008]} /><M color={HAIR} /></mesh>
          <mesh position={[0.098 * s, 0.002, 0]} scale={[0.4, 1, 0.7]}><sphereGeometry args={[0.026, 10, 8]} /><M color={SKIN} /></mesh>
          {/* Cheeks lifted in a smile */}
          <mesh position={[0.042 * s, -0.016, 0.07]}><sphereGeometry args={[0.02, 10, 8]} /><M color={SKIN} rough={0.55} /></mesh>
        </group>
      ))}
      <mesh position={[0, -0.004, 0.1]} rotation={[0.25, 0, 0]} scale={[0.55, 1.2, 0.75]}><sphereGeometry args={[0.02, 10, 8]} /><M color={SKIN} rough={0.55} /></mesh>
      <mesh position={[0, -0.02, 0.104]} scale={[1.4, 0.8, 1]}><sphereGeometry args={[0.011, 8, 6]} /><M color={SKIN_DK} rough={0.55} /></mesh>
      {/* Closed-mouth smile */}
      <mesh position={[0, -0.03, 0.1]} rotation={[-0.2, 0, Math.PI * 1.1]}><torusGeometry args={[0.018, 0.003, 6, 14, Math.PI * 0.8]} /><M color="#7a3f33" rough={0.5} /></mesh>

      <group name="ppe-glasses" visible={false}>
        <mesh position={[0, 0.014, 0.004]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.112, 0.11, 0.05, 24, 1, true, Math.PI * 0.68, Math.PI * 0.64]} />
          <meshPhysicalMaterial color="#cfeaff" transparent opacity={0.35} roughness={0.05} metalness={0} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0.042, 0.004]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.114, 0.114, 0.008, 24, 1, true, Math.PI * 0.66, Math.PI * 0.68]} /><M color="#1b1e22" /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[0.106 * s, 0.03, -0.04]}><boxGeometry args={[0.006, 0.01, 0.1]} /><M color="#1b1e22" /></mesh>)}
      </group>
      <group name="ppe-earmuffs" visible={false}>
        <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.135, 0.012, 8, 24, Math.PI]} /><M color="#222" /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[0.115 * s, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.04, 18]} /><M color={ORANGE} rough={0.45} /></mesh>)}
      </group>
      <group name="ppe-welding" visible={false}>
        <mesh position={[0, -0.005, 0.02]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.14, 0.13, 0.3, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9]} /><M color="#24272b" rough={0.5} opacity={0.999} /></mesh>
        <mesh position={[0, 0.015, 0.145]}><boxGeometry args={[0.11, 0.055, 0.01]} /><M color="#0e3b1e" rough={0.1} metal={0.5} emissive="#0b2a14" glow={0.4} /></mesh>
        <mesh position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.115, 0.01, 6, 20]} /><M color="#333" /></mesh>
        <Plate3 text="WABYS" y={-0.08} />
      </group>
      <group name="ppe-visor" visible={false}>
        <mesh position={[0, 0.0, 0.01]} rotation={[0, Math.PI, 0]}><cylinderGeometry args={[0.145, 0.15, 0.25, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
          <meshPhysicalMaterial color="#d9f0ff" transparent opacity={0.28} roughness={0.05} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
        <mesh position={[0, 0.13, 0.0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.116, 0.012, 6, 20]} /><M color="#2c3e66" /></mesh>
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
  const logo = useMemo(() => wabysTex('chest'), []);
  const name = useMemo(() => wabysTex('name', 'VTC\nSTUDENT'), []);
  const shop = useMemo(() => wabysTex('name', 'MECHANICAL\nWORKSHOP'), []);
  const back = useMemo(() => wabysTex('back', 'WABYS STUDENT · متدرب'), []);
  // Front of the torso: the cylinder is squashed to 0.66 in depth.
  const front = (y: number) => (0.148 + (0.178 - 0.148) * (y / 0.42 + 0.5)) * 0.66 + 0.002;
  return (
    <>
      {/* Pelvis and the stitched waist of the coverall */}
      <mesh position={[0, 0.02, 0]} scale={[1, 0.8, 0.72]} castShadow><sphereGeometry args={[0.152, 18, 12]} /><M color={NAVY} /></mesh>
      <mesh position={[0, 0.08, 0]} scale={[1, 1, 0.72]}><cylinderGeometry args={[0.154, 0.154, 0.05, 20]} /><M color={NAVY_SEAM} rough={0.85} /></mesh>
      <group name="spine" position={[0, 0.06, 0]}>
        <mesh position={[0, 0.22, 0]} scale={[1, 1, 0.66]} castShadow receiveShadow>
          <cylinderGeometry args={[0.178, 0.148, 0.42, 22]} /><M color={NAVY} />
        </mesh>
        <mesh position={[0, 0.43, 0]} scale={[1, 0.42, 0.66]} castShadow><sphereGeometry args={[0.178, 22, 12]} /><M color={NAVY} /></mesh>
        {/* Button placket */}
        <mesh position={[0, 0.25, front(0.25)]}><boxGeometry args={[0.03, 0.4, 0.004]} /><M color={NAVY_SEAM} /></mesh>
        {[0.1, 0.2, 0.3, 0.4].map((y) => <mesh key={y} position={[0, y, front(y) + 0.003]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.006, 0.006, 0.004, 10]} /><M color="#2a3654" rough={0.4} /></mesh>)}
        {/* Two chest pockets with flaps, the WABYS logo over the left one, a name over the right, the workshop below */}
        {[-1, 1].map((s) => (
          <group key={s} position={[0.078 * s, 0.27, front(0.27)]} rotation={[-0.05, s * 0.24, 0]}>
            <mesh><boxGeometry args={[0.085, 0.09, 0.006]} /><M color={NAVY} /></mesh>
            <mesh position={[0, 0.04, 0.005]}><boxGeometry args={[0.09, 0.028, 0.006]} /><M color={NAVY_SEAM} /></mesh>
            <mesh position={[0, 0.088, 0.004]}><planeGeometry args={[0.1, 0.04]} /><M color="#ffffff" map={s > 0 ? logo : name} rough={0.7} /></mesh>
            {s > 0 && <mesh position={[0, -0.072, 0.004]}><planeGeometry args={[0.08, 0.034]} /><M color="#ffffff" map={shop} rough={0.7} /></mesh>}
          </group>
        ))}
        <mesh position={[0, 0.3, -0.116]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.28, 0.14]} /><M color="#ffffff" map={back} rough={0.6} /></mesh>
        {/* White T-shirt at the open neck, and the shirt collar */}
        <mesh position={[0, 0.476, 0.064]} scale={[1, 0.6, 0.55]}><sphereGeometry args={[0.046, 14, 10]} /><M color={TEE} rough={0.9} /></mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[0.05 * s, 0.505, -0.01]} rotation={[0.25, s * -0.25, s * 0.2]}><boxGeometry args={[0.06, 0.05, 0.11]} /><M color={NAVY} /></mesh>
            <mesh position={[0.036 * s, 0.468, 0.09]} rotation={[0.5, s * 0.45, s * -0.75]}><boxGeometry args={[0.06, 0.024, 0.005]} /><M color={NAVY_DK} /></mesh>
          </group>
        ))}
        <group name="ppe-apron" visible={false}>
          <mesh position={[0, 0.05, 0.125]}><boxGeometry args={[0.3, 0.62, 0.012]} /><M color="#7a4a2a" rough={0.85} /></mesh>
          <mesh position={[0, 0.48, 0.07]} rotation={[0.9, 0, 0]}><torusGeometry args={[0.09, 0.008, 6, 16, Math.PI]} /><M color="#5b3820" /></mesh>
        </group>
        <group name="neck" position={[0, 0.5, 0]}>
          <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.046, 0.052, 0.1, 14]} /><M color={SKIN} rough={0.6} /></mesh>
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
// Motion
// ---------------------------------------------------------------------------
interface Joints {
  spine: number; spineYaw: number; head: number; hipR: number; hipL: number; kneeR: number; kneeL: number;
  footR: number; footL: number; shR: Vec3; shL: Vec3; elR: number; elL: number; lean: number; sway: number; pelvisYaw: number;
}
const REST: Joints = {
  spine: 0.02, spineYaw: 0, head: 0.05, hipR: 0, hipL: 0, kneeR: 0.04, kneeL: 0.04, footR: 0, footL: 0,
  shR: [0.05, 0, -0.1], shL: [0.05, 0, 0.1], elR: -0.18, elL: -0.18, lean: 0, sway: 0, pelvisYaw: 0,
};
const cloneJ = (j: Joints): Joints => ({ ...j, shR: [...j.shR], shL: [...j.shL] });

/** A smooth bump centred on c (radians, wraps round the gait cycle). */
const bump = (x: number, c: number, w: number) => { const d = Math.atan2(Math.sin(x - c), Math.cos(x - c)); return Math.exp(-(d / w) * (d / w)); };

/** Standing poses, with breathing and a slow shift of weight from foot to foot so the student never stands frozen. */
function poseJoints(pose: Pose, t: number): Joints {
  const j = cloneJ(REST);
  j.spine += Math.sin(t * 1.5) * 0.012;
  const shift = Math.sin(t * 0.55) * 0.5 + Math.sin(t * 0.23) * 0.5;
  j.sway = shift * 0.018;
  j.kneeR += Math.max(0, -shift) * 0.1; j.kneeL += Math.max(0, shift) * 0.1;
  j.shR[0] += Math.sin(t * 1.5 + 0.4) * 0.015; j.shL[0] += Math.sin(t * 1.5 + 0.9) * 0.015;
  switch (pose) {
    case 'inspect': j.spine = 0.42; j.head = 0.35; j.hipR = j.hipL = -0.22; j.kneeR = j.kneeL = 0.32; j.shL = [-0.35, 0, 0.15]; j.elL = -0.6; j.sway *= 0.4; break;
    case 'measure': j.spine = 0.28; j.head = 0.4; j.hipR = j.hipL = -0.12; j.kneeR = j.kneeL = 0.18; j.sway *= 0.4; break;
    case 'weld': j.spine = 0.3; j.head = 0.45; j.hipR = -0.3; j.hipL = -0.2; j.kneeR = 0.45; j.kneeL = 0.35; j.sway = 0; break;
    case 'crouch': j.spine = 0.35; j.head = 0.25; j.hipR = -1.35; j.hipL = -1.2; j.kneeR = 2.1; j.kneeL = 1.9; j.shL = [-0.6, 0, 0.12]; j.elL = -0.5; j.sway = 0; break;
    case 'lift': j.spine = 0.25; j.head = 0.1; j.hipR = j.hipL = -0.9; j.kneeR = j.kneeL = 1.4; j.shR = [-0.7, 0, -0.1]; j.shL = [-0.7, 0, 0.1]; j.elR = j.elL = -0.3; j.sway = 0; break;
    case 'point': j.spine = 0.05; j.head = 0.1; break;
    case 'operate': j.spine = 0.1; j.head = 0.15; j.sway *= 0.6; break;
    case 'reach': j.spine = 0.2; j.head = 0.25; j.hipR = -0.08; j.kneeR = 0.12; j.sway *= 0.5; break;
    case 'hurt': {
      const shake = Math.sin(t * 30) * 0.03;
      j.spine = -0.18 + shake; j.head = -0.25; j.hipR = 0.12; j.hipL = -0.2; j.kneeR = 0.25; j.kneeL = 0.35; j.lean = -0.06; j.sway = 0;
      break;
    }
    default: break;
  }
  return j;
}

/**
 * One walking cycle (phase 0: right heel strikes). Heel-toe roll, the knee
 * folding through the swing, the pelvis turning and shifting over the
 * standing foot, and the arms and shoulders swinging against the legs.
 * `amt` (0..1) scales it, so starting and stopping blend in.
 */
function walkJoints(phase: number, amt: number, t: number): Joints {
  const j = poseJoints('idle', t);
  const A = 0.4 * amt;
  const c = Math.cos(phase);
  j.hipR = -A * c; j.hipL = A * c;
  const knee = (p: number) => 0.06 + 0.16 * bump(p, 0.35 * Math.PI, 0.25 * Math.PI) + 1.05 * bump(p, 1.42 * Math.PI, 0.36 * Math.PI);
  j.kneeR = 0.04 + (knee(phase) - 0.04) * amt; j.kneeL = 0.04 + (knee(phase + Math.PI) - 0.04) * amt;
  // Foot pitch against the floor: toes up at heel strike, flat in stance, pushing off, then clearing the floor.
  const foot = (p: number) => -0.28 * bump(p, 0.02, 0.18 * Math.PI) + 0.55 * bump(p, 0.9 * Math.PI, 0.13 * Math.PI) - 0.12 * bump(p, 1.45 * Math.PI, 0.3 * Math.PI);
  j.footR = foot(phase) * amt; j.footL = foot(phase + Math.PI) * amt;
  j.sway = -0.02 * Math.sin(phase) * amt;
  j.pelvisYaw = 0.09 * c * amt;
  j.spineYaw = -0.15 * c * amt;
  j.shR = [0.34 * c * amt + 0.04, 0, -0.08]; j.shL = [-0.34 * c * amt + 0.04, 0, 0.08];
  j.elR = -0.22 - (0.18 + 0.22 * Math.max(0, -c)) * amt; j.elL = -0.22 - (0.18 + 0.22 * Math.max(0, c)) * amt;
  j.spine = 0.02 + 0.06 * amt; j.head = 0.03;
  return j;
}

function mixJ(a: Joints, b: Joints, w: number): Joints {
  if (w <= 0) return a;
  if (w >= 1) return b;
  const m = (x: number, y: number) => x + (y - x) * w;
  const m3 = (x: Vec3, y: Vec3): Vec3 => [m(x[0], y[0]), m(x[1], y[1]), m(x[2], y[2])];
  return {
    spine: m(a.spine, b.spine), spineYaw: m(a.spineYaw, b.spineYaw), head: m(a.head, b.head), hipR: m(a.hipR, b.hipR), hipL: m(a.hipL, b.hipL),
    kneeR: m(a.kneeR, b.kneeR), kneeL: m(a.kneeL, b.kneeL), footR: m(a.footR, b.footR), footL: m(a.footL, b.footL),
    shR: m3(a.shR, b.shR), shL: m3(a.shL, b.shL), elR: m(a.elR, b.elR), elL: m(a.elL, b.elL), lean: m(a.lean, b.lean), sway: m(a.sway, b.sway),
    pelvisYaw: m(a.pelvisYaw, b.pelvisYaw),
  };
}

const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/** Point an arm's shoulder and elbow so its hand (plus anything it holds) lands on `target` (in the spine's space). */
function solveArm(shoulder: THREE.Object3D, elbow: THREE.Object3D, target: THREE.Vector3, side: 1 | -1, k: number, extra = 0) {
  const d = tmpV.copy(target).sub(shoulder.position);
  const L1 = UPPER, L2 = FORE + HAND + extra;
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

/** A critically damped spring: eases in and out, never overshoots. */
class Spring3 {
  x = new THREE.Vector3(); v = new THREE.Vector3(); on = false;
  constructor(private w: number) {}
  reset(to: THREE.Vector3) { this.x.copy(to); this.v.set(0, 0, 0); this.on = true; }
  /** Exact solution over dt, so it stays stable however long the frame. */
  step(to: THREE.Vector3, dt: number) {
    const w = this.w, e = Math.exp(-w * dt);
    const y = this.x.sub(to); // offset from the goal
    const j = tmpV.copy(this.v).addScaledVector(y, w).multiplyScalar(dt);
    this.v.addScaledVector(j, -w).multiplyScalar(e);
    this.x.add(j).multiplyScalar(e).add(to);
    return this.x;
  }
}
const damp = (cur: number, to: number, rate: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-rate * dt));

interface Rig {
  hips: THREE.Object3D; spine: THREE.Object3D; neck: THREE.Object3D; head: THREE.Object3D; eyes: THREE.Object3D;
  shR: THREE.Object3D; shL: THREE.Object3D; elR: THREE.Object3D; elL: THREE.Object3D; handR: THREE.Object3D;
  hipR: THREE.Object3D; hipL: THREE.Object3D; knR: THREE.Object3D; knL: THREE.Object3D; anR: THREE.Object3D; anL: THREE.Object3D;
  fingersR: THREE.Object3D[]; fingersL: THREE.Object3D[];
  ppe: Record<string, THREE.Object3D[]>;
}

function findRig(root: THREE.Object3D): Rig {
  const g = (n: string) => root.getObjectByName(n)!;
  const all = (n: string, under: THREE.Object3D = root) => { const out: THREE.Object3D[] = []; under.traverse((o) => { if (o.name === n) out.push(o); }); return out; };
  const handR = g('handR'), handL = g('handL');
  return {
    hips: g('hips'), spine: g('spine'), neck: g('neck'), head: g(STUDENT_HEAD), eyes: g('eyes'),
    shR: g('shoulderR'), shL: g('shoulderL'), elR: g('elbowR'), elL: g('elbowL'), handR,
    hipR: g('hipR'), hipL: g('hipL'), knR: g('kneeR'), knL: g('kneeL'), anR: g('ankleR'), anL: g('ankleL'),
    fingersR: all('fingers', handR), fingersL: all('fingers', handL),
    ppe: Object.fromEntries(['ppe-glasses', 'ppe-earmuffs', 'ppe-welding', 'ppe-visor', 'ppe-mask', 'ppe-apron', 'boots', 'trainers',
      'hand-skin', 'hand-leather', 'hand-nitrile', 'hand-insulated', 'cuffR', 'cuffL', 'watchL', 'watchR', ...TOOLS.map((t) => `tool-${t}`)].map((n) => [n, all(n)])),
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
  const m = useRef({
    phase: 0, clock: 0, walk: 0, turn: 0, lastYaw: NaN, reachKey: '', reachSince: 0, ik: 0, curl: 0.25, lean: 0, low: 0, twist: 0,
    headYaw: 0, headPitch: 0, blink: 2.5,
  });
  const hand = useMemo(() => new Spring3(9), []);
  const u = env.unitsPerM;
  const floor = env.floorY ?? -1.25;
  const v = useMemo(() => ({ local: new THREE.Vector3(), want: new THREE.Vector3(), sh: new THREE.Vector3(), hw: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const s = state.current;
    const g = root.current;
    if (!s || !g) return;
    g.visible = s.visible;
    if (!s.visible) return;
    const dt = Math.min(rawDt, 0.1);
    const st = m.current;
    st.clock += dt;
    rig.current ??= findRig(g);
    const r = rig.current;
    g.position.set(s.pos.x, floor, s.pos.z);
    g.rotation.y = s.yaw;
    g.scale.setScalar(u);

    // PPE and tools
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
    const tool = s.hold ?? null;
    for (const t of TOOLS) show(r, `tool-${t}`, t === tool);
    r.head.visible = !s.firstPerson;

    // Blend between standing and walking by speed, and shuffle the feet when turning on the spot.
    const yawRate = Number.isNaN(st.lastYaw) ? 0 : Math.abs(angleTo(st.lastYaw, s.yaw)) / Math.max(dt, 1e-3);
    st.lastYaw = s.yaw;
    st.walk = damp(st.walk, THREE.MathUtils.clamp(s.speed / WALK_SPEED, 0, 1), 6, dt);
    st.turn = damp(st.turn, s.speed < 0.1 ? THREE.MathUtils.clamp(yawRate / 2.5, 0, 0.45) : 0, 8, dt);
    const gait = Math.max(st.walk, st.turn);
    const amp = Math.max(0.05, Math.sqrt(gait));
    const stride = 4 * 0.88 * Math.sin(0.4 * amp); // metres per cycle
    st.phase += (Math.max(s.speed, st.turn * 1.2) / Math.max(0.2, stride)) * Math.PI * 2 * dt;
    const moving = st.walk > 0.35;
    const still = poseJoints(s.pose === 'walk' ? 'idle' : s.pose, st.clock);
    const j = mixJ(still, walkJoints(st.phase, amp, st.clock), THREE.MathUtils.smoothstep(gait, 0, 0.6));

    // Reaching: the hand travels on a spring, stops just short of the target, then presses or grips.
    // (Side-stepping with a hand on something, like a sliding door, keeps the hand on it.)
    const reaching = !!s.reach && s.pose !== 'walk' && s.pose !== 'hurt' && s.pose !== 'lift';
    const key = s.reach ? `${s.reachKey ?? ''}` : '';
    if (key !== st.reachKey) { st.reachKey = key; st.reachSince = st.clock; }
    st.ik = damp(st.ik, reaching ? 1 : 0, reaching ? 5 : 4, dt);
    g.updateWorldMatrix(true, false);
    if (reaching && s.reach) {
      // Target in the student's own (metre) space.
      const tw = g.parent ? g.parent.localToWorld(v.local.copy(s.reach)) : v.local.copy(s.reach);
      const tl = g.worldToLocal(v.want.copy(tw));
      // Lean, bend the knees and turn the shoulders so the hand can really get there.
      const shoulderY = HIP_Y + 0.06 + SHOULDER[1];
      const horiz = Math.hypot(tl.x + SHOULDER[0], tl.z);
      const armLen = UPPER + FORE + HAND + (tool ? TOOL_LEN[tool] : 0);
      const lean = THREE.MathUtils.clamp((horiz - armLen * 0.7) * 1.1 + Math.max(0, shoulderY - 0.35 - tl.y) * 0.2, 0, 0.5);
      const low = THREE.MathUtils.clamp(0.75 - tl.y, 0, 0.45);
      const twist = THREE.MathUtils.clamp(Math.atan2(tl.x + SHOULDER[0] * 0.5, Math.max(0.05, tl.z)) * 0.4, -0.4, 0.4);
      st.lean = damp(st.lean, lean, 4, dt); st.low = damp(st.low, low, 4, dt); st.twist = damp(st.twist, twist, 4, dt);
    } else {
      st.lean = damp(st.lean, 0, 3, dt); st.low = damp(st.low, 0, 3, dt); st.twist = damp(st.twist, 0, 3, dt);
    }
    j.spine += st.lean * st.ik + st.low * 0.5 * st.ik;
    j.spineYaw += st.twist * st.ik;
    j.hipR -= st.low * 1.1 * st.ik; j.hipL -= st.low * 1.0 * st.ik;
    j.kneeR += st.low * 1.9 * st.ik; j.kneeL += st.low * 1.7 * st.ik;

    // Legs and feet (the ankle cancels the leg's angle so the sole stays parallel to the floor, plus the gait's roll).
    const k = 1 - Math.exp(-(moving ? 16 : 9) * dt);
    setRot(r.hips, 0, j.pelvisYaw, 0, k);
    setRot(r.spine, j.spine, j.spineYaw - j.pelvisYaw, 0, k);
    setRot(r.hipR, j.hipR, 0, 0.02, k); setRot(r.hipL, j.hipL, 0, -0.02, k);
    setRot(r.knR, j.kneeR, 0, 0, k); setRot(r.knL, j.kneeL, 0, 0, k);
    setRot(r.anR, -(j.hipR + j.kneeR) + j.footR, 0, 0, k); setRot(r.anL, -(j.hipL + j.kneeL) + j.footL, 0, 0, k);
    // Keep the lower foot on the floor whatever the legs do.
    const legH = (h: number, kn: number) => ANKLE + THIGH * Math.cos(h) + SHIN * Math.cos(h + kn);
    const hipY = Math.min(legH(j.hipR, j.kneeR), legH(j.hipL, j.kneeL)) + 0.02;
    r.hips.position.y = damp(r.hips.position.y, hipY, moving ? 20 : 10, dt);
    r.hips.position.z = damp(r.hips.position.z, j.lean - st.lean * 0.06 * st.ik, 10, dt);
    r.hips.position.x = damp(r.hips.position.x, j.sway, 8, dt);

    // Head: looks at the work (or where the hand is going), glances about when idle, faces ahead when walking.
    const look = s.look ?? s.reach;
    let hy = 0, hp = j.head;
    if (look && st.walk < 0.4) {
      v.local.copy(look);
      if (g.parent) g.parent.localToWorld(v.local);
      g.worldToLocal(v.local);
      const dy = v.local.y - EYE_Y + st.low * 0.4;
      hy = THREE.MathUtils.clamp(Math.atan2(v.local.x, v.local.z) - j.spineYaw, -1.0, 1.0);
      hp = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(v.local.x, v.local.z)) - j.spine, -0.5, 0.8);
    } else if (st.walk < 0.2) {
      hy = Math.sin(st.clock * 0.31) * 0.18 + Math.sin(st.clock * 0.77) * 0.06;
      hp = j.head + Math.sin(st.clock * 0.43) * 0.05;
    } else {
      hy = -j.spineYaw * 0.8; // keep the gaze steady as the shoulders swing
    }
    st.headYaw = damp(st.headYaw, hy, 5, dt); st.headPitch = damp(st.headPitch, hp, 5, dt);
    setRot(r.neck, st.headPitch * 0.4, st.headYaw * 0.45, 0, 1);
    setRot(r.head, st.headPitch * 0.6, st.headYaw * 0.55, 0, 1);
    // Blink every few seconds.
    st.blink -= dt;
    if (st.blink < -0.12) st.blink = 2.2 + ((st.clock * 7.3) % 1) * 3;
    r.eyes.scale.y = st.blink < 0 ? 0.15 : 1;

    // Arms: the right hand reaches by IK, else both swing with the pose.
    const ikR = st.ik > 0.01 && !!s.reach;
    const ikBoth = !moving && (s.pose === 'measure' || s.pose === 'weld' || s.pose === 'hurt');
    if (ikR) {
      g.updateWorldMatrix(true, true);
      const tw = g.parent ? g.parent.localToWorld(v.local.copy(s.reach!)) : v.local.copy(s.reach!);
      const tSpine = r.spine.worldToLocal(tw.clone());
      // Approach: hover a few centimetres short (back towards the shoulder), then move in.
      const since = st.clock - st.reachSince;
      const press = THREE.MathUtils.smoothstep(since, 0.55, 0.95);
      const back = v.sh.copy(r.shR.position).sub(tSpine).normalize();
      const goal = tSpine.clone().addScaledVector(back, 0.07 * (1 - press));
      if (!hand.on || st.ik < 0.05) {
        // Start the spring from where the hand is now, so nothing jumps.
        r.handR.getWorldPosition(v.hw);
        hand.reset(r.spine.worldToLocal(v.hw));
      }
      const at = hand.step(goal, dt);
      const kk = THREE.MathUtils.clamp(st.ik, 0, 1);
      solveArm(r.shR, r.elR, at, -1, kk, tool ? TOOL_LEN[tool] : 0);
      if (ikBoth && s.pose !== 'hurt') solveArm(r.shL, r.elL, at.clone().add(new THREE.Vector3(0.13, 0.02, -0.04)), 1, kk);
      else { setRot(r.shL, j.shL[0], j.shL[1], j.shL[2], k); setRot(r.elL, j.elL, 0, 0, k); }
      st.curl = damp(st.curl, tool ? 1.15 : 0.35 + 0.65 * press, 8, dt);
    } else if (s.pose === 'hurt' && !moving) {
      hand.on = false;
      const face = new THREE.Vector3(0, 0.62, 0.14);
      solveArm(r.shR, r.elR, face.clone().add(new THREE.Vector3(-0.04, 0, 0)), -1, k);
      solveArm(r.shL, r.elL, face.clone().add(new THREE.Vector3(0.04, 0, 0)), 1, k);
      st.curl = damp(st.curl, 0.6, 8, dt);
    } else {
      hand.on = false;
      setRot(r.shR, j.shR[0], j.shR[1], j.shR[2], k); setRot(r.elR, j.elR, 0, 0, k);
      setRot(r.shL, j.shL[0], j.shL[1], j.shL[2], k); setRot(r.elL, j.elL, 0, 0, k);
      st.curl = damp(st.curl, tool ? 1.15 : 0.3, 8, dt);
    }
    for (const f of r.fingersR) f.rotation.z = st.curl * 1.25; // curls towards the palm (+x for the right hand)
    for (const f of r.fingersL) f.rotation.z = -0.3 * 1.25;
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
      const v = WALK_SPEED * pace; // m/s
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
