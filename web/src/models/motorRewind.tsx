/**
 * Motor rewinding station for Industrial Electrical Maintenance (IEM): a
 * three-phase stator on the winding stand with its old coils being cut out,
 * a coil-winding machine, the varnish dip tank and baking oven, and the
 * test panel (megger, surge tester, resistance bridge). Floor-standing.
 * Lesson params:
 *   wind    0..1  winding machine running
 *   coils   0..1  new coils in the stator
 *   oven    0..1  oven hot
 *   test    0..1  insulation test running (HV)
 *   guard   0..1  test enclosure door closed
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Radial, Sticker, Tube, child, glowOf, param, tx, type ModelDef } from './kit';

const FLOOR = -2.0;           // unitsPerM 2.5
const TOP = FLOOR + 2.25;     // bench height 0.9 m

const Stand = () => (
  <group>
    {/* Steel work bench */}
    <Box size={[2.2, 0.08, 1.2]} position={[0, TOP - 0.04, 0]} color="#5b6670" metal={0.5} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.08, TOP - FLOOR - 0.08, 0.08]} position={[x! * 1.02, (TOP + FLOOR) / 2 - 0.04, z! * 0.52]} color="#3e4650" metal={0.6} />)}
    {/* Stator cradle */}
    <Box size={[0.9, 0.2, 0.6]} position={[-0.4, TOP + 0.1, 0]} color="#3e4650" metal={0.5} />
  </group>
);

const Stator = () => (
  <group position={[-0.4, TOP + 0.65, 0]}>
    <Cyl r={0.5} len={0.65} axis="z" color={COLORS.darkSteel} metal={0.6} open />
    <Cyl r={0.36} len={0.66} axis="z" color="#7a8590" metal={0.6} open />
    {/* Slots */}
    <Radial count={24}>{(a, i) => <Box key={i} size={[0.02, 0.06, 0.66]} position={[Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0]} rotation={[0, 0, a]} color="#2b2f36" />}</Radial>
    {/* New coils (end windings) */}
    <group name="coils">
      {[-0.36, 0.36].map((z) => <Cyl key={z} r={0.42} r2={0.42} len={0.08} axis="z" position={[0, 0, z]} color={COLORS.copper} metal={0.75} rough={0.3} open />)}
    </group>
    {/* Old burnt coils (shown while removed) */}
    <group name="old-coils">
      {[-0.36, 0.36].map((z) => <Cyl key={z} r={0.42} len={0.08} axis="z" position={[0, 0, z]} color="#3a2416" rough={0.9} open />)}
    </group>
    <Plate lines={['3~ 15 kW · 4 pole · 400 V Δ', '36 slots · class F']} size={[0.34, 0.07]} position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    <Grip name="grip-stator" at={[0, 0.0, 0.4]} />
  </group>
);

const Winder = () => (
  <group position={[0.6, TOP, 0.05]}>
    <Box size={[0.5, 0.3, 0.4]} position={[0, 0.15, 0]} color={COLORS.blue} metal={0.3} />
    <Box name="winder-count" size={[0.14, 0.06, 0.01]} position={[0, 0.2, 0.201]} color="#0c2b3f" emissive="#f2c230" glow={0} shadow={false} />
    <Plate lines={['COIL WINDER · 0–1500 rpm']} size={[0.26, 0.04]} position={[0, 0.07, 0.201]} />
    <group name="former" position={[0.4, 0.2, 0]}>
      <Cyl r={0.1} len={0.12} axis="x" color={COLORS.alu} metal={0.8} />
      <Cyl r={0.08} len={0.13} axis="x" color={COLORS.copper} metal={0.75} />
    </group>
    {/* Wire reel and its feed */}
    <Cyl r={0.12} len={0.16} axis="x" position={[0.5, 0.15, -0.45]} color={COLORS.copper} metal={0.7} />
    <Tube points={[[0.5, 0.25, -0.4], [0.45, 0.35, -0.2], [0.42, 0.28, 0]]} r={0.004} color={COLORS.copper} metal={0.8} />
    <Sticker kind="warning" pic="rotating" size={0.08} position={[-0.15, 0.2, 0.202]} />
  </group>
);

