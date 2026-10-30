/**
 * Procedural machine-vision inspection cell for the applied AI & industrial
 * technology programme (AIT): a belt conveyor carrying parts under an
 * industrial camera and ring light, an edge-AI computer that classifies each
 * part, a pneumatic reject pusher, a guarded enclosure with an interlocked
 * door, a light curtain at the infeed, a stack light and the HMI.
 * Parts travel along +x. Lesson params:
 *   door     0..1  access door open
 *   curtain  0..1  light curtain active (0 = muted/bypassed)
 *   reject   0..1  last part was rejected (pusher out)
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Sticker, Tube, child, param, tx, type ModelDef } from './kit';

const ALU = '#c3cbd3';
const DARK = '#2b2f36';
const BELT_Y = 0;
const CAM_X = 0.1;

const Conveyor = () => (
  <group>
    <Box size={[3.2, 0.04, 0.5]} position={[0, BELT_Y - 0.02, 0]} color="#22262b" metal={0.1} rough={0.85} finish="matte" />
    {[-0.29, 0.29].map((z) => <Box key={z} size={[3.3, 0.14, 0.04]} position={[0, BELT_Y - 0.04, z]} color={ALU} metal={0.85} rough={0.3} />)}
    {[-1.6, 1.6].map((x) => <Cyl key={x} r={0.06} len={0.56} axis="z" position={[x, BELT_Y - 0.06, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />)}
    {[-1.4, 0, 1.4].map((x) => [-0.26, 0.26].map((z) => (
      <Box key={`${x}${z}`} size={[0.05, 1.0, 0.05]} position={[x, BELT_Y - 0.6, z]} color={ALU} metal={0.85} rough={0.3} />
    )))}
    <Cyl r={0.08} len={0.2} axis="z" position={[1.6, BELT_Y - 0.06, 0.4]} color={COLORS.blue} metal={0.4} rough={0.45} />
    {/* Parts on the belt: two good (green ring) and one with a missing hole */}
    <group name="parts">
      {[-1.2, -0.5, 0.2, 0.9].map((x, i) => (
        <group key={x} position={[x, BELT_Y + 0.04, 0]}>
          <Cyl r={0.09} len={0.06} color={COLORS.alu} metal={0.85} rough={0.25} />
          {i !== 2 && <Cyl r={0.025} len={0.062} color="#22262b" metal={0.2} rough={0.6} />}
        </group>
      ))}
    </group>
  </group>
);

const Camera = () => (
  <group>
    <Box size={[0.05, 1.1, 0.05]} position={[CAM_X - 0.5, 0.55, -0.32]} color={ALU} metal={0.85} rough={0.3} />
    <Box size={[0.6, 0.05, 0.05]} position={[CAM_X - 0.22, 1.08, -0.32]} color={ALU} metal={0.85} rough={0.3} />
    <Box size={[0.05, 0.05, 0.34]} position={[CAM_X, 1.08, -0.15]} color={ALU} metal={0.85} rough={0.3} />
    <Box size={[0.12, 0.16, 0.12]} position={[CAM_X, 0.94, 0]} color={DARK} metal={0.3} rough={0.5} />
    <Cyl r={0.04} len={0.1} position={[CAM_X, 0.82, 0]} color="#111316" metal={0.5} rough={0.3} />
    <Cyl r={0.025} len={0.005} position={[CAM_X, 0.769, 0]} color="#2a4a7a" metal={0.2} rough={0.05} />
    {/* Ring light */}
    <mesh position={[CAM_X, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.12, 0.025, 12, 40]} />
      <meshStandardMaterial color="#e8f2ff" emissive="#cfe4ff" emissiveIntensity={1.1} />
    </mesh>
    <Tube points={[[CAM_X, 1.0, -0.06], [CAM_X, 1.05, -0.2], [CAM_X - 0.5, 1.05, -0.36], [-0.5, 0.2, -0.4]]} r={0.012} color="#1b1d20" rough={0.8} />
    {/* Field of view */}
    <mesh name="fov" position={[CAM_X, 0.4, 0]}>
      <coneGeometry args={[0.22, 0.75, 4, 1, true]} />
      <meshBasicMaterial color="#59b7ff" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  </group>
);

