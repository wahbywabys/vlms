/**
 * Procedural pedestal grinder: 200 mm double-ended grinder on a floor
 * pedestal, with wheel guards, adjustable tool rests, tongue guards and eye
 * shields. The spindle runs along x at y = 0. Lesson params:
 *   gap     0..1  tool-rest gap (0 = the correct 2 mm, 1 = about 10 mm, dangerous)
 *   shield  0..1  eye shields lowered into place
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, child, param, tx, type ModelDef } from './kit';

const PAINT = '#3f6b5a';
const WR = 0.25;           // wheel radius (Ø200 mm at 2.5 units per metre)
const WX = 0.66;           // wheel centre, ± x
const restZ = (gap: number) => WR + 0.005 + 0.07 + gap * 0.02;

const Motor = () => (
  <group>
    <Cyl r={0.21} len={0.82} axis="x" color={PAINT} metal={0.3} rough={0.45} />
    {[-0.3, -0.1, 0.1, 0.3].map((x) => <Cyl key={x} r={0.215} len={0.02} axis="x" position={[x, 0, 0]} color="#355b4c" metal={0.3} rough={0.5} />)}
    <Box size={[0.36, 0.14, 0.34]} position={[0, -0.22, 0]} color={PAINT} metal={0.3} rough={0.5} />
    <Box size={[0.2, 0.08, 0.002]} position={[0, 0.02, 0.212]} color={COLORS.cream} shadow={false} />
    {/* Spindle ends */}
    {[-1, 1].map((s) => <Cyl key={s} r={0.03} len={0.2} axis="x" position={[s * 0.5, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />)}
  </group>
);

const Wheels = () => (
  <group>
    {/* Coarse (A36) on the left, fine (A60) on the right */}
    <Cyl r={WR} len={0.07} axis="x" position={[-WX, 0, 0]} color="#7d7a73" metal={0.05} rough={0.95} seg={48} />
    <Cyl r={WR} len={0.07} axis="x" position={[WX, 0, 0]} color="#b9b4a6" metal={0.05} rough={0.9} seg={48} />
    {[-1, 1].map((s) => (
      <group key={s}>
        <Cyl r={0.08} len={0.08} axis="x" position={[s * WX, 0, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
        {/* A mark so you can see it turn */}
        <Box size={[0.072, 0.05, 0.02]} position={[s * WX, WR - 0.04, 0]} color="#4a4740" shadow={false} />
      </group>
    ))}
  </group>
);

/** Wheel guard: a shell over the back and top of each wheel, open at the front. */
const Guards = () => (
  <group>
    {[-1, 1].map((s) => (
      <group key={s} position={[s * WX, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[WR + 0.04, WR + 0.04, 0.13, 40, 1, true, Math.PI * 0.62, Math.PI * 1.55]} />
          <meshStandardMaterial color={PAINT} metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[s * 0.065, 0, 0]} rotation={[0, s * Math.PI / 2, 0]} castShadow>
          <circleGeometry args={[WR + 0.04, 40, Math.PI * 0.12, Math.PI * 1.55]} />
          <meshStandardMaterial color={PAINT} metalness={0.3} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Tongue guard (spark arrestor) above the opening, 6 mm off the wheel */}
        <Box size={[0.12, 0.03, 0.09]} position={[0, WR + 0.02, 0.15]} rotation={[0.6, 0, 0]} color={COLORS.darkSteel} metal={0.7} rough={0.35} />
      </group>
    ))}
  </group>
);

const Rests = () => (
  <group>
    {[-1, 1].map((s) => (
      <group key={s} name={s < 0 ? 'restL' : 'restR'} position={[s * WX, -0.04, restZ(0)]}>
        <Box size={[0.16, 0.025, 0.12]} color={COLORS.steel} metal={0.85} rough={0.3} />
        <Box size={[0.03, 0.14, 0.03]} position={[0, -0.08, -0.05]} color={COLORS.darkSteel} metal={0.7} rough={0.35} />
      </group>
    ))}
  </group>
);

const Shields = () => (
  <group>
    {[-1, 1].map((s) => (
      <group key={s} name={s < 0 ? 'shieldL' : 'shieldR'} position={[s * WX, WR + 0.08, 0.12]}>
        <Box size={[0.22, 0.14, 0.012]} position={[0, -0.07, 0.02]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.35} shadow={false} />
        <Cyl r={0.012} len={0.24} axis="x" color={COLORS.steel} metal={0.9} rough={0.2} />
      </group>
    ))}
  </group>
);

const Pedestal = () => (
  <group>
    <Cyl r={0.09} r2={0.11} len={2.05} position={[0, -1.33, 0]} color={PAINT} metal={0.3} rough={0.5} />
    <Box size={[0.9, 0.06, 0.7]} position={[0, -2.37, 0]} color={PAINT} metal={0.3} rough={0.55} />
    {/* Bolted to the floor */}
    {[[-0.36, -0.27], [0.36, -0.27], [-0.36, 0.27], [0.36, 0.27]].map(([x, z]) => (
      <Cyl key={`${x}${z}`} r={0.025} len={0.05} position={[x!, -2.32, z!]} color={COLORS.steel} metal={0.9} rough={0.3} />
    ))}
    {/* NVR switch box */}
    <Box size={[0.2, 0.26, 0.12]} position={[0, -0.55, 0.16]} color="#e9e4d6" metal={0.1} rough={0.6} />
    <Cyl r={0.045} len={0.04} axis="z" position={[0, -0.5, 0.235]} color={COLORS.red} emissive="#4a0806" glow={0.3} />
    <Cyl r={0.03} len={0.03} axis="z" position={[0, -0.62, 0.23]} color={COLORS.green} />
  </group>
);

export const benchGrinder: ModelDef = {
  id: 'bench-grinder',
  title: tx('Pedestal grinder · 200 mm', 'جلاخة عمودية · 200 مم'),
  assetTag: 'GRD-P200 · WS-04',
  view: { camera: [1.9, 0.9, 2.9], target: [0, -0.2, 0] },
  params: { gap: 0, shield: 1 },
  env: {
    unitsPerM: 2.5, floorY: -2.4, stand: 'floor', bay: 'cnc',
    stations: [
      { id: 'front', label: tx('In front of the grinder', 'أمام الجلاخة'), pos: [0.2, 1.5], face: Math.PI, pose: 'operate', reach: [WX, -0.02, 0.4] },
      { id: 'grind', label: tx('Fine wheel', 'الحجر الناعم'), pos: [0.9, 1.4], face: Math.PI, pose: 'operate', reach: [WX, 0.0, 0.36] },
      { id: 'switch', label: tx('Start / stop switch', 'مفتاح التشغيل والإيقاف'), pos: [0.15, 1.3], face: Math.PI, pose: 'reach', reach: [0, -0.5, 0.26] },
      { id: 'side', label: tx('Side of the grinder', 'جانب الجلاخة'), pos: [2.3, 0.6], face: -Math.PI / 2, pose: 'inspect', reach: [WX + 0.1, 0.0, 0.1] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.2, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'shields', name: tx('Eye shields', 'واقيات العين'), explode: [0, 0.7, 0.5], stage: 0,
      animate: (g, s) => {
        for (const n of ['shieldL', 'shieldR']) {
          const o = child(g, n);
          if (o) o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, (1 - param(s, 'shield', 1)) * -1.3, 0.12);
        }
      },
      render: () => <Shields />,
      hotspot: {
        position: [WX, WR + 0.1, 0.16], title: tx('Adjustable eye shields', 'واقيات عين قابلة للضبط'),
        specs: [[tx('Material', 'المادة'), tx('Polycarbonate, impact rated', 'بولي كربونات مقاوم للصدمات')], [tx('Use', 'الاستخدام'), tx('Lowered every time, as well as your glasses', 'تُنزل في كل مرة إضافة إلى نظارتك')]],
        safety: tx('Shields add to safety glasses; they do not replace them.', 'الواقيات تضاف إلى نظارة السلامة ولا تغني عنها.'),
      },
    },
    {
      id: 'rests', name: tx('Tool rests', 'مساند العدة'), explode: [0, -0.3, 0.7], stage: 0.1,
      animate: (g, s) => {
        for (const n of ['restL', 'restR']) {
          const o = child(g, n);
          if (o) o.position.z = THREE.MathUtils.lerp(o.position.z, restZ(param(s, 'gap')), 0.15);
        }
      },
      render: () => <Rests />,
      hotspot: {
        position: [WX, -0.02, 0.36], title: tx('Tool rest: 2 mm from the wheel', 'مسند العدة: 2 مم من الحجر'),
        specs: [[tx('Gap', 'الفراغ'), tx('2 mm maximum', '2 مم كحد أقصى')], [tx('Height', 'الارتفاع'), tx('At or just below the wheel centre', 'عند مركز الحجر أو أسفله قليلًا')]],
        safety: tx('A wide gap lets the work jam between rest and wheel: the wheel can burst or drag the hand in.', 'الفراغ الواسع يسمح بانحشار القطعة بين المسند والحجر: قد ينفجر الحجر أو يسحب اليد.'),
      },
    },
    {
      id: 'guards', name: tx('Wheel guards & tongue guards', 'أغطية الأحجار وواقيات اللسان'), explode: [0, 0.4, -0.6], stage: 0.2,
      render: () => <Guards />,
      hotspot: {
        position: [-WX, WR + 0.08, 0.1], title: tx('Wheel guard', 'غطاء الحجر'),
        specs: [[tx('Covers', 'يغطي'), tx('All but the working opening', 'كل الحجر عدا فتحة العمل')], [tx('Tongue guard gap', 'فراغ واقي اللسان'), tx('6 mm maximum', '6 مم كحد أقصى')]],
        safety: tx('If a wheel bursts, the guard holds the pieces. Never run a grinder with a guard off.', 'إذا انفجر الحجر يحتجز الغطاء القطع. لا تشغّل الجلاخة والغطاء منزوع أبدًا.'),
      },
    },
    {
      id: 'wheels', name: tx('Grinding wheels', 'أحجار التجليخ'), explode: [0, 0, 0.9], stage: 0.3, spin: { axis: 'x', speed: -40 },
      render: () => <Wheels />,
      hotspot: {
        position: [WX, 0, WR], title: tx('Ø200 mm vitrified wheels', 'أحجار مزججة قطر 200 مم'),
        specs: [[tx('Left', 'اليسار'), tx('A36 coarse', 'A36 خشن')], [tx('Right', 'اليمين'), tx('A60 fine', 'A60 ناعم')], [tx('Max speed', 'السرعة القصوى'), '35 m/s · 3340 rpm'], [tx('Spindle', 'العمود'), '2950 rpm']],
        safety: tx('Ring-test a new wheel, check its rated speed is above the spindle speed, and stand aside for the first minute of running.', 'اختبر الحجر الجديد بالطرق، وتأكد أن سرعته المقررة أعلى من سرعة العمود، وقف جانبًا في الدقيقة الأولى من التشغيل.'),
      },
    },
    {
      id: 'motor', name: tx('Motor', 'المحرك'), explode: [0, 0.5, -0.4], stage: 0.45,
      render: () => <Motor />,
      hotspot: { position: [0, 0.22, 0.1], title: tx('Induction motor', 'محرك حثي'), specs: [[tx('Power', 'القدرة'), '0.55 kW, 400 V'], [tx('Speed', 'السرعة'), '2950 rpm']] },
    },
    {
      id: 'pedestal', name: tx('Pedestal & NVR switch', 'القاعدة ومفتاح NVR'), explode: [0, -0.6, 0], stage: 0.6,
      render: () => <Pedestal />,
      hotspot: {
        position: [0, -0.5, 0.25], title: tx('No-volt release switch', 'مفتاح الفصل عند انقطاع الجهد'),
        specs: [[tx('Type', 'النوع'), tx('NVR with red mushroom stop', 'NVR مع زر إيقاف أحمر')]],
        safety: tx('After a power cut the grinder will not restart by itself.', 'بعد انقطاع الكهرباء لا تعود الجلاخة للعمل من تلقاء نفسها.'),
      },
    },
  ],
};
