/**
 * Procedural DOL motor-starter panel (IP54 wall enclosure): Q1 rotary
 * isolator with padlock hasp, F1 fuses, KM1 contactor, F2 thermal overload,
 * X1 terminals, trunking and the S1/S2/H1 door controls. Lesson params:
 *   door  0..1  enclosure door opening (1 = 100° open)
 *   q1    0..1  isolator handle (0 = OFF, 1 = ON)
 *   lock  0..1  padlock fitted on the hasp
 *   km    0..1  contactor pulled in (armature down, run lamp lit)
 *   trip  0..1  overload tripped (flag shows, trip lamp lit)
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, child, Grip, param, Sphere, Tube, tx, type ModelDef } from './kit';

const GREY = COLORS.ral7035;
const DIN = '#b8bfc6';
const W = 1.8, H = 2.2, D = 0.7; // enclosure outer size
const BACK = -D / 2 + 0.05;       // mounting-plate face

const Enclosure = () => (
  <group>
    <Box size={[W, H, 0.04]} position={[0, 0, -D / 2]} color={GREY} />
    <Box size={[0.04, H, D]} position={[-W / 2, 0, 0]} color={GREY} />
    <Box size={[0.04, H, D]} position={[W / 2, 0, 0]} color={GREY} />
    <Box size={[W, 0.04, D]} position={[0, H / 2, 0]} color={GREY} />
    <Box size={[W, 0.04, D]} position={[0, -H / 2, 0]} color={GREY} />
    {/* Gland plate and cable entries */}
    {[-0.5, 0, 0.5].map((x) => <Cyl key={x} r={0.07} len={0.08} position={[x, -H / 2 - 0.04, 0]} color={COLORS.black} />)}
    <Box size={[W - 0.12, H - 0.12, 0.02]} position={[0, 0, BACK - 0.02]} color="#e9ecef" metal={0.2} rough={0.6} />
  </group>
);

const Trunking = () => (
  <group>
    {[0.62, -0.18, -0.82].map((y) => <Box key={y} size={[W - 0.2, 0.12, 0.12]} position={[0, y, BACK + 0.06]} color="#9ea7ae" rough={0.7} />)}
    {[-0.8, 0.8].map((x) => <Box key={x} size={[0.12, 1.56, 0.12]} position={[x, -0.1, BACK + 0.06]} color="#9ea7ae" rough={0.7} />)}
  </group>
);

const Rail = ({ y }: { y: number }) => <Box size={[1.4, 0.07, 0.015]} position={[0, y, BACK + 0.01]} color={DIN} metal={0.8} rough={0.3} />;

const Isolator = () => (
  <group>
    <Box size={[0.36, 0.42, 0.22]} position={[-0.45, 0.28, BACK + 0.12]} color="#2a2e33" />
    {/* Rotary handle: red on yellow, sits on the shaft through to the door */}
    <Box size={[0.32, 0.32, 0.02]} position={[-0.45, 0.28, BACK + 0.24]} color={COLORS.yellow} />
    <group name="handle" position={[-0.45, 0.28, BACK + 0.27]}>
      <Cyl r={0.08} len={0.05} axis="z" color={COLORS.red} />
      <Box size={[0.28, 0.06, 0.06]} position={[0, 0, 0.04]} color={COLORS.red} />
      <Grip name="grip-q1" at={[0.1, 0, 0.09]} />
    </group>
    <Grip name="grip-hasp" at={[-0.28, 0.14, BACK + 0.3]} />
    <group name="padlock" position={[-0.28, 0.12, BACK + 0.27]}>
      <Box size={[0.09, 0.1, 0.04]} color={COLORS.red} metal={0.4} />
      <Cyl r={0.032} len={0.008} axis="z" position={[0, 0.06, 0]} color="#c0c6cc" metal={0.9} open />
      <Box size={[0.08, 0.035, 0.03]} position={[0, -0.09, 0]} color="#f2f2ee" />
    </group>
  </group>
);

const Fuses = () => (
  <group>
    {[0, 1, 2].map((i) => (
      <group key={i} position={[-0.05 + i * 0.13, 0.28, BACK + 0.1]}>
        <Box size={[0.11, 0.38, 0.17]} color="#3a3f45" />
        <Cyl r={0.035} len={0.2} position={[0, 0, 0.09]} color="#e8e1cf" rough={0.8} />
      </group>
    ))}
  </group>
);

