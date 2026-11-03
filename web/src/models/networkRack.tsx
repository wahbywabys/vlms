/**
 * Network rack for Computer Systems & Networks (CSN): a 42U floor rack with a
 * fibre patch panel, a copper patch panel with patch leads, a 24-port PoE
 * switch, a router, a firewall, a 2U server on slide rails and a UPS at the
 * bottom, plus a PC on the assembly bench beside it. Floor-standing.
 * Lesson params:
 *   door     0..1  front glass door open
 *   server   0..1  server pulled out on its rails
 *   power    0..1  rack powered (link LEDs, server fans)
 *   fibre    0..1  a fibre patch lead is unplugged (its laser end exposed)
 *   pc       0..1  PC side panel off (motherboard visible)
 */
import * as THREE from 'three';
import { Box, COLORS, Cyl, Grip, Plate, Sticker, Tube, child, glowOf, param, tx, type ModelDef } from './kit';

const RACK = '#1f2328';
const U = 0.0445 * 2.2;               // one rack unit in model units (unitsPerM 2.2)
const W = 0.6 * 2.2;
const D = 0.8 * 2.2;
const H = 2.0 * 2.2;
const FLOOR = -2.2;
const uy = (n: number) => FLOOR + 0.1 + n * U; // bottom of rack unit n (0-based)

const Frame = () => (
  <group>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => (
      <Box key={`${x}${z}`} size={[0.06, H, 0.06]} position={[x! * (W / 2 - 0.03), FLOOR + H / 2, z! * (D / 2 - 0.03)]} color={RACK} metal={0.5} rough={0.4} />
    ))}
    <Box size={[W, 0.06, D]} position={[0, FLOOR + H - 0.03, 0]} color={RACK} metal={0.5} rough={0.4} />
    <Box size={[W, 0.1, D]} position={[0, FLOOR + 0.05, 0]} color={RACK} metal={0.5} rough={0.4} />
    {[-1, 1].map((x) => <Box key={x} size={[0.02, H - 0.2, D - 0.1]} position={[x * (W / 2 - 0.01), FLOOR + H / 2, 0]} color="#2b3036" metal={0.4} rough={0.5} />)}
    {/* Mounting rails with holes */}
    {[-1, 1].map((x) => <Box key={x} size={[0.04, H - 0.2, 0.02]} position={[x * (W / 2 - 0.1), FLOOR + H / 2, D / 2 - 0.12]} color="#5b6670" metal={0.6} rough={0.3} />)}
    {/* Cable manager on the side */}
    <Box size={[0.08, H - 0.3, 0.1]} position={[W / 2 + 0.05, FLOOR + H / 2, D / 2 - 0.1]} color={RACK} metal={0.4} />
    <Plate lines={['RACK A · 42U', 'Comms room 1']} size={[0.4, 0.1]} position={[0, FLOOR + H - 0.15, D / 2 + 0.005]} />
  </group>
);

const Door = () => (
  <group name="door" position={[-W / 2, 0, D / 2 + 0.02]}>
    <Box size={[W, H - 0.1, 0.02]} position={[W / 2, FLOOR + H / 2, 0]} color={COLORS.glass} opacity={0.25} rough={0.05} />
    <Box size={[0.04, 0.3, 0.04]} position={[W - 0.06, FLOOR + H / 2, 0.03]} color={COLORS.steel} metal={0.8} />
  </group>
);