/** Edge-AI computer and the HMI on the side of the cell. */
const EdgeAi = () => (
  <group>
    <Box size={[0.36, 0.1, 0.26]} position={[-1.2, -0.45, -0.1]} color="#3b4048" metal={0.4} rough={0.45} />
    {Array.from({ length: 8 }, (_, i) => <Box key={i} size={[0.3, 0.008, 0.008]} position={[-1.2, -0.39, -0.2 + i * 0.03]} color="#2b2f36" metal={0.5} rough={0.4} shadow={false} />)}
    <Box size={[0.03, 0.01, 0.002]} position={[-1.08, -0.45, 0.031]} color="#2f9e57" emissive="#2fff80" glow={1} shadow={false} />
    <Plate lines={['EDGE AI · 40 TOPS', 'model v3.2 · 12 ms']} size={[0.22, 0.06]} position={[-1.2, -0.45, 0.031]} bg="#14234c" fg="#ffffff" />
    <group position={[-1.75, 0.5, 0.55]} rotation={[0, 0.5, 0]}>
      <Box size={[0.5, 0.36, 0.05]} color={DARK} metal={0.3} rough={0.5} />
      <Box size={[0.44, 0.3, 0.002]} position={[0, 0, 0.027]} color="#0c2b3f" emissive="#1b6fa8" glow={0.8} shadow={false} />
      <Box size={[0.12, 0.08, 0.002]} position={[-0.12, 0.06, 0.029]} color="#2f9e57" emissive="#2f9e57" glow={0.9} shadow={false} />
      <Box size={[0.12, 0.08, 0.002]} position={[0.08, 0.06, 0.029]} color="#c8312b" emissive="#c8312b" glow={0.6} shadow={false} />
      <Box size={[0.05, 0.7, 0.05]} position={[0, -0.55, -0.04]} color={ALU} metal={0.85} rough={0.3} />
      <Grip name="grip-hmi" at={[0, 0, 0.06]} />
    </group>
  </group>
);

/** Pneumatic reject pusher and the reject bin. */
const Reject = () => (
  <group>
    <Box size={[0.14, 0.1, 0.4]} position={[0.9, BELT_Y + 0.06, -0.52]} color={ALU} metal={0.85} rough={0.3} />
    <group name="pusher" position={[0.9, BELT_Y + 0.06, -0.32]}>
      <Cyl r={0.012} len={0.12} axis="z" position={[0, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
      <Box size={[0.16, 0.08, 0.02]} position={[0, 0, 0.06]} color={COLORS.orange} metal={0.2} rough={0.5} />
    </group>
    <Tube points={[[0.9, BELT_Y + 0.1, -0.7], [0.7, BELT_Y + 0.3, -0.8], [0.3, BELT_Y - 0.3, -0.75]]} r={0.008} color="#2f5f93" rough={0.6} />
    <Box size={[0.4, 0.3, 0.3]} position={[0.9, BELT_Y - 0.25, 0.5]} color={COLORS.red} metal={0.2} rough={0.6} />
    <Box size={[0.08, 0.06, 0.14]} position={[0.3, BELT_Y - 0.3, -0.75]} color="#3b4048" metal={0.3} rough={0.5} />
    <Sticker kind="warning" pic="exclaim" size={0.08} position={[0.9, BELT_Y + 0.06, -0.319]} />
  </group>
);

/** Enclosure with the interlocked door and the light curtain at the infeed. */
const Enclosure = () => (
  <group>
    {[[-1.0, -0.62], [1.2, -0.62], [-1.0, 0.62], [1.2, 0.62]].map(([x, z]) => (
      <Box key={`${x}${z}`} size={[0.05, 2.2, 0.05]} position={[x!, 0.0, z!]} color={COLORS.yellow} metal={0.3} rough={0.5} />
    ))}
    <Box size={[2.25, 0.05, 1.3]} position={[0.1, 1.1, 0]} color={COLORS.yellow} metal={0.3} rough={0.5} />
    <Box size={[2.2, 1.6, 0.01]} position={[0.1, 0.3, -0.62]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.25} shadow={false} />
    <group name="door" position={[-1.0, 0.3, 0.62]}>
      <Box size={[2.2, 1.6, 0.012]} position={[1.1, 0, 0]} color={COLORS.glass} metal={0.1} rough={0.05} opacity={0.25} shadow={false} />
      <Box size={[0.03, 0.2, 0.04]} position={[2.05, 0, 0.03]} color={DARK} metal={0.3} rough={0.5} />
      <Grip name="grip-door" at={[2.05, 0, 0.06]} />
    </group>
    <Box size={[0.06, 0.08, 0.05]} position={[1.15, 0.3, 0.66]} color={COLORS.red} metal={0.2} rough={0.5} />
    {/* Light curtain at the open infeed (left end) */}
    {[-0.3, 0.3].map((z) => <Box key={z} size={[0.04, 0.7, 0.04]} position={[-1.05, 0.3, z]} color="#f2c230" metal={0.2} rough={0.5} />)}
    <group name="beams">
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[-1.05, 0.0 + i * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.58, 4]} /><meshBasicMaterial color="#ff3a30" transparent opacity={0.45} />
        </mesh>
      ))}
    </group>
    <Sticker kind="mandatory" pic="exclaim" size={0.12} position={[0.1, 0.8, 0.635]} />
  </group>
);

