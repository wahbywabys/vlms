/**
 * Procedural 2-axis CNC turning centre (slant-bed style, simplified to a flat
 * bed). The spindle runs along x, headstock on the left (−x). Lesson params:
 *   feed  0..1  carriage travel toward the chuck
 *   cut   0..1  length of the bar already turned to size
 *   door  0..1  guard door slid open
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, child, param, Radial, Tube, tx, type ModelDef } from './kit';

const PAINT = '#e8ebee';
const TRIM = '#2b3a4a';
const ACCENT = COLORS.orange;
const SPIN = 14;

const Base = () => (
  <group>
    <Box size={[4.6, 0.62, 1.15]} position={[0, -0.94, 0]} color={TRIM} metal={0.2} rough={0.7} />
    <Box size={[4.4, 0.3, 0.9]} position={[0, -0.48, 0]} color="#56616c" metal={0.5} rough={0.4} />
    {/* Hardened box ways */}
    {[-0.3, 0.3].map((z) => <Box key={z} size={[4.3, 0.06, 0.12]} position={[0, -0.3, z]} color={COLORS.steel} metal={0.9} rough={0.2} />)}
    {/* Chip tray */}
    <Box size={[3.4, 0.05, 0.5]} position={[-0.2, -0.62, 0.55]} color="#3d4650" />
  </group>
);

const Headstock = () => (
  <group>
    <Box size={[0.95, 1.15, 0.95]} position={[-1.75, 0.27, 0]} color={PAINT} metal={0.2} rough={0.5} />
    <Box size={[0.97, 0.12, 0.97]} position={[-1.75, 0.86, 0]} color={ACCENT} metal={0.2} rough={0.5} />
    {/* Spindle nose bearing housing */}
    <Cyl r={0.34} len={0.14} axis="x" position={[-1.22, 0, 0]} color={COLORS.darkSteel} metal={0.7} rough={0.3} />
  </group>
);

const Chuck = () => (
  <group>
    <Cyl r={0.42} len={0.32} axis="x" position={[-1.0, 0, 0]} color={COLORS.steel} metal={0.85} rough={0.25} />
    <Radial count={3}>
      {(a, i) => (
        <Box key={i} size={[0.1, 0.22, 0.12]} position={[-0.8, Math.cos(a) * 0.24, Math.sin(a) * 0.24]} rotation={[a, 0, 0]}
          color={COLORS.darkSteel} metal={0.8} rough={0.3} />
      )}
    </Radial>
  </group>
);

/** Bar stock: the turned length grows with `cut`. */
const Workpiece = () => (
  <group position={[-0.76, 0, 0]}>
    <Cyl name="stock" r={0.1} len={0.86} axis="x" position={[0.43, 0, 0]} color="#b8bfc6" metal={0.9} rough={0.18} />
    <group name="turned" position={[0.86, 0, 0]}>
      {/* Scaled along x from the free end inward */}
      <Cyl r={0.085} len={1} axis="x" position={[-0.5, 0, 0]} color="#e6ebef" metal={0.95} rough={0.08} />
    </group>
  </group>
);

const Carriage = () => (
  <group name="slide" position={[0.35, 0, 0]}>
    <Box size={[0.7, 0.16, 0.9]} position={[0, -0.19, 0]} color={PAINT} metal={0.2} rough={0.5} />
    <Box size={[0.5, 0.12, 0.6]} position={[0, -0.05, 0.12]} color="#c9ced3" metal={0.4} rough={0.4} />
    {/* Turret disc with tool stations, axis along x */}
    <Cyl r={0.26} len={0.18} axis="x" position={[0, 0, 0.48]} seg={8} color={COLORS.darkSteel} metal={0.7} rough={0.3} />
    <Box size={[0.12, 0.07, 0.3]} position={[0, 0, 0.24]} color={COLORS.black} />
    {/* Carbide insert, tip near the bar */}
    <Box size={[0.05, 0.03, 0.05]} position={[0, 0, 0.1]} rotation={[0, Math.PI / 4, 0]} color={COLORS.yellow} metal={0.6} rough={0.3} emissive="#7a5a00" glow={0.2} />
  </group>
);

