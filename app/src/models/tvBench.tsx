/**
 * LED TV on the audio-visual repair bench (AVE): the panel face-down on a
 * soft mat with its back cover off, the power board (mains side, big
 * capacitor), the LED backlight driver, the main board (HDMI, tuner) and the
 * T-con. On the bench: an isolation transformer, a variac, a pattern
 * generator, an LED backlight tester and a multimeter. Bench top at y = 0.
 * Lesson params:
 *   back    0..1  back cover off
 *   power   0..1  set powered (through the isolation transformer)
 *   iso     0..1  fed through the isolation transformer
 *   cap     0..1  primary capacitor charged
 *   leds    0..1  backlight tester on the LED strips
 */
import * as THREE from 'three';
import { Box, Cyl, Plate, Sticker, Tube, child, glowOf, param, tx, type ModelDef } from './kit';

const CASE = '#e9ecef';
const DARK = '#22262b';
const PCB = '#1f6f43';

/** The panel lies screen-down on the mat, back facing up. */
const Panel = () => (
  <group position={[0.2, 0.03, 0.25]}>
    <Box size={[1.9, 0.02, 0.05]} position={[0, 0.0, -0.55]} color="#3e4650" />
    <Box size={[1.85, 0.05, 1.08]} position={[0, 0.03, 0]} color={DARK} rough={0.3} />
    {/* Backlight LED strips under a diffuser (visible through a cut-out) */}
    {[-0.3, 0, 0.3].map((z) => (
      <group key={z} position={[0, 0.06, z]}>
        <Box size={[1.6, 0.006, 0.05]} color="#c3cbd3" />
        {Array.from({ length: 10 }, (_, i) => <Box key={i} name="led" size={[0.04, 0.008, 0.03]} position={[-0.72 + i * 0.16, 0.006, 0]} color="#f7f7f2" emissive="#ffffff" glow={0} shadow={false} />)}
      </group>
    ))}
    <Plate lines={['WABYS 55" UHD LED', 'Model LT55U · 220 V · 130 W']} size={[0.4, 0.08]} position={[-0.7, 0.062, 0.45]} rotation={[-Math.PI / 2, 0, 0]} />
  </group>
);

const BackCover = () => (
  <group name="back-cover" position={[0.2, 0.12, 0.25]}>
    <Box size={[1.8, 0.03, 1.02]} color="#3e4650" rough={0.6} opacity={0.98} />
  </group>
);

