/**
 * Front-loading washing machine on the appliance repair stand for Home
 * Appliances Maintenance (HAM), with its top panel removable: drum and tub,
 * universal motor and belt, drain pump, door lock, heater, inlet valves and
 * the control board. Beside it: the isolation transformer and the appliance
 * safety tester (PAT) used for the final test. Floor-standing.
 * Lesson params:
 *   top     0..1  top panel off
 *   plug    0..1  plugged into the mains
 *   water   0..1  water in the drum
 *   door    0..1  door open
 *   pat     0..1  PAT tester connected and testing
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Radial, Sticker, Tube, child, glowOf, param, tx, type ModelDef } from './kit';

const WHITE = '#f1f3f5';
const FLOOR = -2.125;            // unitsPerM 2.5
const BODY_H = 0.85 * 2.5;
const BODY_W = 0.6 * 2.5;
const BODY_D = 0.6 * 2.5;
const CY = FLOOR + BODY_H / 2;

const Cabinet = () => (
  <group>
    {/* Sides, back and front panel (top is a separate part) */}
    {[-1, 1].map((x) => <Box key={x} size={[0.02, BODY_H, BODY_D]} position={[x * BODY_W / 2, CY, 0]} color={WHITE} metal={0.2} rough={0.35} />)}
    <Box size={[BODY_W, BODY_H, 0.02]} position={[0, CY, -BODY_D / 2]} color={WHITE} metal={0.2} rough={0.35} />
    <Box size={[BODY_W, BODY_H, 0.03]} position={[0, CY, BODY_D / 2]} color={WHITE} metal={0.2} rough={0.35} opacity={0.98} />
    {/* Control strip */}
    <Box size={[BODY_W, 0.3, 0.05]} position={[0, FLOOR + BODY_H - 0.17, BODY_D / 2 + 0.02]} color="#d5d8d6" />
    <Cyl r={0.08} len={0.05} axis="z" position={[-0.45, FLOOR + BODY_H - 0.17, BODY_D / 2 + 0.06]} color="#c3cbd3" metal={0.6} />
    <Box name="wm-display" size={[0.26, 0.1, 0.01]} position={[0.2, FLOOR + BODY_H - 0.17, BODY_D / 2 + 0.05]} color="#0c2b3f" emissive="#3ad1ff" glow={0} shadow={false} />
    <Plate lines={['WABYS WM 8 kg · 1400 rpm', '230 V · 2100 W · IPX4']} size={[0.4, 0.1]} position={[0.1, FLOOR + 0.25, BODY_D / 2 + 0.02]} />
    {/* Repair stand */}
    <Box size={[BODY_W + 0.3, 0.12, BODY_D + 0.3]} position={[0, FLOOR + 0.06, 0]} color="#3e4650" metal={0.5} />
  </group>
);

const Top = () => (
  <group name="top"><Box size={[BODY_W + 0.02, 0.03, BODY_D + 0.02]} position={[0, FLOOR + BODY_H + 0.015, 0]} color={WHITE} metal={0.2} rough={0.35} /></group>
);

const Door = () => (
  <group name="door" position={[-0.38, CY + 0.05, BODY_D / 2 + 0.04]}>
    <group position={[0.38, 0, 0]}>
      <Cyl r={0.38} len={0.08} axis="z" color="#c3cbd3" metal={0.5} rough={0.3} />
      <Cyl r={0.3} len={0.1} axis="z" color={COLORS.glass} opacity={0.4} rough={0.05} />
      <Box size={[0.08, 0.16, 0.06]} position={[0.36, 0, 0.03]} color="#c3cbd3" metal={0.5} />
    </group>
  </group>
);

/** Tub, drum (spins), water (shows when filled). */
const Drum = () => (
  <group position={[0, CY + 0.05, -0.05]}>
    <Cyl r={0.62} len={1.05} axis="z" color="#9aa5b0" metal={0.5} rough={0.4} open />
    <Cyl r={0.62} len={0.02} axis="z" position={[0, 0, -0.52]} color="#9aa5b0" metal={0.5} rough={0.4} />
    <group name="drum">
      <Cyl r={0.55} len={0.95} axis="z" color="#c3cbd3" metal={0.85} rough={0.25} open />
      <Radial count={3}>{(a, i) => <Box key={i} size={[0.08, 0.12, 0.85]} position={[Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0]} rotation={[0, 0, a]} color="#e9ecef" />}</Radial>
    </group>
    <Box name="water" size={[1.0, 0.4, 0.9]} position={[0, -0.32, 0]} color="#5ab0e8" opacity={0.45} rough={0.1} shadow={false} />
    {/* Shock absorbers and springs */}
    {[-0.35, 0.35].map((x) => <Cyl key={x} r={0.03} len={0.6} position={[x, -0.85, 0]} color="#5b6670" metal={0.6} />)}
    {[-0.4, 0.4].map((x) => <Cyl key={x} r={0.025} len={0.45} position={[x, 0.85, -0.2]} color={COLORS.steel} metal={0.8} />)}
  </group>
);