const StackLight = () => (
  <group position={[1.2, 1.15, -0.62]}>
    <Cyl r={0.015} len={0.15} position={[0, 0.07, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
    {[[COLORS.green, 'lampG'], [COLORS.yellow, 'lampY'], [COLORS.red, 'lampR']].map(([c, n], i) => (
      <group key={n} name={n}><Cyl r={0.04} len={0.07} position={[0, 0.19 + i * 0.075, 0]} color={c!} opacity={0.85} emissive={c} glow={0.2} /></group>
    ))}
  </group>
);

const setGlow = (o: THREE.Object3D | undefined, v: number) => {
  o?.traverse((m) => { const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mat && 'emissiveIntensity' in mat) mat.emissiveIntensity = v; });
};

export const visionCell: ModelDef = {
  id: 'vision-cell',
  title: tx('AI vision inspection cell', 'خلية فحص بالرؤية والذكاء الاصطناعي'),
  assetTag: 'VIS-3 · AIT-01',
  view: { camera: [1.6, 1.4, 3.2], target: [0, 0.2, 0] },
  params: { door: 0, curtain: 1, reject: 0 },
  env: {
    unitsPerM: 1.6, floorY: -1.12, stand: 'floor', bay: 'ait',
    stations: [
      { id: 'hmi', label: tx('Operator screen (HMI)', 'شاشة المشغل (HMI)'), pos: [-1.9, 1.2], face: Math.PI - 0.5, pose: 'operate', reach: [-1.75, 0.5, 0.62] },
      { id: 'door', label: tx('Cell door', 'باب الخلية'), pos: [0.9, 1.3], face: Math.PI, pose: 'reach', reach: [1.05, 0.3, 0.68] },
      { id: 'inside', label: tx('Inside the cell, at the camera', 'داخل الخلية عند الكاميرا'), pos: [0.1, 0.35], face: Math.PI, pose: 'reach', reach: [CAM_X, 0.85, 0.08] },
      { id: 'infeed', label: tx('Infeed', 'مدخل السير'), pos: [-1.7, 0.2], face: Math.PI / 2, pose: 'reach', reach: [-1.2, 0.08, 0] },
      { id: 'pusher', label: tx('Reject pusher', 'دافع الرفض'), pos: [0.9, -1.2], face: 0, pose: 'inspect', reach: [0.9, 0.1, -0.5] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.0, 2.6], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'enclosure', name: tx('Guard enclosure & light curtain', 'الحاجز الواقي والستارة الضوئية'), explode: [0, 0.9, 0.6], stage: 0,
      animate: (g, s) => {
        const d = child(g, 'door');
        if (d) d.rotation.y = THREE.MathUtils.lerp(d.rotation.y, -param(s, 'door') * 1.4, 0.1);
        const b = child(g, 'beams');
        if (b) b.visible = param(s, 'curtain', 1) > 0.5;
      },
      render: () => <Enclosure />,
      hotspot: {
        position: [-1.05, 0.5, 0.3], title: tx('Type 4 light curtain', 'ستارة ضوئية من النوع 4'), specs: [[tx('Resolution', 'الدقة'), tx('30 mm (hand)', '30 مم (اليد)')], [tx('Response', 'زمن الاستجابة'), '12 ms'], [tx('Standard', 'المعيار'), 'IEC 61496']],
        safety: tx('Breaking a beam stops the conveyor and the pusher. Never mute or bypass it to save time.', 'قطع أي شعاع يوقف السير والدافع. لا تعطّلها أو تتجاوزها أبدًا لتوفير الوقت.'),
      },
    },
    {
      id: 'camera', name: tx('Industrial camera & ring light', 'الكاميرا الصناعية والإضاءة الحلقية'), explode: [0, 0.8, -0.4], stage: 0.15,
      animate: (g, s) => { const f = child(g, 'fov'); if (f) f.visible = s.running; },
      render: () => <Camera />,
      hotspot: {
        position: [CAM_X, 0.94, 0.08], title: tx('5 MP GigE camera', 'كاميرا 5 ميجابكسل GigE'), specs: [[tx('Lens', 'العدسة'), '16 mm'], [tx('Field of view', 'مجال الرؤية'), '120 × 90 mm'], [tx('Light', 'الإضاءة'), tx('White LED ring, strobed', 'حلقة LED بيضاء وامضة')]],
        safety: tx('The strobe is very bright: do not look into the ring light while it runs.', 'الوميض شديد السطوع: لا تنظر إلى الإضاءة الحلقية أثناء التشغيل.'),
      },
    },
    {
      id: 'edge', name: tx('Edge-AI computer & HMI', 'حاسوب الذكاء الاصطناعي الطرفي وشاشة HMI'), explode: [-0.6, 0.2, 0.4], stage: 0.3,
      render: () => <EdgeAi />,
      hotspot: { position: [-1.2, -0.38, 0.05], title: tx('Edge inference', 'الاستدلال الطرفي'), specs: [[tx('Model', 'النموذج'), tx('Defect classifier v3.2', 'مصنّف عيوب v3.2')], [tx('Time per part', 'الزمن لكل قطعة'), '12 ms'], [tx('Accuracy', 'الدقة'), tx('99.1 % on the test set', '99.1٪ على بيانات الاختبار')]] },
    },
    {
      id: 'reject', name: tx('Pneumatic reject pusher', 'دافع الرفض الهوائي'), explode: [0, 0.3, -0.7], stage: 0.4,
      animate: (g, s) => { const p = child(g, 'pusher'); if (p) p.position.z = THREE.MathUtils.lerp(p.position.z, -0.32 + param(s, 'reject') * 0.4, 0.3); },
      render: () => <Reject />,
      hotspot: {
        position: [0.9, 0.12, -0.4], title: tx('Reject cylinder', 'أسطوانة الرفض'), specs: [[tx('Air', 'الهواء'), '6 bar'], [tx('Stroke', 'المشوار'), '100 mm in 80 ms']],
        safety: tx('Compressed air stays in the cylinder after a stop. Dump the air and lock the valve before reaching in.', 'يبقى الهواء المضغوط في الأسطوانة بعد الإيقاف. فرّغ الهواء واقفل الصمام قبل مد يدك.'),
      },
    },
    {
      id: 'conveyor', name: tx('Belt conveyor & parts', 'السير الناقل والقطع'), explode: [0, -0.4, 0.4], stage: 0.55,
      animate: (g, s) => {
        const p = child(g, 'parts');
        if (p && s.running) p.position.x = ((p.position.x + s.dt * 0.25 + 0.35) % 0.7) - 0.35;
      },
      render: () => <Conveyor />,
      hotspot: { position: [-0.5, 0.08, 0.1], title: tx('Parts under test', 'القطع تحت الفحص'), specs: [[tx('Rate', 'المعدل'), tx('60 parts/min', '60 قطعة/دقيقة')], [tx('Defect', 'العيب'), tx('Missing centre hole', 'غياب الثقب المركزي')]] },
    },
    {
      id: 'stack', name: tx('Stack light', 'برج الإشارات'), explode: [0.3, 0.5, 0], stage: 0.7,
      animate: (g, s) => {
        setGlow(child(g, 'lampG'), s.running ? 1 : 0.15);
        setGlow(child(g, 'lampY'), param(s, 'curtain', 1) < 0.5 || param(s, 'door') > 0.5 ? 1 : 0.15);
        setGlow(child(g, 'lampR'), param(s, 'reject') > 0.5 ? 1 : 0.15);
      },
      render: () => <StackLight />,
      hotspot: { position: [1.2, 1.3, -0.6], title: tx('Status light', 'ضوء الحالة'), specs: [[tx('Green', 'الأخضر'), tx('Running', 'يعمل')], [tx('Amber', 'الأصفر'), tx('Door open or safety muted', 'باب مفتوح أو حماية معطلة')], [tx('Red', 'الأحمر'), tx('Part rejected or fault', 'قطعة مرفوضة أو عطل')]] },
    },
  ],
};
