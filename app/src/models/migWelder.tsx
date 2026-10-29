/**
 * Procedural MIG/MAG welding set: inverter power source, wire feeder with
 * spool and drive rolls, Ar/CO₂ cylinder with flowmeter, torch on a bench and
 * a fillet-welded T-joint. Lesson params:
 *   bead    0..1  how far the fillet weld has been run along the joint
 *   arc     0..1  arc on (torch glow and flicker)
 *   flow    0..1  flowmeter reading (1 = 25 L/min full scale)
 *   defects 0..1  show porosity and undercut on the finished bead
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, child, param, Sphere, Tube, tx, type ModelDef } from './kit';

const BODY = '#1f5aa6';
const X0 = 0.45, X1 = 1.85; // weld start and end along the joint
const torchX = (bead: number) => X0 + (X1 - X0) * bead;

const PowerSource = () => (
  <group>
    <Box size={[1.2, 1.15, 1.0]} position={[-1.3, -0.62, 0]} color={BODY} metal={0.3} rough={0.5} />
    <Box size={[1.0, 0.5, 0.02]} position={[-1.3, -0.4, 0.51]} color="#14181d" />
    <Box size={[0.42, 0.16, 0.02]} position={[-1.45, -0.3, 0.525]} color="#0b2b16" emissive="#33ff88" glow={0.8} />
    {[-1.05, -0.85].map((x) => <Cyl key={x} r={0.06} len={0.05} axis="z" position={[x, -0.32, 0.54]} color="#d9dde1" metal={0.3} />)}
    <Cyl r={0.05} len={0.06} axis="z" position={[-1.55, -0.85, 0.53]} color={COLORS.red} />
    <Cyl r={0.05} len={0.06} axis="z" position={[-1.05, -0.85, 0.53]} color="#222" />
    {[[-1.8, 0.4], [-0.8, 0.4], [-1.8, -0.4], [-0.8, -0.4]].map(([x, z]) => <Cyl key={`${x}${z}`} r={0.07} len={0.06} axis="z" position={[x!, -1.18, z!]} color={COLORS.rubber} />)}
  </group>
);

const Feeder = () => (
  <group>
    {/* Open-fronted case so the spool and rolls show when the cover is off or see-through */}
    <Box size={[1.1, 0.03, 0.9]} position={[-1.3, -0.04, -0.02]} color="#2a2f35" metal={0.3} rough={0.5} />
    <Box size={[1.1, 0.03, 0.9]} position={[-1.3, 0.485, -0.02]} color="#2a2f35" metal={0.3} rough={0.5} />
    <Box size={[1.1, 0.55, 0.03]} position={[-1.3, 0.225, -0.46]} color="#2a2f35" metal={0.3} rough={0.5} />
    {[-1.835, -0.765].map((x) => <Box key={x} size={[0.03, 0.55, 0.9]} position={[x, 0.225, -0.02]} color="#2a2f35" metal={0.3} rough={0.5} />)}
    <group name="spool" position={[-1.48, 0.24, 0.12]}>
      <Cyl r={0.24} len={0.2} axis="z" color="#9aa3ab" metal={0.6} rough={0.4} />
      <Cyl r={0.2} len={0.21} axis="z" color={COLORS.copper} metal={0.8} rough={0.3} />
      <Box size={[0.05, 0.44, 0.22]} color="#6e767e" />
    </group>
    {[0.29, 0.17].map((y, i) => (
      <group key={y} name={`roll${i}`} position={[-0.98, y, 0.2]}>
        <Cyl r={0.055} len={0.05} axis="z" color={COLORS.brass} metal={0.8} rough={0.3} />
        <Box size={[0.012, 0.1, 0.055]} color="#7a6420" />
      </group>
    ))}
    <Tube points={[[-1.3, 0.23, 0.2], [-1.1, 0.23, 0.2], [-0.76, 0.23, 0.2]]} r={0.008} color={COLORS.copper} metal={0.9} />
    <Cyl r={0.06} len={0.08} axis="x" position={[-0.71, 0.23, 0.2]} color={COLORS.brass} metal={0.8} rough={0.3} />
  </group>
);

const FeederCover = () => (
  <group>
    <Box size={[1.08, 0.53, 0.03]} position={[-1.3, 0.225, 0.45]} color="#3a4048" metal={0.3} rough={0.5} opacity={0.9} />
    <Box size={[0.3, 0.06, 0.02]} position={[-1.3, 0.42, 0.47]} color={COLORS.orange} />
  </group>
);

