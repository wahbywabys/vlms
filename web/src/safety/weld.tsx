/**
 * MIG welding: weld a fillet T-joint. Traps: an unchained gas cylinder,
 * rags and thinner near the bench, no helmet (arc eye), nitrile gloves that
 * melt, no fume extraction, no screens for people passing, and a missing
 * earth clamp.
 */
import { migWelder } from '../models/migWelder';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const ARC: V3 = [0.6, -0.15, 0.09];
const CYL: V3 = [-2.25, 0.3, -0.25];
const CLAMP: V3 = [1.95, -0.22, -0.25];
const FLAM: V3 = [2.55, -1.1, 0.75];

const arcEyeHarm = tx('Arc eye (welder\'s flash) feels like sand in the eyes for one or two days. Repeated exposure damages the retina and causes cataracts.', 'التهاب العين من القوس يشبه الرمل في العينين ليوم أو يومين. التعرض المتكرر يضر الشبكية ويسبب المياه البيضاء.');

export const weldSafety: Scenario = {
  id: 'sim-weld-fillet',
  trade: 'weld',
  model: migWelder,
  minutes: 20,
  title: tx('Weld a fillet T-joint safely', 'لحام وصلة T زاوية بأمان'),
  brief: tx(
    'A T-joint is tacked on the bench, ready for a 150 mm fillet weld with MIG. The bay was left untidy by the last shift. Set up and weld it. Each mistake will happen in front of you; rewind and get it right.',
    'وصلة T مثبتة بنقاط لحام على الطاولة وجاهزة للحام زاوية بطول 150 مم بطريقة MIG. الوردية السابقة تركت الورشة غير مرتبة. جهّز والحم. كل خطأ سيحدث أمامك؛ ارجع وصححه.'),
  task: tx('Set up the station and run the weld with no incident.', 'جهّز محطة اللحام ونفّذ اللحام دون أي حادث.'),
  params: { bead: 0, arc: 0, flow: 0, defects: 0 },
  ppe: [
    { key: 'helmet-welding', need: 'required', why: tx('Auto-darkening helmet, shade 10 to 13 for MIG. The arc burns the eyes in seconds.', 'خوذة ذاتية التعتيم بدرجة 10 إلى 13 للحام MIG. القوس يحرق العين في ثوانٍ.') },
    { key: 'gloves-leather', need: 'required', why: tx('Leather gauntlets stop spatter, heat and UV burns.', 'القفازات الجلدية الطويلة تمنع حروق الرذاذ والحرارة والأشعة.') },
    { key: 'apron', need: 'required', why: tx('Spatter lands on the chest and lap; leather does not catch fire.', 'الرذاذ يسقط على الصدر والفخذين، والجلد لا يشتعل.') },
    { key: 'boots', need: 'required', why: tx('Hot spatter and dropped steel. Trousers over the boot tops.', 'رذاذ ساخن وقطع حديد تسقط. البنطلون فوق رقبة الحذاء.') },
    { key: 'glasses', need: 'required', why: tx('Under the helmet, for chipping and grinding when the helmet is up.', 'تحت الخوذة، للتكسير والتجليخ عندما تُرفع الخوذة.') },
    { key: 'mask', need: 'optional', why: tx('Needed if extraction cannot keep fume away from the breathing zone.', 'تلزم إذا لم يستطع الشفط إبعاد الدخان عن منطقة التنفس.') },
    { key: 'gloves-nitrile', need: 'forbidden', why: tx('Nitrile melts onto the skin under spatter and arc heat.', 'النيتريل يذوب على الجلد تحت الرذاذ وحرارة القوس.') },
  ],
  actions: [
    {
      id: 'chain', station: 'gas', pose: 'reach', reach: [-2.25, 0.4, -0.05],
      label: tx('Chain the gas cylinder to the wall bracket', 'اربط أسطوانة الغاز بالسلسلة في حامل الحائط'),
      ok: tx('Chain at two-thirds height, cylinder upright and secure.', 'السلسلة على ثلثي الارتفاع والأسطوانة قائمة وثابتة.'),
    },
    {
      id: 'gas-on', station: 'gas', pose: 'reach', reach: [-2.25, 0.86, -0.04], set: { flow: 0.6 },
      label: tx('Open the cylinder valve and set 15 L/min', 'افتح صمام الأسطوانة واضبط 15 لتر/دقيقة'),
      ok: tx('Valve opened slowly, standing to the side of the regulator. 15 L/min on the flowmeter.', 'فُتح الصمام ببطء مع الوقوف بجانب المنظم. 15 لتر/دقيقة على المقياس.'),
      hazards: [{
        when: { notDone: ['chain'] },
        outcome: {
          kind: 'incident', id: 'weld-cylinder', effect: 'fall', at: CYL, toward: [-1.2, -1.2, 0.6], severity: 3,
          title: tx('The cylinder fell over', 'سقطت الأسطوانة'),
          what: tx('Turning the valve rocked the unchained cylinder. It fell, hit the floor next to the foot and the regulator snapped off.', 'أدى فتح الصمام إلى اهتزاز الأسطوانة غير المربوطة، فسقطت بجوار القدم وانكسر المنظم.'),
          harm: tx('A full 50 L cylinder weighs about 80 kg and crushes feet. If the valve breaks off, 200 bar turns it into a missile through walls.', 'الأسطوانة المملوءة بسعة 50 لترًا تزن نحو 80 كجم وتهرس القدم. وإذا انكسر الصمام يحولها ضغط 200 بار إلى صاروخ يخترق الجدران.'),
          rule: tx('Chain or strap every cylinder upright before you touch the valve.', 'اربط كل أسطوانة قائمة بسلسلة أو حزام قبل لمس الصمام.'),
          ref: 'Gas cylinder safety', sign: { kind: 'mandatory', pic: 'gas' },
        },
      }],
    },
    {
      id: 'clear', station: 'weld', pose: 'crouch', reach: [2.3, -0.9, 0.6],
      label: tx('Move the rags, the thinner tin and the cardboard away', 'أبعد الخرق وعلبة التنر والكرتون'),
      ok: tx('Flammables moved over 11 m away. Fire extinguisher checked within reach.', 'نُقلت المواد القابلة للاشتعال لأكثر من 11 مترًا، وطفاية الحريق في متناول اليد.'),
    },
    {
      id: 'extract', station: 'weld', pose: 'reach', reach: [1.0, 0.4, 0.3],
      label: tx('Switch on the fume extraction and bring the hood close', 'شغّل شفاط الدخان وقرّب الفوهة'),
      ok: tx('Hood 20 cm from the arc, airflow indicator green.', 'الفوهة على بعد 20 سم من القوس ومؤشر التدفق أخضر.'),
    },
    {
      id: 'screens', station: 'weld', pose: 'reach', reach: [1.8, 0.2, 1.6],
      label: tx('Close the welding screens around the booth', 'أغلق ستائر اللحام حول الكابينة'),
      ok: tx('Screens closed: people walking past are protected from the arc.', 'الستائر مغلقة: المارون محميون من القوس.'),
    },
    {
      id: 'earth', station: 'weld', pose: 'reach', reach: CLAMP,
      label: tx('Clamp the earth (return) lead onto the workpiece', 'ثبّت ماسك الأرضي (الراجع) على قطعة العمل'),
      ok: tx('Return clamp on clean metal, close to the joint.', 'ماسك الراجع على معدن نظيف وقريب من الوصلة.'),
    },
    {
      id: 'weld', station: 'weld', pose: 'weld', reach: ARC, needs: [], set: { bead: 1, arc: 0 }, goal: true,
      label: tx('Lower the helmet and run the weld', 'أنزل الخوذة ونفّذ اللحام'),
      ok: tx('150 mm fillet, 6 mm leg, even ripples, no undercut. Weld left to cool before chipping.', 'لحام زاوية 150 مم وساق 6 مم وتموجات منتظمة دون تآكل حواف. تُرك ليبرد قبل التكسير.'),
      hazards: [
        {
          when: { notDone: ['earth'] },
          outcome: {
            kind: 'blocked', id: 'weld-no-earth', effect: 'alarm', at: ARC,
            title: tx('No arc: the return clamp is not on', 'لا يوجد قوس: ماسك الراجع غير مثبت'),
            what: tx('The wire fed but no arc struck. The welding current had no way back to the machine.', 'خرج السلك لكن القوس لم يشتعل، فتيار اللحام ليس له طريق للعودة إلى الماكينة.'),
            harm: tx('A return clamp on the bench leg or a pipe can send welding current through chains, bearings or other people\'s work.', 'ماسك الراجع على رجل الطاولة أو على ماسورة قد يمرر تيار اللحام عبر السلاسل أو الرولمان أو أعمال الآخرين.'),
            rule: tx('Clamp the return lead onto the workpiece, on clean metal, as close to the weld as you can.', 'ثبّت كابل الراجع على قطعة العمل على معدن نظيف وأقرب ما يمكن للحام.'),
            sign: { kind: 'mandatory', pic: 'exclaim' },
          },
        },
        {
          when: { notWearing: ['helmet-welding'] },
          outcome: {
            kind: 'incident', id: 'weld-arc-eye', effect: 'arceye', at: ARC, toward: 'face', severity: 2,
            title: tx('Arc eye: the arc was watched without a helmet', 'التهاب العين: نُظر إلى القوس دون خوذة'),
            what: tx('The arc struck a few centimetres from the eyes. Everything went white, then blurred.', 'اشتعل القوس على بعد سنتيمترات من العينين. أصبح كل شيء أبيض ثم ضبابيًا.'),
            harm: arcEyeHarm,
            rule: tx('Helmet down before you strike. Shade 10 to 13 for MIG.', 'أنزل الخوذة قبل إشعال القوس. درجة 10 إلى 13 للحام MIG.'),
            ref: 'EN 169 / EN 379', sign: { kind: 'mandatory', pic: 'welding' },
          },
        },
        {
          when: { notDone: ['clear'] },
          outcome: {
            kind: 'incident', id: 'weld-fire', effect: 'fire', at: FLAM, severity: 2,
            title: tx('Spatter set the rags and cardboard on fire', 'الرذاذ أشعل الخرق والكرتون'),
            what: tx('Hot spatter dropped off the bench into the oily rags and the cardboard next to the thinner tin. Flames reached the bench in seconds.', 'سقط الرذاذ الساخن من الطاولة على الخرق الزيتية والكرتون بجوار علبة التنر، ووصلت النيران إلى الطاولة في ثوانٍ.'),
            harm: tx('Hot work is a leading cause of workshop fires. Sparks travel up to 11 m and smoulder for hours.', 'الأعمال الساخنة من أهم أسباب حرائق الورش. الشرر يطير حتى 11 مترًا ويبقى مشتعلًا لساعات.'),
            rule: tx('Clear flammables 11 m from hot work, or cover them with fire blankets. Keep an extinguisher within reach and check the area afterwards.', 'أبعد المواد القابلة للاشتعال 11 مترًا عن العمل الساخن أو غطّها ببطانيات الحريق. أبقِ الطفاية قريبة وافحص المكان بعد العمل.'),
            ref: 'Hot work permit', sign: { kind: 'prohibition', pic: 'noFlame' },
          },
        },
        {
          when: { wearing: ['gloves-nitrile'] },
          outcome: {
            kind: 'incident', id: 'weld-nitrile', effect: 'burn', at: ARC, toward: 'hand', severity: 2,
            title: tx('The nitrile gloves melted onto the hand', 'ذابت قفازات النيتريل على اليد'),
            what: tx('Spatter and the heat of the arc melted holes in the gloves. Molten nitrile stuck to the skin.', 'أذاب الرذاذ وحرارة القوس ثقوبًا في القفازات، والتصق النيتريل المنصهر بالجلد.'),
            harm: tx('Melted synthetics turn a small burn into a deep one.', 'المواد الصناعية الذائبة تحول الحرق البسيط إلى حرق عميق.'),
            rule: tx('Wear leather welding gauntlets. Never synthetic gloves for hot work.', 'ارتدِ قفازات لحام جلدية طويلة، ولا تلبس قفازات صناعية في الأعمال الساخنة.'),
            sign: { kind: 'mandatory', pic: 'gloves' },
          },
        },
        {
          when: { notWearing: ['gloves-leather'] },
          outcome: {
            kind: 'incident', id: 'weld-hands', effect: 'burn', at: ARC, toward: 'hand', severity: 1,
            title: tx('Spatter and UV burned the bare hands', 'الرذاذ والأشعة أحرقا اليدين العاريتين'),
            what: tx('Spatter landed on the bare hand and the arc\'s UV burned the skin like sunburn.', 'سقط الرذاذ على اليد العارية وأحرقت الأشعة فوق البنفسجية الجلد كحروق الشمس.'),
            rule: tx('Leather gauntlets for every weld, however short.', 'قفازات جلدية طويلة لكل لحام مهما كان قصيرًا.'),
            sign: { kind: 'mandatory', pic: 'gloves' },
          },
        },
        {
          when: { notWearing: ['apron'] },
          outcome: {
            kind: 'incident', id: 'weld-apron', effect: 'burn', at: ARC, toward: 'face', severity: 1,
            title: tx('Spatter burned through the coverall', 'الرذاذ أحرق الأفرول'),
            what: tx('A ball of spatter landed in the lap and burned through to the skin.', 'سقطت كرة رذاذ على الفخذ وأحرقت القماش حتى الجلد.'),
            rule: tx('Leather apron or jacket when welding, with no open pockets or turn-ups to catch spatter.', 'مريلة أو جاكيت جلدي عند اللحام، دون جيوب مفتوحة أو ثنيات تلتقط الرذاذ.'),
            sign: { kind: 'mandatory', pic: 'apron' },
          },
        },
        {
          when: { notDone: ['extract'], notWearing: ['mask'] },
          outcome: {
            kind: 'incident', id: 'weld-fume', effect: 'fumes', at: ARC, toward: 'face', severity: 2,
            title: tx('The fume plume went straight into the breathing zone', 'دخان اللحام دخل منطقة التنفس مباشرة'),
            what: tx('With no extraction, the fume rose under the helmet. Headache and a metallic taste followed.', 'بدون شفط صعد الدخان تحت الخوذة، وتبعه صداع وطعم معدني.'),
            harm: tx('All welding fume is classed as a cause of lung cancer. Manganese fume damages the nerves; zinc gives metal fume fever.', 'كل أدخنة اللحام مصنفة كمسبب لسرطان الرئة. دخان المنجنيز يضر الأعصاب والزنك يسبب حمى الأدخنة المعدنية.'),
            rule: tx('Local exhaust ventilation for every weld indoors. Add a respirator if fume still reaches you.', 'شفط موضعي لكل لحام داخل المبنى، وأضف كمامة إذا وصل إليك الدخان.'),
            ref: 'IARC Group 1 · welding fume', sign: { kind: 'mandatory', pic: 'fume' },
          },
        },
        {
          when: { notDone: ['screens'] },
          outcome: {
            kind: 'incident', id: 'weld-bystander', effect: 'arceye', at: ARC, toward: [3.5, 0.6, 3.5], severity: 1,
            title: tx('A classmate walking past got arc eye', 'زميل مار أصيب بالتهاب العين من القوس'),
            what: tx('You were protected, but with the screens open the arc flashed straight at a classmate walking past.', 'كنت محميًا، لكن مع فتح الستائر لمع القوس مباشرة في عين زميل يمر.'),
            harm: arcEyeHarm,
            rule: tx('Close the welding screens before you strike, and warn people nearby: "Covering!"', 'أغلق ستائر اللحام قبل إشعال القوس ونبّه من حولك.'),
            sign: { kind: 'warning', pic: 'welding' },
          },
        },
        {
          when: { notDone: ['gas-on'] },
          outcome: {
            kind: 'blocked', id: 'weld-no-gas', effect: 'alarm', at: ARC,
            title: tx('No shielding gas: the weld is full of holes', 'لا يوجد غاز حماية: اللحام مليء بالثقوب'),
            what: tx('The trainer stopped you after two seconds. Without gas, air gets into the pool: porosity and spatter everywhere.', 'أوقفك المدرب بعد ثانيتين. دون غاز يدخل الهواء إلى الحوض: مسامية ورذاذ في كل مكان.'),
            rule: tx('Open the cylinder and check the flow (12 to 15 L/min) before you weld.', 'افتح الأسطوانة وتحقق من التدفق (12 إلى 15 لتر/دقيقة) قبل اللحام.'),
            sign: { kind: 'mandatory', pic: 'gas' },
          },
        },
      ],
    },
  ],
  props: [
    {
      id: 'flammables', when: { notDone: ['clear'] },
      render: () => (
        <group position={FLAM}>
          <mesh position={[0, 0.0, 0]} castShadow><boxGeometry args={[0.6, 0.35, 0.45]} /><meshStandardMaterial color="#b48a5a" roughness={0.95} /></mesh>
          <mesh position={[-0.5, -0.05, 0.15]} castShadow><cylinderGeometry args={[0.12, 0.12, 0.28, 20]} /><meshStandardMaterial color="#c62b2b" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0.15, 0.2, 0.05]} rotation={[0.2, 0.5, 0]}><boxGeometry args={[0.4, 0.05, 0.3]} /><meshStandardMaterial color="#5b6e3b" roughness={1} /></mesh>
        </group>
      ),
    },
    {
      id: 'chain', when: { done: ['chain'] },
      render: () => (
        <mesh position={[-2.25, 0.25, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.215, 0.012, 6, 28]} /><meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.35} />
        </mesh>
      ),
    },
    {
      id: 'hood', when: { done: ['extract'] },
      render: () => (
        <group>
          <mesh position={[0.9, 0.6, 0.35]} rotation={[0.5, 0, 0]} castShadow><coneGeometry args={[0.2, 0.25, 24, 1, true]} /><meshStandardMaterial color="#e3b500" side={2} roughness={0.5} /></mesh>
          <mesh position={[0.9, 1.25, 0.0]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.07, 0.07, 1.3, 14]} /><meshStandardMaterial color="#555" roughness={0.6} /></mesh>
        </group>
      ),
    },
    {
      id: 'screens', when: { done: ['screens'] },
      render: () => (
        <group>
          {[[-0.6, 3.2, 0.3], [2.6, 3.2, -0.3]].map(([x, z, r], i) => (
            <mesh key={i} position={[x!, -0.15, z!]} rotation={[0, r!, 0]}>
              <planeGeometry args={[2.6, 2.2]} />
              <meshStandardMaterial color="#ff7a10" transparent opacity={0.45} side={2} emissive="#5a1e00" emissiveIntensity={0.3} />
            </mesh>
          ))}
        </group>
      ),
    },
  ],
};