const MotorBelt = () => (
  <group position={[0, CY - 0.75, -0.55]}>
    <Cyl r={0.12} len={0.32} axis="x" position={[0.15, 0, 0.1]} color="#5b6670" metal={0.6} />
    <Plate lines={['UNIVERSAL 230 V']} size={[0.14, 0.04]} position={[0.15, 0, 0.225]} />
    <group name="pulley" position={[0, 0.8, -0.2]}><Cyl r={0.3} len={0.04} axis="z" color={COLORS.alu} metal={0.8} rough={0.3} /></group>
    <Tube points={[[-0.02, 0.06, -0.12], [-0.25, 0.8, -0.2], [0, 1.1, -0.2], [0.25, 0.8, -0.2], [0.02, 0.06, -0.12]]} r={0.012} color="#1b1d20" />
    <Grip name="grip-motor" at={[0.15, 0.1, 0.25]} />
  </group>
);

const Pump = () => (
  <group position={[0.5, FLOOR + 0.35, 0.4]}>
    <Cyl r={0.1} len={0.18} axis="x" color="#2b2f36" />
    <Cyl r={0.08} len={0.06} axis="z" position={[0.06, 0, 0.12]} color="#5b6670" />
    <Tube points={[[0, 0.05, 0], [-0.1, 0.5, -0.4], [-0.3, 1.1, -0.9]]} r={0.04} color="#3e4650" rough={0.8} />
  </group>
);

const Electrics = () => (
  <group>
    {/* Control board in its tray, top front */}
    <group position={[0.2, FLOOR + BODY_H - 0.35, BODY_D / 2 - 0.2]}>
      <Box size={[0.6, 0.04, 0.25]} color="#22262b" />
      <Box size={[0.5, 0.01, 0.2]} position={[0, 0.03, 0]} color="#1f6f43" />
      <Box size={[0.06, 0.04, 0.06]} position={[-0.15, 0.06, 0]} color="#1f3d7a" />
      <Box name="board-led" size={[0.03, 0.02, 0.03]} position={[0.18, 0.05, 0.05]} color="#103a12" emissive="#2fff80" glow={0} shadow={false} />
    </group>
    {/* Door lock on the front frame */}
    <Box size={[0.08, 0.1, 0.06]} position={[0.42, CY + 0.05, BODY_D / 2 - 0.08]} color="#f2f2f2" />
    {/* Heater element under the tub */}
    <Box size={[0.5, 0.05, 0.06]} position={[0, CY - 0.6, 0.45]} color="#c3cbd3" metal={0.7} />
    {/* Inlet valves at the back top */}
    {[-0.12, 0.12].map((x) => <Cyl key={x} r={0.04} len={0.1} axis="z" position={[0.5 + x, FLOOR + BODY_H - 0.12, -BODY_D / 2 + 0.05]} color={x < 0 ? '#2f6fd0' : '#c8312b'} />)}
    {/* Mains lead and plug */}
    <group name="plug-in">
      <Tube points={[[0.6, FLOOR + 0.5, -BODY_D / 2], [1.2, FLOOR + 0.2, -0.6], [1.9, FLOOR + 0.15, 0.1], [2.25, FLOOR + 0.55, 0.25]]} r={0.018} color="#e8e8e8" />
    </group>
    <Sticker kind="warning" pic="electric" size={0.1} position={[0.55, CY + 0.6, BODY_D / 2 + 0.02]} />
  </group>
);