/** A 1U device face with port blocks and LEDs. */
const Device = ({ n, h = 1, color, ports = 0, label, leds = 'leds' }: { n: number; h?: number; color: string; ports?: number; label: string; leds?: string }) => (
  <group position={[0, uy(n) + (h * U) / 2, D / 2 - 0.25]}>
    <Box size={[W - 0.22, h * U - 0.005, 0.5]} position={[0, 0, -0.25]} color={color} metal={0.4} rough={0.4} />
    {Array.from({ length: ports }, (_, i) => (
      <Box key={i} size={[0.035, 0.03, 0.01]} position={[-0.42 + (i % 12) * 0.045, i < 12 ? 0.018 : -0.018, 0.005]} color="#0e0f11" shadow={false} />
    ))}
    <group name={leds}>{Array.from({ length: Math.min(ports, 12) || 3 }, (_, i) => (
      <Box key={i} size={[0.01, 0.01, 0.005]} position={[-0.42 + i * 0.045, h * U / 2 - 0.012, 0.006]} color="#103a12" emissive="#2fff80" glow={0} shadow={false} />
    ))}</group>
    <Plate lines={[label]} size={[0.16, 0.035]} position={[0.42, 0, 0.003]} />
  </group>
);

/** Patch leads from the copper panel down to the switch. */
const Leads = () => (
  <group>
    {Array.from({ length: 8 }, (_, i) => {
      const x = -0.42 + i * 0.045;
      const c = ['#2f6fd0', '#2f6fd0', '#f2c230', '#2f9e57', '#2f6fd0', '#c8312b', '#2f6fd0', '#f2c230'][i]!;
      return <Tube key={i} points={[[x, uy(30) + U / 2, D / 2 - 0.23], [x + 0.02, uy(29.5), D / 2 - 0.12], [x, uy(28) + U / 2, D / 2 - 0.23]]} r={0.009} color={c} rough={0.7} />;
    })}
  </group>
);

const Server = () => (
  <group name="server">
    <group position={[0, uy(14) + U, D / 2 - 0.25]}>
      <Box size={[W - 0.22, 2 * U - 0.005, 0.7]} position={[0, 0, -0.35]} color="#3e4650" metal={0.4} rough={0.4} />
      {Array.from({ length: 8 }, (_, i) => <Box key={i} size={[0.1, 0.03, 0.01]} position={[-0.38 + i * 0.11, 0.02, 0.003]} color="#8c96a0" metal={0.5} />)}
      <Box name="srv-led" size={[0.02, 0.02, 0.005]} position={[0.46, 0.05, 0.005]} color="#103a12" emissive="#3ad1ff" glow={0} shadow={false} />
      <Plate lines={['SRV-01 · 2U']} size={[0.14, 0.03]} position={[0.4, -0.04, 0.004]} />
      {/* Inside: fans, CPU heatsinks, DIMMs (seen when pulled out) */}
      <group position={[0, 0.06, -0.38]}>
        <group name="fans">{[-0.36, -0.18, 0, 0.18, 0.36].map((x) => <Cyl key={x} r={0.05} len={0.03} axis="z" position={[x, 0, 0]} color="#22262b" />)}</group>
        {[-0.18, 0.18].map((x) => <Box key={x} size={[0.16, 0.05, 0.16]} position={[x, 0.0, -0.2]} color={COLORS.alu} metal={0.7} />)}
        {Array.from({ length: 8 }, (_, i) => <Box key={i} size={[0.012, 0.04, 0.14]} position={[-0.42 + i * 0.03 + (i > 3 ? 0.66 : 0), 0, -0.2]} color="#1f6f43" />)}
      </group>
    </group>
  </group>
);

const Ups = () => (
  <group>
    <Box size={[W - 0.22, 3 * U, 0.65]} position={[0, uy(1) + 1.5 * U, D / 2 - 0.58]} color="#22262b" metal={0.3} rough={0.5} />
    <Box name="ups-screen" size={[0.14, 0.06, 0.005]} position={[-0.3, uy(1) + 1.8 * U, D / 2 - 0.25]} color="#0c2b3f" emissive="#2fbf6a" glow={0} shadow={false} />
    <Plate lines={['UPS 3 kVA · online', '48 V battery']} size={[0.26, 0.06]} position={[0.2, uy(1) + 1.5 * U, D / 2 - 0.252]} />
    <Sticker kind="warning" pic="electric" size={0.08} position={[0.45, uy(1) + 1.5 * U, D / 2 - 0.252]} />
  </group>
);

