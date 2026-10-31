/**
 * Split air-conditioner service rig for Refrigeration & Air-Conditioning
 * (RAC): an outdoor unit with its top cover removable (compressor,
 * condenser coil and fan, run capacitor, service valves), the indoor unit
 * on a stand, and the service kit: digital manifold with hoses, vacuum pump,
 * recovery machine with a recovery cylinder, nitrogen cylinder with
 * regulator, and an electronic leak detector. Floor-standing.
 * Lesson params:
 *   cover    0..1  outdoor unit top/side cover off
 *   hoses    0..1  manifold hoses connected to the service valves
 *   pressure 0..1  suction gauge reading (0 = vacuum, 1 = normal running)
 *   recover  0..1  recovery machine running
 *   nitrogen 0..1  nitrogen flowing (purge or pressure test)
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Radial, Sticker, Tube, child, glowOf, param, tx, type ModelDef } from './kit';

const UNIT = '#eef1f3';
const FLOOR = -1.8;               // unitsPerM 2.4
const COPPER = COLORS.copper;

const Outdoor = () => (
  <group position={[0, 0, 0]}>
    {/* Base and legs */}
    <Box size={[2.0, 0.08, 0.8]} position={[0, -0.92, 0]} color="#5b6670" metal={0.5} />
    {/* Back coil (condenser), visible as a fin grid */}
    <Box size={[1.9, 1.5, 0.05]} position={[0, -0.12, -0.37]} color="#9aa5b0" metal={0.6} rough={0.4} />
    {Array.from({ length: 26 }, (_, i) => <Box key={i} size={[0.01, 1.45, 0.06]} position={[-0.9 + i * 0.07, -0.12, -0.34]} color={COPPER} metal={0.7} rough={0.35} />)}
    {/* Fan with grille at the front left */}
    <group position={[-0.4, -0.12, 0.38]}>
      <Cyl r={0.55} len={0.02} axis="z" color="#d5d8d6" open />
      <group name="fan">
        <Radial count={3}>{(a, i) => <Box key={i} size={[0.42, 0.16, 0.01]} position={[Math.cos(a) * 0.22, Math.sin(a) * 0.22, -0.05]} rotation={[0.35, 0, a]} color="#3e4650" />}</Radial>
        <Cyl r={0.06} len={0.08} axis="z" position={[0, 0, -0.05]} color="#22262b" />
      </group>
    </group>
    {/* Compressor, capacitor and the service valves (right side) */}
    <group position={[0.55, -0.42, 0.05]}>
      <Cyl r={0.2} len={0.6} color="#22262b" metal={0.4} rough={0.5} />
      <Cyl r={0.2} len={0.08} position={[0, 0.32, 0]} color="#22262b" metal={0.4} rough={0.5} />
      <Tube points={[[0.05, 0.36, 0], [0.1, 0.55, 0.1], [0.3, 0.5, 0.3]]} r={0.025} color={COPPER} metal={0.7} rough={0.3} />
      <Tube points={[[-0.12, 0.2, 0.12], [-0.25, 0.5, 0.0], [-0.3, 0.9, -0.3]]} r={0.025} color={COPPER} metal={0.7} rough={0.3} />
      <Plate lines={['ROTARY R32', '1.5 HP · 230 V']} size={[0.2, 0.08]} position={[0, 0.05, 0.205]} />
    </group>
    <group position={[0.35, 0.25, 0.25]}>
      <Cyl r={0.05} len={0.14} color="#c3cbd3" metal={0.6} />
      <Plate lines={['35+5 µF']} size={[0.08, 0.03]} position={[0, 0, 0.052]} />
    </group>
    <group position={[0.98, -0.55, 0.3]}>
      {[0, 0.18].map((y, i) => (
        <group key={y} position={[0, y, 0]}>
          <Box size={[0.08, 0.08, 0.1]} color={COLORS.brass} metal={0.8} rough={0.3} />
          <Cyl r={0.02} len={0.08} axis="x" position={[0.07, 0, 0]} color={COLORS.brass} metal={0.8} rough={0.3} />
          <Plate lines={[i ? 'LIQ' : 'SUC']} size={[0.06, 0.025]} position={[0, 0.06, 0.051]} />
        </group>
      ))}
      <Grip name="grip-valve" at={[0.1, 0.05, 0.05]} />
    </group>
    <Plate lines={['WABYS SPLIT 18000 BTU', 'R32 · 0.95 kg · A2L']} size={[0.36, 0.1]} position={[0.6, 0.45, 0.41]} />
    <Sticker kind="warning" pic="noFlame" size={0.12} position={[0.85, 0.45, 0.41]} />
  </group>
);

