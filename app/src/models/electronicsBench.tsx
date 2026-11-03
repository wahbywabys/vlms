/**
 * Industrial electronics bench (IEL): the ETF / IEL workstation from the
 * manual's training requirements. A 2-channel oscilloscope, a function
 * generator, a 0–30 V DC supply, an LCR meter, a temperature-controlled
 * soldering station, an isolation transformer, an ESD mat and wrist strap,
 * and a power-electronics board under test (bridge rectifier, smoothing
 * capacitor bank, MOSFET stage on a heatsink). Stands on a bench (top at y = 0).
 * Lesson params:
 *   power   0..1  bench power on (supply, scope trace, board LEDs)
 *   iron    0..1  soldering iron hot (tip glows)
 *   cap     0..1  capacitor bank charged (red LED lit: still dangerous)
 *   iso     0..1  board fed through the isolation transformer
 *   strap   0..1  ESD wrist strap plugged into the mat
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Sticker, Tube, child, param, tx, type ModelDef } from './kit';

const CASE = '#e9ecef';
const DARK = '#2b2f36';
const PCB = '#1f6f43';

/** A small rectangular screen that glows when the bench is on. */
const Screen = ({ name, size, position, color = '#0c2b3f' }: { name: string; size: [number, number]; position: [number, number, number]; color?: string }) => (
  <Box name={name} size={[size[0], size[1], 0.01]} position={position} color={color} emissive="#2fbf6a" glow={0} shadow={false} />
);

const Scope = () => (
  <group position={[-1.2, 0, -0.55]}>
    <Box size={[1.0, 0.55, 0.42]} position={[0, 0.3, 0]} color={CASE} metal={0.2} rough={0.4} />
    <Box size={[0.62, 0.4, 0.01]} position={[-0.14, 0.32, 0.215]} color="#0b1a24" shadow={false} />
    {/* Two traces: a sine (CH1) and a rectified ripple (CH2); hidden when off */}
    <group name="trace" position={[-0.14, 0.32, 0.222]}>
      <Tube points={Array.from({ length: 24 }, (_, i) => [-0.29 + i * 0.025, Math.sin(i * 0.55) * 0.08 + 0.06, 0] as [number, number, number])} r={0.004} color="#f2c230" emissive="#f2c230" glow={1} />
      <Tube points={Array.from({ length: 24 }, (_, i) => [-0.29 + i * 0.025, Math.abs(Math.sin(i * 0.55)) * 0.06 - 0.1, 0] as [number, number, number])} r={0.004} color="#3ad1ff" emissive="#3ad1ff" glow={1} />
    </group>
    {[0, 1, 2, 3].map((i) => <Cyl key={i} r={0.03} len={0.03} axis="z" position={[0.3, 0.42 - i * 0.09, 0.22]} color={DARK} />)}
    {[0, 1].map((i) => <Cyl key={i} r={0.022} len={0.03} axis="z" position={[0.22 + i * 0.14, 0.08, 0.22]} color={i ? '#3ad1ff' : '#f2c230'} />)}
    <Plate lines={['WABYS DSO 2102', '100 MHz · 1 GS/s']} size={[0.3, 0.06]} position={[-0.14, 0.08, 0.212]} />
    {/* Probe lead to the board */}
    <Tube points={[[0.22, 0.08, 0.24], [0.4, 0.0, 0.6], [1.0, 0.02, 0.85], [1.25, 0.1, 0.75]]} r={0.012} color="#22262b" rough={0.8} />
  </group>
);

const Generator = () => (
  <group position={[-0.05, 0, -0.6]}>
    <Box size={[0.75, 0.3, 0.38]} position={[0, 0.16, 0]} color={CASE} metal={0.2} rough={0.4} />
    <Screen name="gen-screen" size={[0.32, 0.13]} position={[-0.12, 0.2, 0.195]} />
    <Cyl r={0.05} len={0.04} axis="z" position={[0.22, 0.17, 0.2]} color={DARK} />
    <Plate lines={['FG 20 MHz', '1.000 kHz · 5 Vpp']} size={[0.28, 0.06]} position={[-0.12, 0.07, 0.192]} />
  </group>
);