/** Fibre patch panel with one lead unplugged: its ferrule points out. */
const Fibre = () => (
  <group>
    <Tube points={[[0.1, uy(36) + U / 2, D / 2 - 0.23], [0.25, uy(35), D / 2 + 0.05], [0.42, uy(33.5), D / 2 + 0.2]]} r={0.006} color="#f2c230" />
    <group name="fibre-end" position={[0.42, uy(33.5), D / 2 + 0.2]}>
      <Cyl r={0.012} len={0.05} axis="z" color="#3ad1ff" />
      <Box name="laser" size={[0.006, 0.006, 0.4]} position={[0, 0, 0.22]} color="#ff2a20" emissive="#ff2a20" glow={0} opacity={0.5} shadow={false} />
    </group>
    <Sticker kind="warning" pic="exclaim" caption="LASER" size={0.08} position={[0.45, uy(36) + U / 2, D / 2 - 0.22]} />
  </group>
);

const Pc = () => (
  <group position={[2.0, 0, 0.3]}>
    {/* Assembly bench */}
    <Box size={[1.6, 0.05, 1.0]} position={[0, -0.6, 0]} color="#c9b48a" rough={0.7} />
    {[[-0.75, -0.45], [0.75, -0.45], [-0.75, 0.45], [0.75, 0.45]].map(([x, z]) => <Box key={`${x}${z}`} size={[0.05, 1.6, 0.05]} position={[x!, -1.4, z!]} color="#5b6670" metal={0.6} />)}
    <Box size={[1.4, 0.008, 0.8]} position={[0, -0.57, 0]} color="#3d6f8f" rough={0.8} />
    {/* Tower on its side, panel off */}
    <group position={[0, -0.35, 0]}>
      <Box size={[0.42, 0.42, 0.9]} color="#2b2f36" metal={0.4} rough={0.4} />
      <group name="pc-panel"><Box size={[0.01, 0.42, 0.9]} position={[0.215, 0, 0]} color="#2b2f36" metal={0.4} /></group>
      <Box size={[0.005, 0.32, 0.6]} position={[0.2, 0.0, 0.05]} color="#1f6f43" shadow={false} />
      <Box size={[0.04, 0.1, 0.1]} position={[0.18, 0.06, 0.1]} color={COLORS.alu} metal={0.7} />
      {[0, 1].map((i) => <Box key={i} size={[0.02, 0.02, 0.18]} position={[0.19, -0.05 - i * 0.03, -0.1]} color="#1f3d7a" />)}
    </group>
    <Grip name="grip-pc" at={[0.25, -0.3, 0.1]} />
  </group>
);