const Tailstock = () => (
  <group>
    <Box size={[0.55, 0.62, 0.62]} position={[1.6, 0.0, 0]} color={PAINT} metal={0.2} rough={0.5} />
    <Cyl r={0.09} len={0.5} axis="x" position={[1.15, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
    <Cyl r={0.08} r2={0.01} len={0.14} axis="x" position={[0.85, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
  </group>
);

const GuardDoor = () => (
  <group name="door">
    <Box size={[2.2, 1.3, 0.04]} position={[-0.25, 0.3, 0.78]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.22} shadow={false} />
    <Box size={[2.24, 0.08, 0.06]} position={[-0.25, 0.97, 0.78]} color={TRIM} />
    <Box size={[2.24, 0.08, 0.06]} position={[-0.25, -0.37, 0.78]} color={TRIM} />
    {[-1.35, 0.85].map((x) => <Box key={x} size={[0.08, 1.38, 0.06]} position={[x, 0.3, 0.78]} color={TRIM} />)}
    <Box size={[0.06, 0.4, 0.06]} position={[0.65, 0.3, 0.84]} color={ACCENT} />
  </group>
);

const Controls = () => (
  <group position={[2.25, 0.45, 0.55]} rotation={[0, -0.5, 0]}>
    <Box size={[0.62, 0.9, 0.16]} color={TRIM} />
    <Box size={[0.48, 0.32, 0.02]} position={[0, 0.17, 0.09]} color="#0c2b3f" emissive="#1b6fa8" glow={0.9} />
    <Cyl r={0.06} len={0.05} axis="z" position={[0.18, -0.25, 0.1]} color={COLORS.red} emissive="#6a0c08" glow={0.4} />
    <Box size={[0.26, 0.14, 0.02]} position={[-0.1, -0.2, 0.09]} color="#3b4856" />
  </group>
);

const Coolant = () => (
  <group>
    <Tube points={[[-1.2, 0.9, -0.3], [-0.9, 0.85, -0.25], [-0.55, 0.4, -0.1], [-0.45, 0.17, 0]]} r={0.022} color="#2e3c4b" metal={0.3} />
    <Cyl r={0.025} r2={0.012} len={0.08} position={[-0.45, 0.13, 0]} color={COLORS.brass} metal={0.8} rough={0.3} />
  </group>
);

export const cncLathe: ModelDef = {
  id: 'cnc-lathe',
  title: tx('CNC turning centre · 2-axis', 'مخرطة CNC · محوران'),
  assetTag: 'CNC2-L01 · MTL-250',
  view: { camera: [3.8, 2.4, 6.0], target: [0, 0.1, 0] },
  params: { door: 0, feed: 0.3, cut: 0.6 },
  env: {
    unitsPerM: 1.14, stand: 'floor', bay: 'cnc',
    stations: [
      { id: 'front', label: tx('Operator position', 'موقع المشغل'), pos: [-0.2, 1.6], face: Math.PI, pose: 'operate', reach: [0.65, 0.3, 0.86] },
      { id: 'controls', label: tx('Control panel', 'لوحة التحكم'), pos: [1.8, 1.4], face: 2.64, pose: 'operate', reach: [2.15, 0.38, 0.66] },
      { id: 'chuck', label: tx('Chuck', 'الظرف'), pos: [-0.85, 1.5], face: Math.PI, pose: 'reach', reach: [-0.85, 0.08, 0.32] },
      { id: 'tailstock', label: tx('Tailstock', 'الغراب المتحرك'), pos: [1.5, 1.5], face: Math.PI, pose: 'inspect', reach: [1.35, 0.1, 0.35] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-3.9, 2.7], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'guard', name: tx('Guard door (interlocked)', 'باب الحماية (معشّق)'), explode: [0, 0.3, 1.6], stage: 0,
      animate: (g, s) => { const d = child(g, 'door'); if (d) d.position.x = THREE.MathUtils.lerp(d.position.x, param(s, 'door') * 1.6, 0.15); },
      render: () => <GuardDoor />,
      hotspot: {
        position: [0.65, 0.65, 0.85], title: tx('Guard door interlock', 'تعشيق باب الحماية'),
        specs: [[tx('Switch', 'المفتاح'), 'Safety interlock, PL d'], [tx('Glass', 'الزجاج'), tx('Polycarbonate 8 mm', 'بولي كربونات 8 مم')], [tx('Spindle with door open', 'الدوران والباب مفتوح'), tx('Blocked', 'ممنوع')]],
        safety: tx('Never bypass the interlock. Open the door only when the spindle has fully stopped.', 'لا تتجاوز التعشيق أبدًا. افتح الباب فقط بعد توقف عمود الدوران تمامًا.'),
      },
    },
    {
      id: 'controls', name: tx('CNC control & E-stop', 'وحدة التحكم وزر الطوارئ'), explode: [1.2, 0.2, 0.6], stage: 0.05,
      render: () => <Controls />,
      hotspot: {
        position: [2.3, 0.95, 0.6], title: tx('Control panel', 'لوحة التحكم'),
        specs: [[tx('Control', 'نظام التحكم'), 'Fanuc 0i-TF'], [tx('Program', 'البرنامج'), 'O1180 (JC-118)'], [tx('Offsets', 'الإزاحات'), tx('Wear / geometry, X and Z', 'تآكل / هندسة، X و Z')]],
        safety: tx('E-stop stops the spindle and axes. Reset only after finding the cause.', 'زر الطوارئ يوقف الدوران والمحاور. لا تُعِد الضبط قبل معرفة السبب.'),
      },
    },
    {
      id: 'tailstock', name: tx('Tailstock', 'الغراب المتحرك'), explode: [1.4, 0, 0], stage: 0.15,
      render: () => <Tailstock />,
      hotspot: {
        position: [1.6, 0.45, 0], title: tx('Tailstock & live centre', 'الغراب والذنبة الدوارة'),
        specs: [[tx('Quill travel', 'مشوار الجلبة'), '80 mm'], [tx('Taper', 'المسلوب'), 'MT4'], [tx('Use when', 'يُستخدم عندما'), tx('Bar sticks out > 3 × Ø', 'بروز القطعة > 3 × القطر')]],
      },
    },
    {
      id: 'carriage', name: tx('Carriage, cross-slide & turret', 'العربة والمنزلقة العرضية والبرج'), explode: [0.6, 0.9, 0.9], stage: 0.25,
      animate: (g, s) => { const sl = child(g, 'slide'); if (sl) sl.position.x = THREE.MathUtils.lerp(sl.position.x, 0.35 - param(s, 'feed') * 0.75, 0.2); },
      render: () => <Carriage />,
      hotspot: {
        position: [0.35, 0.38, 0.48], title: tx('Turret & tool', 'البرج وأداة القطع'),
        specs: [[tx('Stations', 'المحطات'), '8 × VDI 30'], [tx('Insert', 'اللقمة'), 'CNMG 120408'], [tx('Axes', 'المحاور'), tx('X (diameter), Z (length)', 'X (القطر)، Z (الطول)')]],
        safety: tx('Clear the turret path before cycle start: no gauges or rags on the bed.', 'أخلِ مسار البرج قبل بدء الدورة: لا أدوات قياس ولا قماش على الفرش.'),
      },
    },
    {
      id: 'coolant', name: tx('Coolant nozzle', 'فوهة سائل التبريد'), explode: [0, 1.4, -0.6], stage: 0.3,
      render: () => <Coolant />,
      hotspot: {
        position: [-0.9, 0.95, -0.25], title: tx('Coolant supply', 'تغذية سائل التبريد'),
        specs: [[tx('Fluid', 'السائل'), tx('Soluble oil 6 %', 'زيت قابل للذوبان 6 %')], [tx('Check', 'الفحص'), tx('Concentration weekly (refractometer)', 'التركيز أسبوعيًا (رفراكتومتر)')]],
        safety: tx('H319: wear safety glasses; wash skin contact.', 'H319: ارتدِ نظارة أمان واغسل الجلد عند التلامس.'),
      },
    },
    {
      id: 'workpiece', name: tx('Workpiece (C45 bar Ø30)', 'المشغولة (عمود C45 قطر 30)'), explode: [0.5, 0.5, 0], stage: 0.4,
      spin: { axis: 'x', speed: SPIN },
      animate: (g, s) => {
        const tn = child(g, 'turned');
        const st = child(g, 'stock');
        const c = Math.max(0.001, param(s, 'cut')) * 0.6;
        if (tn) { tn.scale.x = c; tn.visible = param(s, 'cut') > 0.01; }
        if (st) { st.scale.y = (0.86 - c) / 0.86; st.position.x = (0.86 - c) / 2; }
      },
      render: () => <Workpiece />,
      hotspot: {
        position: [-0.3, 0.25, 0], title: tx('Shaft Ø25 h7, Ra 1.6', 'عمود Ø25 h7، خشونة Ra 1.6'),
        specs: [[tx('Tolerance', 'التفاوت'), '24.979 – 25.000 mm'], [tx('Measure with', 'القياس بـ'), tx('0–25 mm micrometer', 'ميكرومتر 0–25 مم')], [tx('Material', 'الخامة'), 'C45 (1.0503)']],
      },
    },
    {
      id: 'chuck', name: tx('3-jaw hydraulic chuck', 'ظرف هيدروليكي ثلاثي الفكوك'), explode: [0.3, 0, 0], stage: 0.5,
      spin: { axis: 'x', speed: SPIN },
      render: () => <Chuck />,
      hotspot: {
        position: [-0.95, 0.55, 0], title: tx('Chuck', 'الظرف'),
        specs: [[tx('Size', 'المقاس'), '8"'], [tx('Clamping pressure', 'ضغط الربط'), '25 bar'], [tx('Max speed', 'أقصى سرعة'), '4 500 rpm']],
        safety: tx('Low chuck pressure lets the part slip: check the gauge before every cycle.', 'ضغط الظرف المنخفض يسمح بانزلاق القطعة: افحص المؤشر قبل كل دورة.'),
      },
    },
    {
      id: 'headstock', name: tx('Headstock & spindle', 'رأس المخرطة وعمود الدوران'), explode: [-0.9, 0.6, 0], stage: 0.55,
      render: () => <Headstock />,
      hotspot: {
        position: [-1.75, 0.95, 0.3], title: tx('Spindle', 'عمود الدوران'),
        specs: [[tx('Power', 'القدرة'), '11 kW'], [tx('Speed', 'السرعة'), '50 – 4 500 rpm'], [tx('Bearings', 'الرولمان'), tx('Angular contact, preloaded', 'تلامس زاوي، محمّل مسبقًا')]],
      },
    },
    {
      id: 'bed', name: tx('Bed & base', 'الفرش والقاعدة'), explode: [0, 0, 0],
      render: () => <Base />,
      hotspot: {
        position: [0.9, -0.25, -0.35], title: tx('Bed ways', 'مجاري الفرش'),
        specs: [[tx('Type', 'النوع'), tx('Hardened box ways', 'مجاري صندوقية مقسّاة')], [tx('Lubrication', 'التزييت'), tx('Auto, every 30 min', 'آلي كل 30 دقيقة')]],
      },
    },
  ],
};