const Cover = () => (
  <group name="cover">
    <Box size={[2.0, 0.05, 0.82]} position={[0, 0.66, 0]} color={UNIT} metal={0.3} rough={0.4} />
    <Box size={[0.72, 1.55, 0.03]} position={[0.62, -0.12, 0.4]} color={UNIT} metal={0.3} rough={0.4} />
    <Box size={[0.03, 1.55, 0.82]} position={[1.0, -0.12, 0]} color={UNIT} metal={0.3} rough={0.4} />
  </group>
);

const Indoor = () => (
  <group position={[-2.6, 0.9, -0.2]}>
    <Box size={[0.08, 2.7, 0.08]} position={[0, -1.35, -0.15]} color="#5b6670" metal={0.5} />
    <Box size={[1.6, 0.6, 0.45]} position={[0, 0.5, 0]} color={UNIT} metal={0.2} rough={0.4} round={0.08} />
    <Box size={[1.4, 0.06, 0.04]} position={[0, 0.26, 0.21]} color="#c3cbd3" />
    <Box name="ac-display" size={[0.14, 0.06, 0.01]} position={[0.5, 0.55, 0.226]} color="#0c2b3f" emissive="#3ad1ff" glow={0} shadow={false} />
    <Tube points={[[0.75, 0.4, -0.15], [1.4, 0.0, -0.15], [2.0, -0.6, 0.0], [2.6, -1.0, 0.1]]} r={0.04} color="#e8e8e8" rough={0.9} />
  </group>
);

/** Digital manifold with three hoses; when connected the hoses run to the valves. */
const Manifold = () => (
  <group position={[1.65, -0.15, 0.6]}>
    <Box size={[0.4, 0.26, 0.08]} color="#2b2f36" />
    <Box size={[0.26, 0.12, 0.01]} position={[0, 0.04, 0.041]} color="#0c2b3f" emissive="#2fbf6a" glow={0.6} shadow={false} />
    {[[-0.12, '#2f6fd0'], [0.12, '#c8312b']].map(([x, c]) => <Cyl key={x as number} r={0.035} len={0.05} axis="z" position={[x as number, -0.09, 0.045]} color={c as string} />)}
    <group name="needle" position={[0, 0.04, 0.05]}><Box size={[0.004, 0.05, 0.004]} position={[0, 0.02, 0]} color={COLORS.red} shadow={false} /></group>
    <group name="hoses-on">
      <Tube points={[[-0.12, -0.13, 0.0], [-0.3, -0.4, 0.1], [-0.55, -0.4, -0.2], [-0.6, -0.5, -0.3]]} r={0.016} color="#2f6fd0" />
      <Tube points={[[0.12, -0.13, 0.0], [-0.1, -0.5, 0.1], [-0.55, -0.35, -0.15], [-0.6, -0.33, -0.3]]} r={0.016} color="#c8312b" />
      <Tube points={[[0, -0.13, 0.0], [0.1, -0.6, 0.3], [0.5, -0.9, 0.4]]} r={0.016} color={COLORS.yellow} />
    </group>
    <Plate lines={['MANIFOLD R32/R410A']} size={[0.26, 0.04]} position={[0, -0.03, 0.041]} />
  </group>
);

