/**
 * Procedural pump-and-motor training rig for industrial maintenance (EIM):
 * a 7.5 kW motor driving an end-suction centrifugal pump through a jaw
 * coupling on a common baseplate, with suction and discharge pipework,
 * valves, gauges, a lockable isolator and a laser shaft-alignment kit.
 * The shaft line runs along x at y = 0 (motor at −x, pump at +x). Lesson params:
 *   guard     0..1  coupling guard fitted
 *   offset    0..1  motor misaligned (1 ≈ 0.6 mm offset, exaggerated for view)
 *   laser     0..1  laser alignment heads mounted on the shafts
 *   isolator  0..1  isolator ON (0 = off and locked)
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Radial, Sticker, child, param, tx, type ModelDef } from './kit';

const MOTOR = '#2f5f93';
const PUMP = '#3a9d5d';
const BASE = '#3e4650';
const CX = 0;                      // coupling x
const SHAFT_Y = 0;

const Baseplate = () => (
  <group>
    <Box size={[3.4, 0.16, 0.9]} position={[0.1, -0.62, 0]} color={BASE} metal={0.5} rough={0.45} />
    {[-0.36, 0.36].map((z) => <Box key={z} size={[3.4, 0.08, 0.08]} position={[0.1, -0.5, z]} color={BASE} metal={0.5} rough={0.45} />)}
    {/* Grouted holding-down bolts */}
    {[-1.5, -0.5, 0.6, 1.7].map((x) => [-0.38, 0.38].map((z) => (
      <Cyl key={`${x}${z}`} r={0.03} len={0.08} position={[x, -0.5, z]} color={COLORS.steel} metal={0.9} rough={0.25} />
    )))}
    <Box size={[3.8, 0.3, 1.2]} position={[0.1, -0.85, 0]} color="#a9a59c" metal={0} rough={0.95} finish="matte" />
  </group>
);

const Motor = () => (
  <group name="motor">
    <Cyl r={0.34} len={0.95} axis="x" position={[-1.0, SHAFT_Y, 0]} color={MOTOR} metal={0.35} rough={0.45} />
    <Radial count={16}>{(a, i) => (
      <Box key={i} size={[0.8, 0.05, 0.03]} position={[-1.0, Math.cos(a) * 0.36, Math.sin(a) * 0.36]} rotation={[a, 0, 0]} color={MOTOR} metal={0.35} rough={0.45} />
    )}</Radial>
    {/* Fan cowl */}
    <Cyl r={0.33} len={0.22} axis="x" position={[-1.58, SHAFT_Y, 0]} color={MOTOR} metal={0.35} rough={0.5} />
    <Cyl r={0.26} len={0.01} axis="x" position={[-1.695, SHAFT_Y, 0]} color="#1b1d20" metal={0.2} rough={0.7} />
    {/* Feet with shims under them */}
    {[-1.35, -0.65].map((x) => [-0.26, 0.26].map((z) => (
      <group key={`${x}${z}`}>
        <Box size={[0.16, 0.18, 0.12]} position={[x, -0.36, z]} color={MOTOR} metal={0.35} rough={0.45} />
        <Box size={[0.18, 0.012, 0.14]} position={[x, -0.457, z]} color={COLORS.steel} metal={0.9} rough={0.2} />
        <Cyl r={0.022} len={0.06} position={[x, -0.25, z]} color={COLORS.steel} metal={0.9} rough={0.25} />
      </group>
    )))}
    <Box size={[0.22, 0.14, 0.2]} position={[-0.95, 0.4, 0]} color={MOTOR} metal={0.35} rough={0.45} />
    <Plate lines={['3~ 400 V · 7.5 kW', '2930 rpm · IE3 · IP55']} size={[0.26, 0.12]} position={[-1.0, 0.0, 0.345]} />
    <Cyl r={0.04} len={0.28} axis="x" position={[-0.4, SHAFT_Y, 0]} color={COLORS.steel} metal={0.9} rough={0.18} />
  </group>
);