const Supply = () => (
  <group position={[0.9, 0, -0.6]}>
    <Box size={[0.7, 0.36, 0.4]} position={[0, 0.19, 0]} color={CASE} metal={0.2} rough={0.4} />
    <Screen name="psu-screen" size={[0.22, 0.09]} position={[-0.15, 0.27, 0.205]} color="#2a0b0b" />
    <Screen name="psu-screen2" size={[0.22, 0.09]} position={[-0.15, 0.15, 0.205]} color="#2a0b0b" />
    {[0.16, 0.27].map((x) => <Cyl key={x} r={0.04} len={0.04} axis="z" position={[x, 0.24, 0.21]} color={DARK} />)}
    {[[0.12, COLORS.red], [0.22, COLORS.black], [0.32, COLORS.green]].map(([x, c]) => <Cyl key={x as number} r={0.018} len={0.04} axis="z" position={[x as number, 0.08, 0.21]} color={c as string} />)}
    <Plate lines={['DC 0–30 V · 0–5 A']} size={[0.24, 0.04]} position={[-0.15, 0.06, 0.202]} />
  </group>
);

const IsoTransformer = () => (
  <group position={[1.75, 0, -0.45]}>
    <Box size={[0.42, 0.34, 0.36]} position={[0, 0.17, 0]} color="#5b6670" metal={0.5} rough={0.4} />
    <Box size={[0.3, 0.06, 0.24]} position={[0, 0.37, 0]} color="#3e4650" metal={0.5} rough={0.4} />
    <Box name="iso-lamp" size={[0.05, 0.05, 0.02]} position={[-0.12, 0.25, 0.19]} color="#2a3a12" emissive="#9cff3a" glow={0} shadow={false} />
    <Box size={[0.1, 0.12, 0.02]} position={[0.08, 0.18, 0.185]} color="#f2f2f2" />
    <Plate lines={['ISOLATION 230/230 V', '500 VA · IEC 61558']} size={[0.32, 0.06]} position={[0, 0.06, 0.182]} />
    <Sticker kind="warning" pic="electric" size={0.08} position={[0.14, 0.27, 0.181]} />
  </group>
);

/** The power board under test: mains input, bridge, capacitor bank, MOSFET on a heatsink, output LEDs. */
const Board = () => (
  <group position={[1.15, 0.03, 0.55]}>
    <Box size={[0.9, 0.025, 0.6]} color={PCB} metal={0.1} rough={0.5} />
    {/* Mains terminal block */}
    <Box size={[0.14, 0.08, 0.1]} position={[-0.36, 0.05, -0.2]} color="#2f6fd0" />
    {/* Bridge rectifier */}
    <Box size={[0.1, 0.06, 0.1]} position={[-0.2, 0.04, -0.2]} color={DARK} />
    {/* Capacitor bank: three electrolytics */}
    <group name="caps">
      {[-0.05, 0.08, 0.21].map((x) => (
        <group key={x} position={[x, 0, -0.18]}>
          <Cyl r={0.05} len={0.2} position={[0, 0.11, 0]} color="#1f3d7a" metal={0.3} rough={0.4} />
          <Cyl r={0.05} len={0.005} position={[0, 0.215, 0]} color={COLORS.alu} metal={0.8} rough={0.3} />
        </group>
      ))}
    </group>
    <Box name="cap-led" size={[0.03, 0.02, 0.03]} position={[0.32, 0.025, -0.22]} color="#3a0b0b" emissive="#ff2a20" glow={0} shadow={false} />
    {/* MOSFET on a finned heatsink */}
    <group position={[0.2, 0, 0.12]}>
      <Box size={[0.24, 0.14, 0.08]} position={[0, 0.08, 0]} color={COLORS.alu} metal={0.7} rough={0.35} />
      {[-0.09, -0.03, 0.03, 0.09].map((x) => <Box key={x} size={[0.015, 0.14, 0.16]} position={[x, 0.08, 0]} color={COLORS.alu} metal={0.7} rough={0.35} />)}
      <Box size={[0.06, 0.08, 0.02]} position={[0, 0.06, 0.05]} color={DARK} />
    </group>
    {/* Driver IC and output LEDs */}
    <Box size={[0.1, 0.02, 0.05]} position={[-0.15, 0.02, 0.1]} color={DARK} />
    <group name="out-leds">{[-0.3, -0.24, -0.18].map((x, i) => <Box key={x} size={[0.025, 0.025, 0.025]} position={[x, 0.025, 0.22]} color="#103a12" emissive={['#9cff3a', '#ffd23a', '#3ad1ff'][i]} glow={0} shadow={false} />)}</group>
    <Sticker kind="warning" pic="electric" size={0.07} position={[-0.36, 0.02, 0.15]} rotation={[-Math.PI / 2, 0, 0]} />
    <Tube points={[[-0.45, 0.03, -0.2], [-0.6, 0.05, -0.55], [0.4, 0.05, -0.95], [0.6, 0.2, -1.0]]} r={0.012} color="#22262b" rough={0.8} />
  </group>
);