const Kit = () => (
  <group>
    {/* Vacuum pump */}
    <group position={[2.0, -1.55, 0.95]}>
      <Box size={[0.42, 0.26, 0.2]} color="#f06721" metal={0.3} />
      <Cyl r={0.1} len={0.26} axis="x" position={[-0.05, 0.02, 0]} color="#3e4650" metal={0.5} />
      <Plate lines={['VACUUM 2-stage']} size={[0.2, 0.04]} position={[0.05, 0.06, 0.101]} />
    </group>
    {/* Recovery machine and recovery cylinder */}
    <group position={[2.7, -1.55, 0.2]}>
      <Box size={[0.42, 0.34, 0.3]} color="#2f5f93" metal={0.3} />
      <Box name="rec-led" size={[0.04, 0.04, 0.01]} position={[0.12, 0.1, 0.151]} color="#103a12" emissive="#2fff80" glow={0} shadow={false} />
      <Plate lines={['RECOVERY UNIT']} size={[0.22, 0.04]} position={[-0.05, 0.08, 0.151]} />
    </group>
    <group position={[3.3, -1.3, 0.2]}>
      <Cyl r={0.18} len={0.65} color="#8f9aa3" metal={0.5} />
      <Cyl r={0.14} len={0.12} position={[0, 0.38, 0]} color={COLORS.yellow} metal={0.3} />
      <Plate lines={['RECOVERY · 80% max']} size={[0.2, 0.05]} position={[0, 0.05, 0.181]} />
    </group>
    {/* Nitrogen cylinder with regulator */}
    <group position={[3.0, -0.9, -0.7]}>
      <Cyl r={0.14} len={1.6} color="#22262b" metal={0.4} />
      <Cyl r={0.04} len={0.12} position={[0, 0.86, 0]} color={COLORS.brass} metal={0.8} />
      <Cyl r={0.05} len={0.04} axis="z" position={[0.05, 0.9, 0.04]} color="#e9ecef" />
      <Plate lines={['OFN · NITROGEN']} size={[0.2, 0.05]} position={[0, 0.2, 0.141]} />
      <Box name="n2-flow" size={[0.01, 0.2, 0.01]} position={[0.08, 0.98, 0.05]} color="#d0eaff" emissive="#d0eaff" glow={0} opacity={0.5} shadow={false} />
    </group>
    {/* Electronic leak detector */}
    <group position={[1.4, -1.72, 1.1]} rotation={[0, 0.5, 0]}>
      <Box size={[0.08, 0.06, 0.26]} color={COLORS.yellow} />
      <Cyl r={0.006} len={0.3} axis="z" position={[0, 0.01, 0.27]} color="#22262b" />
    </group>
  </group>
);