const Contactor = () => (
  <group>
    <Box size={[0.42, 0.42, 0.24]} position={[-0.3, -0.48, BACK + 0.13]} color="#2f3439" />
    <Box size={[0.36, 0.08, 0.02]} position={[-0.3, -0.34, BACK + 0.255]} color="#d8dde2" />
    <group name="armature" position={[-0.3, -0.48, BACK + 0.26]}>
      <Box size={[0.16, 0.12, 0.04]} color={COLORS.navy} />
      <Box name="flag" size={[0.06, 0.04, 0.012]} position={[0, 0, 0.026]} color="#ffffff" />
    </group>
    {/* Coil terminals A1/A2 */}
    <Cyl r={0.02} len={0.02} axis="z" position={[-0.47, -0.66, BACK + 0.255]} color={COLORS.brass} metal={0.8} />
    <Cyl r={0.02} len={0.02} axis="z" position={[-0.13, -0.66, BACK + 0.255]} color={COLORS.brass} metal={0.8} />
    <Grip name="grip-km1" at={[-0.3, -0.7, BACK + 0.28]} />
  </group>
);

const Overload = () => (
  <group>
    <Box size={[0.4, 0.26, 0.22]} position={[0.25, -0.53, BACK + 0.12]} color="#373c42" />
    <Cyl r={0.04} len={0.03} axis="z" position={[0.18, -0.5, BACK + 0.24]} color="#3a7bd5" />
    <Grip name="grip-f2" at={[0.18, -0.5, BACK + 0.28]} />
    <group name="tripflag" position={[0.36, -0.5, BACK + 0.24]}>
      <Box size={[0.07, 0.05, 0.02]} color={COLORS.orange} />
    </group>
  </group>
);

const Terminals = () => (
  <group>
    {Array.from({ length: 9 }, (_, i) => (
      <Box key={i} size={[0.05, 0.16, 0.14]} position={[-0.38 + i * 0.065, -0.98, BACK + 0.08]}
        color={i === 8 ? COLORS.green : i >= 6 ? COLORS.blue : '#8a9095'} />
    ))}
    <Grip name="grip-x1" at={[-0.18, -0.98, BACK + 0.18]} />
    {/* Motor cable and supply cable down to the glands */}
    <Tube points={[[0.1, -1.05, BACK + 0.08], [0.0, -1.1, 0], [0, -1.15, 0]]} r={0.04} color="#333" />
    <Tube points={[[-0.45, 0.5, BACK + 0.1], [-0.82, 0.4, BACK + 0.1], [-0.82, -1.0, BACK + 0.1], [-0.5, -1.15, 0]]} r={0.035} color="#2b2b2b" />
  </group>
);

const Wiring = () => (
  <group>
    {[0, 1, 2].map((i) => {
      const x = -0.05 + i * 0.13;
      const c = [COLORS.copper, '#222', '#888'][i]!;
      return (
        <group key={i}>
          <Tube points={[[x, 0.08, BACK + 0.12], [x, -0.05, BACK + 0.13], [-0.4 + i * 0.1, -0.22, BACK + 0.14], [-0.4 + i * 0.1, -0.28, BACK + 0.2]]} r={0.012} color={c} />
          <Tube points={[[-0.4 + i * 0.1, -0.68, BACK + 0.2], [-0.4 + i * 0.1, -0.74, BACK + 0.14], [0.15 + i * 0.1, -0.7, BACK + 0.13], [0.15 + i * 0.1, -0.66, BACK + 0.2]]} r={0.012} color={c} />
        </group>
      );
    })}
  </group>
);

const DoorLeaf = () => (
  <group name="leaf" position={[-W / 2, 0, D / 2]}>
    {/* Built hinged at its left edge so it swings about the hinge line */}
    <group position={[W / 2, 0, 0]}>
      <Box size={[W, H, 0.04]} color={GREY} opacity={0.97} />
      <Box size={[0.5, 0.7, 0.01]} position={[0.45, 0.45, 0.025]} color="#cfd4d8" />
      {/* Push buttons, pilot lamps and the warning label */}
      <Cyl r={0.06} len={0.05} axis="z" position={[0.3, -0.25, 0.04]} color={COLORS.green} />
      <Cyl r={0.06} len={0.05} axis="z" position={[0.55, -0.25, 0.04]} color={COLORS.red} />
      <Sphere name="lampRun" r={0.05} position={[0.3, -0.05, 0.04]} color="#2a6b3c" emissive="#39ff7a" glow={0} />
      <Sphere name="lampTrip" r={0.05} position={[0.55, -0.05, 0.04]} color="#7a5a14" emissive="#ffb020" glow={0} />
      <group position={[-0.45, 0.6, 0.025]}>
        <mesh rotation={[0, 0, Math.PI]}><circleGeometry args={[0.16, 3]} /><meshStandardMaterial color={COLORS.yellow} /></mesh>
        <Box size={[0.03, 0.1, 0.01]} position={[0, 0.02, 0.005]} color="#111" />
      </group>
      {/* Door-mounted extension of Q1's handle */}
      <Box size={[0.3, 0.3, 0.015]} position={[-0.45, 0.28, 0.025]} color={COLORS.yellow} />
      <Box size={[0.26, 0.05, 0.05]} position={[-0.45, 0.28, 0.05]} color={COLORS.red} />
      <Cyl r={0.03} len={0.1} position={[W / 2 - 0.06, 0, 0.04]} color="#303438" />
      <Grip name="grip-panel-door" at={[W / 2 - 0.06, 0, 0.09]} />
      <Grip name="grip-s1" at={[0.3, -0.25, 0.08]} />
      <Grip name="grip-s2" at={[0.55, -0.25, 0.08]} />
      <Grip name="grip-q1door" at={[-0.35, 0.28, 0.09]} />
    </group>
  </group>
);

