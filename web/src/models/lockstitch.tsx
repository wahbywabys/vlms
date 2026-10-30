/**
 * Procedural industrial lockstitch sewing machine (single needle, direct-drive
 * servo) on its work table, as used in the garment-making (RMG) workshop.
 * The table top is at y = 0, the needle on the left (−x) and the handwheel on
 * the right (+x) as the operator sees it from the front (+z). Lesson params:
 *   foot    0..1  presser foot raised (knee lifter)
 *   guard   0..1  finger guard in place in front of the needle
 *   shield  0..1  eye shield lowered
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Sticker, Tube, child, param, tx, type ModelDef } from './kit';

const CAST = '#e9e7e1';        // cream enamel head, as most modern machines
const TRIM = '#2b2f36';
const NX = -0.52;              // needle x
const NZ = 0.04;               // needle z
const HW = 0.66;               // handwheel x
const ARM_Y = 0.62;

const Table = () => (
  <group>
    <Box size={[3.0, 0.1, 1.5]} position={[0, -0.05, -0.1]} color="#c9b48a" metal={0} rough={0.7} finish="matte" />
    {/* Cut-out frame the machine bed drops into */}
    <Box size={[1.32, 0.012, 0.5]} position={[0, 0.003, 0]} color="#3a3f45" metal={0.4} rough={0.5} shadow={false} />
    {[[-1.35, 0.5], [1.35, 0.5], [-1.35, -0.7], [1.35, -0.7]].map(([x, z]) => (
      <Box key={`${x}${z}`} size={[0.08, 1.77, 0.08]} position={[x!, -0.985, z!]} color="#5b6670" metal={0.6} rough={0.4} />
    ))}
    <Box size={[2.8, 0.06, 0.06]} position={[0, -1.6, -0.1]} color="#5b6670" metal={0.6} rough={0.4} />
    {/* Drawer for bobbins, scissors and spare needles */}
    <Box size={[0.8, 0.2, 0.9]} position={[-0.9, -0.22, 0]} color="#b8a37a" metal={0} rough={0.7} finish="matte" />
    <Cyl r={0.025} len={0.12} axis="x" position={[-0.9, -0.22, 0.47]} color={COLORS.steel} metal={0.8} rough={0.3} />
  </group>
);

/** Head casting: bed, pillar, arm and the head that carries the needle bar. */
const Head = () => (
  <group>
    <Box size={[1.25, 0.12, 0.45]} position={[0, -0.06, 0]} color={CAST} metal={0.25} rough={0.4} />
    <Box size={[0.3, 0.62, 0.36]} position={[0.43, 0.3, -0.03]} color={CAST} metal={0.25} rough={0.4} round={0.06} />
    <Box size={[1.05, 0.2, 0.26]} position={[-0.02, ARM_Y, -0.04]} color={CAST} metal={0.25} rough={0.4} round={0.08} />
    <Box size={[0.24, 0.5, 0.3]} position={[NX + 0.02, 0.48, -0.02]} color={CAST} metal={0.25} rough={0.4} round={0.06} />
    {/* Face plate and stitch-length dial */}
    <Box size={[0.012, 0.34, 0.24]} position={[NX - 0.105, 0.5, -0.02]} color={COLORS.steel} metal={0.85} rough={0.25} />
    <Cyl r={0.07} len={0.03} axis="z" position={[0.43, 0.32, 0.16]} color={TRIM} metal={0.3} rough={0.5} />
    <Box size={[0.012, 0.05, 0.004]} position={[0.43, 0.36, 0.177]} color={COLORS.orange} shadow={false} />
    {/* Reverse lever */}
    <Box size={[0.04, 0.18, 0.03]} position={[0.43, 0.14, 0.17]} rotation={[0, 0, 0.35]} color={TRIM} metal={0.3} rough={0.5} />
    <Plate lines={['WABYS · LS-8800', '5000 st/min · 220 V']} size={[0.36, 0.08]} position={[0, ARM_Y, 0.091]} bg="#14234c" fg="#ffffff" />
    <Sticker kind="warning" pic="exclaim" caption="" size={0.08} position={[NX + 0.02, 0.62, 0.131]} />
    {/* Thread tension unit and guides */}
    <Cyl r={0.035} len={0.04} axis="z" position={[NX + 0.02, 0.38, 0.15]} color={COLORS.steel} metal={0.85} rough={0.25} />
    <Cyl r={0.012} len={0.06} axis="z" position={[NX + 0.02, 0.38, 0.17]} color={COLORS.brass} metal={0.8} rough={0.3} />
  </group>
);

