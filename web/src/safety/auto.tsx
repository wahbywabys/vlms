/**
 * Car engine: change the alternator on an engine that has just come off a
 * test run. Traps: the belt with the engine running, the coolant cap on a hot
 * engine, the battery positive before the negative, a ring across the
 * terminals, the live alternator B+ lead and the hot exhaust manifold.
 */
import { carEngine } from '../models/carEngine';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const TANK: V3 = [1.25, 0.95, -0.55];
const ALT: V3 = [-0.9, 0.2, 0.75];
const BELT: V3 = [-1.12, -0.05, 0.45];
const POS: V3 = [2.2, -0.58, 0.5];
const NEG: V3 = [2.2, -0.58, 0.1];

const severeBurn = tx('Burns from coolant at 120 °C and 1.1 bar scald the face and arms: skin grafts, scarring and eye damage.', 'حروق سائل التبريد عند 120 °م و1.1 بار تسلق الوجه والذراعين: ترقيع جلد وتشوهات وإصابات في العين.');

export const autoSafety: Scenario = {
  id: 'sim-auto-alternator',
  trade: 'auto',
  model: carEngine,
  minutes: 45,
  startRunning: true,
  title: tx('Change the alternator on a hot engine', 'تغيير الدينامو على محرك ساخن'),
  brief: tx(
    'The engine on the stand has just finished a test run and is still idling. The battery warning light was on: the alternator has to be replaced. Do the whole job in your order. Every mistake plays out, then you rewind.',
    'المحرك على الحامل انتهى للتو من تجربة تشغيل وما زال يعمل على الوضع الخامل. لمبة البطارية كانت مضاءة: يجب تغيير الدينامو. نفّذ المهمة بالترتيب الذي تختاره. كل خطأ يحدث أمامك ثم ترجع.'),
  task: tx('Remove the faulty alternator, fit the new one and reconnect the battery, with no incident.', 'فك الدينامو التالف وركّب الجديد وأعد توصيل البطارية دون أي حادث.'),
  params: { crank: 0 },
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Battery acid, coolant and brake fluid splash. Springs and clips fly.', 'حمض البطارية وسائل التبريد يتطايران، والنوابض والمشابك تقفز.') },
    { key: 'boots', need: 'required', why: tx('Heavy parts, jacks and oily floors.', 'أجزاء ثقيلة وروافع وأرضيات زيتية.') },
    { key: 'gloves-nitrile', need: 'required', why: tx('Used oil and coolant harm the skin; nitrile keeps them off.', 'الزيت المستعمل وسائل التبريد يضران الجلد، والنيتريل يمنع ملامستهما.') },
    { key: 'no-jewellery', need: 'required', why: tx('A ring across a battery terminal and the body heats red hot in a second.', 'خاتم يلمس طرف البطارية وجسم السيارة يسخن حتى الاحمرار في ثانية.') },
    { key: 'cuffs', need: 'optional', why: tx('Loose sleeves near a running engine can be caught by the belt or fan.', 'الأكمام الفضفاضة قرب محرك يعمل قد يلتقطها السير أو المروحة.') },
    { key: 'earmuffs', need: 'optional', why: tx('Useful with air tools in a busy bay.', 'مفيد مع العدد الهوائية في ورشة مزدحمة.') },
    { key: 'gloves-insulated', need: 'optional', why: tx('Needed only on hybrid and electric high-voltage systems.', 'تلزم فقط في أنظمة الجهد العالي للسيارات الهجينة والكهربائية.') },
  ],
  actions: [
    {
      id: 'stop-engine', station: 'front', pose: 'operate', running: false,
      label: tx('Switch the engine off and take the key out', 'أطفئ المحرك واسحب المفتاح'),
      ok: tx('Engine off, key in your pocket, "Do not start" tag on the stand.', 'المحرك متوقف والمفتاح في جيبك وبطاقة "ممنوع التشغيل" على الحامل.'),
    },
    {
      id: 'cool', station: 'front', pose: 'inspect', reach: [0.2, 0.7, 0.6], needs: ['stop-engine'],
      label: tx('Let it cool, and check the manifold with the IR thermometer', 'اتركه يبرد وافحص المجمّع بالترمومتر الحراري'),
      ok: tx('40 minutes later: manifold 46 °C, coolant 38 °C. Safe to touch.', 'بعد 40 دقيقة: المجمّع 46 °م وسائل التبريد 38 °م. آمن للمس.'),
    },
    {
      id: 'coolant', station: 'front', pose: 'reach', reach: TANK,
      label: tx('Open the coolant cap to check the level', 'افتح غطاء سائل التبريد لفحص المستوى'),
      detail: tx('The trainer asked you to check it as well', 'طلب المدرب فحصه أيضًا'),
      ok: tx('Cap opened slowly with a rag, a quarter turn first: level at MAX.', 'فُتح الغطاء ببطء بقطعة قماش، ربع لفة أولًا: المستوى عند MAX.'),
      hazards: [
        {
          when: { notDone: ['cool'], notWearing: ['glasses'] },
          outcome: {
            kind: 'incident', id: 'auto-steam-eye', effect: 'steam', at: TANK, toward: 'face', severity: 3,
            title: tx('Boiling coolant sprayed into the face', 'اندفع سائل التبريد المغلي إلى الوجه'),
            what: tx('The system was under pressure. When the cap came off, coolant flashed to steam and sprayed over the face and eyes.', 'كانت الدائرة تحت الضغط. عند فتح الغطاء تحوّل السائل إلى بخار واندفع على الوجه والعينين.'),
            harm: severeBurn,
            rule: tx('Never open a hot cooling system. Wait until it is cold, then open slowly with a rag, a quarter turn first.', 'لا تفتح دائرة تبريد ساخنة. انتظر حتى تبرد ثم افتح ببطء بقطعة قماش، ربع لفة أولًا.'),
            ref: 'Hot work on vehicles', sign: { kind: 'warning', pic: 'hot' },
          },
        },
        {
          when: { notDone: ['cool'] },
          outcome: {
            kind: 'incident', id: 'auto-steam', effect: 'steam', at: TANK, toward: 'hand', severity: 2,
            title: tx('Steam scalded the hand and arm', 'البخار سلق اليد والذراع'),
            what: tx('The glasses kept the eyes safe, but the steam burst scalded the hand and forearm.', 'حمت النظارة العينين، لكن البخار سلق اليد والساعد.'),
            harm: severeBurn,
            rule: tx('Never open a hot cooling system. Wait until it is cold, then open slowly with a rag, a quarter turn first.', 'لا تفتح دائرة تبريد ساخنة. انتظر حتى تبرد ثم افتح ببطء بقطعة قماش، ربع لفة أولًا.'),
            sign: { kind: 'warning', pic: 'hot' },
          },
        },
      ],
    },
    {
      id: 'disc-neg', station: 'battery', pose: 'reach', reach: NEG,
      label: tx('Disconnect the battery negative (−) terminal', 'افصل الطرف السالب (−) للبطارية'),
      ok: tx('Negative off first and tucked away from the post. The car body is no longer part of the circuit.', 'السالب فُصل أولًا وأُبعد عن القطب. جسم السيارة لم يعد جزءًا من الدائرة.'),
    },
    {
      id: 'disc-pos', station: 'battery', pose: 'reach', reach: POS, needs: [],
      label: tx('Disconnect the battery positive (+) terminal', 'افصل الطرف الموجب (+) للبطارية'),
      ok: tx('Positive off with an insulated cover over the clamp.', 'فُصل الموجب ووُضع غطاء عازل على الطرف.'),
      hazards: [
        {
          when: { notDone: ['disc-neg'], notWearing: ['no-jewellery'] },
          outcome: {
            kind: 'incident', id: 'auto-ring', effect: 'burn', at: POS, toward: 'hand', severity: 3,
            title: tx('The ring shorted the battery and burned the finger', 'الخاتم قصّر البطارية وأحرق الإصبع'),
            what: tx('The spanner on the positive touched the body, and the ring closed the circuit. Hundreds of amps went through the ring. It glowed red in a second.', 'لمس المفتاح على الموجب جسم السيارة وأغلق الخاتم الدائرة، فمرت مئات الأمبيرات في الخاتم واحمر في ثانية.'),
            harm: tx('Ring burns go to the bone and often end in amputation of the finger.', 'حروق الخاتم تصل إلى العظم وتنتهي غالبًا ببتر الإصبع.'),
            rule: tx('Take off rings and watches. Disconnect the negative first and reconnect it last.', 'اخلع الخواتم والساعات. افصل السالب أولًا وأعد توصيله أخيرًا.'),
            ref: 'Battery safety', sign: { kind: 'prohibition', pic: 'noJewel' },
          },
        },
        {
          when: { notDone: ['disc-neg'] },
          outcome: {
            kind: 'incident', id: 'auto-pos-first', effect: 'spark', at: POS, toward: 'hand', severity: 1,
            title: tx('The spanner shorted the battery to the body', 'المفتاح قصّر البطارية على جسم السيارة'),
            what: tx('With the negative still on, the spanner touched the body: a flash, molten metal and a burnt hand. A battery can also release hydrogen that ignites.', 'والسالب ما زال موصولًا، لمس المفتاح الجسم: وميض ومعدن منصهر وحرق في اليد. وقد تطلق البطارية هيدروجين يشتعل.'),
            harm: tx('Battery explosions blind mechanics every year with acid and plastic.', 'انفجارات البطاريات تُفقد ميكانيكيين بصرهم كل عام بالحمض والبلاستيك.'),
            rule: tx('Negative off first, negative on last.', 'السالب يُفصل أولًا ويوصل أخيرًا.'),
            sign: { kind: 'warning', pic: 'electric' },
          },
        },
      ],
    },
    {
      id: 'belt', station: 'timing', pose: 'reach', reach: BELT,
      label: tx('Release the tensioner and take the drive belt off', 'فك الشداد واخلع سير الملحقات'),
      ok: tx('Tensioner wound back with the bar, belt off. Belt route photographed first.', 'أُرجع الشداد بالعتلة وخُلع السير. صُوّر مسار السير أولًا.'),
      hazards: [{
        when: { notDone: ['stop-engine'] },
        outcome: {
          kind: 'incident', id: 'auto-belt', effect: 'entangle', at: BELT, toward: 'hand', severity: 3,
          title: tx('The hand was pulled into the running belt', 'سُحبت اليد إلى السير الدوار'),
          what: tx('The engine was still running. The fingers went between the belt and the pulley and were dragged round.', 'كان المحرك ما زال يعمل. دخلت الأصابع بين السير والبكرة وسُحبت معها.'),
          harm: tx('Belt and fan injuries crush and cut off fingers in an instant.', 'إصابات السيور والمراوح تهرس الأصابع وتبترها في لحظة.'),
          rule: tx('Engine off and key out before you touch the belt, fan or pulleys. Electric fans can start even with the engine off.', 'أطفئ المحرك واسحب المفتاح قبل لمس السير أو المروحة أو البكرات. المراوح الكهربائية قد تعمل والمحرك متوقف.'),
          sign: { kind: 'warning', pic: 'rotating' },
        },
      }],
    },
    {
      id: 'alt-off', station: 'timing', pose: 'reach', reach: ALT, needs: ['belt'],
      label: tx('Undo the B+ lead and unbolt the alternator', 'فك كابل B+ وفك مسامير الدينامو'),
      ok: tx('B+ nut off, plug unclipped, two bolts out. Old alternator on the bench.', 'فُك صامولة B+ والقابس ومسماران. الدينامو القديم على الطاولة.'),
      hazards: [
        {
          when: { notDone: ['disc-neg'] },
          outcome: {
            kind: 'incident', id: 'auto-bplus', effect: 'spark', at: ALT, toward: 'hand', severity: 2,
            title: tx('The B+ terminal arced to the bracket', 'طرف B+ عمل شرارة على الحامل'),
            what: tx('The B+ lead goes straight to the battery with no fuse on many cars. The spanner touched the bracket: arc, molten metal on the hand and a melted lead.', 'كابل B+ متصل مباشرة بالبطارية دون فيوز في كثير من السيارات. لمس المفتاح الحامل: قوس كهربائي ومعدن منصهر على اليد وكابل ذائب.'),
            harm: tx('Short-circuit arcs burn hands and start engine-bay fires.', 'أقواس القصر تحرق الأيدي وتشعل حرائق في حجرة المحرك.'),
            rule: tx('Disconnect the battery negative before you work on the starter, alternator or any unfused lead.', 'افصل سالب البطارية قبل العمل على المارش أو الدينامو أو أي كابل بلا فيوز.'),
            sign: { kind: 'warning', pic: 'electric' },
          },
        },
        {
          when: { notDone: ['cool'] },
          outcome: {
            kind: 'incident', id: 'auto-manifold', effect: 'burn', at: [0.0, 0.3, 0.78], toward: 'hand', severity: 2,
            title: tx('The forearm touched the exhaust manifold', 'لمس الساعد مجمّع العادم'),
            what: tx('The alternator sits next to the exhaust manifold, still at about 400 °C. Nitrile gloves give no heat protection.', 'الدينامو بجوار مجمّع العادم الذي ما زال عند 400 °م تقريبًا. قفازات النيتريل لا تحمي من الحرارة.'),
            harm: tx('Contact burns from a manifold are deep and slow to heal.', 'حروق ملامسة المجمّع عميقة وبطيئة الشفاء.'),
            rule: tx('Let the engine cool, and check with an IR thermometer before you work near the exhaust.', 'اترك المحرك يبرد، وافحصه بالترمومتر الحراري قبل العمل قرب العادم.'),
            sign: { kind: 'warning', pic: 'hot' },
          },
        },
      ],
    },
    {
      id: 'alt-fit', station: 'timing', pose: 'reach', reach: ALT, needs: ['alt-off'],
      label: tx('Fit the new alternator and refit the belt', 'ركّب الدينامو الجديد وأعد تركيب السير'),
      ok: tx('Bolts to 45 N·m, B+ to 12 N·m, belt on the right route, tensioner released.', 'المسامير بعزم 45 ن·م وB+ بعزم 12 ن·م، والسير على المسار الصحيح.'),
    },
    {
      id: 'reconnect', station: 'battery', pose: 'reach', reach: NEG, needs: ['alt-fit'], goal: true,
      label: tx('Reconnect the battery and test the charge', 'أعد توصيل البطارية واختبر الشحن'),
      ok: tx('Positive on, negative last. Engine started: 14.2 V at the battery. Warning light off.', 'الموجب أولًا والسالب أخيرًا. دار المحرك: 14.2 فولت على البطارية. لمبة التحذير انطفأت.'),
    },
  ],
  props: [
    {
      id: 'tank', render: () => (
        <group position={TANK}>
          <mesh position={[0, -0.12, 0]} castShadow><boxGeometry args={[0.32, 0.26, 0.2]} /><meshPhysicalMaterial color="#f2efe6" roughness={0.35} transmission={0.2} transparent opacity={0.92} /></mesh>
          <mesh position={[0, -0.16, 0.101]}><planeGeometry args={[0.3, 0.12]} /><meshStandardMaterial color="#ff4fa3" emissive="#a0205a" emissiveIntensity={0.25} /></mesh>
          <mesh position={[0, 0.04, 0]} castShadow><cylinderGeometry args={[0.06, 0.06, 0.06, 20]} /><meshStandardMaterial color="#222" roughness={0.6} /></mesh>
        </group>
      ),
    },
    {
      id: 'hot-glow', when: { notDone: ['cool'] },
      render: () => (
        <mesh position={[0.3, -0.25, 0.78]}>
          <cylinderGeometry args={[0.105, 0.105, 0.5, 20]} />
          <meshStandardMaterial color="#ff5a1f" emissive="#ff3a00" emissiveIntensity={0.9} transparent opacity={0.45} toneMapped={false} />
        </mesh>
      ),
    },
    {
      id: 'neg-off', when: { done: ['disc-neg'] },
      render: () => (
        <mesh position={[2.35, -0.48, 0.0]} rotation={[0.4, 0, 0.6]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.3, 10]} /><meshStandardMaterial color="#1b1b1b" roughness={0.6} />
        </mesh>
      ),
    },
  ],
};
