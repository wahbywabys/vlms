/**
 * CNC machining centre: load a part and run a new program. Traps: loading
 * with the spindle still turning, leaving the vice handle on, clearing chips
 * by hand, running a new program at full rapid without single block, and
 * gloves near the rotating cutter.
 */
import { cncMill } from '../models/cncMill';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const CUTTER: V3 = [0, 0.3, 0.05];

export const cncMillSafety: Scenario = {
  id: 'sim-cnc-mill-firstoff',
  trade: 'cnc',
  model: cncMill,
  minutes: 20,
  title: tx('Load a part and run the first-off on the machining centre', 'حمّل قطعة وشغّل أول قطعة على مركز التشغيل'),
  brief: tx(
    'A new program for an aluminium bracket has just been sent to the VMC. The last part is still in the vice, covered in chips, and the spindle is coasting to a stop.',
    'أُرسل للتو برنامج جديد لكتيفة ألومنيوم إلى مركز التشغيل. القطعة السابقة ما زالت في المنجلة مغطاة بالرايش، والعمود يتباطأ حتى يتوقف.'),
  task: tx('Unload, clean, clamp the new blank and prove the program safely on the first part.', 'أخرج القطعة ونظّف وثبّت الخامة الجديدة وجرّب البرنامج بأمان على أول قطعة.'),
  params: { door: 0, z: 0.3, clamp: 1 },
  startRunning: true,
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Chips and coolant spray when the door opens.', 'الرايش وسائل التبريد يتطايران عند فتح الباب.') },
    { key: 'boots', need: 'required', why: tx('Vices and blanks are heavy.', 'المناجل والخامات ثقيلة.') },
    { key: 'cuffs', need: 'required', why: tx('Sleeves near a spindle get wound in.', 'الأكمام قرب العمود تلتف حوله.') },
    { key: 'no-jewellery', need: 'required', why: tx('Rings catch on the vice and the tool.', 'الخواتم تعلق بالمنجلة والعدة.') },
    { key: 'gloves-nitrile', need: 'forbidden', why: tx('Gloves are pulled in by a turning cutter.', 'القفازات تُسحب بالقاطع الدوار.') },
    { key: 'earmuffs', need: 'optional', why: tx('High-speed cutting is loud.', 'القطع عالي السرعة مزعج.') },
  ],
  actions: [
    {
      id: 'stop', station: 'panel', pose: 'operate', reach: [1.55, 0.3, 0.75], running: false, set: { z: 1 },
      label: tx('Wait for the spindle to stop, then home Z', 'انتظر توقف العمود ثم أعد Z لنقطة الأصل'),
      ok: tx('Spindle at 0 rpm, head at Z home, machine in setup mode.', 'العمود على 0 لفة/دقيقة والرأس في نقطة الأصل والماكينة في وضع الضبط.'),
    },
    {
      id: 'open', station: 'door', pose: 'reach', reach: [0.42, 0.4, 0.86], set: { door: 1 },
      label: tx('Open the door', 'افتح الباب'),
      ok: tx('Door open. Interlock holds the spindle off.', 'الباب مفتوح. القفل البيني يمنع دوران العمود.'),
      hazards: [{
        when: { notDone: ['stop'] },
        outcome: {
          kind: 'blocked', id: 'mill-door-locked', effect: 'alarm', at: [0.42, 0.4, 0.86],
          title: tx('The door stayed locked', 'بقي الباب مقفلًا'),
          what: tx('The guard-locking switch keeps the door shut until the spindle has stopped.', 'مفتاح قفل الواقي يبقي الباب مغلقًا حتى يتوقف العمود.'),
          rule: tx('Wait for the spindle to stop. Never force or defeat a door lock.', 'انتظر توقف العمود. لا تفتح قفل الباب بالقوة ولا تعطله أبدًا.'),
          sign: { kind: 'warning', pic: 'rotating' },
        },
      }],
    },
    {
      id: 'chipsHand', station: 'vice', pose: 'reach', reach: [0.0, 0.0, 0.1], needs: ['open'], hideWhen: { done: ['brush'] },
      label: tx('Sweep the chips off the part with your hand', 'أزل الرايش عن القطعة بيدك'),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'mill-chips', effect: 'cut', at: [0, 0.05, 0.05], toward: 'hand', severity: 1,
          title: tx('Cut by aluminium chips', 'جرح من رايش الألومنيوم'),
          what: tx('The long stringy chips were razor sharp and still hot.', 'كان الرايش الطويل حادًا كالشفرة وما زال ساخنًا.'),
          rule: tx('Use a brush, a chip hook or the coolant gun. Never your hands, and never compressed air towards yourself or others.', 'استخدم فرشاة أو خطاف رايش أو مسدس التبريد. ليس بيديك أبدًا، ولا هواء مضغوط نحوك أو نحو الآخرين.'),
          sign: { kind: 'mandatory', pic: 'glasses' },
        },
      }],
      ok: tx('', ''),
    },
    {
      id: 'brush', station: 'vice', pose: 'reach', reach: [0.0, 0.0, 0.1], needs: ['open'],
      label: tx('Clear the chips with a brush and the coolant gun', 'أزل الرايش بالفرشاة ومسدس التبريد'),
      ok: tx('Vice jaws and table clean; no chips under the new part.', 'فكوك المنجلة والطاولة نظيفة ولا رايش تحت القطعة الجديدة.'),
    },
    {
      id: 'load', station: 'vice', pose: 'reach', reach: [0.5, 0.0, 0.1], needs: ['brush'], set: { clamp: 1 },
      label: tx('Unload, put the new blank on parallels and clamp', 'أخرج القطعة وضع الخامة الجديدة على المتوازيات وثبّتها'),
      ok: tx('Blank seated on parallels (tapped down), clamped tight. 12 mm above the jaws.', 'الخامة مستقرة على المتوازيات (بالطرق الخفيف) ومثبتة جيدًا، وبارزة 12 مم فوق الفكوك.'),
    },
    {
      id: 'handle', station: 'vice', pose: 'reach', reach: [0.5, 0.0, 0.1], needs: ['load'],
      label: tx('Take the handle off the vice', 'انزع الذراع من المنجلة'),
      ok: tx('Handle back on its hook outside the machine.', 'الذراع على خطافه خارج الماكينة.'),
    },
    {
      id: 'close', station: 'door', pose: 'reach', reach: [0.42, 0.4, 0.86], needs: ['load'], set: { door: 0 },
      label: tx('Close the door', 'أغلق الباب'),
      ok: tx('Door closed and locked.', 'الباب مغلق ومقفل.'),
    },
    {
      id: 'single', station: 'panel', pose: 'operate', reach: [1.55, 0.3, 0.75], needs: ['close'],
      label: tx('Select single block and set rapid to 25 %', 'اختر الكتلة المفردة واضبط الحركة السريعة على 25٪'),
      ok: tx('Single block on, rapid 25 %, feed override at 50 %; hand on feed hold.', 'الكتلة المفردة مفعلة والحركة السريعة 25٪ والتغذية 50٪، واليد على زر إيقاف التغذية.'),
    },
    {
      id: 'cycle', station: 'panel', pose: 'operate', reach: [1.42, 0.25, 0.8], needs: ['close'], running: true, set: { z: 0.25 }, goal: true,
      label: tx('Press cycle start', 'اضغط بدء الدورة'),
      ok: tx('First block by block: the tool stopped 2 mm above the part as the drawing says. Bracket cut, measured: in tolerance.', 'كتلة بكتلة: توقفت العدة 2 مم فوق القطعة كما في الرسم. قُطعت الكتيفة وقيست: ضمن السماحية.'),
      hazards: [
        {
          when: { notDone: ['handle'] },
          outcome: {
            kind: 'incident', id: 'mill-handle', effect: 'projectile', at: [0.5, 0.0, 0.0], toward: [0.4, 0.5, 0.8], severity: 2,
            title: tx('The vice handle was thrown against the door', 'قُذف ذراع المنجلة نحو الباب'),
            what: tx('The table moved in rapid and the handle left on the vice hit the spindle head and was flung against the window.', 'تحركت الطاولة بالحركة السريعة واصطدم الذراع المتروك على المنجلة برأس العمود وقُذف نحو النافذة.'),
            rule: tx('Nothing loose inside the machine. The vice handle is off before the door closes.', 'لا شيء سائب داخل الماكينة. يُنزع ذراع المنجلة قبل إغلاق الباب.'),
            sign: { kind: 'warning', pic: 'flying' },
          },
        },
        {
          when: { notDone: ['single'] },
          outcome: {
            kind: 'incident', id: 'mill-crash', effect: 'crash', at: CUTTER, severity: 2,
            title: tx('Crash: the tool hit the vice at full rapid', 'تصادم: اصطدمت العدة بالمنجلة بالحركة السريعة الكاملة'),
            what: tx('The work offset was wrong by 50 mm. At 100 % rapid there was no time to press feed hold; the cutter broke and the insert flew.', 'كانت إزاحة المشغولة خاطئة بمقدار 50 مم. بالحركة السريعة 100٪ لم يكن هناك وقت لإيقاف التغذية؛ انكسر القاطع وتطايرت اللقمة.'),
            harm: tx('Crashes wreck spindles worth months of wages and can throw tool fragments through guards.', 'التصادمات تدمر أعمدة تساوي أجر شهور، وقد تقذف شظايا العدد عبر الواقيات.'),
            rule: tx('Prove every new program: graphics check, single block, reduced rapid, hand on feed hold, watch the distance-to-go.', 'جرّب كل برنامج جديد: فحص بالرسوم، وكتلة مفردة، وحركة سريعة مخفضة، واليد على إيقاف التغذية، وراقب المسافة المتبقية.'),
            sign: { kind: 'warning', pic: 'flying' },
          },
        },
      ],
    },
  ],
};