/** Needle bar and needle; the take-up lever moves with it. Animated from the shaft angle. */
const NeedleBar = () => (
  <group>
    <group name="needlebar">
      <Cyl r={0.016} len={0.34} position={[NX, 0.32, NZ]} color={COLORS.steel} metal={0.9} rough={0.18} />
      <Cyl r={0.022} len={0.04} position={[NX, 0.16, NZ]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
      <Cyl r={0.005} r2={0.002} len={0.14} position={[NX, 0.08, NZ]} color="#d9dde2" metal={1} rough={0.12} seg={12} />
    </group>
    <group name="takeup" position={[NX + 0.02, 0.62, 0.14]}>
      <Box size={[0.03, 0.03, 0.16]} position={[0, 0, 0.02]} color={COLORS.steel} metal={0.85} rough={0.25} />
    </group>
  </group>
);

const PresserFoot = () => (
  <group name="foot">
    <Cyl r={0.013} len={0.28} position={[NX + 0.05, 0.25, NZ - 0.02]} color={COLORS.steel} metal={0.9} rough={0.2} />
    <Box size={[0.1, 0.012, 0.13]} position={[NX + 0.03, 0.012, NZ + 0.01]} color={COLORS.steel} metal={0.9} rough={0.2} />
    <Box size={[0.08, 0.012, 0.03]} position={[NX + 0.03, 0.02, NZ + 0.08]} rotation={[0.5, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
  </group>
);

/** Needle plate and feed dog in the bed; the feed dog rises and walks the cloth. */
const NeedlePlate = () => (
  <group>
    <Box size={[0.3, 0.012, 0.2]} position={[NX + 0.04, 0.004, NZ]} color={COLORS.alu} metal={0.9} rough={0.2} />
    {[-0.03, 0.03].map((dz) => (
      <group key={dz} name={dz < 0 ? 'feed1' : 'feed2'}>
        <Box size={[0.025, 0.014, 0.1]} position={[NX + 0.05, 0.005, NZ + dz]} color={COLORS.darkSteel} metal={0.8} rough={0.4} />
      </group>
    ))}
    {/* Bobbin cover slide */}
    <Box size={[0.2, 0.008, 0.16]} position={[NX - 0.14, 0.002, NZ]} color={COLORS.steel} metal={0.9} rough={0.2} />
  </group>
);

/** Rotary hook and bobbin case under the needle plate: seen in the section view. */
const Hook = () => (
  <group name="hook" position={[NX, -0.07, NZ]}>
    <Cyl r={0.055} len={0.03} axis="x" color={COLORS.steel} metal={0.9} rough={0.2} />
    <Cyl r={0.04} len={0.034} axis="x" color={COLORS.brass} metal={0.8} rough={0.3} />
    <Box size={[0.006, 0.015, 0.06]} position={[0.017, 0.045, 0]} color={COLORS.darkSteel} metal={0.9} rough={0.2} />
    <Cyl r={0.01} len={0.25} axis="x" position={[0.14, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
  </group>
);

const Handwheel = () => (
  <group>
    <group name="wheel" position={[HW, ARM_Y - 0.02, -0.04]}>
      <Cyl r={0.15} len={0.06} axis="x" color={TRIM} metal={0.3} rough={0.5} seg={40} />
      <Cyl r={0.155} len={0.02} axis="x" position={[0.03, 0, 0]} color="#1b1d20" metal={0.1} rough={0.8} seg={40} />
      <Box size={[0.07, 0.04, 0.02]} position={[0.035, 0.11, 0]} color={COLORS.orange} shadow={false} />
    </group>
    <Grip name="grip-handwheel" at={[HW + 0.05, ARM_Y + 0.1, 0.06]} />
  </group>
);

/** Servo motor under the table, with the control box and the treadle. */
const Motor = () => (
  <group>
    <Cyl r={0.14} len={0.36} axis="x" position={[0.6, -0.42, -0.05]} color={TRIM} metal={0.4} rough={0.45} />
    <Box size={[0.3, 0.2, 0.24]} position={[0.95, -0.42, -0.05]} color="#3b4048" metal={0.3} rough={0.5} />
    <Box size={[0.16, 0.08, 0.002]} position={[0.95, -0.4, 0.071]} color="#0c2b3f" emissive="#1b6fa8" glow={0.7} shadow={false} />
    <Cyl r={0.04} len={0.04} axis="z" position={[1.12, -0.48, 0.07]} color={COLORS.red} />
    <Grip name="grip-power" at={[1.12, -0.48, 0.1]} />
    {/* Treadle and its link rod */}
    <group name="pedal" position={[0.2, -1.8, 0.35]}>
      <Box size={[0.5, 0.04, 0.32]} rotation={[0.18, 0, 0]} color="#3b4048" metal={0.4} rough={0.5} />
    </group>
    <Cyl r={0.008} len={1.3} position={[0.6, -1.15, 0.3]} color={COLORS.steel} metal={0.8} rough={0.3} />
    {/* Knee lifter */}
    <Box size={[0.05, 0.05, 0.3]} position={[-0.25, -0.35, 0.35]} rotation={[0.5, 0, 0]} color={TRIM} metal={0.4} rough={0.5} />
    <Box size={[0.14, 0.12, 0.04]} position={[-0.25, -0.48, 0.47]} color="#1b1d20" metal={0.1} rough={0.8} />
    <Tube points={[[1.0, -0.52, -0.1], [1.2, -0.9, -0.3], [1.3, -1.75, -0.5]]} r={0.012} color="#1b1d20" rough={0.8} />
  </group>
);

/** Belt guard over the drive and the finger guard in front of the needle. */
const Guards = () => (
  <group>
    <Box size={[0.08, 0.22, 0.24]} position={[HW + 0.08, ARM_Y - 0.12, -0.04]} color={COLORS.yellow} metal={0.2} rough={0.5} />
    <group name="fingerguard">
      <Box size={[0.006, 0.12, 0.004]} position={[NX - 0.02, 0.1, NZ + 0.06]} color={COLORS.steel} metal={0.9} rough={0.2} />
      <Box size={[0.006, 0.12, 0.004]} position={[NX + 0.02, 0.1, NZ + 0.06]} color={COLORS.steel} metal={0.9} rough={0.2} />
      <Box size={[0.05, 0.006, 0.004]} position={[NX, 0.16, NZ + 0.06]} color={COLORS.steel} metal={0.9} rough={0.2} />
    </group>
    <group name="shield" position={[NX, 0.34, 0.2]}>
      <Box size={[0.2, 0.14, 0.008]} position={[0, -0.07, 0]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.35} shadow={false} />
      <Cyl r={0.008} len={0.08} axis="z" position={[0, 0, -0.04]} color={COLORS.steel} metal={0.9} rough={0.2} />
    </group>
  </group>
);

const ThreadStand = () => (
  <group position={[1.1, 0, -0.55]}>
    <Box size={[0.3, 0.02, 0.16]} position={[0, 0.01, 0]} color={COLORS.steel} metal={0.8} rough={0.3} />
    {[-0.08, 0.08].map((x) => (
      <group key={x}>
        <Cyl r={0.006} len={0.2} position={[x, 0.1, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
        <Cyl r={0.05} r2={0.035} len={0.14} position={[x, 0.09, 0]} color={x < 0 ? '#2f5f93' : '#c2417a'} metal={0} rough={0.85} finish="matte" />
      </group>
    ))}
    <Cyl r={0.006} len={0.9} position={[0, 0.45, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
    <Box size={[0.3, 0.012, 0.02]} position={[0, 0.9, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
    <Tube points={[[-0.08, 0.9, 0], [-0.6, 0.85, 0.2], [-1.6, 0.62, 0.55]]} r={0.003} color="#2f5f93" rough={0.9} seg={24} />
  </group>
);

const Lamp = () => (
  <group position={[NX - 0.1, 0.58, 0.04]}>
    <Box size={[0.03, 0.02, 0.14]} color={TRIM} metal={0.3} rough={0.5} />
    <Box size={[0.03, 0.006, 0.12]} position={[0, -0.012, 0]} color="#fff6d8" emissive="#fff2c0" glow={1} shadow={false} />
  </group>
);

/** The shaft angle for the needle bar, feed dog and hook: 15 turns a second at full speed in the explorer, slowed so you can see it. */
const angle = (g: THREE.Object3D, s: { dt: number; running: boolean }) => {
  const a = (g.userData.a ?? 0) + (s.running ? s.dt * 9 : 0);
  g.userData.a = a;
  return a;
};

export const lockstitch: ModelDef = {
  id: 'lockstitch',
  title: tx('Industrial lockstitch sewing machine', 'ماكينة خياطة صناعية (غرزة مقفلة)'),
  assetTag: 'LS-8800 · RMG-02',
  view: { camera: [1.3, 0.9, 2.2], target: [-0.1, 0.25, 0] },
  params: { foot: 0, guard: 1, shield: 1 },
  runParams: { foot: 0 },
  env: {
    unitsPerM: 2.5, floorY: -1.875, stand: 'floor', bay: 'rmg',
    stations: [
      { id: 'seat', label: tx('Operator seat', 'مقعد المشغل'), pos: [-0.25, 1.15], face: Math.PI, pose: 'operate', reach: [NX, 0.05, NZ + 0.2] },
      { id: 'needle', label: tx('At the needle', 'عند الإبرة'), pos: [-0.6, 1.0], face: Math.PI, pose: 'reach', reach: [NX, 0.12, NZ + 0.06] },
      { id: 'wheel', label: tx('Handwheel', 'عجلة اليد'), pos: [0.75, 1.0], face: Math.PI, pose: 'reach', reach: [HW + 0.05, ARM_Y + 0.1, 0.06] },
      { id: 'power', label: tx('Motor switch', 'مفتاح المحرك'), pos: [1.15, 1.1], face: Math.PI, pose: 'crouch', reach: [1.12, -0.48, 0.1] },
      { id: 'side', label: tx('Behind the head', 'خلف الرأس'), pos: [-1.6, -0.2], face: Math.PI / 2, pose: 'inspect', reach: [NX - 0.1, 0.3, 0] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.0, 2.6], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'needle', name: tx('Needle bar & needle', 'عمود الإبرة والإبرة'), explode: [0, 0.5, 0.4], stage: 0.1,
      animate: (g, s) => {
        const a = angle(g, s);
        const bar = child(g, 'needlebar');
        if (bar) bar.position.y = 0.06 * Math.cos(a) + 0.03;
        const up = child(g, 'takeup');
        if (up) up.rotation.x = 0.35 * Math.sin(a);
      },
      render: () => <NeedleBar />,
      hotspot: {
        position: [NX, 0.12, NZ + 0.02], title: tx('Needle (DB×1, size 14)', 'الإبرة (DB×1 مقاس 14)'),
        specs: [[tx('Stroke', 'المشوار'), '31 mm'], [tx('Speed', 'السرعة'), tx('Up to 5000 stitches/min', 'حتى 5000 غرزة/دقيقة')], [tx('System', 'النظام'), 'DB×1 · Nm 90']],
        safety: tx('Change the needle only with the motor switched off: a touch on the pedal drives the needle through a finger.', 'غيّر الإبرة والمحرك مطفأ فقط: لمسة واحدة على الدواسة تدفع الإبرة في الإصبع.'),
      },
    },
    {
      id: 'foot', name: tx('Presser foot', 'قدم الضغط'), explode: [0, 0.3, 0.6], stage: 0.15,
      animate: (g, s) => {
        const o = child(g, 'foot');
        if (o) o.position.y = THREE.MathUtils.lerp(o.position.y, param(s, 'foot') * 0.08, 0.15);
      },
      render: () => <PresserFoot />,
      hotspot: { position: [NX + 0.03, 0.03, NZ + 0.08], title: tx('Presser foot', 'قدم الضغط'), specs: [[tx('Lift', 'الرفع'), tx('5.5 mm by hand, 13 mm by knee', '5.5 مم يدويًا، 13 مم بالركبة')]] },
    },
    {
      id: 'guards', name: tx('Finger guard, eye shield & belt guard', 'واقي الأصابع وواقي العين وغطاء السير'), explode: [0, 0.2, 0.9], stage: 0,
      animate: (g, s) => {
        const fg = child(g, 'fingerguard');
        if (fg) fg.position.z = THREE.MathUtils.lerp(fg.position.z, (1 - param(s, 'guard', 1)) * 0.25, 0.15);
        const sh = child(g, 'shield');
        if (sh) sh.rotation.x = THREE.MathUtils.lerp(sh.rotation.x, (1 - param(s, 'shield', 1)) * -1.2, 0.12);
      },
      render: () => <Guards />,
      hotspot: {
        position: [NX, 0.14, NZ + 0.07], title: tx('Finger guard', 'واقي الأصابع'),
        specs: [[tx('Standard', 'المعيار'), 'ISO 10821'], [tx('Covers', 'يغطي'), tx('The needle from the front', 'الإبرة من الأمام')]],
        safety: tx('Needle-through-finger is the most common sewing-room injury. Keep the guard on and fingers 2 cm from the needle.', 'دخول الإبرة في الإصبع أشهر إصابة في صالة الخياطة. أبقِ الواقي مركّبًا والأصابع على بعد 2 سم من الإبرة.'),
      },
    },
    {
      id: 'plate', name: tx('Needle plate & feed dog', 'لوح الإبرة وأسنان التغذية'), explode: [0, -0.1, 0.6], stage: 0.3,
      animate: (g, s) => {
        const a = (g.userData.a ?? 0) + (s.running ? s.dt * 9 : 0);
        g.userData.a = a;
        for (const n of ['feed1', 'feed2']) {
          const o = child(g, n);
          if (o) { o.position.y = Math.max(0, Math.sin(a)) * 0.012; o.position.z = Math.cos(a) * 0.012; }
        }
      },
      render: () => <NeedlePlate />,
      hotspot: { position: [NX + 0.05, 0.02, NZ], title: tx('Drop feed', 'التغذية بالأسنان'), specs: [[tx('Stitch length', 'طول الغرزة'), '0 – 5 mm'], [tx('Feed', 'التغذية'), tx('Four-motion feed dog', 'أسنان تغذية رباعية الحركة')]] },
    },
    {
      id: 'hook', name: tx('Rotary hook & bobbin', 'المكوك الدوار والبوبينة'), explode: [0, -0.5, 0.4], stage: 0.4,
      animate: (g, s) => { const o = child(g, 'hook'); if (o) o.rotation.x += s.running ? s.dt * 18 : 0; },
      render: () => <Hook />,
      hotspot: { position: [NX, -0.07, NZ + 0.06], title: tx('Full-rotary hook', 'مكوك دوار كامل'), specs: [[tx('Turns', 'الدوران'), tx('Twice per stitch', 'مرتان لكل غرزة')], [tx('Oil', 'الزيت'), tx('Automatic, from the sump', 'تلقائي من حوض الزيت')]] },
    },
    {
      id: 'head', name: tx('Machine head', 'رأس الماكينة'), explode: [0, 0.9, -0.3], stage: 0.6,
      render: () => <Head />,
      hotspot: { position: [0.43, 0.32, 0.18], title: tx('Stitch-length dial & reverse lever', 'قرص طول الغرزة وذراع الرجوع'), specs: [[tx('Reverse', 'الرجوع'), tx('Locks the seam at both ends', 'يقفل الدرزة من الطرفين')]] },
    },
    {
      id: 'wheel', name: tx('Handwheel', 'عجلة اليد'), explode: [0.6, 0.4, 0], stage: 0.5,
      animate: (g, s) => { const o = child(g, 'wheel'); if (o) o.rotation.x -= s.running ? s.dt * 9 : 0; },
      render: () => <Handwheel />,
      hotspot: {
        position: [HW + 0.04, ARM_Y + 0.12, 0.05], title: tx('Handwheel', 'عجلة اليد'), specs: [[tx('Turn', 'الاتجاه'), tx('Towards you only', 'نحوك فقط')]],
        safety: tx('Turn the wheel by hand only with the motor off, to bring the needle up.', 'أدر العجلة باليد والمحرك مطفأ فقط لرفع الإبرة.'),
      },
    },
    {
      id: 'motor', name: tx('Servo motor, switch & pedal', 'محرك سيرفو والمفتاح والدواسة'), explode: [0, -0.6, 0.3], stage: 0.7,
      animate: (g, s) => { const o = child(g, 'pedal'); if (o) o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, s.running ? 0.2 : 0, 0.2); },
      render: () => <Motor />,
      hotspot: {
        position: [0.95, -0.4, 0.08], title: tx('Direct-drive servo', 'سيرفو بالدفع المباشر'), specs: [[tx('Power', 'القدرة'), '550 W, 220 V'], [tx('Idle', 'الخمول'), tx('Silent: no clutch, no noise', 'صامت بلا قابض ولا ضوضاء')]],
        safety: tx('A servo motor makes no sound when idle: the machine looks off but sews the moment the pedal is touched.', 'محرك السيرفو لا يصدر صوتًا وهو خامل: تبدو الماكينة مطفأة لكنها تخيط بمجرد لمس الدواسة.'),
      },
    },
    { id: 'stand', name: tx('Thread stand', 'حامل الخيوط'), explode: [0.4, 0.6, -0.4], stage: 0.75, render: () => <ThreadStand /> },
    { id: 'lamp', name: tx('LED lamp', 'مصباح LED'), explode: [-0.4, 0.3, 0.2], stage: 0.8, render: () => <Lamp /> },
    { id: 'table', name: tx('Work table', 'طاولة العمل'), explode: [0, -0.9, 0], stage: 0.9, render: () => <Table /> },
  ],
};