const VarnishOven = () => (
  <group position={[-2.3, FLOOR, -0.3]}>
    {/* Dip tank */}
    <Box size={[0.8, 0.8, 0.6]} position={[0, 0.4, 0.9]} color="#3e4650" metal={0.5} />
    <Box size={[0.72, 0.02, 0.52]} position={[0, 0.79, 0.9]} color="#8a5a1a" rough={0.2} />
    <Sticker kind="warning" pic="fume" size={0.14} position={[0, 0.55, 1.201]} />
    {/* Oven */}
    <Box size={[1.0, 1.6, 0.9]} position={[0, 0.8, -0.2]} color="#d5d8d6" metal={0.3} />
    <Box name="oven-lamp" size={[0.08, 0.08, 0.02]} position={[0.35, 1.45, 0.26]} color="#3a1010" emissive="#ff4020" glow={0} shadow={false} />
    <Plate lines={['VARNISH OVEN · 160 °C']} size={[0.34, 0.07]} position={[-0.1, 1.45, 0.255]} />
    <Sticker kind="warning" pic="hot" size={0.14} position={[0, 1.1, 0.255]} />
  </group>
);

const TestPanel = () => (
  <group position={[2.0, FLOOR, -0.2]}>
    <Box size={[0.9, 1.4, 0.4]} position={[0, 0.9, 0]} color={COLORS.ral7035} metal={0.3} />
    <Box name="test-screen" size={[0.3, 0.18, 0.01]} position={[-0.15, 1.3, 0.205]} color="#0c2b3f" emissive="#3ad1ff" glow={0} shadow={false} />
    <Plate lines={['MEGGER 500 V / 1 kV', 'SURGE 6 kV · BRIDGE']} size={[0.34, 0.08]} position={[-0.15, 1.05, 0.205]} />
    <Box name="hv-lamp" size={[0.08, 0.08, 0.03]} position={[0.28, 1.5, 0.21]} color="#3a1010" emissive="#ff2020" glow={0} shadow={false} />
    <Sticker kind="warning" pic="electric" caption="HV" size={0.14} position={[0.25, 1.15, 0.205]} />
    {/* Test enclosure door (a mesh gate round the bench end) */}
    <group name="gate" position={[-0.75, 0, 0.8]}>
      <Box size={[0.04, 1.2, 0.04]} position={[0, 0.6, 0]} color={COLORS.yellow} />
      <Box size={[0.04, 1.2, 0.04]} position={[0, 0.6, 0.8]} color={COLORS.yellow} />
      <Box size={[0.02, 1.0, 0.76]} position={[0, 0.6, 0.4]} color="#9aa5b0" opacity={0.35} />
    </group>
    <group name="hv-leads">
      <Tube points={[[-0.3, 0.8, 0.2], [-0.8, 1.2, 0.6], [-1.8, 2.3, 0.4], [-2.35, 2.55, 0.25]]} r={0.012} color={COLORS.red} />
      <Tube points={[[-0.2, 0.8, 0.2], [-0.8, 1.1, 0.7], [-1.9, 2.2, 0.5], [-2.4, 2.45, 0.3]]} r={0.012} color={COLORS.black} />
    </group>
  </group>
);

