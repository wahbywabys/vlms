/**
 * Procedural 7.5 kW TEFC three-phase induction motor used as the demo twin.
 * In production each `render` returns a node from the asset's glTF instead:
 *   render: () => <primitive object={nodes.FanCover} />
 * Units ≈ decimetres; the shaft runs along +x (drive end) / −x (non-drive end).
 */
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { PartSpec } from '../components/MachineExplorer';

const PAINT = '#2f5f93';
const ALU = '#b9c1c9';
const STEEL = '#8f9aa4';
const COPPER = '#c27a3a';
const LAMINATION = '#4b535c';

const DS = THREE.DoubleSide;

/** Cylinder whose axis lies along x. */
function CylX({ r, r2 = r, len, x = 0, color, seg = 48, open = false, metal = 0.4, rough = 0.5 }: {
  r: number; r2?: number; len: number; x?: number; color: string; seg?: number; open?: boolean; metal?: number; rough?: number;
}) {
  return (
    <mesh position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
      <cylinderGeometry args={[r, r2, len, seg, 1, open]} />
      <meshStandardMaterial color={color} metalness={metal} roughness={rough} side={DS} />
    </mesh>
  );
}

/** Flat annulus in the y–z plane at position x. */
function RingX({ inner, outer, x, color }: { inner: number; outer: number; x: number; color: string }) {
  return (
    <mesh position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <ringGeometry args={[inner, outer, 48]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} side={DS} />
    </mesh>
  );
}

function Radial({ count, children }: { count: number; children: (angle: number, i: number) => ReactNode }) {
  return <>{Array.from({ length: count }, (_, i) => children((i / count) * Math.PI * 2, i))}</>;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
const Frame = () => (
  <group>
    <CylX r={0.8} len={2} color={PAINT} open />
    {/* Cooling fins */}
    <Radial count={16}>
      {(a, i) => (
        <mesh key={i} position={[0, Math.cos(a) * 0.86, Math.sin(a) * 0.86]} rotation={[a, 0, 0]} castShadow>
          <boxGeometry args={[1.9, 0.14, 0.035]} />
          <meshStandardMaterial color={PAINT} metalness={0.35} roughness={0.55} />
        </mesh>
      )}
    </Radial>
    {/* Feet */}
    {[-0.65, 0.65].map((x) => (
      <mesh key={x} position={[x, -0.92, 0]} castShadow>
        <boxGeometry args={[0.32, 0.22, 1.5]} />
        <meshStandardMaterial color={PAINT} metalness={0.35} roughness={0.55} />
      </mesh>
    ))}
    {/* Terminal box base */}
    <mesh position={[0.15, 0.96, 0]} castShadow>
      <boxGeometry args={[0.7, 0.22, 0.62]} />
      <meshStandardMaterial color={PAINT} metalness={0.35} roughness={0.55} />
    </mesh>
    {/* Stator core + winding end-turns live inside the frame */}
    <CylX r={0.78} len={1.6} color={LAMINATION} open metal={0.6} rough={0.4} />
    {[-0.86, 0.86].map((x) => (
      <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.6, 0.11, 16, 48]} />
        <meshStandardMaterial color={COPPER} metalness={0.8} roughness={0.35} />
      </mesh>
    ))}
  </group>
);

const TerminalLid = () => (
  <group position={[0.15, 1.12, 0]}>
    <mesh castShadow>
      <boxGeometry args={[0.72, 0.1, 0.64]} />
      <meshStandardMaterial color={PAINT} metalness={0.35} roughness={0.55} />
    </mesh>
    {[[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x!, 0.06, z!]}>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.3} />
      </mesh>
    ))}
  </group>
);