export const splitAc: ModelDef = {
  id: 'split-ac',
  title: tx('Split air-conditioner service rig', 'منصة صيانة مكيف سبليت'),
  assetTag: 'R32 18k BTU · RAC-03',
  view: { camera: [2.6, 1.4, 6.4], target: [0, -0.4, 0] },
  params: { cover: 0, hoses: 0, pressure: 0.6, recover: 0, nitrogen: 0 },
  runParams: { pressure: 1 },
  env: {
    unitsPerM: 2.4, floorY: FLOOR, stand: 'floor', bay: 'rac',
    stations: [
      { id: 'front', label: tx('In front of the outdoor unit', 'أمام الوحدة الخارجية'), pos: [0.2, 1.8], face: Math.PI, pose: 'inspect', reach: [0.3, -0.2, 0.6] },
      { id: 'valves', label: tx('Service valves', 'صمامات الخدمة'), pos: [1.2, 1.4], face: Math.PI, pose: 'crouch', reach: [1.05, -0.5, 0.4] },
      { id: 'inside', label: tx('Inside the unit', 'داخل الوحدة'), pos: [0.6, 1.3], face: Math.PI, pose: 'reach', reach: [0.45, 0.2, 0.3] },
      { id: 'kit', label: tx('Recovery and nitrogen', 'الاسترجاع والنيتروجين'), pos: [2.8, 1.4], face: Math.PI, pose: 'crouch', reach: [2.8, -1.3, 0.35] },
      { id: 'indoor', label: tx('Indoor unit', 'الوحدة الداخلية'), pos: [-2.6, 1.6], face: Math.PI, pose: 'reach', reach: [-2.4, 1.3, 0.3] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'cover', name: tx('Outdoor unit cover', 'غطاء الوحدة الخارجية'), explode: [0.6, 1.2, 0.6], stage: 0,
      animate: (g, s) => { const o = child(g, 'cover'); if (o) { o.position.y = THREE.MathUtils.lerp(o.position.y, param(s, 'cover') * 1.6, 0.1); o.visible = o.position.y < 1.5; } },
      render: () => <Cover />,
      hotspot: { position: [0.6, 0.7, 0.3], title: tx('Top and service cover', 'الغطاء العلوي وغطاء الخدمة'), specs: [[tx('Fixing', 'التثبيت'), tx('Screws; isolate first', 'مسامير؛ اعزل الكهرباء أولًا')]] },
    },
    {
      id: 'outdoor', name: tx('Outdoor unit (condenser)', 'الوحدة الخارجية (المكثف)'), explode: [0, -0.4, -0.8], stage: 0.1,
      animate: (g, s) => { const f = child(g, 'fan'); if (f && s.running) f.rotation.z += s.dt * 18; },
      render: () => <Outdoor />,
      hotspot: {
        position: [0.55, -0.1, 0.3], title: tx('Rotary compressor and condenser', 'الضاغط الدوار والمكثف'), specs: [[tx('Refrigerant', 'وسيط التبريد'), 'R32 · A2L · 0.95 kg'], [tx('Capacity', 'القدرة'), '18 000 BTU/h'], [tx('Run capacitor', 'مكثف التشغيل'), '35 + 5 µF']],
        safety: tx('R32 is mildly flammable (A2L). No naked flame or sparks until the system is recovered and purged with nitrogen.', 'وسيط R32 قابل للاشتعال بدرجة خفيفة (A2L). لا لهب ولا شرر حتى يُسترجع الوسيط ويُطهَّر النظام بالنيتروجين.'),
      },
    },
    {
      id: 'indoor', name: tx('Indoor unit', 'الوحدة الداخلية'), explode: [-0.6, 0.6, 0], stage: 0.2,
      animate: (g, s) => glowOf(g, 'ac-display', s.running ? 1 : 0),
      render: () => <Indoor />,
      hotspot: { position: [-2.6, 1.4, 0.05], title: tx('Wall split indoor unit', 'وحدة سبليت داخلية جدارية'), specs: [[tx('Air flow', 'تدفق الهواء'), '850 m³/h'], [tx('Filters', 'المرشحات'), tx('Wash monthly', 'تُغسل شهريًا')]] },
    },
    {
      id: 'manifold', name: tx('Digital manifold and hoses', 'المانيفولد الرقمي والخراطيم'), explode: [0.8, 0.5, 0.6], stage: 0.3,
      animate: (g, s) => {
        const h = child(g, 'hoses-on'); if (h) h.visible = param(s, 'hoses') > 0.5;
        const n = child(g, 'needle'); if (n) n.rotation.z = THREE.MathUtils.lerp(n.rotation.z, 1.2 - param(s, 'pressure') * 2.4, 0.08);
      },
      render: () => <Manifold />,
      hotspot: {
        position: [1.65, -0.05, 0.65], title: tx('Digital manifold', 'مانيفولد رقمي'), specs: [[tx('Reads', 'يقرأ'), tx('Pressures, saturation temperatures, superheat, subcooling', 'الضغوط ودرجات التشبع والتحميص والتبريد الزائد')], [tx('Hoses', 'الخراطيم'), tx('Blue low, red high, yellow service', 'الأزرق منخفض والأحمر عالٍ والأصفر للخدمة')]],
        safety: tx('Liquid refrigerant at −40 °C causes frostbite in seconds. Wear gloves and goggles when you connect or disconnect hoses.', 'وسيط التبريد السائل عند −40 °م يسبب قضمة الصقيع في ثوانٍ. ارتدِ القفازات والنظارة عند توصيل الخراطيم أو فصلها.'),
      },
    },
    {
      id: 'kit', name: tx('Vacuum, recovery and nitrogen', 'التفريغ والاسترجاع والنيتروجين'), explode: [0.8, 0.3, 0.4], stage: 0.4,
      animate: (g, s) => { glowOf(g, 'rec-led', param(s, 'recover') * (0.6 + 0.6 * Math.sin(s.t * 6))); glowOf(g, 'n2-flow', param(s, 'nitrogen') * 1.2); },
      render: () => <Kit />,
      hotspot: {
        position: [2.7, -1.2, 0.4], title: tx('Recovery machine and cylinder', 'ماكينة الاسترجاع والأسطوانة'), specs: [[tx('Cylinder fill', 'ملء الأسطوانة'), tx('80% by weight, never more', '80% بالوزن ولا أكثر أبدًا')], [tx('Law', 'القانون'), tx('Montreal Protocol, Kigali Amendment', 'بروتوكول مونتريال وتعديل كيغالي')]],
        safety: tx('Never vent refrigerant. Recover it into a rated cylinder; never use oxygen or compressed air to pressure-test, only dry nitrogen.', 'لا تطلق وسيط التبريد في الهواء أبدًا. استرجعه في أسطوانة مقننة؛ ولا تستخدم الأكسجين أو الهواء المضغوط لاختبار الضغط، فقط النيتروجين الجاف.'),
      },
    },
  ],
};