export const motorRewind: ModelDef = {
  id: 'motor-rewind',
  title: tx('Motor rewinding station', 'محطة إعادة لف المحركات'),
  assetTag: 'RW-15 · IEM-04',
  view: { camera: [2.0, 1.4, 4.2], target: [0, -0.2, 0] },
  params: { wind: 0, coils: 0, oven: 0, test: 0, guard: 1 },
  runParams: { wind: 1 },
  env: {
    unitsPerM: 2.5, floorY: FLOOR, stand: 'floor', bay: 'iem',
    stations: [
      { id: 'front', label: tx('At the bench', 'أمام الطاولة'), pos: [0, 1.9], face: Math.PI, pose: 'inspect', reach: [-0.2, 0.5, 0.6] },
      { id: 'stator', label: tx('Stator on the cradle', 'العضو الثابت على المهد'), pos: [-0.4, 1.4], face: Math.PI, pose: 'reach', reach: [-0.4, 0.6, 0.4] },
      { id: 'winder', label: tx('Coil winder', 'ماكينة لف الملفات'), pos: [0.7, 1.5], face: Math.PI, pose: 'operate', reach: [0.7, 0.35, 0.3] },
      { id: 'oven', label: tx('Varnish tank and oven', 'حوض الورنيش والفرن'), pos: [-2.3, 1.7], face: Math.PI, pose: 'reach', reach: [-2.3, -0.6, 0.4] },
      { id: 'test', label: tx('Test panel', 'لوحة الاختبار'), pos: [2.0, 1.4], face: Math.PI, pose: 'operate', reach: [1.9, -0.7, 0.1] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'stator', name: tx('Stator and windings', 'العضو الثابت والملفات'), explode: [-0.4, 0.8, 0.4], stage: 0,
      animate: (g, s) => {
        const c = child(g, 'coils'); const o = child(g, 'old-coils');
        if (c) c.visible = param(s, 'coils') > 0.5; if (o) o.visible = param(s, 'coils') <= 0.5 && param(s, 'oven') < 0.5;
      },
      render: () => <Stator />,
      hotspot: {
        position: [-0.4, TOP + 0.9, 0.3], title: tx('Three-phase stator, 36 slots', 'عضو ثابت ثلاثي الأوجه، 36 مجرى'), specs: [[tx('Winding', 'اللف'), tx('Double layer, lap, 12 turns/coil', 'طبقتان، لفة متراكبة، 12 لفة/ملف')], [tx('Wire', 'السلك'), tx('1.25 mm enamelled copper, class F', 'نحاس معزول 1.25 مم، فئة F')]],
        safety: tx('Old coils are cut out, not burnt out: burning varnish gives off toxic fumes and warps the core.', 'تُقطع الملفات القديمة ولا تُحرق: احتراق الورنيش يطلق أبخرة سامة ويشوه القلب.'),
      },
    },
    {
      id: 'winder', name: tx('Coil-winding machine', 'ماكينة لف الملفات'), explode: [0.6, 0.6, 0.4], stage: 0.1,
      animate: (g, s) => {
        const f = child(g, 'former'); const on = param(s, 'wind') > 0.5 && s.running;
        if (f && on) f.rotation.x += s.dt * 18;
        glowOf(g, 'winder-count', on ? 1 : 0.2);
      },
      render: () => <Winder />,
      hotspot: { position: [0.6, TOP + 0.35, 0.25], title: tx('Coil winder with turn counter', 'ماكينة لف مع عداد لفات'), specs: [[tx('Speed', 'السرعة'), '0–1500 rpm'], [tx('Control', 'التحكم'), tx('Foot pedal, stops on release', 'دواسة قدم، تتوقف عند رفعها')]] },
    },
    {
      id: 'oven', name: tx('Varnish tank and baking oven', 'حوض الورنيش وفرن التجفيف'), explode: [-0.6, 0.4, 0.3], stage: 0.25,
      animate: (g, s) => glowOf(g, 'oven-lamp', param(s, 'oven') * 1.3),
      render: () => <VarnishOven />,
      hotspot: { position: [-2.3, FLOOR + 1.5, 0.2], title: tx('Dip and bake', 'الغمر والتجفيف'), specs: [[tx('Varnish', 'الورنيش'), tx('Solvent-based, flammable', 'أساسه مذيبات، قابل للاشتعال')], [tx('Bake', 'التجفيف'), tx('160 °C for 4 hours', '160 درجة لمدة 4 ساعات')]] },
    },
    {
      id: 'test', name: tx('Insulation and surge test panel', 'لوحة اختبار العزل والصدمة'), explode: [0.6, 0.4, 0], stage: 0.35,
      animate: (g, s) => {
        const t = param(s, 'test');
        glowOf(g, 'test-screen', 0.4 + t * 0.6); glowOf(g, 'hv-lamp', t * 1.6);
        const l = child(g, 'hv-leads'); if (l) l.visible = t > 0.5;
        const gt = child(g, 'gate'); if (gt) gt.rotation.y = THREE.MathUtils.lerp(gt.rotation.y, (1 - param(s, 'guard', 1)) * 1.4, 0.12);
      },
      render: () => <TestPanel />,
      hotspot: {
        position: [2.0, FLOOR + 1.4, 0], title: tx('Megger, surge tester and bridge', 'جهاز ميجر واختبار الصدمة والقنطرة'), specs: [[tx('Insulation', 'العزل'), '≥ 100 MΩ at 1 kV'], [tx('Surge', 'الصدمة'), tx('Matched waveforms between phases', 'تطابق الموجات بين الأوجه')], [tx('Resistance', 'المقاومة'), tx('Phases within 2 %', 'الأوجه ضمن 2٪')]],
        safety: tx('The surge tester puts out 6 kV. Close the test gate, keep everyone outside it, and earth the windings after every test.', 'جهاز الصدمة يخرج 6 كيلو فولت. أغلق بوابة الاختبار وأبقِ الجميع خارجها، ووصّل الملفات بالأرضي بعد كل اختبار.'),
      },
    },
    { id: 'bench', name: tx('Work bench and cradle', 'طاولة العمل والمهد'), explode: [0, -0.6, 0], stage: 0.6, render: () => <Stand /> },
  ],
};