const Gas = () => (
  <group>
    <Cyl r={0.2} len={1.7} position={[-2.25, -0.38, -0.25]} color="#7a7f84" metal={0.4} rough={0.5} />
    <Sphere r={0.2} position={[-2.25, 0.47, -0.25]} color="#3e9a4f" metal={0.3} rough={0.5} />
    <Cyl r={0.05} len={0.12} position={[-2.25, 0.7, -0.25]} color={COLORS.brass} metal={0.8} />
    {/* Regulator and flowmeter, gauge facing the operator */}
    <Box size={[0.16, 0.12, 0.12]} position={[-2.25, 0.8, -0.18]} color={COLORS.brass} metal={0.8} rough={0.3} />
    <group position={[-2.25, 0.86, -0.07]}>
      <Cyl r={0.1} len={0.04} axis="z" color="#f2f2ee" metal={0.1} rough={0.6} />
      <group name="needle"><Box size={[0.012, 0.085, 0.01]} position={[0, 0.04, 0.025]} color={COLORS.red} /></group>
    </group>
    <Tube points={[[-2.2, 0.78, -0.12], [-2.0, 0.6, -0.3], [-1.7, 0.4, -0.45], [-1.5, 0.3, -0.48]]} r={0.018} color="#2e6f3a" />
  </group>
);

const Bench = () => (
  <group>
    <Box size={[2.2, 0.08, 1.0]} position={[1.2, -0.3, 0]} color="#59616a" metal={0.6} rough={0.4} />
    {[[0.2, 0.42], [2.2, 0.42], [0.2, -0.42], [2.2, -0.42]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.08, 0.9, 0.08]} position={[x!, -0.8, z!]} color="#3a4048" />)}
    {/* Earth clamp and return lead to the power source's − socket */}
    <Box size={[0.12, 0.08, 0.1]} position={[1.95, -0.22, -0.25]} color={COLORS.brass} metal={0.8} />
    <Tube points={[[1.95, -0.2, -0.3], [1.6, -0.5, -0.6], [0, -0.9, -0.2], [-1.05, -0.85, 0.6]]} r={0.02} color="#202326" />
  </group>
);

const Joint = () => (
  <group>
    <Box size={[1.5, 0.06, 0.6]} position={[1.15, -0.23, 0]} color="#7d858d" metal={0.7} rough={0.45} />
    <Box size={[1.5, 0.4, 0.06]} position={[1.15, 0, 0]} color="#848c94" metal={0.7} rough={0.45} />
    {/* The fillet bead, scaled along x as the weld is run */}
    <group name="bead" position={[X0, -0.175, 0.055]}>
      <Cyl r={0.045} len={1} axis="x" position={[0.5, 0, 0]} color="#a7946e" metal={0.7} rough={0.35} />
      {Array.from({ length: 28 }, (_, i) => (
        <Cyl key={i} r={0.047} len={0.012} axis="x" position={[(i + 0.5) / 28, 0, 0]} color="#c8b48a" metal={0.7} rough={0.3} />
      ))}
    </group>
    <group name="defects">
      {[0.62, 0.71, 0.93, 1.21, 1.27, 1.55].map((x, i) => <Sphere key={x} r={0.011 + (i % 2) * 0.004} position={[x, -0.15 + (i % 3) * 0.008, 0.088]} color="#0d0d0d" metal={0} rough={1} />)}
      <Box size={[0.38, 0.01, 0.012]} position={[1.4, -0.128, 0.036]} color="#1a1a1a" metal={0} rough={1} />
    </group>
  </group>
);

const Torch = () => (
  <group>
    <group name="gun">
      {/* Built with the tip at the origin, then tilted out from the vertical plate to a 45° work angle, with a slight push angle */}
      <group rotation={[Math.PI / 4, 0, -0.17]}>
        <Cyl r={0.03} r2={0.035} len={0.12} position={[0, 0.06, 0]} color={COLORS.brass} metal={0.8} rough={0.3} />
        <Tube points={[[0, 0.12, 0], [0, 0.3, 0], [0.05, 0.42, 0], [0.18, 0.5, 0]]} r={0.022} color={COLORS.black} />
        <Cyl r={0.045} len={0.34} axis="x" position={[0.34, 0.52, 0]} color="#1e2327" rough={0.7} />
        <Box size={[0.04, 0.06, 0.03]} position={[0.28, 0.47, 0]} color={COLORS.red} />
      </group>
      <Sphere name="arc" r={0.03} color="#cfe8ff" emissive="#bfe3ff" glow={0} opacity={0} />
      <pointLight name="arcLight" color="#b9dcff" intensity={0} distance={3} decay={2} />
    </group>
    <mesh name="cable" castShadow>
      <meshStandardMaterial color={COLORS.black} roughness={0.7} metalness={0.1} />
    </mesh>
  </group>
);