/** Jaw coupling: two hubs and the rubber spider; spins with the shafts. */
const Coupling = () => (
  <group name="coupling">
    <Cyl r={0.11} len={0.1} axis="x" position={[CX - 0.08, SHAFT_Y, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
    <Cyl r={0.11} len={0.1} axis="x" position={[CX + 0.08, SHAFT_Y, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
    <Radial count={6}>{(a, i) => (
      <Box key={i} size={[0.05, 0.05, 0.05]} position={[CX, Math.cos(a) * 0.075, Math.sin(a) * 0.075]} rotation={[a, 0, 0]} color={i % 2 ? COLORS.darkSteel : COLORS.yellow} metal={i % 2 ? 0.8 : 0} rough={i % 2 ? 0.3 : 0.8} />
    )}</Radial>
  </group>
);

/** Fixed coupling guard (yellow mesh). */
const Guard = () => (
  <group name="guard">
    <mesh position={[CX, SHAFT_Y + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.24, 0.24, 0.5, 28, 1, true, -Math.PI * 0.1, Math.PI * 1.2]} />
      <meshStandardMaterial color={COLORS.yellow} metalness={0.3} roughness={0.5} side={THREE.DoubleSide} wireframe />
    </mesh>
    <Box size={[0.5, 0.02, 0.5]} position={[CX, -0.22, 0]} color={COLORS.yellow} metal={0.3} rough={0.5} />
    {[-0.22, 0.22].map((z) => <Box key={z} size={[0.04, 0.24, 0.04]} position={[CX, -0.34, z]} color={COLORS.yellow} metal={0.3} rough={0.5} />)}
    <Sticker kind="warning" pic="rotating" size={0.1} position={[CX, 0.05, 0.25]} />
  </group>
);

/** End-suction pump: bearing frame, volute casing and the impeller inside (seen in a section). */
const Pump = () => (
  <group>
    <Cyl r={0.04} len={0.28} axis="x" position={[0.3, SHAFT_Y, 0]} color={COLORS.steel} metal={0.9} rough={0.18} />
    <Cyl r={0.16} r2={0.2} len={0.55} axis="x" position={[0.68, SHAFT_Y, 0]} color={PUMP} metal={0.4} rough={0.5} />
    <Box size={[0.4, 0.34, 0.32]} position={[0.68, -0.3, 0]} color={PUMP} metal={0.4} rough={0.5} />
    <Cyl r={0.05} len={0.04} axis="z" position={[0.68, 0.1, 0.17]} color={COLORS.glass} opacity={0.6} />
    {/* Volute */}
    <Cyl r={0.46} len={0.26} axis="x" position={[1.2, 0.02, 0]} color={PUMP} metal={0.4} rough={0.5} seg={40} />
    <Cyl r={0.2} len={0.2} axis="x" position={[1.43, 0.0, 0]} color={PUMP} metal={0.4} rough={0.5} />
    <Box size={[0.26, 0.4, 0.26]} position={[1.2, 0.5, 0.18]} color={PUMP} metal={0.4} rough={0.5} />
    <Box size={[0.4, 0.42, 0.34]} position={[1.2, -0.3, 0]} color={PUMP} metal={0.4} rough={0.5} />
    <Plate lines={['WABYS CP 65-200', 'Q 50 m³/h · H 48 m']} size={[0.24, 0.1]} position={[0.68, 0.0, 0.205]} />
    <group name="impeller" position={[1.2, 0.02, 0]}>
      <Cyl r={0.38} len={0.04} axis="x" position={[-0.06, 0, 0]} color={COLORS.brass} metal={0.8} rough={0.3} />
      <Radial count={6}>{(a, i) => (
        <Box key={i} size={[0.1, 0.3, 0.02]} position={[0, Math.cos(a) * 0.2, Math.sin(a) * 0.2]} rotation={[a + 0.4, 0, 0]} color={COLORS.brass} metal={0.8} rough={0.3} />
      )}</Radial>
      <Cyl r={0.1} len={0.12} axis="x" color={COLORS.brass} metal={0.8} rough={0.3} />
    </group>
  </group>
);

const Pipework = () => (
  <group>
    {/* Suction from the tank side (+x) */}
    <Cyl r={0.13} len={0.9} axis="x" position={[1.95, 0.0, 0]} color="#7d8790" metal={0.6} rough={0.4} />
    <Cyl r={0.19} len={0.04} axis="x" position={[1.54, 0.0, 0]} color="#5b6670" metal={0.6} rough={0.4} />
    <Cyl r={0.19} len={0.04} axis="x" position={[2.38, 0.0, 0]} color="#5b6670" metal={0.6} rough={0.4} />
    {/* Discharge riser with valve and gauge */}
    <Cyl r={0.1} len={1.0} position={[1.2, 1.2, 0.18]} color="#7d8790" metal={0.6} rough={0.4} />
    <Box size={[0.26, 0.2, 0.26]} position={[1.2, 1.0, 0.18]} color="#c8312b" metal={0.4} rough={0.5} />
    <Cyl r={0.016} len={0.3} position={[1.2, 1.24, 0.18]} color={COLORS.steel} metal={0.9} rough={0.2} />
    <Cyl r={0.14} len={0.02} position={[1.2, 1.4, 0.18]} color="#c8312b" metal={0.4} rough={0.5} />
    <Grip name="grip-valve" at={[1.32, 1.4, 0.18]} />
    <group position={[1.38, 0.82, 0.18]}>
      <Cyl r={0.012} len={0.12} axis="x" position={[-0.06, 0, 0]} color={COLORS.brass} metal={0.8} rough={0.3} />
      <Cyl r={0.08} len={0.04} axis="z" position={[0.04, 0, 0.0]} color="#e9ecef" metal={0.2} rough={0.4} />
      <group name="needle" position={[0.04, 0, 0.022]}><Box size={[0.006, 0.06, 0.004]} position={[0, 0.03, 0]} color={COLORS.red} shadow={false} /></group>
    </group>
  </group>
);

/** Laser alignment heads clamped on both shafts, with the display unit. */
const Laser = () => (
  <group name="laser">
    {[-0.3, 0.3].map((x) => (
      <group key={x} position={[x, SHAFT_Y, 0]}>
        <Box size={[0.06, 0.12, 0.1]} position={[0, -0.06, 0]} color={COLORS.steel} metal={0.8} rough={0.3} />
        <Box size={[0.08, 0.14, 0.1]} position={[0, 0.12, 0]} color={x < 0 ? COLORS.orange : COLORS.navy} metal={0.2} rough={0.5} />
        <Box size={[0.01, 0.02, 0.02]} position={[x < 0 ? 0.045 : -0.045, 0.14, 0]} color={COLORS.red} emissive="#ff2a20" glow={1} shadow={false} />
      </group>
    ))}
    <mesh position={[0, SHAFT_Y + 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.004, 0.004, 0.52, 6]} /><meshBasicMaterial color="#ff2a20" transparent opacity={0.8} />
    </mesh>
    <Box size={[0.22, 0.3, 0.05]} position={[0, -0.2, 0.62]} rotation={[-0.4, 0, 0]} color="#2b2f36" metal={0.3} rough={0.5} />
    <Box size={[0.17, 0.2, 0.002]} position={[0, -0.18, 0.648]} rotation={[-0.4, 0, 0]} color="#0c2b3f" emissive="#2a8f5a" glow={0.8} shadow={false} />
  </group>
);

/** Local isolator with a padlock hasp. */
const Isolator = () => (
  <group position={[-1.9, 0.5, 0.7]}>
    <Box size={[0.08, 1.9, 0.08]} position={[0, -0.4, -0.06]} color={BASE} metal={0.5} rough={0.4} />
    <Box size={[0.3, 0.38, 0.18]} position={[0, 0.36, 0]} color={COLORS.yellow} metal={0.2} rough={0.5} />
    <group name="isolator" position={[0, 0.36, 0.1]}>
      <Box size={[0.06, 0.18, 0.04]} color={COLORS.red} metal={0.2} rough={0.5} />
    </group>
    <group name="padlock" position={[0.08, 0.24, 0.12]}>
      <Box size={[0.06, 0.06, 0.03]} color={COLORS.red} metal={0.3} rough={0.5} />
      <mesh position={[0, 0.045, 0]}><torusGeometry args={[0.022, 0.006, 8, 16, Math.PI]} /><meshStandardMaterial color={COLORS.steel} metalness={0.9} roughness={0.2} /></mesh>
    </group>
    <Grip name="grip-isolator" at={[0, 0.36, 0.14]} />
    <Sticker kind="warning" pic="electric" size={0.08} position={[0, 0.6, 0.091]} />
  </group>
);

const spinAll = (g: THREE.Object3D, s: { dt: number; running: boolean }, name: string, k = 1) => {
  const o = child(g, name);
  if (o && s.running) o.rotation.x += s.dt * 14 * k;
};

export const pumpRig: ModelDef = {
  id: 'pump-rig',
  title: tx('Pump & motor alignment rig', 'منصة محاذاة المضخة والمحرك'),
  assetTag: 'CP65-200 · EIM-01',
  view: { camera: [1.6, 1.4, 3.4], target: [0.1, 0.0, 0] },
  params: { guard: 1, offset: 0, laser: 0, isolator: 1 },
  env: {
    unitsPerM: 2.0, floorY: -1.0, stand: 'floor', bay: 'eim',
    stations: [
      { id: 'front', label: tx('In front of the coupling', 'أمام الوصلة'), pos: [0, 1.4], face: Math.PI, pose: 'inspect', reach: [CX, 0.05, 0.3] },
      { id: 'coupling', label: tx('At the coupling', 'عند الوصلة'), pos: [0.1, 1.0], face: Math.PI, pose: 'crouch', reach: [CX, SHAFT_Y, 0.2] },
      { id: 'motor', label: tx('Motor feet', 'أقدام المحرك'), pos: [-1.0, 1.1], face: Math.PI, pose: 'crouch', reach: [-1.0, -0.36, 0.3] },
      { id: 'isolator', label: tx('Isolator', 'مفتاح العزل'), pos: [-1.9, 1.5], face: Math.PI, pose: 'reach', reach: [-1.9, 0.86, 0.84] },
      { id: 'valve', label: tx('Discharge valve', 'محبس الطرد'), pos: [1.3, 1.2], face: Math.PI, pose: 'reach', reach: [1.32, 1.4, 0.3] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'guard', name: tx('Coupling guard', 'غطاء الوصلة'), explode: [0, 0.8, 0.4], stage: 0,
      animate: (g, s) => {
        const o = child(g, 'guard');
        if (o) { o.visible = param(s, 'guard', 1) > 0.5; }
      },
      render: () => <Guard />,
      hotspot: {
        position: [CX, 0.24, 0.2], title: tx('Fixed coupling guard', 'غطاء وصلة ثابت'),
        specs: [[tx('Fixing', 'التثبيت'), tx('Needs a tool to remove', 'لا يُفك إلا بعدة')], [tx('Standard', 'المعيار'), 'ISO 14120']],
        safety: tx('A rotating coupling grabs clothes and gloves instantly. Never run the rig with the guard off.', 'الوصلة الدوارة تسحب الملابس والقفازات فورًا. لا تشغّل المنصة والغطاء منزوع أبدًا.'),
      },
    },
    {
      id: 'coupling', name: tx('Jaw coupling', 'وصلة فكية مرنة'), explode: [0, 0.3, 0.8], stage: 0.1,
      animate: (g, s) => spinAll(g, s, 'coupling'),
      render: () => <Coupling />,
      hotspot: { position: [CX, 0.12, 0.1], title: tx('Flexible jaw coupling', 'وصلة فكية مرنة'), specs: [[tx('Spider', 'العنصر المرن'), '92 Shore A'], [tx('Tolerance', 'السماحية'), tx('Offset ≤ 0.05 mm at 3000 rpm', 'إزاحة ≤ 0.05 مم عند 3000 لفة/دقيقة')]] },
    },
    {
      id: 'laser', name: tx('Laser alignment kit', 'جهاز محاذاة بالليزر'), explode: [0, 0.6, 1.0], stage: 0.15,
      animate: (g, s) => { const o = child(g, 'laser'); if (o) o.visible = param(s, 'laser') > 0.5; },
      render: () => <Laser />,
      hotspot: { position: [0, 0.24, 0], title: tx('Laser shaft alignment', 'محاذاة الأعمدة بالليزر'), specs: [[tx('Reads', 'يقيس'), tx('Offset and angle, vertical and horizontal', 'الإزاحة والزاوية رأسيًا وأفقيًا')], [tx('Corrects', 'يصحّح'), tx('Shims under the motor feet', 'رقائق تحت أقدام المحرك')]] },
    },
    {
      id: 'motor', name: tx('Electric motor', 'المحرك الكهربائي'), explode: [-0.8, 0.4, 0], stage: 0.3,
      animate: (g, s) => {
        const o = child(g, 'motor');
        if (o) o.position.z = THREE.MathUtils.lerp(o.position.z, param(s, 'offset') * 0.06, 0.1);
      },
      render: () => <Motor />,
      hotspot: { position: [-1.0, 0.36, 0.1], title: tx('Induction motor 7.5 kW', 'محرك حثي 7.5 ك.وات'), specs: [[tx('Supply', 'التغذية'), '3~ 400 V 50 Hz'], [tx('Speed', 'السرعة'), '2930 rpm'], [tx('Current', 'التيار'), '14.2 A']] },
    },
    {
      id: 'pump', name: tx('Centrifugal pump', 'مضخة طاردة مركزية'), explode: [0.9, 0.4, 0], stage: 0.4,
      animate: (g, s) => spinAll(g, s, 'impeller', 1),
      render: () => <Pump />,
      hotspot: {
        position: [1.2, 0.5, 0.25], title: tx('End-suction pump', 'مضخة سحب طرفي'), specs: [[tx('Flow', 'التصرف'), '50 m³/h'], [tx('Head', 'الرفع'), '48 m'], [tx('Seal', 'مانع التسرب'), tx('Mechanical seal', 'مانع تسرب ميكانيكي')]],
        safety: tx('Never run the pump dry or against a closed valve for long: it overheats and the seal fails.', 'لا تشغّل المضخة جافة أو والمحبس مغلق لفترة طويلة: ترتفع حرارتها ويتلف مانع التسرب.'),
      },
    },
    {
      id: 'pipes', name: tx('Pipework, valve & gauge', 'المواسير والمحبس والعداد'), explode: [0.6, 0.8, 0], stage: 0.5,
      animate: (g, s) => { const o = child(g, 'needle'); if (o) o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, s.running ? -1.6 : 0, 0.05); },
      render: () => <Pipework />,
      hotspot: { position: [1.38, 0.82, 0.3], title: tx('Discharge pressure gauge', 'عداد ضغط الطرد'), specs: [[tx('Range', 'المدى'), '0 – 10 bar'], [tx('Normal', 'التشغيل العادي'), '4.7 bar']] },
    },
    {
      id: 'isolator', name: tx('Local isolator (LOTO)', 'مفتاح عزل محلي (LOTO)'), explode: [-0.4, 0.3, 0.4], stage: 0.6,
      animate: (g, s) => {
        const on = param(s, 'isolator', 1);
        const o = child(g, 'isolator');
        if (o) o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, on ? 0 : -Math.PI / 2, 0.2);
        const p = child(g, 'padlock');
        if (p) p.visible = on < 0.5;
      },
      render: () => <Isolator />,
      hotspot: {
        position: [-1.9, 0.86, 0.8], title: tx('Lockable isolator', 'مفتاح عزل قابل للقفل'), specs: [[tx('Rating', 'التصنيف'), '32 A AC-23'], [tx('Lock', 'القفل'), tx('Your own padlock and tag', 'قفلك وبطاقتك الشخصية')]],
        safety: tx('Isolate, lock, tag and try to start before you touch the coupling. The stop button alone is not isolation.', 'اعزل واقفل وعلّق البطاقة وجرّب التشغيل قبل لمس الوصلة. زر الإيقاف وحده ليس عزلًا.'),
      },
    },
    { id: 'base', name: tx('Baseplate & plinth', 'القاعدة والمصطبة'), explode: [0, -0.6, 0], stage: 0.8, render: () => <Baseplate /> },
  ],
};
