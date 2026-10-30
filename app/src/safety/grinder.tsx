/**
 * Pedestal grinder: sharpen a lathe tool bit. Traps: a wide tool-rest gap
 * (the bit jams and the wheel bursts), the eye shield up and no glasses,
 * gloves, standing in line with the wheel at start-up and grinding on the
 * side of the wheel.
 */
import { benchGrinder } from '../models/benchGrinder';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const WHEEL: V3 = [0.66, 0.0, 0.27];

export const grinderSafety: Scenario = {
  id: 'sim-grinder-toolbit',
  trade: 'cnc',
  model: benchGrinder,
  minutes: 10,
  title: tx('Sharpen a tool bit on the grinder', 'سنّ قلم خراطة على الجلاخة'),
  brief: tx(
    'A high-speed-steel tool bit needs a new edge. The pedestal grinder was last used for a heavy job and has not been checked since. The wheel turns at 2950 rpm: get it right.',
    'قلم خراطة من الصلب السريع يحتاج حافة جديدة. استُخدمت الجلاخة آخر مرة في عمل ثقيل ولم تُفحص بعده. الحجر يدور بسرعة 2950 لفة/دقيقة: نفّذها بشكل صحيح.'),
  task: tx('Check the grinder, sharpen the bit on the fine wheel and switch off, with no incident.', 'افحص الجلاخة وسنّ القلم على الحجر الناعم ثم أطفئها، دون أي حادث.'),
  params: { gap: 1, shield: 0 },
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Grit and steel particles leave the wheel at 35 m/s.', 'حبيبات الحجر والحديد تخرج من الحجر بسرعة 35 م/ث.') },
    { key: 'visor', need: 'optional', why: tx('A face shield over the glasses for heavy grinding.', 'واقي وجه فوق النظارة للتجليخ الثقيل.') },
    { key: 'boots', need: 'required', why: tx('Hot parts and tools get dropped.', 'القطع الساخنة والعدد تسقط.') },
    { key: 'cuffs', need: 'required', why: tx('Sleeves can be caught by the wheel or the spindle end.', 'قد يعلق الكم بالحجر أو بطرف العمود.') },
    { key: 'no-jewellery', need: 'required', why: tx('Rings and watches catch and conduct heat.', 'الخواتم والساعات تعلق وتنقل الحرارة.') },
    { key: 'gloves-nitrile', need: 'forbidden', why: tx('Gloves can be pulled in between the rest and the wheel.', 'قد تُسحب القفازات بين المسند والحجر.') },
    { key: 'earmuffs', need: 'optional', why: tx('Grinding is loud; protect your hearing for long jobs.', 'التجليخ مزعج؛ احمِ سمعك في الأعمال الطويلة.') },
  ],
  actions: [
    {
      id: 'inspect', station: 'side', pose: 'inspect', reach: [0.76, 0.0, 0.1],
      label: tx('Check the wheels and guards (machine off)', 'افحص الأحجار والأغطية (والماكينة مطفأة)'),
      ok: tx('No cracks or chips in the wheels, guards tight, wheel speed rating 35 m/s.', 'لا شروخ ولا كسور في الأحجار، والأغطية مثبتة، وسرعة الحجر المقررة 35 م/ث.'),
    },
    {
      id: 'rest', station: 'grind', pose: 'reach', reach: [0.66, -0.04, 0.36], set: { gap: 0 },
      label: tx('Set the tool rest 2 mm from the wheel', 'اضبط مسند العدة على بعد 2 مم من الحجر'),
      ok: tx('Rest locked 2 mm from the wheel, at centre height.', 'المسند مثبت على بعد 2 مم من الحجر وفي مستوى المركز.'),
    },
    {
      id: 'shield', station: 'grind', pose: 'reach', reach: [0.66, 0.3, 0.2], set: { shield: 1 },
      label: tx('Lower the eye shield', 'أنزل واقي العين'),
      ok: tx('Shield down between your eyes and the wheel.', 'الواقي منخفض بين عينيك والحجر.'),
    },
    {
      id: 'start', station: 'switch', pose: 'reach', reach: [0, -0.5, 0.26], running: true,
      label: tx('Switch on and let it run up to speed', 'شغّل الجلاخة واتركها تصل إلى سرعتها'),
      ok: tx('Standing to one side for the first minute, out of line with the wheels. Running smoothly.', 'وقفت جانبًا في الدقيقة الأولى بعيدًا عن خط الأحجار. تعمل بسلاسة.'),
      hazards: [{
        when: { notDone: ['inspect'] },
        outcome: {
          kind: 'incident', id: 'grind-burst', effect: 'crash', at: WHEEL, toward: 'face', severity: 3,
          title: tx('A cracked wheel burst at start-up', 'انفجر حجر مشروخ عند التشغيل'),
          what: tx('The coarse wheel had a crack from the last heavy job. At full speed it burst; the guard caught most of it, but fragments flew out of the opening.', 'كان في الحجر الخشن شرخ من العمل الثقيل السابق. انفجر عند السرعة الكاملة، وأمسك الغطاء معظمه لكن الشظايا خرجت من الفتحة.'),
          harm: tx('Wheel fragments leave at over 100 km/h. Burst wheels cause fatal head and chest injuries.', 'شظايا الحجر تخرج بأكثر من 100 كم/ساعة. الأحجار المنفجرة تسبب إصابات قاتلة في الرأس والصدر.'),
          rule: tx('Inspect the wheels before every start, ring-test new ones, and stand to one side for the first minute.', 'افحص الأحجار قبل كل تشغيل، واختبر الجديدة بالطرق، وقف جانبًا في الدقيقة الأولى.'),
          ref: 'EN 12413 · abrasive wheels', sign: { kind: 'warning', pic: 'flying' },
        },
      }],
    },
    {
      id: 'grind', station: 'grind', pose: 'operate', reach: [0.66, 0.0, 0.36], needs: ['start'],
      label: tx('Grind the bit on the face of the fine wheel', 'سنّ القلم على وجه الحجر الناعم'),
      ok: tx('Light pressure, moving across the face, dipping the bit in water to keep it cool. Clean 6° clearance.', 'ضغط خفيف مع التحريك على وجه الحجر وتبريد القلم بالماء. زاوية خلوص 6° نظيفة.'),
      hazards: [
        {
          when: { notDone: ['rest'] },
          outcome: {
            kind: 'incident', id: 'grind-jam', effect: 'entangle', at: WHEEL, toward: 'hand', severity: 3,
            title: tx('The bit jammed in the rest gap and pulled the hand in', 'انحشر القلم في فراغ المسند وسحب اليد'),
            what: tx('The rest was 10 mm from the wheel. The bit tipped into the gap, jammed, and the fingers were dragged onto the wheel.', 'كان المسند على بعد 10 مم من الحجر. انقلب القلم في الفراغ وانحشر، وسُحبت الأصابع إلى الحجر.'),
            harm: tx('Jammed work can also crack and burst the wheel. Finger injuries on grinders go down to the bone.', 'القطعة المنحشرة قد تشرخ الحجر وتفجره. إصابات الأصابع على الجلاخة تصل إلى العظم.'),
            rule: tx('Tool rest no more than 2 mm from the wheel. Re-set it as the wheel wears, with the grinder off.', 'المسند على بعد 2 مم كحد أقصى من الحجر. أعد ضبطه مع تآكل الحجر والجلاخة مطفأة.'),
            ref: 'EN 13218', sign: { kind: 'warning', pic: 'rotating' },
          },
        },
        {
          when: { wearing: ['gloves-nitrile'] },
          outcome: {
            kind: 'incident', id: 'grind-glove', effect: 'entangle', at: WHEEL, toward: 'hand', severity: 2,
            title: tx('The glove was snagged by the wheel', 'علق القفاز بالحجر'),
            what: tx('The glove fingertip touched the wheel, was snagged and pulled the hand towards the rest.', 'لمس طرف القفاز الحجر فعلق وسحب اليد نحو المسند.'),
            rule: tx('No gloves at the grinder. Hold small work in a holder or vice-grip pliers.', 'لا قفازات عند الجلاخة. أمسك القطع الصغيرة بحامل أو كماشة.'),
            sign: { kind: 'prohibition', pic: 'noGloves' },
          },
        },
        {
          when: { notWearing: ['glasses'], notDone: ['shield'] },
          outcome: {
            kind: 'incident', id: 'grind-eye', effect: 'chips', at: WHEEL, toward: 'face', severity: 2,
            title: tx('Hot grit went into the eye', 'دخلت حبيبات ساخنة في العين'),
            what: tx('No glasses and the shield was up. A spark of hot steel and grit hit the eye.', 'لا نظارة والواقي مرفوع. أصابت شرارة من الحديد الساخن والحبيبات العين.'),
            harm: tx('Grinding sparks embed in the cornea and leave rust rings that have to be drilled out.', 'شرر التجليخ ينغرس في القرنية ويترك حلقات صدأ يجب إزالتها بالحفر.'),
            rule: tx('Safety glasses always, and the eye shield down as well.', 'نظارة السلامة دائمًا، وواقي العين منخفض أيضًا.'),
            sign: { kind: 'mandatory', pic: 'glasses' },
          },
        },
        {
          when: { notWearing: ['glasses'] },
          outcome: {
            kind: 'blocked', id: 'grind-no-glasses', effect: 'alarm', at: WHEEL,
            title: tx('The trainer stopped you: no safety glasses', 'أوقفك المدرب: لا نظارة سلامة'),
            what: tx('The shield is not enough: sparks come round it and bounce off the bit.', 'الواقي وحده لا يكفي: الشرر يلتف حوله ويرتد عن القلم.'),
            rule: tx('Safety glasses always, and the eye shield down as well.', 'نظارة السلامة دائمًا، وواقي العين منخفض أيضًا.'),
            sign: { kind: 'mandatory', pic: 'glasses' },
          },
        },
      ],
    },
    {
      id: 'side', station: 'side', pose: 'operate', reach: [0.76, 0.0, 0.05], needs: ['start'],
      label: tx('Grind on the side of the wheel to get a flat face', 'سنّ على جانب الحجر للحصول على وجه مستوٍ'),
      detail: tx('It is quicker', 'أسرع'),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'grind-side', effect: 'crash', at: [0.7, 0.0, 0.0], toward: 'face', severity: 3,
          title: tx('The wheel cracked from side loading', 'انشرخ الحجر من الضغط الجانبي'),
          what: tx('Straight wheels are made for grinding on the face only. Side pressure cracked it, and it broke apart.', 'الأحجار المستقيمة مصنوعة للتجليخ على الوجه فقط. شرخه الضغط الجانبي فتفتت.'),
          harm: tx('A wheel that breaks at 2950 rpm throws heavy fragments out of the guard opening.', 'الحجر الذي ينكسر عند 2950 لفة/دقيقة يقذف شظايا ثقيلة من فتحة الغطاء.'),
          rule: tx('Grind on the face of a straight wheel only. Use a cup wheel for side grinding.', 'سنّ على وجه الحجر المستقيم فقط. استخدم حجرًا كأسيًا للتجليخ الجانبي.'),
          ref: 'EN 12413', sign: { kind: 'warning', pic: 'flying' },
        },
      }],
      ok: tx('', ''),
    },
    {
      id: 'stop', station: 'switch', pose: 'reach', reach: [0, -0.5, 0.26], needs: ['grind'], running: false, goal: true,
      label: tx('Switch off and wait for the wheels to stop', 'أطفئ الجلاخة وانتظر حتى تتوقف الأحجار'),
      ok: tx('Off. Wheels ran down for 40 seconds; you did not slow them by hand. Bit sharp and cool.', 'أُطفئت. توقفت الأحجار خلال 40 ثانية ولم تبطئها بيدك. القلم حاد وبارد.'),
    },
  ],
  props: [
    {
      id: 'crack', when: { notDone: ['inspect'] },
      render: () => (
        <mesh position={[-0.7, 0.1, 0.2]} rotation={[0, Math.PI / 2, 0.3]}>
          <planeGeometry args={[0.012, 0.16]} /><meshBasicMaterial color="#1a1a1a" />
        </mesh>
      ),
    },
    {
      id: 'bit', when: { done: ['start'], notDone: ['stop'] },
      render: (v) => v.fx ? null : (
        <mesh position={[0.66, 0.0, 0.33]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[0.03, 0.03, 0.2]} /><meshStandardMaterial color="#d6dbe0" metalness={0.9} roughness={0.25} />
        </mesh>
      ),
    },
  ],
};
