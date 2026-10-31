/**
 * Laser MFP: clear a fuser jam and replace the toner. Traps: reaching into
 * a hot fuser, blowing spilt toner out with the air gun, cleaning toner
 * without a mask, and defeating the door interlock to watch it print.
 */
import { laserMfp } from '../models/laserMfp';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const INSIDE: V3 = [0, -0.5, 0.4];
const FUSER: V3 = [0, -0.4, -0.3];

export const oeqSafety: Scenario = {
  id: 'sim-oeq-jam',
  trade: 'oeq',
  model: laserMfp,
  minutes: 25,
  title: tx('Clear a fuser jam and replace the toner', 'أزل ورقة عالقة في الفيوزر واستبدل الحبر'),
  brief: tx(
    'The office printer shows "Jam in fuser area" and "Toner low". Someone tried to pull the paper out and tore it; there is toner spilt inside. It has just finished a 200-page job.',
    'تظهر طابعة المكتب "ورقة عالقة في منطقة الفيوزر" و"الحبر منخفض". حاول أحدهم سحب الورقة فتمزقت، وهناك حبر منسكب بالداخل. انتهت للتو من طباعة 200 صفحة.'),
  task: tx('Clear the jam, clean up the toner safely, fit a new cartridge and print a test page.', 'أزل الورقة العالقة ونظف الحبر بأمان وركب خرطوشة جديدة واطبع صفحة اختبار.'),
  params: { front: 0, toner: 0, fuser: 1, power: 1, vacuum: 0 },
  startRunning: false,
  ppe: [
    { key: 'mask', need: 'required', why: tx('Toner is a fine powder that stays in the air; a P2 mask while you clean it.', 'الحبر مسحوق ناعم يبقى في الهواء؛ كمامة P2 أثناء تنظيفه.') },
    { key: 'gloves-nitrile', need: 'required', why: tx('Toner stains skin and is hard to wash off; wash in cold water if it gets on you.', 'الحبر يصبغ الجلد ويصعب غسله؛ اغسله بماء بارد إن أصابك.') },
    { key: 'glasses', need: 'optional', why: tx('Against toner dust if the cartridge drops.', 'ضد غبار الحبر إن سقطت الخرطوشة.') },
  ],
  actions: [
    {
      id: 'off', station: 'back', pose: 'reach', reach: [0.62, -0.9, -0.4], set: { power: 0 }, hideWhen: { done: ['off'] },
      label: tx('Switch off and unplug the printer', 'أطفئ الطابعة وافصل القابس'),
      ok: tx('Off and unplugged. The fuser is still at 190 °C.', 'مطفأة ومفصولة. الفيوزر ما زال عند 190 درجة.'),
    },
    {
      id: 'open', station: 'inside', pose: 'reach', reach: INSIDE, set: { front: 1 }, hideWhen: { done: ['open'] },
      label: tx('Open the front door', 'افتح الباب الأمامي'),
      ok: tx('Door open: torn paper visible going into the fuser, toner scattered on the transfer area.', 'الباب مفتوح: ورق ممزق داخل إلى الفيوزر، وحبر منتثر على منطقة النقل.'),
    },
    {
      id: 'cool', station: 'front', pose: 'inspect', reach: [0, -0.6, 0.7], needs: ['off'], set: { fuser: 0 }, hideWhen: { done: ['cool'] },
      label: tx('Wait 20 minutes for the fuser to cool', 'انتظر 20 دقيقة حتى يبرد الفيوزر'),
      ok: tx('Twenty minutes; fuser cover now warm, not hot.', 'عشرون دقيقة؛ غطاء الفيوزر الآن دافئ لا ساخن.'),
    },
    {
      id: 'jam', station: 'inside', pose: 'reach', reach: FUSER, needs: ['open'],
      label: tx('Release the fuser levers and pull the paper out', 'حرر أذرع الفيوزر واسحب الورقة'),
      ok: tx('Pressure levers down, paper out in one piece, no scraps left on the rollers.', 'أُنزلت أذرع الضغط وخرجت الورقة قطعة واحدة دون بقايا على الأسطوانات.'),
      hazards: [{
        when: { notDone: ['cool'] },
        outcome: {
          kind: 'incident', id: 'oeq-fuser', effect: 'burn', at: FUSER, toward: 'hand', severity: 1,
          title: tx('Burnt on the fuser', 'حرق من الفيوزر'),
          what: tx('The heat roller was still near 190 °C. The back of your hand touched it as you reached for the paper.', 'كانت أسطوانة التسخين قرب 190 درجة. لمسها ظهر يدك وأنت تمد يدك إلى الورقة.'),
          rule: tx('Switch off and let the fuser cool before you reach behind the drum.', 'أطفئ واترك الفيوزر يبرد قبل أن تمد يدك خلف الأسطوانة.'),
          sign: { kind: 'warning', pic: 'hot' },
        },
      }],
    },
    {
      id: 'out', station: 'inside', pose: 'reach', reach: INSIDE, needs: ['open'], set: { toner: 1 }, hideWhen: { done: ['out'] },
      label: tx('Pull out the old toner cartridge', 'اسحب خرطوشة الحبر القديمة'),
      ok: tx('Cartridge out and straight into its bag; drum kept away from the light.', 'خرجت الخرطوشة ووُضعت في كيسها مباشرة؛ والأسطوانة بعيدة عن الضوء.'),
    },
    {
      id: 'airgun', station: 'inside', pose: 'reach', reach: INSIDE, needs: ['out'], hideWhen: { done: ['clean'] },
      label: tx('Blow the spilt toner out with the air gun', 'انفث الحبر المنسكب بمسدس الهواء'),
      ok: tx('', ''),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'oeq-air', effect: 'fumes', at: INSIDE, toward: 'face', severity: 1,
          title: tx('A cloud of toner over you and the office', 'سحابة من الحبر عليك وعلى المكتب'),
          what: tx('The toner went everywhere: into your face, the scanner and the next desk. A dust cloud like this near a spark can flash.', 'انتشر الحبر في كل مكان: على وجهك والماسح والمكتب المجاور. سحابة غبار كهذه قرب شرارة قد تشتعل.'),
          harm: tx('Toner dust irritates the lungs and, in a cloud, is a dust-explosion hazard.', 'غبار الحبر يهيج الرئتين، وفي شكل سحابة يمثل خطر انفجار غبار.'),
          rule: tx('Never blow toner. Use the toner vacuum or a damp cloth.', 'لا تنفث الحبر أبدًا. استخدم مكنسة الحبر أو قطعة قماش رطبة.'),
          sign: { kind: 'prohibition', pic: 'exclaim' },
        },
      }],
    },
    {
      id: 'clean', station: 'vacuum', pose: 'crouch', reach: [-1.6, -1.4, 0.6], needs: ['out'], set: { vacuum: 1 },
      label: tx('Clean the spill with the toner vacuum', 'نظف الانسكاب بمكنسة الحبر'),
      ok: tx('Toner vacuumed out, transfer roller wiped with a dry lint-free cloth.', 'شُفط الحبر ومُسحت أسطوانة النقل بقماش جاف خالٍ من الوبر.'),
      hazards: [{
        when: { notWearing: ['mask'] },
        outcome: {
          kind: 'incident', id: 'oeq-dust', effect: 'fumes', at: INSIDE, toward: 'face', severity: 1,
          title: tx('You breathed in toner dust', 'استنشقت غبار الحبر'),
          what: tx('Even with the vacuum, fine toner rose as you lifted the cartridge guides. You are coughing.', 'حتى مع المكنسة ارتفع الحبر الناعم عند رفع مجاري الخرطوشة. أنت تسعل.'),
          rule: tx('Wear a P2 mask when you clean toner.', 'ارتدِ كمامة P2 عند تنظيف الحبر.'),
          sign: { kind: 'mandatory', pic: 'mask' },
        },
      }],
    },
    {
      id: 'interlock', station: 'inside', pose: 'reach', reach: INSIDE, needs: ['open'], hideWhen: { done: ['fit'] },
      label: tx('Tape the door switch down so you can watch it print with the door open', 'ثبّت مفتاح الباب بشريط لتشاهدها تطبع والباب مفتوح'),
      ok: tx('', ''),
      hazards: [{
        when: {},
        outcome: {
          kind: 'blocked', id: 'oeq-interlock', effect: 'alarm', at: INSIDE,
          title: tx('Your supervisor took the tape off', 'نزع المشرف الشريط'),
          what: tx('With the interlock defeated the laser and the −600 V charge roller work with the door open, and the 3B beam can reach your eye through the gaps.', 'مع تعطيل مفتاح الأمان يعمل الليزر وأسطوانة الشحن −600 فولت والباب مفتوح، وقد يصل شعاع 3B إلى عينك من الفتحات.'),
          rule: tx('Never defeat an interlock. Use the service manual\'s test modes.', 'لا تعطل مفتاح أمان أبدًا. استخدم أوضاع الاختبار في دليل الصيانة.'),
          ref: 'IEC 60825-1', sign: { kind: 'prohibition', pic: 'exclaim' },
        },
      }],
    },
    {
      id: 'fit', station: 'inside', pose: 'reach', reach: INSIDE, needs: ['clean'], set: { toner: 0, vacuum: 0, front: 0 },
      label: tx('Fit the new cartridge and close the door', 'ركب الخرطوشة الجديدة وأغلق الباب'),
      ok: tx('Seal strip pulled, cartridge rocked to spread the toner, clicked in. Door closed.', 'سُحب شريط الختم وهُزت الخرطوشة لتوزيع الحبر ثم رُكبت. الباب مغلق.'),
    },
    {
      id: 'print', station: 'panel', pose: 'operate', reach: [0.35, -0.15, 0.55], needs: ['fit', 'jam'], set: { power: 1, fuser: 1 }, running: true, goal: true,
      label: tx('Plug in, switch on and print a test page', 'وصّل الطابعة وشغّلها واطبع صفحة اختبار'),
      ok: tx('Warm-up 18 s, test page clean, no streaks, counters reset. Job logged.', 'إحماء 18 ثانية وصفحة اختبار نظيفة بلا خطوط، وأُعيد ضبط العدادات. سُجل العمل.'),
    },
  ],
};