const Soldering = () => (
  <group position={[-0.7, 0, 0.45]}>
    <Box size={[0.36, 0.16, 0.3]} position={[0, 0.08, 0]} color="#2f5f93" metal={0.2} rough={0.5} />
    <Screen name="iron-screen" size={[0.14, 0.06]} position={[0, 0.11, 0.152]} color="#2a0b0b" />
    {/* Holder spring with the iron in it, and the tip */}
    <group position={[0.35, 0.06, 0.05]} rotation={[0, 0, 0.6]}>
      <Cyl r={0.04} len={0.22} axis="x" position={[0, 0, 0]} color={COLORS.steel} metal={0.8} rough={0.3} open />
      <Cyl r={0.022} len={0.22} axis="x" position={[0.06, 0, 0]} color="#22262b" rough={0.8} />
      <Cyl r={0.008} r2={0.002} len={0.08} axis="x" position={[0.21, 0, 0]} name="tip" color="#6b6f75" metal={0.8} rough={0.3} emissive="#ff6a1a" glow={0} />
    </group>
    <Box size={[0.12, 0.03, 0.12]} position={[0.32, 0.015, -0.12]} color="#c9a54a" rough={0.9} />
    <Tube points={[[0.17, 0.06, 0.0], [0.3, 0.04, 0.05], [0.42, 0.08, 0.12]]} r={0.01} color="#22262b" />
    <Grip name="grip-iron" at={[0.42, 0.12, 0.08]} />
  </group>
);

const Esd = () => (
  <group position={[-1.6, 0.0, 0.6]}>
    <Box size={[0.1, 0.04, 0.06]} position={[0, 0.02, 0]} color="#2b2f36" />
    <group name="strap">
      <Tube points={[[0, 0.03, 0.03], [0.12, 0.06, 0.2], [0.3, 0.12, 0.4], [0.45, 0.25, 0.75]]} r={0.008} color="#f2c230" />
    </group>
    <Plate lines={['ESD ⏚ 1 MΩ']} size={[0.12, 0.03]} position={[0, 0.045, 0.031]} />
  </group>
);

const Meters = () => (
  <group position={[0.1, 0, 0.55]}>
    {/* Digital multimeter lying on the mat */}
    <group rotation={[-Math.PI / 2 + 0.25, 0, 0.2]} position={[0, 0.06, 0]}>
      <Box size={[0.2, 0.36, 0.06]} color={COLORS.yellow} rough={0.7} />
      <Box size={[0.15, 0.08, 0.01]} position={[0, 0.1, 0.031]} color="#9fb39a" shadow={false} />
      <Cyl r={0.05} len={0.02} axis="z" position={[0, -0.04, 0.035]} color={DARK} />
    </group>
    {/* LCR meter */}
    <group position={[-0.4, 0, -0.1]}>
      <Box size={[0.22, 0.08, 0.3]} position={[0, 0.04, 0]} color="#3e4650" />
      <Box size={[0.14, 0.01, 0.08]} position={[0, 0.085, -0.05]} color="#9fb39a" shadow={false} />
    </group>
  </group>
);