const Boards = () => (
  <group position={[0.2, 0.09, 0.25]}>
    {/* Power supply board (left): primary side, bulk cap, bridge */}
    <group position={[-0.5, 0, 0]}>
      <Box size={[0.5, 0.012, 0.4]} color={PCB} />
      <Cyl name="ps-cap" r={0.05} len={0.11} position={[-0.12, 0.06, -0.08]} color="#1f3d7a" emissive="#ff3020" glow={0} />
      <Box size={[0.08, 0.06, 0.08]} position={[0.05, 0.03, -0.1]} color="#e9e4d6" />
      <Box size={[0.07, 0.05, 0.02]} position={[0.15, 0.03, 0.08]} color="#5b6670" metal={0.6} />
      <Sticker kind="warning" pic="electric" size={0.07} position={[-0.15, 0.008, 0.12]} rotation={[-Math.PI / 2, 0, 0]} />
      <Plate lines={['PSU · HOT side']} size={[0.14, 0.035]} position={[0.1, 0.008, 0.15]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
    {/* LED driver */}
    <Box size={[0.3, 0.012, 0.2]} position={[-0.05, 0, 0.25]} color={PCB} />
    {/* Main board with HDMI and tuner */}
    <group position={[0.35, 0, 0]}>
      <Box size={[0.42, 0.012, 0.3]} color={PCB} />
      <Box size={[0.12, 0.02, 0.12]} position={[0, 0.02, 0]} color="#5b6670" metal={0.6} />
      {[0, 1, 2].map((i) => <Box key={i} size={[0.05, 0.02, 0.03]} position={[0.18, 0.02, -0.1 + i * 0.07]} color="#c3cbd3" metal={0.7} />)}
      <Box name="main-led" size={[0.02, 0.01, 0.02]} position={[-0.15, 0.015, 0.12]} color="#103a12" emissive="#2fff80" glow={0} shadow={false} />
    </group>
    {/* T-con and LVDS ribbon */}
    <Box size={[0.3, 0.012, 0.12]} position={[0.35, 0, -0.38]} color={PCB} />
    <Box size={[0.08, 0.004, 0.2]} position={[0.35, 0.01, -0.22]} color="#c9a54a" />
  </group>
);

const Instruments = () => (
  <group>
    {/* Isolation transformer and variac */}
    <group position={[-1.55, 0, -0.45]}>
      <Box size={[0.4, 0.3, 0.32]} position={[0, 0.15, 0]} color="#5b6670" metal={0.5} />
      <Plate lines={['ISO 230/230 V · 500 VA']} size={[0.3, 0.05]} position={[0, 0.2, 0.162]} />
      <Box size={[0.32, 0.22, 0.3]} position={[0, 0.11, 0.42]} color="#3e4650" metal={0.5} />
      <Cyl r={0.09} len={0.04} position={[0, 0.24, 0.42]} color="#22262b" />
      <Plate lines={['VARIAC 0–250 V']} size={[0.22, 0.04]} position={[0, 0.08, 0.571]} />
    </group>
    {/* Pattern generator and LED tester */}
    <group position={[1.6, 0, -0.45]}>
      <Box size={[0.36, 0.14, 0.28]} position={[0, 0.07, 0]} color={CASE} />
      <Box name="gen-screen" size={[0.16, 0.08, 0.01]} position={[-0.06, 0.08, 0.142]} color="#0c2b3f" emissive="#f2c230" glow={0} shadow={false} />
      <Plate lines={['HDMI PATTERN GEN']} size={[0.2, 0.03]} position={[0, 0.02, 0.142]} />
      <Box size={[0.2, 0.08, 0.14]} position={[0, 0.04, 0.35]} color="#f2c230" />
      <Plate lines={['LED TESTER 0–300 V']} size={[0.16, 0.03]} position={[0, 0.04, 0.421]} />
    </group>
    <group name="led-lead"><Tube points={[[1.6, 0.06, -0.05], [1.3, 0.2, 0.1], [0.9, 0.12, 0.25], [0.6, 0.1, 0.25]]} r={0.006} color="#c8312b" /></group>
    <group name="iso-lead"><Tube points={[[-1.4, 0.1, 0.0], [-1.1, 0.15, 0.2], [-0.6, 0.12, 0.25], [-0.4, 0.1, 0.25]]} r={0.01} color="#22262b" /></group>
    {/* Multimeter and discharge tool */}
    <group position={[1.15, 0, 0.75]} rotation={[0, -0.3, 0]}>
      <Box size={[0.14, 0.04, 0.26]} position={[0, 0.02, 0]} color="#f2c230" rough={0.6} />
      <Box size={[0.09, 0.01, 0.06]} position={[0, 0.045, -0.06]} color="#b8c6a0" />
    </group>
    <group position={[-1.2, 0, 0.8]} rotation={[0, 0.4, 0]}>
      <Cyl r={0.015} len={0.3} axis="x" position={[0, 0.02, 0]} color="#c8312b" />
      <Plate lines={['DISCHARGE 2 kΩ 10 W']} size={[0.16, 0.03]} position={[0, 0.04, 0.03]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  </group>
);

export const tvBench: ModelDef = {
  id: 'tv-bench',
  title: tx('LED TV on the repair bench', 'شاشة LED على طاولة الإصلاح'),
  assetTag: 'LT55U · AVE-03',
  view: { camera: [1.2, 2.2, 3.0], target: [0.2, 0.0, 0.1] },
  params: { back: 1, power: 0, iso: 1, cap: 0, leds: 0 },
  runParams: { power: 1, cap: 1 },
  env: {
    unitsPerM: 2.5, floorY: -2.25, stand: 'bench', bay: 'ave',
    stations: [
      { id: 'front', label: tx('At the bench', 'أمام الطاولة'), pos: [0.2, 1.9], face: Math.PI, pose: 'inspect', reach: [0.2, 0.1, 0.6] },
      { id: 'psu', label: tx('Power board', 'لوحة التغذية'), pos: [-0.4, 1.7], face: Math.PI, pose: 'reach', reach: [-0.3, 0.12, 0.3] },
      { id: 'main', label: tx('Main board', 'اللوحة الرئيسية'), pos: [0.6, 1.7], face: Math.PI, pose: 'reach', reach: [0.55, 0.12, 0.3] },
      { id: 'iso', label: tx('Isolation transformer', 'محول العزل'), pos: [-1.5, 1.8], face: Math.PI, pose: 'reach', reach: [-1.55, 0.3, -0.2] },
      { id: 'tester', label: tx('Pattern generator and LED tester', 'مولد الأنماط وفاحص LED'), pos: [1.6, 1.8], face: Math.PI, pose: 'operate', reach: [1.6, 0.15, -0.1] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'back', name: tx('Back cover', 'الغطاء الخلفي'), explode: [0, 1.0, 0], stage: 0,
      animate: (g, s) => { const o = child(g, 'back-cover'); if (o) { o.position.y = THREE.MathUtils.lerp(o.position.y, 0.12 + param(s, 'back') * 1.2, 0.1); o.visible = o.position.y < 1.2; } },
      render: () => <BackCover />,
      hotspot: { position: [0.2, 0.15, 0.25], title: tx('Back cover', 'الغطاء الخلفي'), specs: [[tx('Fixing', 'التثبيت'), tx('14 screws, clips at the edge', '14 مسمارًا ومشابك على الحافة')]] },
    },
    {
      id: 'psu', name: tx('Power supply board', 'لوحة التغذية'), explode: [-0.5, 0.6, 0], stage: 0.1,
      animate: (g, s) => glowOf(g, 'ps-cap', param(s, 'cap') * 0.9),
      render: () => <Boards />,
      hotspot: {
        position: [-0.3, 0.15, 0.17], title: tx('Switch-mode power supply', 'مصدر تغذية بالتقطيع'), specs: [[tx('Bulk cap', 'المكثف الرئيسي'), '150 µF · 400 V'], [tx('Primary', 'الابتدائي'), tx('Mains-referenced: "hot" ground', 'مرتبط بالشبكة: أرضي "ساخن"')]],
        safety: tx('The bulk capacitor holds about 340 V DC for minutes after unplugging. Measure it, then discharge it with the resistor tool.', 'المكثف الرئيسي يحتفظ بحوالي 340 فولت مستمر لدقائق بعد الفصل. قِسه ثم فرّغه بأداة المقاومة.'),
      },
    },
    {
      id: 'panel', name: tx('Panel and LED backlight', 'الشاشة وإضاءة LED الخلفية'), explode: [0, -0.5, 0.3], stage: 0.2,
      animate: (g, s) => glowOf(g, 'led', Math.max(param(s, 'leds'), s.running ? param(s, 'power') : 0) * 1.4),
      render: () => <Panel />,
      hotspot: { position: [0.2, 0.1, 0.0], title: tx('LED backlight strips', 'شرائط الإضاءة الخلفية'), specs: [[tx('Fault', 'العطل الشائع'), tx('One dead LED kills the whole string', 'ليد واحد تالف يطفئ الشريط كله')], [tx('String voltage', 'جهد الشريط'), '≈ 60–120 V DC']] },
    },
    {
      id: 'instruments', name: tx('Isolation transformer, variac and testers', 'محول العزل والفارياك وأجهزة الاختبار'), explode: [0.6, 0.6, -0.4], stage: 0.3,
      animate: (g, s) => {
        glowOf(g, 'gen-screen', param(s, 'power') * 0.9);
        glowOf(g, 'main-led', param(s, 'power') * 1.2);
        const l = child(g, 'led-lead'); if (l) l.visible = param(s, 'leds') > 0.5;
        const i = child(g, 'iso-lead'); if (i) i.visible = param(s, 'iso', 1) > 0.5;
      },
      render: () => <Instruments />,
      hotspot: { position: [-1.55, 0.35, -0.45], title: tx('Isolation transformer', 'محول العزل'), specs: [[tx('Why', 'لماذا'), tx('Lets you put a scope earth on the hot side safely', 'يسمح بتوصيل أرضي راسم الموجات بالجانب الساخن بأمان')], [tx('Variac', 'الفارياك'), tx('Brings a repaired set up slowly', 'يرفع الجهد تدريجيًا على الجهاز بعد الإصلاح')]] },
    },
  ],
};
