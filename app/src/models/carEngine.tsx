/**
 * Procedural 1.6 L inline-4 petrol engine with its starting circuit (battery,
 * starter motor, alternator). The crankshaft runs along x; cylinder 1 is at
 * the timing-belt end (−x). In run mode the crank turns, the pistons and rods
 * follow real slider-crank geometry, the camshaft turns at half speed, and
 * each cylinder's spark and combustion glow follow the 1-3-4-2 firing order.
 * Lesson params:
 *   crank 0..1  starter cranking (battery cable and solenoid glow)
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, child, param, Tube, tx, type ModelDef } from './kit';
import type { AnimateState } from '../components/MachineExplorer';

const CY = -0.35;           // crank axis height
const R = 0.13;             // crank throw
const ROD = 0.5;            // con-rod length
const XS = [-0.75, -0.25, 0.25, 0.75];
const PHASE = [0, Math.PI, Math.PI, 0];
/** Crank angle (within the 720° cycle) at which each cylinder fires: order 1-3-4-2. */
const FIRE = [0, 3 * Math.PI, Math.PI, 2 * Math.PI];
const OMEGA = 7;            // rad/s of crank in run mode (slowed down to watch)

const ALU = '#a7adb3';
const HEAD = '#b9bfc4';

const crankAngle = (s: AnimateState) => s.t * OMEGA;
function pistonY(theta: number, phase: number) {
  const a = theta + phase;
  const sy = R * Math.cos(a), sz = R * Math.sin(a);
  return { pinY: CY + sy + Math.sqrt(ROD * ROD - sz * sz), crankY: CY + sy, crankZ: sz };
}
/** 0..1 glow for the power stroke of cylinder i (the 180° after it fires). */
function burn(theta: number, i: number) {
  const a = (((theta - FIRE[i]!) % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
  return a < Math.PI ? Math.sin(a) : 0;
}

const Block = () => (
  <group>
    {/* Skirt and deck, open at the bores so X-ray shows the pistons */}
    <Box size={[2.2, 0.6, 0.12]} position={[0, 0.2, 0.42]} color={ALU} metal={0.6} rough={0.45} />
    <Box size={[2.2, 0.6, 0.12]} position={[0, 0.2, -0.42]} color={ALU} metal={0.6} rough={0.45} />
    <Box size={[0.12, 0.6, 0.96]} position={[-1.04, 0.2, 0]} color={ALU} metal={0.6} rough={0.45} />
    <Box size={[0.12, 0.6, 0.96]} position={[1.04, 0.2, 0]} color={ALU} metal={0.6} rough={0.45} />
    {XS.map((x) => <Cyl key={x} r={0.2} len={0.6} position={[x, 0.2, 0]} open color="#7d848b" metal={0.7} rough={0.3} />)}
    {/* Crankcase */}
    <Box size={[2.2, 0.4, 0.96]} position={[0, -0.3, 0]} color={ALU} metal={0.6} rough={0.45} />
    <Box size={[2.24, 0.04, 1.0]} position={[0, 0.5, 0]} color="#8d949a" metal={0.6} rough={0.4} />
  </group>
);

const Head = () => (
  <group>
    <Box size={[2.2, 0.32, 0.98]} position={[0, 0.68, 0]} color={HEAD} metal={0.6} rough={0.4} />
    {XS.map((x) => [-0.1, 0.1].map((dx) => <Cyl key={`${x}${dx}`} r={0.035} len={0.24} position={[x + dx, 0.66, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />))}
  </group>
);

const ValveCover = () => (
  <group>
    <Box size={[2.05, 0.16, 0.8]} position={[0, 0.92, 0]} color={COLORS.red} metal={0.4} rough={0.35} />
    {[-0.6, 0, 0.6].map((x) => <Box key={x} size={[0.3, 0.03, 0.62]} position={[x + 0.3, 1.01, 0]} color="#a3241f" metal={0.4} rough={0.35} />)}
    {/* Coil packs on each plug */}
    {XS.map((x, i) => (
      <group key={x}>
        <Box size={[0.16, 0.16, 0.16]} position={[x, 1.08, 0]} color={COLORS.black} metal={0.1} rough={0.6} />
        <Cyl name={`spark${i}`} r={0.04} len={0.03} position={[x, 1.18, 0]} color="#3a3f45" emissive="#9fd3ff" glow={0} />
      </group>
    ))}
  </group>
);

const Camshaft = () => (
  <group position={[0, 0.78, 0]}>
    <group name="cam">
      <Cyl r={0.045} len={2.1} axis="x" color={COLORS.steel} metal={0.9} rough={0.2} />
      {XS.map((x) => [-0.1, 0.1].map((dx, k) => (
        <Box key={`${x}${dx}`} size={[0.05, 0.13, 0.08]} position={[x + dx, 0.03, 0]} rotation={[k * Math.PI / 2, 0, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
      )))}
    </group>
  </group>
);

const Pistons = () => (
  <group>
    {XS.map((x, i) => (
      <group key={x}>
        <group name={`piston${i}`} position={[x, 0, 0]}>
          <Cyl r={0.18} len={0.22} position={[0, 0.06, 0]} color="#d6dadd" metal={0.8} rough={0.25} />
          {[0.12, 0.08].map((y) => <Cyl key={y} r={0.183} len={0.015} position={[0, y, 0]} color="#6b7178" metal={0.8} rough={0.3} />)}
          {/* Flame above the crown during the power stroke */}
          <Cyl name={`flame${i}`} r={0.17} len={0.04} position={[0, 0.2, 0]} color="#ff8a1c" emissive="#ff6a00" glow={2} opacity={0} shadow={false} />
        </group>
        <group name={`rod${i}`} position={[x, 0, 0]}>
          <Box size={[0.06, ROD, 0.07]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
        </group>
      </group>
    ))}
  </group>
);

const Crankshaft = () => (
  <group position={[0, CY, 0]}>
    <group name="crank">
      <Cyl r={0.06} len={2.3} axis="x" color={COLORS.steel} metal={0.9} rough={0.25} />
      {XS.map((x, i) => (
        <group key={x} rotation={[PHASE[i]!, 0, 0]}>
          {[-0.09, 0.09].map((dx) => <Box key={dx} size={[0.05, 0.3, 0.18]} position={[x + dx, 0.06, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />)}
          <Cyl r={0.05} len={0.14} axis="x" position={[x, R, 0]} color={COLORS.steel} metal={0.9} rough={0.2} />
          <Box size={[0.16, 0.12, 0.26]} position={[x, -0.1, 0]} color={COLORS.darkSteel} metal={0.8} rough={0.3} />
        </group>
      ))}
      {/* Flywheel with ring gear (the starter's pinion meshes here) */}
      <Cyl r={0.5} len={0.08} axis="x" position={[1.22, 0, 0]} color="#5d646b" metal={0.8} rough={0.35} />
      <Cyl r={0.53} len={0.05} axis="x" position={[1.22, 0, 0]} open color={COLORS.brass} metal={0.8} rough={0.3} />
    </group>
  </group>
);

const OilPan = () => (
  <group>
    <Box size={[1.9, 0.26, 0.86]} position={[0, -0.66, 0]} color={COLORS.black} metal={0.3} rough={0.6} />
    <Cyl r={0.04} len={0.06} axis="z" position={[0.6, -0.72, 0.44]} color={COLORS.steel} metal={0.9} />
  </group>
);

const Intake = () => (
  <group>
    <Box size={[1.6, 0.26, 0.26]} position={[0, 0.9, -0.95]} color={COLORS.black} metal={0.2} rough={0.5} />
    {XS.map((x) => <Tube key={x} points={[[x, 0.68, -0.48], [x, 0.72, -0.7], [x, 0.84, -0.86]]} r={0.07} color="#2a2e33" metal={0.2} rough={0.5} />)}
    <Cyl r={0.12} len={0.25} axis="x" position={[-0.95, 0.9, -0.95]} color={COLORS.black} metal={0.2} rough={0.5} />
  </group>
);

const Exhaust = () => (
  <group>
    {XS.map((x) => <Tube key={x} points={[[x, 0.62, 0.48], [x, 0.55, 0.66], [x * 0.5 + 0.2, 0.25, 0.75], [0.3, 0.0, 0.78]]} r={0.06} color="#8a5a3c" metal={0.7} rough={0.5} />)}
    <Cyl r={0.1} len={0.5} position={[0.3, -0.25, 0.78]} color="#6e4a33" metal={0.7} rough={0.5} />
  </group>
);

const Timing = () => (
  <group position={[-1.18, 0, 0]}>
    <group name="tpulley-crank" position={[0, CY, 0]}><Cyl r={0.13} len={0.08} axis="x" color={COLORS.black} /><Box size={[0.085, 0.24, 0.03]} color={COLORS.yellow} /></group>
    <group name="tpulley-cam" position={[0, 0.78, 0]}><Cyl r={0.24} len={0.08} axis="x" color={COLORS.black} /><Box size={[0.085, 0.46, 0.03]} color={COLORS.yellow} /></group>
    <Box size={[0.06, 1.14, 0.03]} position={[0, 0.215, 0.19]} rotation={[-0.1, 0, 0]} color="#30343a" rough={0.8} metal={0} />
    <Box size={[0.06, 1.14, 0.03]} position={[0, 0.215, -0.19]} rotation={[0.1, 0, 0]} color="#30343a" rough={0.8} metal={0} />
  </group>
);

const Alternator = () => (
  <group position={[-0.9, 0.15, 0.7]}>
    <Cyl r={0.17} len={0.3} axis="x" color={COLORS.alu} metal={0.8} rough={0.3} />
    <Cyl r={0.07} len={0.06} axis="x" position={[-0.18, 0, 0]} color={COLORS.black} />
  </group>
);

const Starter = () => (
  <group position={[0.95, -0.32, -0.66]}>
    <Cyl r={0.13} len={0.42} axis="x" color="#3b4148" metal={0.6} rough={0.4} />
    <Cyl name="solenoid" r={0.07} len={0.32} axis="x" position={[0.02, 0.18, 0]} color={COLORS.steel} metal={0.8} rough={0.3} emissive="#ffb000" glow={0} />
    <Cyl r={0.05} len={0.08} axis="x" position={[0.25, 0, 0]} color={COLORS.brass} metal={0.8} />
  </group>
);

const Battery = () => (
  <group>
    <group position={[2.2, -0.82, 0.3]}>
      <Box size={[0.42, 0.36, 0.62]} color="#1e2329" metal={0.1} rough={0.7} />
      <Box size={[0.43, 0.04, 0.63]} position={[0, 0.17, 0]} color={COLORS.black} />
      <Cyl r={0.035} len={0.06} position={[0, 0.22, 0.2]} color={COLORS.red} metal={0.5} />
      <Cyl r={0.035} len={0.06} position={[0, 0.22, -0.2]} color="#333" metal={0.5} />
      <Box size={[0.3, 0.14, 0.01]} position={[0.215, 0, 0]} rotation={[0, Math.PI / 2, 0]} color={COLORS.orange} shadow={false} />
    </group>
    <group name="cable">
      <Tube points={[[2.2, -0.6, 0.5], [1.9, -0.45, 0.2], [1.5, -0.5, -0.5], [1.12, -0.18, -0.66]]} r={0.022} color={COLORS.red} emissive="#ff3020" />
    </group>
  </group>
);

export const carEngine: ModelDef = {
  id: 'car-engine',
  title: tx('1.6 L petrol engine & starting system', 'محرك بنزين 1.6 لتر ونظام البدء'),
  assetTag: 'AUTO1-ENG-R3',
  view: { camera: [4.4, 2.8, 5.6], target: [0.2, 0.1, 0] },
  params: { crank: 0 },
  parts: [
    {
      id: 'valve_cover', name: tx('Valve cover & ignition coils', 'غطاء الصبابات وملفات الإشعال'), explode: [0, 1.5, 0], stage: 0,
      animate: (g, s) => {
        const th = crankAngle(s);
        for (let i = 0; i < 4; i++) {
          const sp = child(g, `spark${i}`) as THREE.Mesh | undefined;
          const m = sp?.material as THREE.MeshStandardMaterial | undefined;
          if (m) m.emissiveIntensity = s.running && burn(th, i) > 0.85 ? 3 : 0;
        }
      },
      render: () => <ValveCover />,
      hotspot: {
        position: [-0.75, 1.3, 0], title: tx('Coil-on-plug ignition', 'إشعال ملف لكل شمعة'),
        specs: [[tx('Firing order', 'ترتيب الإشعال'), '1 – 3 – 4 – 2'], [tx('Plug gap', 'خلوص الشمعة'), '1.0 mm'], [tx('Plug torque', 'عزم الشمعة'), '25 N·m']],
        safety: tx('Ignition coils carry up to 40 kV. Never touch a coil with the engine running.', 'ملفات الإشعال تصل إلى 40 كيلوفولت. لا تلمس الملف والمحرك يعمل.'),
      },
    },
    {
      id: 'intake', name: tx('Intake manifold', 'مجمّع السحب'), explode: [0, 0.6, -1.4], stage: 0.05,
      render: () => <Intake />,
      hotspot: { position: [0, 1.1, -0.95], title: tx('Intake manifold & throttle', 'مجمّع السحب والخانق'), specs: [[tx('Runners', 'المجاري'), '4 × 42 mm'], [tx('Throttle', 'الخانق'), tx('Electronic, 52 mm', 'إلكتروني 52 مم')]] },
    },
    {
      id: 'exhaust', name: tx('Exhaust manifold', 'مجمّع العادم'), explode: [0, 0.2, 1.4], stage: 0.08,
      render: () => <Exhaust />,
      hotspot: {
        position: [0.3, 0.1, 0.95], title: tx('Exhaust manifold', 'مجمّع العادم'), specs: [[tx('Type', 'النوع'), tx('4-into-1, cast iron', '4 في 1، حديد زهر')], [tx('Gasket', 'الجوان'), 'MLS']],
        safety: tx('Up to 600 °C after running. Let it cool before you work near it.', 'تصل إلى 600 °م بعد التشغيل. اتركه يبرد قبل العمل بالقرب منه.'),
      },
    },
    {
      id: 'timing', name: tx('Timing belt & pulleys', 'سير التوقيت والبكرات'), explode: [-1.3, 0, 0], stage: 0.12,
      animate: (g, s) => {
        const th = crankAngle(s);
        const c = child(g, 'tpulley-crank'); if (c) c.rotation.x = th;
        const k = child(g, 'tpulley-cam'); if (k) k.rotation.x = th / 2;
      },
      render: () => <Timing />,
      hotspot: {
        position: [-1.3, 1.05, 0], title: tx('Timing belt', 'سير التوقيت'),
        specs: [[tx('Ratio', 'النسبة'), tx('2 : 1 crank to cam', '2 : 1 من الكرنك إلى الكامة')], [tx('Change', 'التغيير'), tx('Every 90 000 km', 'كل 90 000 كم')]],
        safety: tx('Turn the engine by hand only, clockwise, with the battery disconnected.', 'أدر المحرك يدويًا فقط في اتجاه عقارب الساعة والبطارية مفصولة.'),
      },
    },
    {
      id: 'alternator', name: tx('Alternator', 'الدينامو (المولد)'), explode: [0, 0.4, 1.1], stage: 0.15,
      render: () => <Alternator />,
      hotspot: { position: [-0.9, 0.42, 0.7], title: tx('Alternator', 'الدينامو'), specs: [[tx('Output', 'الخرج'), '14.4 V, 90 A'], [tx('Charging test', 'اختبار الشحن'), tx('13.8–14.6 V at 2 000 rpm', '13.8–14.6 فولت عند 2 000 لفة')]] },
    },
    {
      id: 'camshaft', name: tx('Camshaft', 'عمود الكامات'), explode: [0, 2.3, 0], stage: 0.22,
      animate: (g, s) => { const c = child(g, 'cam'); if (c) c.rotation.x = crankAngle(s) / 2; },
      render: () => <Camshaft />,
      hotspot: { position: [0.5, 0.95, 0.15], title: tx('Camshaft (SOHC)', 'عمود الكامات (SOHC)'), specs: [[tx('Speed', 'السرعة'), tx('Half crank speed', 'نصف سرعة الكرنك')], [tx('Valves', 'الصبابات'), tx('2 per cylinder', '2 لكل أسطوانة')]] },
    },
    {
      id: 'head', name: tx('Cylinder head', 'رأس الأسطوانات (السلندر)'), explode: [0, 1.75, 0], stage: 0.3,
      render: () => <Head />,
      hotspot: {
        position: [0.9, 0.85, 0.5], title: tx('Cylinder head', 'رأس الأسطوانات'),
        specs: [[tx('Bolts', 'المسامير'), tx('10 × M10, torque-to-yield', '10 × M10، عزم حتى الخضوع')], [tx('Sequence', 'الترتيب'), tx('Spiral from the centre out', 'حلزوني من المنتصف للخارج')]],
      },
    },
    {
      id: 'starter', name: tx('Starter motor & solenoid', 'المارش (البادئ) والسولينويد'), explode: [0.5, -0.4, -1.2], stage: 0.3,
      animate: (g, s) => {
        const so = child(g, 'solenoid') as THREE.Mesh | undefined;
        if (so) (so.material as THREE.MeshStandardMaterial).emissiveIntensity = param(s, 'crank') > 0.5 ? 0.6 + 0.3 * Math.sin(performance.now() / 60) : 0;
      },
      render: () => <Starter />,
      hotspot: {
        position: [0.95, -0.05, -0.75], title: tx('Starter motor', 'المارش'),
        specs: [[tx('Power', 'القدرة'), '1.1 kW'], [tx('Cranking current', 'تيار التدوير'), '150 – 200 A'], [tx('Solenoid', 'السولينويد'), tx('Pull-in 0.4 Ω, hold-in 1.2 Ω', 'سحب 0.4 أوم، إمساك 1.2 أوم')]],
        safety: tx('Disconnect the battery negative before touching the B+ terminal.', 'افصل القطب السالب للبطارية قبل لمس طرف B+.'),
      },
    },
    {
      id: 'battery', name: tx('Battery & main cable', 'البطارية والكابل الرئيسي'), explode: [1.0, 0, 0.6], stage: 0.32,
      animate: (g, s) => {
        const c = child(g, 'cable');
        c?.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissive) m.emissiveIntensity = param(s, 'crank') * (0.4 + 0.3 * Math.sin(performance.now() / 90)); });
      },
      render: () => <Battery />,
      hotspot: {
        position: [2.2, -0.45, 0.3], title: tx('12 V battery', 'بطارية 12 فولت'),
        specs: [[tx('Capacity', 'السعة'), '60 Ah, 540 A CCA'], [tx('Rest voltage', 'جهد السكون'), '12.6 V'], [tx('While cranking', 'أثناء التدوير'), tx('≥ 9.6 V', '≥ 9.6 فولت')]],
        safety: tx('Hydrogen gas: no sparks. Remove the negative first, refit it last.', 'غاز الهيدروجين: لا شرر. افصل السالب أولًا وأعده آخرًا.'),
      },
    },
    {
      id: 'oil_pan', name: tx('Oil pan (sump)', 'حوض الزيت (الكارتير)'), explode: [0, -1.1, 0], stage: 0.4,
      render: () => <OilPan />,
      hotspot: { position: [0.6, -0.72, 0.5], title: tx('Sump & drain plug', 'الكارتير وطبة التصريف'), specs: [[tx('Oil', 'الزيت'), '5W-30, 4.2 L'], [tx('Plug torque', 'عزم الطبة'), '30 N·m']] },
    },
    {
      id: 'pistons', name: tx('Pistons & connecting rods', 'المكابس وأذرع التوصيل'), explode: [0, 2.9, 0], stage: 0.45,
      animate: (g, s) => {
        const th = crankAngle(s);
        for (let i = 0; i < 4; i++) {
          const { pinY, crankY, crankZ } = pistonY(th, PHASE[i]!);
          const p = child(g, `piston${i}`); if (p) p.position.y = pinY;
          const r = child(g, `rod${i}`);
          if (r) { r.position.set(XS[i]!, (pinY + crankY) / 2, crankZ / 2); r.rotation.x = Math.atan2(-crankZ, pinY - crankY); }
          const f = child(g, `flame${i}`) as THREE.Mesh | undefined;
          if (f) { const m = f.material as THREE.MeshStandardMaterial; m.opacity = s.running ? burn(th, i) * 0.85 : 0; }
        }
      },
      render: () => <Pistons />,
      hotspot: {
        position: [-0.75, 0.55, 0.3], title: tx('Piston & rod', 'المكبس وذراع التوصيل'),
        specs: [[tx('Bore × stroke', 'القطر × المشوار'), '79 × 81.5 mm'], [tx('Compression', 'نسبة الانضغاط'), '10.5 : 1'], [tx('Rings', 'الشنابر'), tx('2 compression + 1 oil', '2 انضغاط + 1 زيت')]],
      },
    },
    {
      id: 'crankshaft', name: tx('Crankshaft & flywheel', 'عمود الكرنك والحدافة'), explode: [0, -1.6, 0], stage: 0.5,
      animate: (g, s) => { const c = child(g, 'crank'); if (c) c.rotation.x = crankAngle(s); },
      render: () => <Crankshaft />,
      hotspot: {
        position: [1.22, 0.2, 0.2], title: tx('Crankshaft & flywheel', 'الكرنك والحدافة'),
        specs: [[tx('Main bearings', 'كراسي الارتكاز'), '5'], [tx('Throws', 'الأكواع'), tx('1 & 4 together, 2 & 3 at 180°', '1 و4 معًا، 2 و3 على 180°')], [tx('Ring gear', 'الطارة المسننة'), tx('Starter pinion meshes here', 'يعشّق فيها ترس المارش')]],
      },
    },
    {
      id: 'block', name: tx('Cylinder block', 'كتلة الأسطوانات (البلوك)'), explode: [0, 0, 0],
      render: () => <Block />,
      hotspot: { position: [-1.05, 0.3, 0.45], title: tx('Cylinder block', 'البلوك'), specs: [[tx('Material', 'الخامة'), tx('Aluminium, iron liners', 'ألومنيوم بقمصان حديد')], [tx('Cylinders', 'الأسطوانات'), tx('4 in line, no. 1 at the belt end', '4 على خط، رقم 1 جهة السير')]] },
    },
  ],
};
