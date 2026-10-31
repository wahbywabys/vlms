/**
 * Procedural 3-axis CNC vertical machining centre (VMC): base and column,
 * saddle and table with a machine vice and a workpiece, the spindle head on
 * the Z slide, a 20-pocket umbrella tool changer, the enclosure with an
 * interlocked sliding door, the control panel, coolant and the chip
 * conveyor. X runs along the table (x), Y towards the column (−z), Z up.
 * Lesson params:
 *   door   0..1  front door open
 *   z      0..1  spindle head height (1 = home, 0 = cutting)
 *   clamp  0..1  vice closed on the part
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Radial, Sticker, Tube, child, param, tx, type ModelDef } from './kit';

const BODY = '#e8ebee';
const GREY = '#4b5563';
const BLUE = '#2f8fd8';
const TABLE_Y = 0;
const SP_X = 0;
const SP_Z = 0;
const headY = (z: number) => 0.55 + z * 0.55;

const BaseColumn = () => (
  <group>
    <Box size={[2.2, 0.8, 1.6]} position={[0, -0.85, -0.2]} color={GREY} metal={0.35} rough={0.5} />
    <Box size={[1.1, 2.6, 0.8]} position={[0, 0.85, -0.85]} color={GREY} metal={0.35} rough={0.5} />
    {/* Linear guides */}
    {[-0.35, 0.35].map((x) => <Box key={x} size={[0.06, 2.0, 0.05]} position={[x, 0.9, -0.43]} color={COLORS.steel} metal={0.9} rough={0.2} />)}
    {[-0.5, 0.5].map((x) => <Box key={x} size={[0.06, 0.05, 1.4]} position={[x, -0.43, -0.1]} color={COLORS.steel} metal={0.9} rough={0.2} />)}
  </group>
);

