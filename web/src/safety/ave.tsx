/**
 * LED TV: no power. Traps: working on the power board with the bulk
 * capacitor charged, putting a scope earth on the hot side without the
 * isolation transformer, and powering a repair straight from the wall.
 */
import { tx } from '../models/kit';
import { tvBench } from '../models/tvBench';
import type { Scenario } from './types';

type V3 = [number, number, number];
const PSU: V3 = [-0.3, 0.12, 0.3];

export const aveSafety: Scenario = {
  id: 'sim-ave-no-power',
  trade: 'ave',
  model: tvBench,
  minutes: 50,
  title: tx('Repair an LED TV that will not switch on', 'أصلح شاشة LED لا تعمل'),
  brief: tx(
    'A 55" LED TV is dead: no standby light. The customer says it went off with a pop. It is face-down on the mat, plugged in, back cover still on.',
    'شاشة LED مقاس 55 بوصة لا تعمل: لا ضوء استعداد. يقول العميل إنها انطفأت مع فرقعة. هي على وجهها فوق السطح، موصلة، والغطاء الخلفي ما زال مركبًا.'),
  task: tx('Find and fix the power supply fault and bring the set up safely.', 'حدد عطل لوحة التغذية وأصلحه وشغّل الجهاز بأمان.'),
  params: { back: 0, power: 1, iso: 0, cap: 1, leds: 0 },
  startRunning: false,
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Capacitors and MOSFETs can burst when a set is first powered after a repair.', 'المكثفات والترانزستورات قد تنفجر عند أول تشغيل بعد الإصلاح.') },
    { key: 'no-jewellery', need: 'required', why: tx('A ring across the primary side is 340 V DC through your finger.', 'الخاتم عبر الجانب الابتدائي يعني 340 فولت مستمر عبر إصبعك.') },
  ],
  actions: [
    {
      id: 'unplug', station: 'front', pose: 'inspect', reach: [0.2, 0.1, 0.6], set: { power: 0 }, hideWhen: { done: ['unplug'] },
      label: tx('Unplug the TV', 'افصل قابس الشاشة'),
      ok: tx('Unplugged. The plug is on the bench in front of you.', 'فُصل القابس، وهو على الطاولة أمامك.'),
    },
    {
      id: 'back', station: 'front', pose: 'inspect', reach: [0.2, 0.1, 0.6], set: { back: 1 }, hideWhen: { done: ['back'] },
      label: tx('Take the back cover off', 'فك الغطاء الخلفي'),
      ok: tx('14 screws out, cover lifted off. The fuse on the power board is black.', 'فُك 14 مسمارًا ورُفع الغطاء. فيوز لوحة التغذية أسود.'),
    },
    {
      id: 'discharge', station: 'psu', pose: 'reach', reach: PSU, needs: ['back'], set: { cap: 0 },
      label: tx('Measure the bulk capacitor and discharge it', 'قِس المكثف الرئيسي وفرّغه'),
      ok: tx('Meter reads 318 V DC, two minutes after unplugging. 2 kΩ discharge tool for ten seconds: 0.4 V.', 'يقرأ الجهاز 318 فولت مستمر بعد دقيقتين من الفصل. أداة التفريغ 2 كيلو أوم لعشر ثوانٍ: 0.4 فولت.'),
      hazards: [{
        when: { notDone: ['unplug'] },
        outcome: {
          kind: 'incident', id: 'ave-live', effect: 'shock', at: PSU, toward: 'hand', severity: 3,
          title: tx('The set was still plugged in', 'كانت الشاشة ما زالت موصلة'),
          what: tx('With mains on, the primary side of the power board is live at mains and 340 V DC. Your probe slipped and your knuckle touched the heatsink.', 'مع وجود الكهرباء يكون الجانب الابتدائي مكهربًا بجهد الشبكة و340 فولت مستمر. انزلق طرف القياس ولمس مفصل إصبعك المشتت الحراري.'),
          rule: tx('Unplug before the back comes off.', 'افصل القابس قبل فك الغطاء الخلفي.'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'repair', station: 'psu', pose: 'reach', reach: PSU, needs: ['back'],
      label: tx('Replace the fuse, the shorted MOSFET and the bridge', 'استبدل الفيوز والترانزستور المقصور والقنطرة'),
      ok: tx('MOSFET shorted D-S, bridge leaky. Both replaced, new 3.15 A T fuse, no other shorts on the primary.', 'الترانزستور مقصور بين المصرف والمنبع والقنطرة مسربة. استُبدلا مع فيوز جديد 3.15 أمبير بطيء، ولا قصر آخر في الابتدائي.'),
      hazards: [{
        when: { notDone: ['discharge'] },
        outcome: {
          kind: 'incident', id: 'ave-cap', effect: 'shock', at: PSU, toward: 'hand', severity: 2,
          title: tx('The bulk capacitor bit you', 'لسعك المكثف الرئيسي'),
          what: tx('Unplugged is not discharged. 318 V DC across your thumb and finger as you lifted the MOSFET. You jerked back and cut your hand on the chassis.', 'الفصل ليس تفريغًا. 318 فولت مستمر بين إبهامك وإصبعك وأنت ترفع الترانزستور. ارتددت فجرحت يدك على الهيكل.'),
          harm: tx('A charged bulk cap delivers a painful, sometimes dangerous, DC shock and the reflex causes the injury.', 'المكثف المشحون يعطي صدمة مستمرة مؤلمة وأحيانًا خطيرة، ورد الفعل هو ما يسبب الإصابة.'),
          rule: tx('Measure and discharge the bulk capacitor before you touch the primary side.', 'قِس المكثف الرئيسي وفرّغه قبل أن تلمس الجانب الابتدائي.'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'iso', station: 'iso', pose: 'reach', reach: [-1.55, 0.3, -0.2], set: { iso: 1 }, hideWhen: { done: ['iso'] },
      label: tx('Plug the TV into the variac behind the isolation transformer', 'وصّل الشاشة بالفارياك خلف محول العزل'),
      ok: tx('TV on the isolated, variable supply. Variac at zero.', 'الشاشة على مصدر معزول متغير. الفارياك عند الصفر.'),
    },
    {
      id: 'powerup', station: 'psu', pose: 'reach', reach: PSU, needs: ['repair'], set: { power: 1, cap: 1, leds: 1 }, running: true,
      label: tx('Bring it up slowly and check the PWM controller on the scope', 'ارفع الجهد تدريجيًا وافحص متحكم PWM على راسم الموجات'),
      ok: tx('Variac to 230 V over a minute, current flat at 0.4 A. Gate drive clean, 12 V and 24 V rails good, backlight on.', 'رُفع الفارياك إلى 230 فولت خلال دقيقة والتيار ثابت عند 0.4 أمبير. إشارة البوابة نظيفة وخطا 12 و24 فولت سليمان، والإضاءة الخلفية تعمل.'),
      hazards: [{
        when: { notDone: ['iso'] },
        outcome: {
          kind: 'incident', id: 'ave-hot-ground', effect: 'arcflash', at: PSU, toward: 'face', severity: 2,
          title: tx('Scope earth on the hot ground', 'أرضي راسم الموجات على الأرضي الساخن'),
          what: tx('Straight from the wall, the primary "ground" is at mains potential. The scope earth clip shorted it to earth: a flash, the new MOSFET gone again, the earth lead melted.', 'من المقبس مباشرة يكون "أرضي" الابتدائي بجهد الشبكة. قصّر مشبك أرضي راسم الموجات بينه وبين الأرض: وميض وتلف الترانزستور الجديد مرة أخرى وانصهر سلك الأرضي.'),
          rule: tx('Power repaired supplies through an isolation transformer and a variac (or a lamp limiter).', 'غذِّ المصادر المُصلحة عبر محول عزل وفارياك (أو محدد بمصباح).'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'close', station: 'front', pose: 'inspect', reach: [0.2, 0.1, 0.6], needs: ['powerup'], set: { back: 0, leds: 0 }, running: true, goal: true,
      label: tx('Unplug, refit the back cover and soak-test it with a pattern', 'افصل وأعد الغطاء الخلفي واختبرها لمدة بنمط صورة'),
      ok: tx('Cover on, two-hour soak test on the pattern generator, picture and sound good. Ready for the customer.', 'الغطاء مركب واختبار ساعتين بمولد الأنماط، الصورة والصوت سليمان. جاهزة للعميل.'),
    },
  ],
};
