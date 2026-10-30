/**
 * Procedural single-colour sheetfed offset press (B3 format) for the printing
 * programme (PRT): feeder pile and suction head, feed board, one printing unit
 * (plate, blanket and impression cylinders, inking and dampening rollers),
 * the delivery with its chain grippers, the nip guards and the control desk.
 * Sheets travel along +x (feeder at −x, delivery at +x); cylinder axes run
 * along z. Lesson params:
 *   guard  0..1  printing-unit guard closed (interlocked)
 *   inch   0..1  the press is in inch (jog) mode
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Sticker, child, param, tx, type ModelDef } from './kit';

const FRAME = '#d5d8d6';
const DARK = '#2b2f36';
const ACC = '#7a4fd1';
const W = 0.9;            // cylinder length along z
const PLATE: [number, number] = [-0.05, 0.62];
const BLANKET: [number, number] = [0.33, 0.34];
const IMPRESSION: [number, number] = [0.33, -0.12];
const R = 0.2;

const Frames = () => (
  <group>
    {[-1, 1].map((s) => (
      <group key={s}>
        <Box size={[1.6, 1.9, 0.08]} position={[0.2, 0.15, s * (W / 2 + 0.08)]} color={FRAME} metal={0.3} rough={0.45} />
        <Box size={[1.6, 0.06, 0.1]} position={[0.2, 1.12, s * (W / 2 + 0.08)]} color={ACC} metal={0.2} rough={0.5} />
      </group>
    ))}
    <Box size={[1.6, 0.5, W + 0.24]} position={[0.2, -0.95, 0]} color={DARK} metal={0.3} rough={0.5} />
    <Plate lines={['WABYS 52-1', '13 000 sheets/h']} size={[0.34, 0.1]} position={[0.2, 0.95, W / 2 + 0.125]} bg="#14234c" fg="#ffffff" />
  </group>
);

const Cylinders = () => (
  <group>
    {[[PLATE, '#b9c2cb', 'plateCyl'], [BLANKET, '#2a3a4c', 'blanketCyl'], [IMPRESSION, '#9aa5b0', 'impCyl']].map(([p, c, n]) => {
      const [x, y] = p as [number, number];
      return (
        <group key={n as string} name={n as string} position={[x, y, 0]}>
          <Cyl r={R} len={W} axis="z" color={c as string} metal={n === 'blanketCyl' ? 0.05 : 0.85} rough={n === 'blanketCyl' ? 0.8 : 0.25} seg={48} />
          <Box size={[0.03, 0.03, W + 0.01]} position={[0, R - 0.012, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
          <Cyl r={0.04} len={W + 0.3} axis="z" color={COLORS.steel} metal={0.9} rough={0.2} />
        </group>
      );
    })}
    {/* Bearers and gears outside the frame */}
    {[PLATE, BLANKET, IMPRESSION].map(([x, y]) => <Cyl key={`${x}${y}`} r={R + 0.03} len={0.04} axis="z" position={[x, y, -W / 2 - 0.15]} color={COLORS.brass} metal={0.8} rough={0.35} />)}
  </group>
);

/** Ink fountain, ductor and the roller train down to the plate; dampening rollers at the back. */
const Inking = () => (
  <group>
    <Box size={[0.3, 0.16, W]} position={[-0.25, 1.32, 0]} color={DARK} metal={0.3} rough={0.5} />
    <Box size={[0.26, 0.04, W - 0.04]} position={[-0.25, 1.4, 0]} color="#1c3fa8" metal={0} rough={0.3} />
    {[[-0.05, 1.18, 0.07], [0.12, 1.08, 0.08], [-0.2, 1.02, 0.07], [0.0, 0.94, 0.09], [0.18, 0.86, 0.06], [-0.22, 0.84, 0.06]].map(([x, y, r], i) => (
      <group key={i} name={`ink${i}`} position={[x!, y!, 0]}>
        <Cyl r={r!} len={W - 0.02} axis="z" color={i % 2 ? '#1c3fa8' : '#3e4a5c'} metal={i % 2 ? 0.05 : 0.6} rough={i % 2 ? 0.5 : 0.3} />
      </group>
    ))}
    <group position={[-0.3, 0.5, 0]}>
      <Cyl r={0.06} len={W - 0.02} axis="z" color="#7a8b99" metal={0.4} rough={0.5} />
      <Box size={[0.18, 0.14, W]} position={[-0.14, -0.04, 0]} color="#5e8fb8" metal={0.1} rough={0.3} opacity={0.6} />
    </group>
  </group>
);