/** Isolation transformer and appliance safety tester on a trolley. */
const TestTrolley = () => (
  <group position={[2.3, FLOOR, 0.2]}>
    <Box size={[0.8, 0.05, 0.6]} position={[0, 0.85, 0]} color="#5b6670" metal={0.5} />
    <Box size={[0.8, 0.05, 0.6]} position={[0, 0.2, 0]} color="#5b6670" metal={0.5} />
    {[[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.04, 0.85, 0.04]} position={[x!, 0.45, z!]} color="#3e4650" metal={0.6} />)}
    <Box size={[0.4, 0.3, 0.35]} position={[-0.15, 0.4, 0]} color="#5b6670" metal={0.5} />
    <Plate lines={['ISO 230/230 V 3 kVA']} size={[0.26, 0.05]} position={[-0.15, 0.45, 0.176]} />
    <group position={[0.05, 1.0, 0]}>
      <Box size={[0.5, 0.2, 0.35]} color="#f2c230" rough={0.6} />
      <Box name="pat-screen" size={[0.22, 0.08, 0.01]} position={[-0.06, 0.04, 0.176]} color="#0c2b3f" emissive="#2fbf6a" glow={0} shadow={false} />
      <Plate lines={['PAT · IEC 60335 / VDE 0701']} size={[0.3, 0.04]} position={[0, -0.06, 0.176]} />
    </group>
    <group name="pat-lead"><Tube points={[[0.2, 1.0, 0.15], [0.0, 0.8, 0.6], [-1.0, 1.4, 0.4], [-1.5, 1.7, 0.2]]} r={0.01} color="#22262b" /></group>
  </group>
);