export const starterPanel: ModelDef = {
  id: 'dol-panel',
  title: tx('DOL starter panel · 7.5 kW', 'لوحة بادئ مباشر DOL · ‏7.5 ك.وات'),
  assetTag: 'ELEC2-P04 · DOL-7k5',
  view: { camera: [2.6, 1.4, 5.0], target: [0, -0.1, 0] },
  params: { door: 1, q1: 0, km: 0, lock: 0, trip: 0 },
  env: {
    unitsPerM: 2.75, floorY: -4.0, stand: 'wall', bay: 'elec',
    stations: [
      { id: 'front', label: tx('In front of the panel', 'أمام اللوحة'), pos: [0.4, 2.7], face: Math.PI, pose: 'operate', reach: [0.3, -0.25, 0.42] },
      { id: 'isolator', label: tx('Isolator Q1', 'المفصل Q1'), pos: [-0.5, 2.5], face: Math.PI, pose: 'operate', reach: [-0.45, 0.28, 0.45] },
      { id: 'inside', label: tx('Inside the panel', 'داخل اللوحة'), pos: [0.3, 2.3], face: Math.PI, pose: 'reach', reach: [0.25, -0.5, 0.05] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.6, 3.6], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  runParams: { door: 0, q1: 1, km: 1 },
  parts: [
    {
      id: 'door', name: tx('Enclosure door & controls', 'باب اللوحة وأزرار التحكم'), explode: [-0.4, 0, 1.6], stage: 0,
      animate: (g, s) => {
        const leaf = child(g, 'leaf');
        if (leaf) leaf.rotation.y = THREE.MathUtils.lerp(leaf.rotation.y, -param(s, 'door', 0) * 1.75, 0.1);
        const run = child(g, 'lampRun') as THREE.Mesh | undefined;
        if (run) (run.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'km') > 0.5 && param(s, 'trip') < 0.5 ? 2.2 : 0;
        const trip = child(g, 'lampTrip') as THREE.Mesh | undefined;
        if (trip) (trip.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'trip') > 0.5 ? 2.2 : 0;
      },
      render: () => <DoorLeaf />,
      hotspot: {
        position: [0.3, 0.1, D / 2 + 0.1], title: tx('Door controls S1 / S2 / H1 / H2', 'أزرار الباب S1 / S2 / H1 / H2'),
        specs: [[tx('S1 start', 'S1 تشغيل'), tx('Green, 1 NO', 'أخضر، تلامس NO')], [tx('S2 stop', 'S2 إيقاف'), tx('Red, 1 NC', 'أحمر، تلامس NC')], [tx('H1 / H2', 'H1 / H2'), tx('Run (green), trip (amber), 24 V LED', 'تشغيل (أخضر)، فصل حراري (كهرماني)، LED ‏24 فولت')]],
        safety: tx('The door is interlocked with Q1: it opens only with the isolator OFF.', 'الباب مقفل ميكانيكيًا مع Q1: لا يفتح إلا والمفصل في وضع OFF.'),
      },
    },
    {
      id: 'q1', name: tx('Q1 rotary isolator & padlock', 'المفصل الدوار Q1 والقفل'), explode: [-0.5, 0.5, 0.9], stage: 0.15,
      animate: (g, s) => {
        const h = child(g, 'handle');
        if (h) h.rotation.z = THREE.MathUtils.lerp(h.rotation.z, -param(s, 'q1') * Math.PI / 2, 0.12);
        const p = child(g, 'padlock'); if (p) p.visible = param(s, 'lock') > 0.5;
      },
      render: () => <Isolator />,
      hotspot: {
        position: [-0.45, 0.55, BACK + 0.3], title: tx('Q1 main isolator', 'المفصل الرئيسي Q1'),
        specs: [[tx('Rating', 'التحمل'), '32 A AC-23A, 3P'], [tx('Positions', 'الأوضاع'), '0 (OFF) / I (ON)'], [tx('Lockable', 'قابل للقفل'), tx('Up to 3 padlocks in OFF', 'حتى 3 أقفال في وضع OFF')]],
        safety: tx('Lock off, tag, then prove dead at the load side with a tested voltage indicator.', 'اقفل وعلّق البطاقة، ثم تحقق من انعدام الجهد على جهة الحمل بجهاز فحص مُختبَر.'),
      },
    },
    {
      id: 'f1', name: tx('F1 fuses', 'المصهرات F1'), explode: [0.2, 0.9, 0.7], stage: 0.25,
      render: () => <Fuses />,
      hotspot: { position: [0.08, 0.52, BACK + 0.22], title: tx('F1 fuse carriers', 'حاملات المصهرات F1'), specs: [[tx('Fuse', 'المصهر'), '3 × 25 A gG 10×38'], [tx('Breaking', 'قدرة القطع'), '100 kA']] },
    },
    {
      id: 'km1', name: tx('KM1 contactor', 'الكونتاكتور KM1'), explode: [-0.4, -0.2, 0.9], stage: 0.3,
      animate: (g, s) => {
        const a = child(g, 'armature');
        if (a) a.position.z = THREE.MathUtils.lerp(a.position.z, BACK + 0.26 - param(s, 'km') * 0.05, 0.25);
      },
      render: () => <Contactor />,
      hotspot: {
        position: [-0.3, -0.3, BACK + 0.3], title: tx('KM1 contactor', 'الكونتاكتور KM1'),
        specs: [[tx('Rating', 'التحمل'), '18 A AC-3 (7.5 kW)'], [tx('Coil', 'الملف'), '24 V AC, A1–A2'], [tx('Aux', 'مساعد'), '13–14 NO (hold-in)']],
      },
    },
    {
      id: 'f2', name: tx('F2 thermal overload', 'المرحل الحراري F2'), explode: [0.6, -0.3, 0.8], stage: 0.35,
      animate: (g, s) => {
        const f = child(g, 'tripflag');
        if (f) f.position.z = THREE.MathUtils.lerp(f.position.z, BACK + 0.24 + param(s, 'trip') * 0.05, 0.25);
      },
      render: () => <Overload />,
      hotspot: {
        position: [0.25, -0.38, BACK + 0.28], title: tx('F2 overload relay', 'مرحل الحمل الزائد F2'),
        specs: [[tx('Range', 'المدى'), '12 – 18 A'], [tx('Set to', 'يضبط على'), tx('Motor FLC 14.8 A', 'تيار الحمل الكامل 14.8 أمبير')], [tx('Contacts', 'التلامسات'), '95–96 NC, 97–98 NO']],
      },
    },
    {
      id: 'x1', name: tx('X1 terminals & cables', 'أطراف التوصيل X1 والكابلات'), explode: [0, -0.8, 0.6], stage: 0.4,
      render: () => <Terminals />,
      hotspot: { position: [-0.1, -0.98, BACK + 0.2], title: tx('X1 terminal strip', 'شريط الأطراف X1'), specs: [[tx('Motor', 'المحرك'), 'U1 V1 W1'], [tx('Supply', 'التغذية'), 'L1 L2 L3 N'], [tx('Earth', 'الأرضي'), tx('PE, green/yellow', 'PE، أخضر/أصفر')]] },
    },
    {
      id: 'wiring', name: tx('Power wiring', 'أسلاك القدرة'), explode: [0.3, 0.1, 0.5], stage: 0.45,
      render: () => <Wiring />,
    },
    {
      id: 'trunking', name: tx('Trunking & DIN rails', 'مجاري الأسلاك وقضبان DIN'), explode: [0, 0, 0.3], stage: 0.5,
      render: () => <group><Trunking /><Rail y={0.28} /><Rail y={-0.5} /><Rail y={-0.98} /></group>,
    },
    {
      id: 'enclosure', name: tx('Enclosure & mounting plate', 'الصندوق ولوح التركيب'), explode: [0, 0, 0],
      render: () => <Enclosure />,
      hotspot: { position: [0.7, 0.95, -0.2], title: tx('Wall enclosure', 'صندوق جداري'), specs: [[tx('Size', 'المقاس'), '600 × 760 × 210 mm'], [tx('Rating', 'الحماية'), 'IP54, IK08'], [tx('Earth', 'الأرضي'), tx('Door and plate bonded to PE', 'الباب واللوح موصولان بـ PE')]] },
    },
  ],
};
