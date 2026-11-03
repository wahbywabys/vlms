/**
 * Office laser multifunction printer on a service cart for Office Equipment
 * Maintenance (OEQ): scanner lid and ADF, toner cartridge with the drum,
 * laser scanner unit, fuser (hot), paper trays, transfer roller and the
 * formatter board. Beside it: a toner vacuum (type-ATEX) and the field
 * service kit. Floor-standing.
 * Lesson params:
 *   front   0..1  front door open
 *   toner   0..1  toner cartridge pulled out
 *   fuser   0..1  fuser hot (glows)
 *   power   0..1  power on (panel and laser)
 *   vacuum  0..1  toner vacuum in use
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Sticker, Tube, child, glowOf, param, tx, type ModelDef } from './kit';

const CASE = '#e9ecef';
const DARK = '#2b2f36';
const FLOOR = -2.0;            // unitsPerM 2.5
const CART = FLOOR + 0.75;     // cart top
const W = 1.25, D = 1.15;      // printer body
const H = 1.05;

const Body = () => (
  <group>
    {/* Service cart */}
    <Box size={[W + 0.4, 0.06, D + 0.3]} position={[0, CART - 0.03, 0]} color="#5b6670" metal={0.5} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.05, 0.72, 0.05]} position={[x! * (W / 2 + 0.15), FLOOR + 0.38, z! * (D / 2 + 0.1)]} color="#3e4650" metal={0.6} />)}
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <Cyl key={`w${x}${z}`} r={0.05} len={0.04} axis="x" position={[x! * (W / 2 + 0.15), FLOOR + 0.05, z! * (D / 2 + 0.1)]} color={COLORS.rubber} />)}
    {/* Printer shell: sides, back, paper trays */}
    {[-1, 1].map((x) => <Box key={x} size={[0.03, H, D]} position={[x * W / 2, CART + H / 2, 0]} color={CASE} rough={0.5} />)}
    <Box size={[W, H, 0.03]} position={[0, CART + H / 2, -D / 2]} color={CASE} rough={0.5} />
    {[0, 1].map((i) => (
      <group key={i} position={[0, CART + 0.12 + i * 0.2, D / 2 - 0.02]}>
        <Box size={[W - 0.06, 0.17, 0.04]} color="#d5d8d6" rough={0.5} />
        <Box size={[0.3, 0.03, 0.02]} position={[0, 0, 0.03]} color={DARK} />
      </group>
    ))}
    {/* Output tray and control panel */}
    <Box size={[W - 0.2, 0.02, 0.6]} position={[0, CART + H - 0.15, 0.1]} color="#d5d8d6" />
    <group position={[0.35, CART + H + 0.05, D / 2 - 0.05]} rotation={[-0.6, 0, 0]}>
      <Box size={[0.42, 0.04, 0.22]} color={DARK} />
      <Box name="panel" size={[0.28, 0.01, 0.16]} position={[-0.04, 0.025, 0]} color="#0c2b3f" emissive="#3ad1ff" glow={0} shadow={false} />
    </group>
    <Plate lines={['WABYS MFP 4045 · 45 ppm', '220–240 V · 1.2 kW']} size={[0.42, 0.08]} position={[-0.3, CART + 0.55, D / 2 + 0.005]} />
    <Grip name="grip-front" at={[0, CART + 0.75, D / 2 + 0.1]} />
  </group>
);

const Scanner = () => (
  <group name="scanner" position={[0, CART + H, -D / 2]}>
    <Box size={[W, 0.12, D]} position={[0, 0.06, D / 2]} color={CASE} rough={0.5} />
    <Box size={[W - 0.15, 0.01, D - 0.2]} position={[0, 0.125, D / 2]} color={COLORS.glass} opacity={0.5} rough={0.05} />
    {/* ADF on the lid */}
    <Box size={[W - 0.1, 0.16, 0.45]} position={[0, 0.2, 0.35]} color="#d5d8d6" rough={0.5} />
  </group>
);

