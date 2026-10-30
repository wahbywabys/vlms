/**
 * Pump rig: realign the motor after the vibration alarm. Traps: working on
 * the coupling with only the stop button pressed (no isolation), skipping the
 * try-to-start check, gloves near a turning shaft, running with the coupling
 * guard off and starting against a closed discharge valve.
 */
import { pumpRig } from '../models/pumpRig';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const COUPLING: V3 = [0, 0, 0.15];

export const eimSafety: Scenario = {
  id: 'sim-eim-alignment',
  trade: 'eim',
  model: pumpRig,
  minutes: 45,
  title: tx('Realign the pump after a vibration alarm', 'أعد محاذاة المضخة بعد إنذار الاهتزاز'),
  brief: tx(
    'The condition-monitoring system flagged high vibration at 1× running speed on the cooling-water pump: classic misalignment. The pump is running. Production can spare it for one hour.',
    'رصد نظام مراقبة الحالة اهتزازًا عاليًا عند سرعة الدوران 1× في مضخة مياه التبريد: علامة تقليدية على عدم المحاذاة. المضخة تعمل الآن، ويمكن للإنتاج الاستغناء عنها لمدة ساعة.'),
  task: tx('Isolate the rig, align the shafts with the laser kit to within 0.05 mm, and return it to service.', 'اعزل المنصة وحاذِ العمودين بجهاز الليزر لحدود 0.05 مم، ثم أعدها للخدمة.'),
  params: { guard: 1, offset: 1, laser: 0, isolator: 1 },
  startRunning: true,
  ppe: [
    { key: 'boots', need: 'required', why: tx('Steel toecaps: motor feet, shims and tools are heavy.', 'مقدمة حديدية: أقدام المحرك والرقائق والعدد ثقيلة.') },
    { key: 'glasses', need: 'required', why: tx('Grease, rust and spring clips fly when you work on couplings; class 2 laser too.', 'الشحم والصدأ والمشابك تتطاير عند العمل على الوصلات، وكذلك ليزر الفئة 2.') },
    { key: 'gloves-leather', need: 'optional', why: tx('For handling shims, only when everything is locked off and still.', 'لمسك الرقائق فقط عندما يكون كل شيء معزولًا وساكنًا.') },
    { key: 'earmuffs', need: 'optional', why: tx('The pump room is loud while the pump runs.', 'غرفة المضخات مزعجة أثناء تشغيل المضخة.') },
    { key: 'no-jewellery', need: 'required', why: tx('Rings and watches catch on shafts and keyways.', 'الخواتم والساعات تعلق بالأعمدة ومجاري الخوابير.') },
  ],
  actions: [
    {
      id: 'stop', station: 'isolator', pose: 'reach', reach: [-1.9, 0.86, 0.84], running: false,
      label: tx('Press stop at the local station', 'اضغط زر الإيقاف في المحطة المحلية'),
      ok: tx('The pump runs down and stops. Stopped is not the same as isolated.', 'تتباطأ المضخة وتتوقف. التوقف ليس هو العزل.'),
    },
    {
      id: 'isolate', station: 'isolator', pose: 'reach', reach: [-1.9, 0.86, 0.84], needs: ['stop'], set: { isolator: 0 },
      label: tx('Turn the isolator off and fit your lock and tag', 'أدر مفتاح العزل إلى الإيقاف وركّب قفلك وبطاقتك'),
      ok: tx('Isolator OFF, your padlock on, tag signed with your name and the time.', 'مفتاح العزل على الإيقاف وقفلك عليه، والبطاقة موقعة باسمك والوقت.'),
    },
    {
      id: 'try', station: 'isolator', pose: 'reach', reach: [-1.9, 0.86, 0.84], needs: ['isolate'],
      label: tx('Try to start: press start and check nothing moves', 'جرّب التشغيل: اضغط بدء وتأكد أن لا شيء يتحرك'),
      ok: tx('Nothing. The motor is proven dead. Start switch back to off.', 'لا شيء. ثبت أن المحرك بلا تغذية. أعد زر البدء إلى الإيقاف.'),
    },
    {
      id: 'guard', station: 'coupling', pose: 'crouch', reach: [0, 0.1, 0.3], needs: ['stop'], set: { guard: 0 },
      label: tx('Remove the coupling guard', 'فك غطاء الوصلة'),
      ok: tx('Guard bolts out, guard put aside where nobody will trip on it.', 'فُكت مسامير الغطاء ووُضع جانبًا بعيدًا عن طريق المشي.'),
      hazards: [{
        when: { notDone: ['isolate'] },
        outcome: {
          kind: 'blocked', id: 'eim-not-isolated', effect: 'alarm', at: [-1.9, 0.86, 0.8],
          title: tx('The supervisor stopped you: not isolated', 'أوقفك المشرف: لم تعزل'),
          what: tx('The control room can restart the pump remotely after a stop. You were about to put your hands on the coupling.', 'تستطيع غرفة التحكم إعادة تشغيل المضخة عن بُعد بعد الإيقاف. كنت على وشك وضع يديك على الوصلة.'),
          rule: tx('Stop, isolate, lock, tag and try to start before removing any guard.', 'أوقف واعزل واقفل وعلّق البطاقة وجرّب التشغيل قبل فك أي غطاء.'),
          ref: 'LOTO · OSHA 1910.147', sign: { kind: 'mandatory', pic: 'lockout' },
        },
      }],
    },
    {
      id: 'laser', station: 'coupling', pose: 'crouch', reach: [0, 0.1, 0.3], needs: ['guard'], set: { laser: 1 },
      label: tx('Mount the laser heads and measure', 'ركّب رأسي الليزر وقِس'),
      ok: tx('Readings at 9, 12 and 3 o\'clock: offset 0.42 mm, angle 0.08 mm/100 mm. Soft foot checked: 0.02 mm.', 'القراءات عند الساعة 9 و12 و3: إزاحة 0.42 مم، وزاوية 0.08 مم/100 مم. فُحصت القدم الرخوة: 0.02 مم.'),
      hazards: [{
        when: { notDone: ['try'] },
        outcome: {
          kind: 'incident', id: 'eim-restart', effect: 'entangle', at: COUPLING, toward: 'hand', severity: 3,
          title: tx('The pump was restarted while your hand was on the shaft', 'أُعيد تشغيل المضخة ويدك على العمود'),
          what: tx('You locked the isolator but did not try to start. The isolator was faulty and still connected: the control room restarted the pump on low pressure.', 'قفلت مفتاح العزل لكنك لم تجرب التشغيل. كان المفتاح معيبًا وما زال موصلًا: أعادت غرفة التحكم تشغيل المضخة بسبب انخفاض الضغط.'),
          harm: tx('Rotating shafts and couplings cause amputations and deaths in maintenance every year.', 'الأعمدة والوصلات الدوارة تسبب حالات بتر ووفاة في أعمال الصيانة كل عام.'),
          rule: tx('Always prove isolation with a try-to-start (and a voltage test) before touching the machine.', 'أثبت العزل دائمًا بتجربة التشغيل (واختبار الجهد) قبل لمس الماكينة.'),
          ref: 'LOTO', sign: { kind: 'mandatory', pic: 'lockout' },
        },
      }],
    },
    {
      id: 'shim', station: 'motor', pose: 'crouch', reach: [-1.0, -0.36, 0.3], needs: ['laser'], set: { offset: 0 },
      label: tx('Correct the motor: shims under the feet, then move it sideways', 'صحّح المحرك: رقائق تحت الأقدام ثم حرّكه جانبيًا'),
      ok: tx('0.40 mm shims under the rear feet, motor jacked sideways, bolts torqued in a cross pattern. Re-measured: 0.03 mm offset. In tolerance.', 'رقائق 0.40 مم تحت الأقدام الخلفية، وحُرك المحرك جانبيًا، وشُدت المسامير بترتيب متقاطع. إعادة القياس: إزاحة 0.03 مم. ضمن السماحية.'),
    },
    {
      id: 'refit', station: 'coupling', pose: 'crouch', reach: [0, 0.1, 0.3], needs: ['shim'], set: { guard: 1, laser: 0 },
      label: tx('Remove the laser kit and refit the coupling guard', 'انزع جهاز الليزر وأعد تركيب غطاء الوصلة'),
      ok: tx('Laser heads off, guard bolted back on, tools counted.', 'نُزع رأسا الليزر وثُبت الغطاء مرة أخرى وعُدّت العدد.'),
    },
    {
      id: 'valve', station: 'valve', pose: 'reach', reach: [1.32, 1.4, 0.3],
      label: tx('Open the discharge valve a quarter', 'افتح محبس الطرد ربع فتحة'),
      ok: tx('Valve cracked open so the pump will not run against a closed valve.', 'فُتح المحبس قليلًا حتى لا تعمل المضخة والمحبس مغلق.'),
    },
    {
      id: 'restore', station: 'isolator', pose: 'reach', reach: [-1.9, 0.86, 0.84], needs: ['shim'], set: { isolator: 1 }, running: true, goal: true,
      label: tx('Remove your lock, switch on and start the pump', 'انزع قفلك وشغّل المفتاح والمضخة'),
      ok: tx('Everyone clear, lock off, started. Vibration down from 7.1 to 1.8 mm/s. Job card signed.', 'الجميع بعيد، نُزع القفل وبدأ التشغيل. انخفض الاهتزاز من 7.1 إلى 1.8 مم/ث. وُقّعت بطاقة العمل.'),
      hazards: [
        {
          when: { notDone: ['refit'] },
          outcome: {
            kind: 'incident', id: 'eim-no-guard', effect: 'entangle', at: COUPLING, toward: 'hand', severity: 3,
            title: tx('Started with the coupling guard off', 'بدأ التشغيل وغطاء الوصلة منزوع'),
            what: tx('The coupling was bare. A rag left on the baseplate was snatched by the spinning hub and whipped round.', 'كانت الوصلة مكشوفة. خرقة تُركت على القاعدة سحبها المحور الدوار ولفها بقوة.'),
            rule: tx('Refit every guard and remove every tool and rag before the lock comes off.', 'أعد تركيب كل الأغطية وأزل كل العدد والخرق قبل نزع القفل.'),
            sign: { kind: 'warning', pic: 'rotating' },
          },
        },
        {
          when: { notDone: ['valve'] },
          outcome: {
            kind: 'blocked', id: 'eim-closed-valve', effect: 'steam', at: [1.2, 0.6, 0.2],
            title: tx('Running against a closed valve: the pump overheated', 'التشغيل والمحبس مغلق: سخنت المضخة'),
            what: tx('With the discharge valve shut, all the energy went into heating the water in the casing. The seal started to steam and the trip stopped the motor.', 'مع إغلاق محبس الطرد ذهبت الطاقة كلها في تسخين الماء داخل الغلاف. بدأ مانع التسرب يخرج بخارًا وفصل الحماية المحرك.'),
            rule: tx('Prime the pump and crack the discharge valve open before you start a centrifugal pump.', 'املأ المضخة وافتح محبس الطرد قليلًا قبل تشغيل المضخة الطاردة المركزية.'),
            sign: { kind: 'warning', pic: 'hot' },
          },
        },
      ],
    },
  ],
};