export const electronicsBench: ModelDef = {
  id: 'electronics-bench',
  title: tx('Industrial electronics bench', 'طاولة الإلكترونيات الصناعية'),
  assetTag: 'ETF/IEL bench · B-07',
  view: { camera: [1.2, 1.9, 3.3], target: [0.2, 0.25, 0] },
  params: { power: 0, iron: 0, cap: 0, iso: 1, strap: 1 },
  runParams: { power: 1, iron: 1, cap: 1 },
  env: {
    unitsPerM: 2.5, floorY: -2.25, stand: 'bench', bay: 'iel',
    stations: [
      { id: 'front', label: tx('At the bench', 'أمام الطاولة'), pos: [0.2, 1.9], face: Math.PI, pose: 'operate', reach: [0.2, 0.15, 0.6] },
      { id: 'board', label: tx('Board under test', 'اللوحة تحت الاختبار'), pos: [1.1, 1.8], face: Math.PI, pose: 'reach', reach: [1.15, 0.1, 0.55] },
      { id: 'iron', label: tx('Soldering station', 'محطة اللحام'), pos: [-0.6, 1.8], face: Math.PI, pose: 'reach', reach: [-0.3, 0.12, 0.55] },
      { id: 'scope', label: tx('Oscilloscope', 'راسم الموجات'), pos: [-1.1, 1.9], face: Math.PI, pose: 'operate', reach: [-1.0, 0.3, -0.3] },
      { id: 'iso', label: tx('Isolation transformer', 'محول العزل'), pos: [1.8, 1.8], face: Math.PI, pose: 'reach', reach: [1.75, 0.3, -0.25] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'scope', name: tx('Oscilloscope', 'راسم الموجات'), explode: [-0.6, 0.6, -0.4], stage: 0,
      animate: (g, s) => {
        const t = child(g, 'trace');
        if (t) { t.visible = param(s, 'power') > 0.5; t.position.x = -0.14 + (s.running ? Math.sin(s.t * 3) * 0.004 : 0); }
      },
      render: () => <Scope />,
      hotspot: {
        position: [-1.2, 0.62, -0.4], title: tx('2-channel digital oscilloscope', 'راسم موجات رقمي بقناتين'),
        specs: [[tx('Bandwidth', 'عرض النطاق'), '100 MHz'], [tx('CH1 / CH2', 'القناة 1 / 2'), tx('Input sine / rectified ripple', 'الجيب الداخل / تموج التوحيد')], [tx('Category', 'الفئة'), 'CAT II 300 V']],
        safety: tx('The probe earth clip is connected to mains earth. Clip it onto a mains-fed board without an isolation transformer and you short the supply.', 'مشبك أرضي المجس متصل بأرضي الشبكة. إذا وصلته بلوحة تتغذى من الشبكة بدون محول عزل تحدث قصرًا في التغذية.'),
      },
    },
    {
      id: 'generator', name: tx('Function generator', 'مولد الموجات'), explode: [0, 0.7, -0.5], stage: 0.05,
      animate: (g, s) => { const o = child(g, 'gen-screen') as THREE.Mesh | undefined; if (o) (o.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'power') * 0.8; },
      render: () => <Generator />,
      hotspot: { position: [-0.05, 0.35, -0.4], title: tx('Function generator', 'مولد الموجات'), specs: [[tx('Waveforms', 'الأشكال'), tx('Sine, square, triangle, pulse', 'جيبية ومربعة ومثلثة ونبضية')], [tx('Range', 'المدى'), '1 µHz – 20 MHz']] },
    },
    {
      id: 'supply', name: tx('DC power supply', 'مصدر جهد مستمر'), explode: [0.5, 0.7, -0.5], stage: 0.1,
      animate: (g, s) => {
        for (const n of ['psu-screen', 'psu-screen2']) { const o = child(g, n) as THREE.Mesh | undefined; if (o) (o.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'power') * 0.9; }
      },
      render: () => <Supply />,
      hotspot: { position: [0.9, 0.42, -0.4], title: tx('Bench supply 0–30 V', 'مصدر طاولة 0–30 فولت'), specs: [[tx('Output', 'الخرج'), '0–30 V · 0–5 A'], [tx('Limit', 'الحد'), tx('Set the current limit before you connect', 'اضبط حد التيار قبل التوصيل')]] },
    },
    {
      id: 'iso', name: tx('Isolation transformer', 'محول العزل'), explode: [0.6, 0.5, -0.2], stage: 0.15,
      animate: (g, s) => { const o = child(g, 'iso-lamp') as THREE.Mesh | undefined; if (o) (o.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'iso', 1) * param(s, 'power') * 1.2; },
      render: () => <IsoTransformer />,
      hotspot: {
        position: [1.75, 0.42, -0.3], title: tx('1:1 isolation transformer', 'محول عزل 1:1'), specs: [[tx('Rating', 'القدرة'), '500 VA'], [tx('Standard', 'المعيار'), 'IEC 61558-2-4']],
        safety: tx('Feed every mains-powered board through it. It removes the path to earth through your body, but not the voltage across the board.', 'غذِّ كل لوحة تعمل بالشبكة من خلاله. فهو يقطع مسار التيار إلى الأرض عبر جسمك، لكنه لا يزيل الجهد على اللوحة نفسها.'),
      },
    },
    {
      id: 'board', name: tx('Power board under test', 'لوحة القدرة تحت الاختبار'), explode: [0.4, 0.5, 0.6], stage: 0.25,
      animate: (g, s) => {
        const on = param(s, 'power');
        const led = child(g, 'cap-led') as THREE.Mesh | undefined;
        if (led) (led.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(param(s, 'cap'), on) * 1.4;
        const outs = child(g, 'out-leds');
        outs?.children.forEach((m, i) => { const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial; mm.emissiveIntensity = on * (s.running ? 0.6 + 0.6 * Math.sin(s.t * 4 + i) : 1); });
      },
      render: () => <Board />,
      hotspot: {
        position: [1.2, 0.3, 0.4], title: tx('Rectifier, capacitor bank and MOSFET stage', 'موحد وبنك مكثفات ومرحلة MOSFET'),
        specs: [[tx('DC bus', 'جهد الخط المستمر'), '325 V'], [tx('Capacitors', 'المكثفات'), '3 × 470 µF 400 V'], [tx('Switch', 'المفتاح'), 'MOSFET 600 V 20 A']],
        safety: tx('The capacitors stay charged at 325 V after the plug is pulled. Discharge them through a resistor and measure 0 V before you touch.', 'تبقى المكثفات مشحونة بجهد 325 فولت بعد نزع القابس. فرّغها عبر مقاومة وقِس 0 فولت قبل اللمس.'),
      },
    },
    {
      id: 'soldering', name: tx('Soldering station', 'محطة اللحام'), explode: [-0.5, 0.5, 0.6], stage: 0.3,
      animate: (g, s) => {
        const tip = child(g, 'tip') as THREE.Mesh | undefined;
        if (tip) (tip.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'iron') * 1.2;
        const scr = child(g, 'iron-screen') as THREE.Mesh | undefined;
        if (scr) (scr.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'iron') * 0.9;
      },
      render: () => <Soldering />,
      hotspot: {
        position: [-0.4, 0.25, 0.5], title: tx('Temperature-controlled soldering station', 'محطة لحام بتحكم في الحرارة'), specs: [[tx('Tip', 'الطرف'), '350 °C'], [tx('Solder', 'القصدير'), 'Sn99.3Cu0.7']],
        safety: tx('Always return the iron to its holder. A 350 °C tip burns skin and cable insulation in a second; use the fume extractor.', 'أعد الكاوية دائمًا إلى حاملها. طرف بحرارة 350 °م يحرق الجلد وعزل الكابلات في ثانية؛ واستخدم شفاط الأبخرة.'),
      },
    },
    {
      id: 'esd', name: tx('ESD mat and wrist strap', 'سطح وسوار التفريغ الكهروستاتيكي'), explode: [-0.6, 0.4, 0.8], stage: 0.4,
      animate: (g, s) => { const o = child(g, 'strap'); if (o) o.visible = param(s, 'strap', 1) > 0.5; },
      render: () => <Esd />,
      hotspot: { position: [-1.6, 0.1, 0.6], title: tx('ESD protection', 'الحماية من الكهرباء الساكنة'), specs: [[tx('Strap resistor', 'مقاومة السوار'), '1 MΩ'], [tx('Standard', 'المعيار'), 'IEC 61340-5-1']] },
    },
    {
      id: 'meters', name: tx('Multimeter and LCR meter', 'جهاز الآفو وجهاز LCR'), explode: [0, 0.6, 0.9], stage: 0.5,
      render: () => <Meters />,
      hotspot: { position: [0.1, 0.15, 0.55], title: tx('Digital multimeter', 'جهاز قياس رقمي متعدد'), specs: [[tx('Category', 'الفئة'), 'CAT III 600 V'], [tx('Use', 'الاستخدام'), tx('Prove it on a known source before and after', 'اختبره على مصدر معروف قبل القياس وبعده')]] },
    },
  ],
};