const RotorShaft = () => (
  <group>
    <CylX r={0.11} len={3.5} x={0.2} color={STEEL} metal={0.9} rough={0.25} />
    <CylX r={0.55} len={1.58} color={ALU} metal={0.7} rough={0.35} />
    {/* Skewed cage bars, visible in cutaway/x-ray */}
    <Radial count={20}>
      {(a, i) => (
        <mesh key={i} position={[0, Math.cos(a) * 0.5, Math.sin(a) * 0.5]} rotation={[a + 0.12, 0, 0]}>
          <boxGeometry args={[1.6, 0.04, 0.05]} />
          <meshStandardMaterial color="#d8dde2" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
    </Radial>
    {/* Shaft key on drive end */}
    <mesh position={[1.7, 0.11, 0]}>
      <boxGeometry args={[0.35, 0.05, 0.06]} />
      <meshStandardMaterial color="#c9b24a" metalness={0.8} roughness={0.3} />
    </mesh>
  </group>
);

const Bearing = ({ x }: { x: number }) => (
  <group position={[x, 0, 0]}>
    <CylX r={0.24} len={0.12} color={STEEL} open metal={0.95} rough={0.2} />
    <CylX r={0.13} len={0.12} color={STEEL} open metal={0.95} rough={0.2} />
    <RingX inner={0.13} outer={0.24} x={0.06} color="#2b2f33" />
    <RingX inner={0.13} outer={0.24} x={-0.06} color="#2b2f33" />
  </group>
);

const EndShield = ({ x, dir }: { x: number; dir: 1 | -1 }) => (
  <group position={[x, 0, 0]}>
    <CylX r={0.86} r2={0.86} len={0.14} color={PAINT} />
    <CylX r={0.3} len={0.24} x={dir * 0.12} color={PAINT} open />
    <Radial count={4}>
      {(a, i) => (
        <mesh key={i} position={[dir * 0.08, Math.cos(a + 0.78) * 0.74, Math.sin(a + 0.78) * 0.74]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.08, 6]} />
          <meshStandardMaterial color={STEEL} metalness={0.9} roughness={0.3} />
        </mesh>
      )}
    </Radial>
  </group>
);

const Fan = () => (
  <group position={[-1.42, 0, 0]}>
    <CylX r={0.16} len={0.18} color="#2a2d31" metal={0.1} rough={0.8} />
    <Radial count={9}>
      {(a, i) => (
        <mesh key={i} position={[0, Math.cos(a) * 0.42, Math.sin(a) * 0.42]} rotation={[a, 0, 0]}>
          <boxGeometry args={[0.16, 0.52, 0.03]} />
          <meshStandardMaterial color="#2a2d31" metalness={0.1} roughness={0.8} />
        </mesh>
      )}
    </Radial>
  </group>
);

const FanCover = () => (
  <group position={[-1.5, 0, 0]}>
    <CylX r={0.84} len={0.55} color={PAINT} open />
    {/* Grille: concentric rings */}
    {[0.25, 0.42, 0.59, 0.76].map((r) => (
      <mesh key={r} position={[-0.27, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[r, 0.02, 8, 48]} />
        <meshStandardMaterial color={PAINT} metalness={0.35} roughness={0.55} />
      </mesh>
    ))}
    <Radial count={6}>
      {(a, i) => (
        <mesh key={i} position={[-0.27, Math.cos(a) * 0.42, Math.sin(a) * 0.42]} rotation={[a, 0, 0]}>
          <boxGeometry args={[0.03, 0.84, 0.03]} />
          <meshStandardMaterial color={PAINT} metalness={0.35} roughness={0.55} />
        </mesh>
      )}
    </Radial>
  </group>
);

// ---------------------------------------------------------------------------
// Part specs (disassembly order follows the OEM maintenance manual)
// ---------------------------------------------------------------------------
export const inductionMotorParts: PartSpec[] = [
  {
    id: 'terminal_lid', name: 'Terminal box cover', explode: [0, 1.75, 0], stage: 0,
    render: () => <TerminalLid />,
    hotspot: {
      position: [0.15, 1.3, 0], title: 'Terminal box (U1 · V1 · W1)',
      specs: { Connection: 'Δ 400 V / Y 690 V', 'Link torque': '2.5 N·m', Gland: 'M25 × 1.5, IP55' },
      safety: 'Isolate, lock out and prove dead (LOTO) before removing this cover.',
    },
  },
  {
    id: 'fan_cover', name: 'Fan cowl', explode: [-2.9, 0, 0], stage: 0.05,
    render: () => <FanCover />,
    hotspot: {
      position: [-1.78, 0.6, 0], title: 'Fan cowl',
      specs: { Material: 'Pressed steel 1.0 mm', Fixing: '3 × M5 screws', Protection: 'IP55 finger guard' },
    },
  },
  {
    id: 'fan', name: 'Cooling fan', explode: [-2.1, 0, 0], stage: 0.15, spin: { axis: 'x', speed: 9 },
    render: () => <Fan />,
    hotspot: {
      position: [-1.42, 0.75, 0], title: 'Cooling fan',
      specs: { Material: 'PP, 30% glass-filled', Retention: 'Circlip DIN 471 – 24', Rotation: 'Bi-directional' },
    },
  },
  {
    id: 'nde_shield', name: 'End shield (non-drive end)', explode: [-1.35, 0, 0], stage: 0.25,
    render: () => <EndShield x={-1.07} dir={-1} />,
    hotspot: {
      position: [-1.12, -0.6, 0.45], title: 'NDE end shield',
      specs: { Material: 'Cast iron EN-GJL-200', Bolts: '4 × M8, 25 N·m (cross pattern)', Spigot: 'H7 fit' },
    },
  },
  {
    id: 'de_shield', name: 'End shield (drive end)', explode: [1.35, 0, 0], stage: 0.25,
    render: () => <EndShield x={1.07} dir={1} />,
    hotspot: {
      position: [1.12, -0.6, 0.45], title: 'DE end shield',
      specs: { Material: 'Cast iron EN-GJL-200', Bolts: '4 × M8, 25 N·m (cross pattern)', Removal: 'Use jacking screws, never pry' },
    },
  },
  {
    id: 'nde_bearing', name: 'Bearing 6205-2Z (NDE)', explode: [-0.85, 0, 0], stage: 0.38, spin: { axis: 'x', speed: 9 },
    render: () => <Bearing x={-1.0} />,
    hotspot: {
      position: [-1.0, 0.32, 0], title: 'NDE bearing',
      specs: { Type: '6205-2Z/C3', Size: '25 × 52 × 15 mm', Lubrication: 'Sealed, grease-for-life', 'L10 life': '≈ 40 000 h' },
    },
  },
  {
    id: 'de_bearing', name: 'Bearing 6206-2Z (DE)', explode: [0.85, 0, 0], stage: 0.38, spin: { axis: 'x', speed: 9 },
    render: () => <Bearing x={1.0} />,
    hotspot: {
      position: [1.0, 0.32, 0], title: 'DE bearing',
      specs: { Type: '6206-2Z/C3', Size: '30 × 62 × 16 mm', Fitting: 'Induction-heat to 110 °C', Tool: 'Bearing puller only' },
      safety: 'Wear heat-resistant gloves when handling heated bearings.',
    },
  },
  {
    id: 'stator_frame', name: 'Stator & frame', explode: [0, 1.25, 0], stage: 0.5,
    render: () => <Frame />,
    hotspot: {
      position: [-0.5, 0.95, 0.4], title: 'Stator & frame',
      specs: { Rating: '7.5 kW, 4-pole, 1455 rpm', Insulation: 'Class F (ΔT class B)', 'Frame size': 'IEC 132M', Efficiency: 'IE3 – 89.6 %' },
      safety: 'Megger test at 500 V DC after rewind: ≥ 100 MΩ phase-to-earth.',
    },
  },
  {
    id: 'rotor', name: 'Rotor & shaft', explode: [0, 0, 0], spin: { axis: 'x', speed: 9 },
    render: () => <RotorShaft />,
    hotspot: {
      position: [0.3, 0.62, 0], title: 'Squirrel-cage rotor',
      specs: { Cage: 'Die-cast aluminium, skewed bars', 'Shaft end': 'Ø38 k6 × 80 mm', Key: 'DIN 6885 10 × 8 × 70', Balance: 'Half-key, G2.5' },
    },
  },
];