export const networkRack: ModelDef = {
  id: 'network-rack',
  title: tx('Network rack and PC bench', 'خزانة الشبكات وطاولة الحاسب'),
  assetTag: 'RACK-A · CSN-01',
  view: { camera: [3.4, 1.0, 6.8], target: [0.6, -0.5, 0] },
  params: { door: 0, server: 0, power: 1, fibre: 0, pc: 0 },
  runParams: { power: 1 },
  env: {
    unitsPerM: 2.2, floorY: FLOOR, stand: 'floor', bay: 'csn',
    stations: [
      { id: 'front', label: tx('In front of the rack', 'أمام الخزانة'), pos: [0, 2.3], face: Math.PI, pose: 'inspect', reach: [0, -0.3, 0.9] },
      { id: 'rack', label: tx('At the rack', 'عند الخزانة'), pos: [0.2, 1.7], face: Math.PI, pose: 'reach', reach: [0, -0.4, 0.75] },
      { id: 'ups', label: tx('UPS', 'وحدة UPS'), pos: [-0.3, 1.7], face: Math.PI, pose: 'crouch', reach: [-0.3, uy(2), 0.7] },
      { id: 'pc', label: tx('PC bench', 'طاولة الحاسب'), pos: [2.0, 1.6], face: Math.PI, pose: 'reach', reach: [2.25, -0.3, 0.4] },
      { id: 'ppe', label: tx('PPE station', 'محطة الوقاية'), pos: [-4.4, 2.8], face: -Math.PI / 2, pose: 'idle' },
    ],
  },
  parts: [
    {
      id: 'door', name: tx('Rack door', 'باب الخزانة'), explode: [-0.6, 0, 1.4], stage: 0,
      animate: (g, s) => { const o = child(g, 'door'); if (o) o.rotation.y = THREE.MathUtils.lerp(o.rotation.y, -param(s, 'door') * 1.9, 0.12); },
      render: () => <Door />,
      hotspot: { position: [-0.4, -0.2, D / 2 + 0.05], title: tx('Lockable glass door', 'باب زجاجي بقفل'), specs: [[tx('Access', 'الدخول'), tx('Authorised staff only, logged', 'للمخولين فقط مع التسجيل')]] },
    },
    {
      id: 'patch', name: tx('Patch panels and leads', 'لوحات التوزيع وكابلات الربط'), explode: [0, 0.8, 0.6], stage: 0.1,
      render: () => <><Device n={30} color="#2b2f36" ports={24} label="PP-A Cat6A" leds="pp-leds" /><Leads /></>,
      hotspot: { position: [0, uy(30), D / 2], title: tx('Cat 6A copper patch panel', 'لوحة توزيع نحاسية Cat 6A'), specs: [[tx('Wiring', 'التوصيل'), 'T568B'], [tx('Test', 'الاختبار'), tx('Certified to 500 MHz', 'معتمد حتى 500 ميجاهرتز')]] },
    },
    {
      id: 'switch', name: tx('PoE switch', 'سويتش PoE'), explode: [0, 0.5, 0.9], stage: 0.15,
      animate: (g, s) => {
        const on = param(s, 'power', 1);
        child(g, 'sw-leds')?.children.forEach((m, i) => { ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = on * (Math.sin(s.t * (5 + i)) > 0.2 ? 1.2 : 0.2); });
      },
      render: () => <Device n={28} color="#3e4650" ports={24} label="SW-CORE PoE+" leds="sw-leds" />,
      hotspot: { position: [0, uy(28), D / 2], title: tx('24-port managed PoE+ switch', 'سويتش مُدار 24 منفذ PoE+'), specs: [[tx('PoE budget', 'ميزانية PoE'), '370 W'], [tx('VLANs', 'الشبكات الافتراضية'), tx('Staff, students, cameras, guests', 'الموظفون والطلاب والكاميرات والضيوف')]] },
    },
    {
      id: 'router', name: tx('Router and firewall', 'الموجه والجدار الناري'), explode: [0, 0.5, 1.1], stage: 0.2,
      animate: (g, s) => {
        const on = param(s, 'power', 1);
        for (const n of ['rt-leds', 'fw-leds']) child(g, n)?.children.forEach((m, i) => { ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = on * (Math.sin(s.t * (3 + i)) > 0 ? 1 : 0.3); });
      },
      render: () => <><Device n={25} color="#2f5f93" ports={6} label="RTR-EDGE" leds="rt-leds" /><Device n={23} color="#c8312b" ports={6} label="FW-01" leds="fw-leds" /></>,
      hotspot: { position: [0, uy(24.5), D / 2], title: tx('Edge router and firewall', 'موجه الحافة والجدار الناري'), specs: [[tx('Management', 'الإدارة'), tx('SSH only; Telnet off', 'SSH فقط؛ Telnet معطل')], [tx('Rules', 'القواعد'), tx('Deny by default', 'الرفض افتراضيًا')]] },
    },
    {
      id: 'server', name: tx('Server on rails', 'الخادم على القضبان'), explode: [0, 0.2, 1.6], stage: 0.3,
      animate: (g, s) => {
        const o = child(g, 'server');
        if (o) o.position.z = THREE.MathUtils.lerp(o.position.z, param(s, 'server') * 0.75, 0.1);
        glowOf(g, 'srv-led', param(s, 'power', 1) * 1.2);
        const f = child(g, 'fans');
        if (f && param(s, 'power', 1) > 0.5) f.children.forEach((c) => { c.rotation.z += s.dt * 40; });
      },
      render: () => <Server />,
      hotspot: {
        position: [0, uy(15), D / 2], title: tx('2U virtualisation host', 'خادم استضافة افتراضية 2U'), specs: [[tx('Role', 'الدور'), tx('Hypervisor, AD, DHCP, file shares', 'المحاكاة الافتراضية والدليل النشط وDHCP والمجلدات المشتركة')], [tx('Weight', 'الوزن'), '24 kg']],
        safety: tx('A 24 kg server on extended rails can tip a rack that is not bolted down. Pull out one device at a time and lift with two people.', 'خادم بوزن 24 كجم على قضبان ممتدة قد يقلب خزانة غير مثبتة. اسحب جهازًا واحدًا في كل مرة وارفعه بشخصين.'),
      },
    },
    {
      id: 'fibre', name: tx('Fibre patch', 'كابل الألياف الضوئية'), explode: [0.4, 0.6, 0.8], stage: 0.35,
      animate: (g, s) => { const e = child(g, 'fibre-end'); if (e) e.visible = param(s, 'fibre') > 0.5; glowOf(g, 'laser', param(s, 'fibre') * param(s, 'power', 1) * 1.5); },
      render: () => <><Device n={36} color="#2b2f36" ports={12} label="ODF SM LC" leds="odf-leds" /><Fibre /></>,
      hotspot: {
        position: [0.1, uy(36), D / 2], title: tx('Single-mode fibre panel', 'لوحة ألياف أحادية النمط'), specs: [[tx('Connector', 'الموصل'), 'LC/UPC'], [tx('Light', 'الضوء'), tx('1310 nm, invisible', '1310 نانومتر، غير مرئي')]],
        safety: tx('Never look into a fibre end or a port: the laser is invisible and can burn the retina. Cap it and use a power meter.', 'لا تنظر أبدًا في طرف ليف أو منفذ: الليزر غير مرئي وقد يحرق الشبكية. ضع الغطاء واستخدم جهاز قياس القدرة.'),
      },
    },
    {
      id: 'ups', name: tx('UPS', 'وحدة UPS'), explode: [0, -0.4, 1.0], stage: 0.45,
      animate: (g, s) => glowOf(g, 'ups-screen', param(s, 'power', 1) * 0.9),
      render: () => <Ups />,
      hotspot: {
        position: [0, uy(2.5), D / 2], title: tx('Online UPS 3 kVA', 'UPS أونلاين 3 ك.ف.أ'), specs: [[tx('Runtime', 'زمن التشغيل'), tx('12 min at full load', '12 دقيقة عند الحمل الكامل')], [tx('Standard', 'المعيار'), 'IEC 62040']],
        safety: tx('A UPS stays live when the wall socket is off. Its batteries hold enough energy to arc and burn.', 'تبقى وحدة UPS مكهربة حتى لو فُصل المقبس. بطارياتها تحمل طاقة كافية لإحداث قوس وحروق.'),
      },
    },
    {
      id: 'pc', name: tx('PC on the assembly bench', 'الحاسب على طاولة التجميع'), explode: [0.8, 0.4, 0.4], stage: 0.5,
      animate: (g, s) => { const o = child(g, 'pc-panel'); if (o) o.position.x = THREE.MathUtils.lerp(o.position.x, param(s, 'pc') * 0.5, 0.1); },
      render: () => <Pc />,
      hotspot: { position: [2.0, -0.1, 0.3], title: tx('PC under assembly', 'حاسب قيد التجميع'), specs: [[tx('Before opening', 'قبل الفتح'), tx('Shut down, unplug, hold power 5 s, wrist strap on', 'أغلق وافصل القابس واضغط زر التشغيل 5 ثوانٍ وارتدِ السوار')]] },
    },
    { id: 'frame', name: tx('42U rack', 'خزانة 42U'), explode: [0, -0.8, -0.6], stage: 0.7, render: () => <Frame /> },
  ],
};