const FrontDoor = () => (
  <group name="front-door" position={[0, CART + 0.45, D / 2]}>
    <Box size={[W - 0.04, 0.5, 0.03]} position={[0, 0.25, 0]} color={CASE} rough={0.5} />
  </group>
);

const Toner = () => (
  <group name="toner" position={[0, CART + 0.72, 0.1]}>
    <Box size={[0.9, 0.18, 0.28]} color={DARK} rough={0.6} />
    <Cyl r={0.05} len={0.86} axis="x" position={[0, -0.09, 0.08]} color="#3a8a4a" metal={0.3} rough={0.2} />
    <Box size={[0.12, 0.05, 0.06]} position={[0, 0.06, 0.16]} color="#1b1d20" />
    <Plate lines={['TONER / DRUM · 25k pages']} size={[0.3, 0.05]} position={[0, 0.0, 0.142]} />
  </group>
);

const Engine = () => (
  <group>
    {/* Laser scanner unit (above the drum) */}
    <Box size={[0.8, 0.08, 0.35]} position={[0, CART + 0.9, -0.15]} color="#5b6670" metal={0.5} />
    <Sticker kind="warning" pic="exclaim" caption="LASER 3B" size={0.09} position={[0.3, CART + 0.945, -0.1]} rotation={[-Math.PI / 2, 0, 0]} />
    <Box name="laser-beam" size={[0.7, 0.004, 0.004]} position={[0, CART + 0.85, 0.02]} color="#ff2020" emissive="#ff2020" glow={0} shadow={false} />
    {/* Transfer roller and paper path */}
    <Cyl r={0.035} len={0.9} axis="x" position={[0, CART + 0.55, 0.22]} color={COLORS.rubber} />
    <Tube points={[[0, CART + 0.25, 0.4], [0, CART + 0.45, 0.4], [0, CART + 0.55, 0.3], [0, CART + 0.65, -0.3], [0, CART + 0.88, -0.4]]} r={0.006} color="#f7f7f2" />
    {/* Formatter board at the back */}
    <Box size={[0.03, 0.45, 0.6]} position={[W / 2 - 0.08, CART + 0.55, -0.2]} color="#1f6f43" />
    <Box name="formatter-led" size={[0.02, 0.03, 0.03]} position={[W / 2 - 0.1, CART + 0.72, -0.05]} color="#103a12" emissive="#2fff80" glow={0} shadow={false} />
    {/* Power supply box with HV warning */}
    <Box size={[0.3, 0.2, 0.3]} position={[-W / 2 + 0.2, CART + 0.2, -0.3]} color="#3e4650" metal={0.5} />
    <Sticker kind="warning" pic="electric" size={0.09} position={[-W / 2 + 0.2, CART + 0.2, -0.149]} />
  </group>
);

const Fuser = () => (
  <group position={[0, CART + 0.78, -0.42]}>
    <Box size={[0.98, 0.14, 0.16]} color="#5b6670" metal={0.5} />
    <Cyl name="fuser-roll" r={0.045} len={0.9} axis="x" position={[0, 0, 0.09]} color="#7a3b2b" emissive="#ff6020" glow={0} />
    <Sticker kind="warning" pic="hot" size={0.08} position={[0.35, 0.0, 0.082]} />
  </group>
);

const Vacuum = () => (
  <group position={[-1.6, FLOOR, 0.5]}>
    <Cyl r={0.2} len={0.55} position={[0, 0.3, 0]} color="#2f5f93" metal={0.3} />
    <Box size={[0.32, 0.08, 0.2]} position={[0, 0.62, 0]} color={DARK} />
    <Plate lines={['TONER VAC · ATEX', 'HEPA']} size={[0.2, 0.07]} position={[0, 0.3, 0.205]} />
    <group name="vac-hose">
      <Tube points={[[0, 0.62, 0.1], [0.3, 1.1, 0.4], [1.0, 1.5, 0.55], [1.25, CART - FLOOR + 0.7, 0.45]]} r={0.025} color="#3e4650" rough={0.8} />
    </group>
    {/* Service kit: brush, cloths, spare rollers */}
    <Box size={[0.4, 0.1, 0.25]} position={[0.4, 0.05, 0.25]} color="#c8312b" rough={0.6} />
  </group>
);