const Feeder = () => (
  <group>
    <Box size={[0.9, 1.2, W + 0.3]} position={[-1.15, -0.55, 0]} color={FRAME} metal={0.3} rough={0.45} />
    <group name="pile">
      <Box size={[0.62, 0.36, W - 0.1]} position={[-1.15, 0.24, 0]} color="#f7f5ef" metal={0} rough={0.9} finish="matte" />
    </group>
    <Box size={[0.7, 0.05, W]} position={[-1.15, 0.04, 0]} color={DARK} metal={0.4} rough={0.4} />
    {/* Suction head */}
    <Box size={[0.2, 0.14, W - 0.2]} position={[-0.88, 0.56, 0]} color={DARK} metal={0.3} rough={0.5} />
    {/* Feed board towards the unit */}
    <Box size={[0.75, 0.02, W - 0.06]} position={[-0.42, 0.18, 0]} rotation={[0, 0, -0.18]} color={COLORS.alu} metal={0.8} rough={0.3} />
    <group name="sheet"><Box size={[0.36, 0.004, W - 0.16]} position={[-0.5, 0.21, 0]} rotation={[0, 0, -0.18]} color="#ffffff" metal={0} rough={0.9} finish="matte" shadow={false} /></group>
  </group>
);

const Delivery = () => (
  <group>
    <Box size={[1.1, 1.05, W + 0.3]} position={[1.55, -0.65, 0]} color={FRAME} metal={0.3} rough={0.45} />
    <Box size={[1.2, 0.05, W + 0.3]} position={[1.4, 0.62, 0]} color={DARK} metal={0.3} rough={0.5} />
    {[-1, 1].map((s) => <Box key={s} size={[1.2, 0.04, 0.03]} position={[1.4, 0.58, s * (W / 2)]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />)}
    <Box size={[0.62, 0.22, W - 0.1]} position={[1.75, 0.0, 0]} color="#f7f5ef" metal={0} rough={0.9} finish="matte" />
    <Box size={[0.6, 0.004, W - 0.12]} position={[1.75, 0.112, 0]} color="#7a4fd1" metal={0} rough={0.9} finish="matte" shadow={false} />
    {/* Powder sprayer */}
    <Box size={[0.08, 0.08, W]} position={[1.0, 0.5, 0]} color={DARK} metal={0.3} rough={0.5} />
  </group>
);

/** Printing-unit guard: a hinged clear cover over the in-running nips, interlocked. */
const Guard = () => (
  <group name="guard" position={[0.65, 0.95, 0]}>
    <Box size={[0.04, 1.0, W + 0.1]} position={[0, -0.5, 0]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.35} shadow={false} />
    <Box size={[0.06, 0.06, W + 0.14]} color={COLORS.yellow} metal={0.3} rough={0.5} />
    <Box size={[0.06, 0.04, 0.2]} position={[0.03, -0.9, 0]} color={COLORS.yellow} metal={0.3} rough={0.5} />
    <Grip name="grip-guard" at={[0.06, -0.9, 0]} />
    <Sticker kind="warning" pic="rotating" size={0.12} position={[0.025, -0.3, 0.3]} rotation={[0, Math.PI / 2, 0]} />
  </group>
);

const Console = () => (
  <group position={[0.3, 0.1, W / 2 + 0.6]}>
    <Box size={[0.5, 0.06, 0.28]} position={[0, 0.0, 0]} rotation={[-0.4, 0, 0]} color={DARK} metal={0.3} rough={0.5} />
    <Box size={[0.08, 1.15, 0.08]} position={[0, -0.6, 0.05]} color={DARK} metal={0.4} rough={0.4} />
    <Box size={[0.28, 0.14, 0.002]} position={[-0.06, 0.04, 0.0]} rotation={[-0.4, 0, 0]} color="#0c2b3f" emissive="#2c6fb8" glow={0.8} shadow={false} />
    <Cyl r={0.05} len={0.05} position={[0.17, 0.04, 0.0]} color={COLORS.red} emissive="#4a0806" glow={0.3} />
    <Cyl r={0.03} len={0.03} position={[0.17, 0.02, 0.09]} color={COLORS.green} />
    <Cyl r={0.03} len={0.03} position={[0.08, 0.02, 0.09]} color={COLORS.yellow} />
    <Grip name="grip-estop" at={[0.17, 0.08, 0.0]} />
    <Grip name="grip-inch" at={[0.08, 0.05, 0.09]} />
  </group>
);

const CYL_NAMES = ['plateCyl', 'blanketCyl', 'impCyl'];

export const offsetPress: ModelDef = {
  id: 'offset-press',
  title: tx('Sheetfed offset press · 1 colour', 'ماكينة طباعة أوفست بالأفرخ · لون واحد'),
  assetTag: 'WB 52-1 · PRT-01',
  view: { camera: [1.2, 1.4, 3.3], target: [0.2, 0.2, 0] },
  params: { guard: 1, inch: 0 },
  env: {
    unitsPerM: 1.6, floorY: -1.2, stand: 'floor', bay: 'prt',
    stations: [
      { id: 'console', label: tx('Control desk', 'مكتب التحكم'), pos: [0.3, 1.6], face: Math.PI, pose: 'operate', reach: [0.17, 0.12, W / 2 + 0.6] },
      { id: 'unit', label: tx('Printing unit', 'وحدة الطباعة'), pos: [1.1, 0.0], face: -Math.PI / 2, pose: 'reach', reach: [0.6, 0.4, 0] },
      { id: 'ink', label: tx('Ink fountain', 'حوض الحبر'), pos: [-0.3, 1.2], face: Math.PI, pose: 'reach', reach: [-0.25, 1.42, 0.3] },
      { id: 'feeder', label: tx('Feeder', 'وحدة التغذية'), pos: [-1.2, 1.3], face: Math.PI, pose: 'inspect', reach: [-1.15, 0.4, 0.4] },
      { id: 'delivery', label: tx('Delivery', 'وحدة الاستلام'), pos: [1.8, 1.3], face: Math.PI, pose: 'inspect', reach: [1.75, 0.15, 0.4] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.0, 2.6], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'guard', name: tx('Nip guard (interlocked)', 'واقي نقطة الالتقاء (بقفل بيني)'), explode: [0.8, 0.3, 0], stage: 0,
      animate: (g, s) => { const o = child(g, 'guard'); if (o) o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, (1 - param(s, 'guard', 1)) * 1.2, 0.12); },
      render: () => <Guard />,
      hotspot: {
        position: [0.67, 0.4, 0.3], title: tx('Interlocked unit guard', 'واقي الوحدة بقفل بيني'), specs: [[tx('Open', 'عند الفتح'), tx('Press stops; inch only, at crawl speed', 'تتوقف الماكينة؛ تحريك متقطع فقط بسرعة بطيئة')]],
        safety: tx('In-running nips between cylinders pull a hand in faster than you can react. Never reach in while the press turns.', 'نقاط الالتقاء بين الأسطوانات تسحب اليد أسرع من رد فعلك. لا تمد يدك أبدًا والماكينة تدور.'),
      },
    },
    {
      id: 'cylinders', name: tx('Plate, blanket & impression cylinders', 'أسطوانات اللوح والبطانية والطبع'), explode: [0, 0, 1.2], stage: 0.2,
      animate: (g, s) => {
        if (!s.running) return;
        const k = param(s, 'inch') > 0.5 ? 0.6 : 5;
        CYL_NAMES.forEach((n, i) => { const o = child(g, n); if (o) o.rotation.z += s.dt * k * (i === 1 ? 1 : -1); });
      },
      render: () => <Cylinders />,
      hotspot: {
        position: [0.33, 0.34, 0.47], title: tx('Three-cylinder unit', 'وحدة ثلاثية الأسطوانات'),
        specs: [[tx('Plate', 'اللوح'), tx('Image in ink on aluminium', 'الصورة بالحبر على الألومنيوم')], [tx('Blanket', 'البطانية'), tx('Rubber offsets the image', 'المطاط ينقل الصورة')], [tx('Impression', 'الطبع'), tx('Presses the sheet on the blanket', 'يضغط الفرخ على البطانية')]],
      },
    },
    {
      id: 'inking', name: tx('Inking & dampening rollers', 'أسطوانات الحبر والترطيب'), explode: [-0.4, 0.9, 0], stage: 0.3,
      animate: (g, s) => {
        if (!s.running) return;
        for (let i = 0; i < 6; i++) { const o = child(g, `ink${i}`); if (o) o.rotation.z += s.dt * 6 * (i % 2 ? 1 : -1); }
      },
      render: () => <Inking />,
      hotspot: {
        position: [-0.25, 1.42, 0.3], title: tx('Ink fountain & roller train', 'حوض الحبر ومجموعة الأسطوانات'), specs: [[tx('Ink keys', 'مفاتيح الحبر'), '16'], [tx('Damping', 'الترطيب'), tx('Alcohol-free fount, pH 4.8–5.3', 'محلول ترطيب بلا كحول، pH من 4.8 إلى 5.3')]],
        safety: tx('Blanket and roller washes are solvents: nitrile gloves, glasses, good ventilation, and used rags in the closed metal bin.', 'منظفات البطانية والأسطوانات مذيبات: قفازات نيتريل ونظارة وتهوية جيدة، والخرق المستعملة في الصندوق المعدني المغلق.'),
      },
    },
    {
      id: 'feeder', name: tx('Feeder & feed board', 'وحدة التغذية ولوح التغذية'), explode: [-0.9, 0, 0], stage: 0.45,
      animate: (g, s) => { const o = child(g, 'sheet'); if (o) o.position.x = s.running ? ((s.t * 1.2) % 0.6) : 0; },
      render: () => <Feeder />,
      hotspot: { position: [-1.15, 0.45, 0.4], title: tx('Pile feeder', 'مغذي الرصة'), specs: [[tx('Sheet', 'الفرخ'), '370 × 520 mm'], [tx('Paper', 'الورق'), '60 – 400 g/m²']] },
    },
    {
      id: 'delivery', name: tx('Delivery', 'وحدة الاستلام'), explode: [0.9, 0, 0], stage: 0.5,
      render: () => <Delivery />,
      hotspot: { position: [1.75, 0.15, 0.4], title: tx('Chain delivery', 'استلام بالسلاسل'), specs: [[tx('Spray powder', 'بودرة الرش'), tx('Stops set-off between sheets', 'تمنع انتقال الحبر بين الأفرخ')]] },
    },
    {
      id: 'console', name: tx('Control desk & E-stop', 'مكتب التحكم وزر الطوارئ'), explode: [0, 0, 0.6], stage: 0.6,
      render: () => <Console />,
      hotspot: { position: [0.47, 0.18, W / 2 + 0.6], title: tx('Stop, inch, run', 'إيقاف، تحريك متقطع، تشغيل'), specs: [[tx('Inch', 'التحريك المتقطع'), tx('Hold-to-run, crawl speed', 'يعمل أثناء الضغط فقط وبسرعة بطيئة')]], safety: tx('Red E-stop buttons are on both sides of every unit.', 'أزرار الطوارئ الحمراء على جانبي كل وحدة.') },
    },
    { id: 'frames', name: tx('Side frames & base', 'الإطارات الجانبية والقاعدة'), explode: [0, -0.8, 0], stage: 0.8, render: () => <Frames /> },
  ],
};