/** Saddle, table, T-slots, vice and the workpiece. */
const Table = () => (
  <group>
    <Box size={[1.2, 0.18, 0.7]} position={[0, -0.32, 0]} color={GREY} metal={0.35} rough={0.5} />
    <Box size={[1.9, 0.14, 0.6]} position={[0, -0.16, 0]} color="#8d969f" metal={0.75} rough={0.3} />
    {[-0.18, 0, 0.18].map((z) => <Box key={z} size={[1.9, 0.02, 0.04]} position={[0, -0.085, z]} color="#3e4650" metal={0.6} rough={0.4} shadow={false} />)}
    <group position={[SP_X, TABLE_Y - 0.09, SP_Z]}>
      <Box size={[0.5, 0.12, 0.22]} position={[0, 0.06, 0]} color={COLORS.darkSteel} metal={0.75} rough={0.3} />
      <Box size={[0.04, 0.12, 0.22]} position={[-0.17, 0.17, 0]} color={COLORS.steel} metal={0.85} rough={0.25} />
      <group name="jaw"><Box size={[0.04, 0.12, 0.22]} position={[0.1, 0.17, 0]} color={COLORS.steel} metal={0.85} rough={0.25} /></group>
      <Cyl r={0.02} len={0.24} axis="x" position={[0.35, 0.08, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
      <Box size={[0.18, 0.025, 0.025]} position={[0.47, 0.08, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
      <Grip name="grip-vice" at={[0.5, 0.08, 0.05]} />
      <Box size={[0.24, 0.1, 0.16]} position={[-0.03, 0.22, 0]} color={COLORS.alu} metal={0.85} rough={0.3} />
      <Box size={[0.1, 0.012, 0.06]} position={[-0.03, 0.272, 0]} color="#9aa5b0" metal={0.9} rough={0.2} shadow={false} />
    </group>
  </group>
);

/** Spindle head on the Z slide, with the cutter. Moves with param z; the cutter spins. */
const SpindleHead = () => (
  <group name="head" position={[SP_X, headY(1), SP_Z]}>
    <Box size={[0.48, 0.6, 0.5]} position={[0, 0.25, -0.18]} color={BODY} metal={0.3} rough={0.45} />
    <Box size={[0.42, 0.04, 0.44]} position={[0, 0.57, -0.18]} color={BLUE} metal={0.2} rough={0.5} />
    <Cyl r={0.13} len={0.3} position={[0, 0.7, -0.22]} color={GREY} metal={0.4} rough={0.45} />
    <Cyl r={0.1} len={0.12} position={[0, -0.06, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
    <group name="cutter">
      <Cyl r={0.05} r2={0.04} len={0.1} position={[0, -0.17, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
      <Cyl r={0.025} len={0.12} position={[0, -0.28, 0]} color="#c9a54a" metal={0.85} rough={0.25} seg={12} />
      {[0, Math.PI / 2].map((a) => <Box key={a} size={[0.052, 0.1, 0.006]} position={[0, -0.29, 0]} rotation={[0, a, 0]} color="#b8913a" metal={0.85} rough={0.25} shadow={false} />)}
    </group>
    {/* Coolant nozzles */}
    <Tube points={[[0.12, 0.0, 0.05], [0.16, -0.12, 0.08], [0.06, -0.24, 0.06]]} r={0.012} color={COLORS.orange} rough={0.6} />
    <Tube points={[[-0.12, 0.0, 0.05], [-0.16, -0.12, 0.08], [-0.06, -0.24, 0.06]]} r={0.012} color={COLORS.orange} rough={0.6} />
  </group>
);

const ToolChanger = () => (
  <group position={[-0.75, 1.15, -0.45]}>
    <Box size={[0.08, 0.5, 0.08]} position={[0.22, 0.2, 0]} color={GREY} metal={0.35} rough={0.5} />
    <group name="carousel">
      <Cyl r={0.36} len={0.06} color={BODY} metal={0.3} rough={0.45} />
      <Radial count={20}>{(a, i) => (
        <group key={i} position={[Math.cos(a) * 0.3, -0.1, Math.sin(a) * 0.3]}>
          <Cyl r={0.035} len={0.1} color={COLORS.darkSteel} metal={0.8} rough={0.3} seg={12} />
          <Cyl r={0.012} len={0.1} position={[0, -0.09, 0]} color={i % 3 ? COLORS.steel : '#c9a54a'} metal={0.9} rough={0.2} seg={8} />
        </group>
      )}</Radial>
    </group>
  </group>
);

/** Enclosure with the interlocked sliding doors and window. */
const Enclosure = () => (
  <group>
    <Box size={[2.6, 2.2, 0.04]} position={[0, 0.3, -1.3]} color={BODY} metal={0.3} rough={0.45} />
    {[-1, 1].map((s) => <Box key={s} size={[0.04, 2.2, 2.0]} position={[s * 1.3, 0.3, -0.3]} color={BODY} metal={0.3} rough={0.45} />)}
    <Box size={[2.64, 0.06, 2.04]} position={[0, 1.42, -0.3]} color={BLUE} metal={0.2} rough={0.5} />
    <Box size={[2.6, 0.7, 0.04]} position={[0, -0.95, 0.7]} color={BODY} metal={0.3} rough={0.45} />
    <Box size={[0.75, 2.2, 0.04]} position={[0.95, 0.3, 0.72]} color={BODY} metal={0.3} rough={0.45} />
    <group name="door">
      <Box size={[1.85, 1.5, 0.04]} position={[-0.38, 0.35, 0.76]} color={BODY} metal={0.3} rough={0.45} />
      <Box size={[1.2, 0.9, 0.02]} position={[-0.38, 0.4, 0.785]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.35} shadow={false} />
      <Box size={[0.05, 0.4, 0.05]} position={[0.42, 0.4, 0.81]} color={GREY} metal={0.6} rough={0.3} />
      <Grip name="grip-door" at={[0.42, 0.4, 0.84]} />
    </group>
    <Box size={[0.05, 0.08, 0.04]} position={[0.58, 0.9, 0.76]} color={COLORS.red} metal={0.2} rough={0.5} />
    <Sticker kind="warning" pic="rotating" size={0.14} position={[0.95, 0.9, 0.745]} />
    <Sticker kind="mandatory" pic="glasses" size={0.14} position={[0.95, 0.6, 0.745]} />
    <Plate lines={['WABYS VMC-850', 'X850 Y500 Z550 · 10 000 rpm']} size={[0.44, 0.1]} position={[0.95, 1.25, 0.745]} bg="#14234c" fg="#ffffff" />
  </group>
);

const Controls = () => (
  <group position={[1.55, 0.55, 0.65]} rotation={[0, -0.5, 0]}>
    <Box size={[0.55, 0.85, 0.12]} color="#2b3a4a" metal={0.3} rough={0.5} />
    <Box size={[0.4, 0.3, 0.002]} position={[0, 0.2, 0.061]} color="#0c2b3f" emissive="#1b6fa8" glow={0.8} shadow={false} />
    {Array.from({ length: 12 }, (_, i) => <Box key={i} size={[0.05, 0.035, 0.012]} position={[-0.15 + (i % 6) * 0.06, -0.06 - Math.floor(i / 6) * 0.05, 0.066]} color="#d5d8d6" shadow={false} />)}
    <Cyl r={0.045} len={0.04} axis="z" position={[0.17, -0.3, 0.08]} color={COLORS.red} emissive="#4a0806" glow={0.3} />
    <Cyl r={0.025} len={0.03} axis="z" position={[-0.15, -0.3, 0.075]} color={COLORS.green} />
    <Cyl r={0.025} len={0.03} axis="z" position={[-0.05, -0.3, 0.075]} color={COLORS.yellow} />
    <Grip name="grip-estop" at={[0.17, -0.3, 0.1]} />
    <Grip name="grip-start" at={[-0.15, -0.3, 0.1]} />
  </group>
);

const Chips = () => (
  <group>
    <Box size={[0.5, 0.35, 1.8]} position={[1.6, -1.0, -0.2]} color={GREY} metal={0.35} rough={0.5} />
    <Box size={[0.4, 0.5, 0.4]} position={[1.6, -0.95, 0.9]} color="#3e4650" metal={0.5} rough={0.4} />
    <Box size={[1.0, 0.4, 0.5]} position={[-0.6, -1.05, 0.95]} color="#5b6670" metal={0.4} rough={0.5} />
    <Plate lines={['COOLANT 5 %', '250 L']} size={[0.3, 0.1]} position={[-0.6, -1.0, 1.205]} />
  </group>
);

export const cncMill: ModelDef = {
  id: 'cnc-mill',
  title: tx('CNC vertical machining centre', 'مركز تشغيل CNC رأسي'),
  assetTag: 'VMC-850 · WS-03',
  view: { camera: [2.4, 1.4, 3.6], target: [0, 0.2, 0] },
  params: { door: 1, z: 1, clamp: 1 },
  runParams: { door: 0, z: 0.25 },
  env: {
    unitsPerM: 1.0, floorY: -1.25, stand: 'floor', bay: 'cnc',
    stations: [
      { id: 'panel', label: tx('Control panel', 'لوحة التحكم'), pos: [1.7, 1.4], face: Math.PI - 0.5, pose: 'operate', reach: [1.55, 0.3, 0.75] },
      { id: 'door', label: tx('Front door', 'الباب الأمامي'), pos: [0.0, 1.35], face: Math.PI, pose: 'reach', reach: [0.42, 0.4, 0.86] },
      { id: 'vice', label: tx('At the vice', 'عند المنجلة'), pos: [0.2, 1.15], face: Math.PI, pose: 'reach', reach: [0.5, 0.0, 0.1] },
      { id: 'side', label: tx('Chip conveyor', 'ناقل الرايش'), pos: [2.2, 0.0], face: -Math.PI / 2, pose: 'inspect', reach: [1.6, -0.8, 0] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-3.6, 2.4], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'enclosure', name: tx('Enclosure & interlocked door', 'الغلاف والباب ذو القفل البيني'), explode: [0, 0, 1.4], stage: 0,
      animate: (g, s) => { const d = child(g, 'door'); if (d) d.position.x = THREE.MathUtils.lerp(d.position.x, param(s, 'door') * 1.0, 0.1); },
      render: () => <Enclosure />,
      hotspot: {
        position: [0.42, 0.6, 0.85], title: tx('Door interlock', 'القفل البيني للباب'), specs: [[tx('Door open', 'الباب مفتوح'), tx('Spindle and axes stop; setup mode only', 'يتوقف العمود والمحاور؛ وضع الضبط فقط')], [tx('Window', 'النافذة'), tx('Polycarbonate, impact rated', 'بولي كربونات مقاوم للصدمات')]],
        safety: tx('Never defeat the interlock. A cutter at 10 000 rpm can throw a broken insert through an open door.', 'لا تعطّل القفل البيني أبدًا. القاطع عند 10000 لفة/دقيقة قد يقذف لقمة مكسورة من الباب المفتوح.'),
      },
    },
    {
      id: 'head', name: tx('Spindle head & cutter', 'رأس العمود والقاطع'), explode: [0, 0.9, 0.2], stage: 0.2,
      animate: (g, s) => {
        const h = child(g, 'head');
        if (h) h.position.y = THREE.MathUtils.lerp(h.position.y, headY(param(s, 'z', 1)), 0.06);
        const c = child(g, 'cutter');
        if (c && s.running) c.rotation.y += s.dt * 30;
      },
      render: () => <SpindleHead />,
      hotspot: {
        position: [0, 0.5, 0.1], title: tx('BT40 spindle', 'عمود BT40'), specs: [[tx('Speed', 'السرعة'), '10 000 rpm'], [tx('Power', 'القدرة'), '11 kW'], [tx('Cutter', 'القاطع'), tx('Ø12 mm end mill, 4 flutes', 'قاطع طرفي قطر 12 مم، 4 حواف')]],
        safety: tx('Chips come off hot and sharp. Clear them with a brush or the coolant gun, never by hand, and only when the spindle has stopped.', 'الرايش ساخن وحاد. أزله بفرشاة أو مسدس التبريد، وليس باليد أبدًا، وبعد توقف العمود فقط.'),
      },
    },
    {
      id: 'table', name: tx('Table, vice & workpiece', 'الطاولة والمنجلة والمشغولة'), explode: [0, -0.3, 0.9], stage: 0.3,
      animate: (g, s) => { const j = child(g, 'jaw'); if (j) j.position.x = THREE.MathUtils.lerp(j.position.x, (1 - param(s, 'clamp', 1)) * 0.08, 0.15); },
      render: () => <Table />,
      hotspot: {
        position: [0.1, 0.16, 0.1], title: tx('Machine vice', 'منجلة الماكينة'), specs: [[tx('Jaws', 'الفكوك'), '150 mm'], [tx('Part', 'القطعة'), tx('Aluminium 6082, 120 × 80 × 50', 'ألومنيوم 6082، ‏120 × 80 × 50')]],
        safety: tx('Take the vice handle off before you close the door: left on, it is flung out when the table moves.', 'انزع ذراع المنجلة قبل إغلاق الباب: إذا تُرك يُقذف عندما تتحرك الطاولة.'),
      },
    },
    {
      id: 'atc', name: tx('Automatic tool changer', 'مغير العدد الآلي'), explode: [-0.8, 0.5, 0], stage: 0.4,
      animate: (g, s) => { const c = child(g, 'carousel'); if (c && s.running) c.rotation.y += s.dt * 0.3; },
      render: () => <ToolChanger />,
      hotspot: { position: [-0.75, 1.2, -0.1], title: tx('20-pocket carousel', 'حاضنة 20 عدة'), specs: [[tx('Change time', 'زمن التغيير'), '2.5 s'], [tx('Max tool', 'أقصى عدة'), 'Ø80 × 250 mm, 7 kg']] },
    },
    {
      id: 'controls', name: tx('Control panel', 'لوحة التحكم'), explode: [0.6, 0, 0.4], stage: 0.5,
      render: () => <Controls />,
      hotspot: { position: [1.6, 0.3, 0.8], title: tx('CNC control', 'وحدة التحكم CNC'), specs: [[tx('Modes', 'الأوضاع'), tx('Auto, MDI, jog, single block', 'تلقائي، MDI، تحريك يدوي، كتلة مفردة')], [tx('First run', 'التشغيل الأول'), tx('Single block, rapid at 25 %', 'كتلة مفردة والحركة السريعة 25٪')]] },
    },
    { id: 'chips', name: tx('Chip conveyor & coolant tank', 'ناقل الرايش وخزان التبريد'), explode: [0.8, -0.4, 0.4], stage: 0.6, render: () => <Chips /> },
    { id: 'column', name: tx('Base & column', 'القاعدة والعمود الرأسي'), explode: [0, -0.6, -0.8], stage: 0.8, render: () => <BaseColumn /> },
  ],
};