export const laserMfp: ModelDef = {
  id: 'laser-mfp',
  title: tx('Laser multifunction printer on a service cart', 'طابعة ليزر متعددة الوظائف على عربة الصيانة'),
  assetTag: 'MFP 4045 · OEQ-01',
  view: { camera: [2.4, 0.8, 3.4], target: [0, -0.6, 0] },
  params: { front: 0, toner: 0, fuser: 0, power: 1, vacuum: 0 },
  runParams: { fuser: 1, power: 1 },
  env: {
    unitsPerM: 2.5, floorY: FLOOR, stand: 'floor', bay: 'oeq',
    stations: [
      { id: 'front', label: tx('In front of the printer', 'أمام الطابعة'), pos: [0, 1.8], face: Math.PI, pose: 'inspect', reach: [0, -0.6, 0.7] },
      { id: 'panel', label: tx('Control panel', 'لوحة التحكم'), pos: [0.5, 1.6], face: Math.PI, pose: 'operate', reach: [0.35, -0.15, 0.55] },
      { id: 'inside', label: tx('Inside the front door', 'داخل الباب الأمامي'), pos: [0.1, 1.5], face: Math.PI, pose: 'reach', reach: [0, -0.5, 0.4] },
      { id: 'back', label: tx('Mains switch and lead', 'مفتاح وسلك الكهرباء'), pos: [1.4, 0.4], face: -Math.PI / 2, pose: 'reach', reach: [0.62, -0.9, -0.4] },
      { id: 'vacuum', label: tx('Toner vacuum', 'مكنسة الحبر'), pos: [-1.5, 1.4], face: Math.PI, pose: 'crouch', reach: [-1.6, -1.4, 0.6] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'scanner', name: tx('Scanner and document feeder', 'الماسح ووحدة تغذية المستندات'), explode: [0, 1.0, -0.2], stage: 0,
      render: () => <Scanner />,
      hotspot: { position: [0, CART + H + 0.3, 0.2], title: tx('Flatbed scanner and ADF', 'ماسح مسطح ووحدة تغذية آلية'), specs: [[tx('ADF', 'التغذية'), tx('100 sheets, duplex', '100 ورقة، وجهان')], [tx('Lamp', 'المصباح'), tx('LED, CIS sensor', 'LED مع حساس CIS')]] },
    },
    {
      id: 'door', name: tx('Front door', 'الباب الأمامي'), explode: [0, 0, 0.9], stage: 0.05,
      animate: (g, s) => { const o = child(g, 'front-door'); if (o) o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, param(s, 'front') * 1.4, 0.12); },
      render: () => <FrontDoor />,
      hotspot: { position: [0, CART + 0.7, D / 2 + 0.05], title: tx('Front door interlock', 'مفتاح أمان الباب الأمامي'), specs: [[tx('Opens', 'عند الفتح'), tx('Cuts laser and HV, not the fuser heat', 'يقطع الليزر والجهد العالي، لا حرارة الفيوزر')]] },
    },
    {
      id: 'toner', name: tx('Toner and drum unit', 'وحدة الحبر والأسطوانة'), explode: [0, 0.2, 1.4], stage: 0.15,
      animate: (g, s) => { const o = child(g, 'toner'); if (o) o.position.z = THREE.MathUtils.lerp(o.position.z, 0.1 + param(s, 'toner') * 0.9, 0.1); },
      render: () => <Toner />,
      hotspot: {
        position: [0, CART + 0.75, 0.3], title: tx('Toner cartridge with OPC drum', 'خرطوشة الحبر مع أسطوانة OPC'), specs: [[tx('Yield', 'العمر'), tx('25 000 pages', '25000 صفحة')], [tx('Drum', 'الأسطوانة'), tx('Light-sensitive: keep it out of the light', 'حساسة للضوء: أبعدها عن الضوء')]],
        safety: tx('Toner is a fine dust: do not blow it out with air and do not use an ordinary vacuum (it can ignite). Use the toner vacuum.', 'الحبر غبار ناعم جدًا: لا تنفخه بالهواء ولا تستخدم مكنسة عادية (قد يشتعل). استخدم مكنسة الحبر.'),
      },
    },
    {
      id: 'engine', name: tx('Laser, transfer roller and formatter', 'الليزر وأسطوانة النقل ولوحة التنسيق'), explode: [0.5, 0.4, -0.3], stage: 0.25,
      animate: (g, s) => {
        const on = param(s, 'power', 1);
        glowOf(g, 'formatter-led', on * 1.2);
        glowOf(g, 'laser-beam', on > 0.5 && param(s, 'front') < 0.5 && s.running ? 1.5 : 0);
      },
      render: () => <Engine />,
      hotspot: {
        position: [0, CART + 0.95, -0.15], title: tx('Laser scanner unit', 'وحدة مسح الليزر'), specs: [[tx('Class', 'الفئة'), tx('3B inside, class 1 when closed', 'فئة 3B بالداخل، فئة 1 والغطاء مغلق')], [tx('HV supply', 'مصدر الجهد العالي'), '−600 V … +1.5 kV']],
        safety: tx('Never defeat the door interlock to watch the laser. A 3B beam damages the eye before you blink.', 'لا تعطّل مفتاح أمان الباب لمشاهدة الليزر. شعاع فئة 3B يتلف العين قبل أن ترمش.'),
      },
    },
    {
      id: 'fuser', name: tx('Fuser unit', 'وحدة التثبيت (الفيوزر)'), explode: [0, 0.5, -0.9], stage: 0.35,
      animate: (g, s) => { glowOf(g, 'fuser-roll', param(s, 'fuser') * 0.9); const r = child(g, 'fuser-roll'); if (r && s.running) r.rotation.x += s.dt * 4; },
      render: () => <Fuser />,
      hotspot: {
        position: [0, CART + 0.85, -0.42], title: tx('Fuser: heat roller and pressure roller', 'الفيوزر: أسطوانة التسخين والضغط'), specs: [[tx('Temperature', 'الحرارة'), '180–200 °C'], [tx('Cool-down', 'التبريد'), tx('At least 20 minutes', '20 دقيقة على الأقل')]],
        safety: tx('Switch off and let the fuser cool before clearing a jam behind it. It burns at 200 °C.', 'أطفئ الطابعة واترك الفيوزر يبرد قبل إزالة ورقة عالقة خلفه. يحرق عند 200 درجة.'),
      },
    },
    {
      id: 'vacuum', name: tx('Toner vacuum and service kit', 'مكنسة الحبر وحقيبة الصيانة'), explode: [-0.6, 0.2, 0.4], stage: 0.45,
      animate: (g, s) => { const h = child(g, 'vac-hose'); if (h) h.visible = param(s, 'vacuum') > 0.5; },
      render: () => <Vacuum />,
      hotspot: { position: [-1.6, FLOOR + 0.6, 0.5], title: tx('Toner vacuum', 'مكنسة الحبر'), specs: [[tx('Filter', 'المرشح'), 'HEPA'], [tx('Motor', 'المحرك'), tx('Spark-free, grounded hose', 'بلا شرر، خرطوم مؤرض')]] },
    },
    { id: 'body', name: tx('Body, trays and cart', 'الهيكل والأدراج والعربة'), explode: [0, -0.5, 0], stage: 0.6, render: () => <Body />,
      animate: (g, s) => glowOf(g, 'panel', param(s, 'power', 1) * 0.8) },
  ],
};