export const washingMachine: ModelDef = {
  id: 'washing-machine',
  title: tx('Washing machine on the repair stand', 'غسالة على منصة الإصلاح'),
  assetTag: 'WM 8 kg · HAM-02',
  view: { camera: [2.0, 0.6, 4.0], target: [0.6, -0.9, 0] },
  params: { top: 0, plug: 1, water: 0, door: 0, pat: 0 },
  runParams: { water: 1 },
  env: {
    unitsPerM: 2.5, floorY: FLOOR, stand: 'floor', bay: 'ham',
    stations: [
      { id: 'front', label: tx('In front of the machine', 'أمام الغسالة'), pos: [0, 1.9], face: Math.PI, pose: 'inspect', reach: [0, -0.3, 0.9] },
      { id: 'inside', label: tx('Inside, from the top', 'من الأعلى إلى الداخل'), pos: [0.3, 1.4], face: Math.PI, pose: 'reach', reach: [0.2, 0.0, 0.3] },
      { id: 'back', label: tx('Plug and mains lead', 'القابس وسلك الكهرباء'), pos: [1.9, 1.2], face: Math.PI, pose: 'crouch', reach: [2.25, -1.6, 0.3] },
      { id: 'pump', label: tx('Drain pump', 'مضخة الصرف'), pos: [0.6, 1.5], face: Math.PI, pose: 'crouch', reach: [0.5, -1.7, 0.6] },
      { id: 'tester', label: tx('Safety tester', 'جهاز اختبار السلامة'), pos: [2.4, 1.7], face: Math.PI, pose: 'operate', reach: [2.35, -1.0, 0.4] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'top', name: tx('Top panel', 'اللوح العلوي'), explode: [0, 1.2, -0.4], stage: 0,
      animate: (g, s) => { const o = child(g, 'top'); if (o) { o.position.y = THREE.MathUtils.lerp(o.position.y, param(s, 'top') * 1.4, 0.1); o.visible = o.position.y < 1.3; } },
      render: () => <Top />,
      hotspot: { position: [0, FLOOR + BODY_H + 0.05, 0], title: tx('Top panel', 'اللوح العلوي'), specs: [[tx('Removal', 'الفك'), tx('Two rear screws, slide back', 'مسماران خلفيان، ثم اسحبه للخلف')]] },
    },
    {
      id: 'door', name: tx('Door and glass', 'الباب والزجاج'), explode: [0, 0, 1.0], stage: 0.05,
      animate: (g, s) => { const o = child(g, 'door'); if (o) o.rotation.y = THREE.MathUtils.lerp(o.rotation.y, -param(s, 'door') * 1.6, 0.12); },
      render: () => <Door />,
      hotspot: { position: [0, CY + 0.05, BODY_D / 2 + 0.1], title: tx('Porthole door', 'باب دائري'), specs: [[tx('Lock', 'القفل'), tx('Stays locked while water or spin', 'يبقى مقفلًا مع وجود ماء أو أثناء العصر')]] },
    },
    {
      id: 'drum', name: tx('Drum and tub', 'الحلة والحوض'), explode: [0, 0.3, 0.6], stage: 0.15,
      animate: (g, s) => {
        const d = child(g, 'drum'); if (d && s.running) d.rotation.z += s.dt * (param(s, 'water') > 0.5 ? 3 : 40);
        const w = child(g, 'water'); if (w) w.visible = param(s, 'water') > 0.5;
      },
      render: () => <Drum />,
      hotspot: {
        position: [0, CY + 0.6, 0.3], title: tx('Stainless drum in a plastic tub', 'حلة ستانلس داخل حوض بلاستيكي'), specs: [[tx('Load', 'الحمولة'), '8 kg'], [tx('Spin', 'العصر'), '1400 rpm']],
        safety: tx('Never reach into a drum that can turn. At 1400 rpm it breaks an arm; unplug and wait for it to stop.', 'لا تمد يدك أبدًا في حلة يمكن أن تدور. عند 1400 لفة/دقيقة تكسر الذراع؛ افصل القابس وانتظر توقفها.'),
      },
    },
    {
      id: 'motor', name: tx('Motor and belt', 'المحرك والسير'), explode: [0, -0.4, -1.0], stage: 0.25,
      animate: (g, s) => { const p = child(g, 'pulley'); if (p && s.running) p.rotation.z += s.dt * 6; },
      render: () => <MotorBelt />,
      hotspot: { position: [0.15, CY - 0.7, -0.4], title: tx('Universal motor with tacho', 'محرك عام مع مولد سرعة'), specs: [[tx('Brushes', 'الفرش'), tx('Carbon; check length', 'كربونية؛ افحص طولها')], [tx('Drive', 'الإدارة'), tx('Poly-V belt', 'سير متعدد المجاري')]] },
    },
    {
      id: 'pump', name: tx('Drain pump', 'مضخة الصرف'), explode: [0.6, -0.4, 0.6], stage: 0.3,
      render: () => <Pump />,
      hotspot: { position: [0.5, FLOOR + 0.45, 0.45], title: tx('Drain pump and filter', 'مضخة الصرف والمرشح'), specs: [[tx('Fault', 'العطل الشائع'), tx('Coins and lint in the filter', 'عملات ووبر في المرشح')]] },
    },
    {
      id: 'electrics', name: tx('Board, lock, heater and valves', 'اللوحة والقفل والسخان والصمامات'), explode: [0.6, 0.6, 0.4], stage: 0.4,
      animate: (g, s) => {
        const on = param(s, 'plug', 1);
        glowOf(g, 'board-led', on * 1.2);
        const pl = child(g, 'plug-in'); if (pl) pl.visible = on > 0.5;
      },
      render: () => <Electrics />,
      hotspot: {
        position: [0.2, FLOOR + BODY_H - 0.3, BODY_D / 2 - 0.1], title: tx('Main control board', 'لوحة التحكم الرئيسية'), specs: [[tx('Heater', 'السخان'), '2000 W · 26 Ω'], [tx('Error codes', 'أكواد الأعطال'), tx('Read in service mode', 'تُقرأ في وضع الصيانة')]],
        safety: tx('Unplug before you open, not just switch off: the board, heater and pump are live at 230 V near water.', 'افصل القابس قبل الفتح، لا تكتفِ بالإطفاء: اللوحة والسخان والمضخة مكهربة بجهد 230 فولت بجوار الماء.'),
      },
    },
    {
      id: 'tester', name: tx('Isolation transformer and PAT tester', 'محول العزل وجهاز اختبار السلامة'), explode: [0.8, 0.3, 0.3], stage: 0.5,
      animate: (g, s) => { glowOf(g, 'pat-screen', param(s, 'pat') * 0.9); const l = child(g, 'pat-lead'); if (l) l.visible = param(s, 'pat') > 0.5; },
      render: () => <TestTrolley />,
      hotspot: { position: [2.35, FLOOR + 1.15, 0.3], title: tx('Appliance safety tester', 'جهاز اختبار سلامة الأجهزة'), specs: [[tx('Earth bond', 'استمرارية الأرضي'), '≤ 0.3 Ω'], [tx('Insulation', 'العزل'), '≥ 1 MΩ at 500 V'], [tx('Leakage', 'التسرب'), '≤ 3.5 mA']] },
    },
    { id: 'cabinet', name: tx('Cabinet and stand', 'الهيكل والمنصة'), explode: [0, -0.6, -0.8], stage: 0.7, render: () => <Cabinet />,
      animate: (g, s) => glowOf(g, 'wm-display', param(s, 'plug', 1) * 0.8) },
  ],
};