/** Torch cable from the feeder's euro connector to the gun handle, rebuilt as the torch moves. */
function updateCable(g: THREE.Object3D, x: number) {
  const mesh = child(g, 'cable') as THREE.Mesh | undefined;
  if (!mesh || mesh.userData.x === x) return;
  mesh.userData.x = x;
  const end = new THREE.Vector3(x + 0.34, 0.2, 0.46);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.66, 0.23, 0.2), new THREE.Vector3(-0.3, 0.1, 0.55), new THREE.Vector3(0.2, -0.05, 0.75),
    new THREE.Vector3((x + 0.2) / 2 + 0.3, 0.25, 0.7), end,
  ]);
  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.025, 8, false);
}

export const migWelder: ModelDef = {
  id: 'mig-welder',
  title: tx('MIG/MAG welding set · 250 A', 'ماكينة لحام MIG/MAG · ‏250 أمبير'),
  assetTag: 'WELD3-B01 · MIG-250',
  view: { camera: [3.4, 2.2, 5.4], target: [0, -0.1, 0] },
  params: { bead: 1, arc: 0, flow: 0.55, defects: 0 },
  runParams: { bead: 1, arc: 1 },
  parts: [
    {
      id: 'torch', name: tx('MIG torch & cable', 'مسدس اللحام والكابل'), explode: [0.2, 1.2, 0.6], stage: 0,
      animate: (g, s) => {
        const x = torchX(param(s, 'bead'));
        const gun = child(g, 'gun');
        if (gun) gun.position.set(x + 0.01, -0.15, 0.09);
        updateCable(g, Math.round(x * 100) / 100);
        const on = param(s, 'arc') > 0.5;
        const flick = on ? 0.7 + 0.3 * Math.sin(performance.now() / 23) * Math.sin(performance.now() / 61) : 0;
        const l = child(g, 'arcLight') as THREE.PointLight | undefined; if (l) l.intensity = flick * 6;
        const a = child(g, 'arc') as THREE.Mesh | undefined;
        if (a) { const m = a.material as THREE.MeshStandardMaterial; m.opacity = flick; m.emissiveIntensity = flick * 4; }
      },
      render: () => <Torch />,
      hotspot: {
        position: [0.9, 0.45, 0.5], title: tx('MIG torch', 'مسدس MIG'),
        specs: [[tx('Rating', 'التحمل'), '250 A, 60 % duty'], [tx('Contact tip', 'رأس التلامس'), '1.0 mm CuCrZr'], [tx('Stick-out', 'بروز السلك'), '10 – 15 mm'], [tx('Angles', 'الزوايا'), tx('45° work, 10° push', '45° عمل، 10° دفع')]],
        safety: tx('Arc radiation burns eyes and skin in seconds: shade 11+ helmet, FR jacket, gloves, screens closed.', 'إشعاع القوس يحرق العين والجلد في ثوانٍ: خوذة درجة 11 فأكثر، سترة مقاومة للهب، قفازات، والستائر مغلقة.'),
      },
    },
    {
      id: 'feeder_cover', name: tx('Wire-feed cover', 'غطاء وحدة تغذية السلك'), explode: [0, 0.2, 1.1], stage: 0.05,
      render: () => <FeederCover />,
      hotspot: { position: [-1.3, 0.5, 0.48], title: tx('Feeder cover', 'غطاء وحدة التغذية'), specs: [[tx('Open to', 'افتحه لـ'), tx('Change spool, rolls or liner', 'تغيير البكرة أو البكرات أو البطانة')]], safety: tx('Isolate the set first: the drive rolls can trap fingers.', 'افصل الماكينة أولًا: بكرات السحب قد تحتجز الأصابع.') },
    },
    {
      id: 'workpiece', name: tx('T-joint & fillet weld', 'وصلة T ولحام الزاوية'), explode: [0.4, 0.9, 0], stage: 0.1,
      animate: (g, s) => {
        const b = child(g, 'bead');
        const k = param(s, 'bead');
        if (b) { b.scale.x = Math.max(0.0001, k) * (X1 - X0); b.visible = k > 0.005; }
        const d = child(g, 'defects'); if (d) d.visible = param(s, 'defects') > 0.5;
      },
      render: () => <Joint />,
      hotspot: {
        position: [1.4, 0.3, 0.1], title: tx('Fillet weld, PB (2F)', 'لحام زاوية، وضع PB ‏(2F)'),
        specs: [[tx('Plate', 'اللوح'), 'S275, 10 mm'], [tx('Leg length', 'طول الساق'), '6 mm (5.5 – 7.0)'], [tx('Accept', 'القبول'), 'ISO 5817 level C']],
      },
    },
    {
      id: 'feeder', name: tx('Wire feeder, spool & drive rolls', 'وحدة تغذية السلك والبكرة وبكرات السحب'), explode: [0, 1.0, 0], stage: 0.2,
      animate: (g, s) => {
        const feeding = s.running || param(s, 'arc') > 0.5;
        const sp = child(g, 'spool'); if (sp && feeding) sp.rotation.z -= s.dt * 1.2;
        for (const [i, dir] of [[0, 1], [1, -1]] as const) { const r = child(g, `roll${i}`); if (r && feeding) r.rotation.z += dir * s.dt * 6; }
      },
      render: () => <Feeder />,
      hotspot: {
        position: [-0.98, 0.45, 0.25], title: tx('Drive rolls & spool', 'بكرات السحب والبكرة'),
        specs: [[tx('Wire', 'السلك'), 'ER70S-6, Ø1.0 mm, 15 kg'], [tx('Roll groove', 'مجرى البكرة'), tx('1.0 mm V-groove (steel)', 'مجرى V مقاس 1.0 مم (للصلب)')], [tx('Wire speed', 'سرعة السلك'), '7.5 m/min']],
        safety: tx('A groove that does not match the wire causes bird-nesting and erratic feed.', 'المجرى غير المطابق للسلك يسبب تشابك السلك وعدم انتظام التغذية.'),
      },
    },
    {
      id: 'gas', name: tx('Shielding gas & flowmeter', 'غاز الحماية ومقياس التدفق'), explode: [-1.0, 0, -0.6], stage: 0.25,
      animate: (g, s) => {
        const n = child(g, 'needle');
        if (n) n.rotation.z = THREE.MathUtils.lerp(n.rotation.z, 2.2 - param(s, 'flow') * 4.4, 0.08);
      },
      render: () => <Gas />,
      hotspot: {
        position: [-2.25, 1.0, -0.05], title: tx('Ar / CO₂ (M21) and flowmeter', 'غاز Ar / CO₂ ‏(M21) ومقياس التدفق'),
        specs: [[tx('Mix', 'الخليط'), '82 % Ar, 18 % CO₂'], [tx('Flow', 'التدفق'), '12 – 15 L/min'], [tx('Cylinder', 'الأسطوانة'), tx('Chained upright', 'مربوطة بسلسلة قائمة')]],
        safety: tx('Chain the cylinder. Close the valve after work and check the hose for leaks with soapy water.', 'اربط الأسطوانة بسلسلة. أغلق الصمام بعد العمل وافحص الخرطوم بالماء والصابون.'),
      },
    },
    {
      id: 'bench', name: tx('Welding bench & earth clamp', 'طاولة اللحام وماسك الأرضي'), explode: [0.6, -0.6, 0], stage: 0.35,
      render: () => <Bench />,
      hotspot: { position: [1.95, -0.1, -0.25], title: tx('Earth (work) clamp', 'ماسك الأرضي (الشغلة)'), specs: [[tx('Connect to', 'التوصيل بـ'), tx('Clean metal, close to the weld', 'معدن نظيف قريب من اللحام')], [tx('Polarity (MIG)', 'القطبية (MIG)'), tx('Work −, torch + (DCEP)', 'الشغلة −، المسدس + ‏(DCEP)')]] },
    },
    {
      id: 'power', name: tx('Inverter power source', 'مصدر القدرة (إنفرتر)'), explode: [0, 0, 0],
      render: () => <PowerSource />,
      hotspot: {
        position: [-1.3, -0.1, 0.55], title: tx('Power source', 'مصدر القدرة'),
        specs: [[tx('Input', 'الدخل'), '400 V 3~'], [tx('Output', 'الخرج'), '30 – 250 A CV'], [tx('Set for 10 mm fillet', 'الضبط لزاوية 10 مم'), '22.5 V, 7.5 m/min']],
        safety: tx('Isolate at Q1 and close the gas valve before opening the feeder or changing the liner.', 'افصل عند Q1 وأغلق صمام الغاز قبل فتح وحدة التغذية أو تغيير البطانة.'),
      },
    },
  ],
};
