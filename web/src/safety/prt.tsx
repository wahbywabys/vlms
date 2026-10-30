/**
 * Offset press: wash the blanket between jobs. Traps: wiping the blanket
 * with the press turning at speed, reaching into the nip on the in-running
 * side, solvent without gloves or ventilation, rags left in the open, and
 * restarting with the guard open.
 */
import { offsetPress } from '../models/offsetPress';
import { tx } from '../models/kit';
import type { Scenario } from './types';

type V3 = [number, number, number];
const NIP: V3 = [0.5, 0.34, 0.2];

export const prtSafety: Scenario = {
  id: 'sim-prt-blanket',
  trade: 'prt',
  model: offsetPress,
  minutes: 12,
  title: tx('Wash the blanket between two jobs', 'نظّف البطانية بين مهمتين'),
  brief: tx(
    'The last job left blue ink on the blanket and the next job is in black. The press is still turning at production speed. You have a bottle of blanket wash and a rag.',
    'ترك آخر عمل حبرًا أزرق على البطانية والعمل التالي باللون الأسود. الماكينة ما زالت تدور بسرعة الإنتاج. معك زجاجة منظف بطانية وخرقة.'),
  task: tx('Clean the blanket by hand, put the rag away safely and restart the press, with no injury.', 'نظّف البطانية يدويًا وضع الخرقة في مكانها الآمن وأعد تشغيل الماكينة، دون أي إصابة.'),
  params: { guard: 1, inch: 0 },
  startRunning: true,
  ppe: [
    { key: 'gloves-nitrile', need: 'required', why: tx('Blanket wash strips the skin\'s oils and causes dermatitis.', 'منظف البطانية يزيل زيوت الجلد ويسبب التهاب الجلد.') },
    { key: 'glasses', need: 'required', why: tx('Solvent splashes when you wipe a turning cylinder.', 'المذيب يتناثر عند مسح أسطوانة تدور.') },
    { key: 'boots', need: 'required', why: tx('Paper pallets and heavy rolls.', 'منصات الورق واللفائف الثقيلة.') },
    { key: 'earmuffs', need: 'required', why: tx('A press at speed runs above 85 dB(A).', 'الماكينة بسرعتها تتجاوز 85 ديسيبل.') },
    { key: 'cuffs', need: 'required', why: tx('Loose sleeves are pulled into the nips.', 'الأكمام الواسعة تُسحب إلى نقاط الالتقاء.') },
    { key: 'mask', need: 'optional', why: tx('Use a vapour mask if extraction is poor.', 'استخدم كمامة أبخرة إذا كانت التهوية ضعيفة.') },
  ],
  actions: [
    {
      id: 'stop', station: 'console', pose: 'operate', reach: [0.17, 0.12, 1.05], running: false,
      label: tx('Stop the press at the desk', 'أوقف الماكينة من مكتب التحكم'),
      ok: tx('Press stopped. Cylinders at rest.', 'توقفت الماكينة. الأسطوانات ساكنة.'),
    },
    {
      id: 'wipeRunning', station: 'unit', pose: 'reach', reach: [0.5, 0.36, 0.2], hideWhen: { done: ['stop'] },
      label: tx('Wipe the blanket while it turns, to save time', 'امسح البطانية وهي تدور لتوفر الوقت'),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'prt-nip', effect: 'entangle', at: NIP, toward: 'hand', severity: 3,
          title: tx('The rag and hand were pulled into the nip', 'سُحبت الخرقة واليد إلى نقطة الالتقاء'),
          what: tx('The rag caught on the blanket and was drawn into the in-running nip between blanket and impression cylinders, taking the hand with it.', 'علقت الخرقة بالبطانية وسُحبت إلى نقطة الالتقاء الداخلة بين أسطوانتي البطانية والطبع، ومعها اليد.'),
          harm: tx('Nip injuries in printing crush hands and arms; they are among the worst injuries in the industry.', 'إصابات نقاط الالتقاء في الطباعة تسحق اليدين والذراعين، وهي من أسوأ الإصابات في هذه الصناعة.'),
          rule: tx('Never clean, adjust or reach in while the press runs. Stop it, open the guard and inch it with the hold-to-run button.', 'لا تنظف ولا تضبط ولا تمد يدك أبدًا والماكينة تعمل. أوقفها وافتح الواقي وحرّكها بزر التحريك المتقطع.'),
          ref: 'ISO 12648', sign: { kind: 'warning', pic: 'rotating' },
        },
      }],
      ok: tx('', ''),
    },
    {
      id: 'open', station: 'unit', pose: 'reach', reach: [0.71, 0.05, 0], needs: ['stop'], set: { guard: 0, inch: 1 },
      label: tx('Open the unit guard (press goes to inch mode)', 'افتح واقي الوحدة (تنتقل الماكينة إلى التحريك المتقطع)'),
      ok: tx('Guard open. The press now only moves at crawl speed while the inch button is held.', 'الواقي مفتوح. لا تتحرك الماكينة الآن إلا ببطء أثناء الضغط على زر التحريك.'),
    },
    {
      id: 'wash', station: 'unit', pose: 'reach', reach: [0.52, 0.5, 0.2], needs: ['open'],
      label: tx('Wipe the exposed blanket with wash on the rag', 'امسح الجزء الظاهر من البطانية بالمنظف على الخرقة'),
      ok: tx('Ink off the visible half. Wiping on the out-running side, away from the nip.', 'أُزيل الحبر من النصف الظاهر. المسح من جهة الخروج بعيدًا عن نقطة الالتقاء.'),
      hazards: [
        {
          when: { notWearing: ['gloves-nitrile'] },
          outcome: {
            kind: 'incident', id: 'prt-skin', effect: 'burn', at: [0.52, 0.5, 0.2], toward: 'hand', severity: 1,
            title: tx('Solvent on bare hands', 'مذيب على يدين عاريتين'),
            what: tx('Blanket wash soaked into your skin. It stings now; done every day it causes cracked, painful dermatitis.', 'تشرّب جلدك منظف البطانية. يلسع الآن، وتكراره يوميًا يسبب التهاب جلد متشقق مؤلم.'),
            rule: tx('Nitrile gloves for every wash-up. Read the safety data sheet of the wash you use.', 'قفازات نيتريل في كل عملية تنظيف. اقرأ صحيفة بيانات السلامة للمنظف الذي تستخدمه.'),
            sign: { kind: 'mandatory', pic: 'gloves' },
          },
        },
        {
          when: { notWearing: ['glasses'] },
          outcome: {
            kind: 'incident', id: 'prt-splash', effect: 'steam', at: [0.52, 0.5, 0.2], toward: 'face', severity: 1,
            title: tx('Wash splashed into the eye', 'تناثر المنظف في العين'),
            what: tx('Squeezing the rag flicked solvent into your eye.', 'عصر الخرقة قذف المذيب في عينك.'),
            rule: tx('Safety glasses for wash-ups; the eyewash station is by the door.', 'نظارة السلامة عند التنظيف، ومحطة غسيل العين عند الباب.'),
            sign: { kind: 'mandatory', pic: 'glasses' },
          },
        },
      ],
    },
    {
      id: 'inch', station: 'console', pose: 'operate', reach: [0.08, 0.08, 1.14], needs: ['wash'], running: true,
      label: tx('Step back and inch the cylinders half a turn', 'ابتعد وحرّك الأسطوانات نصف لفة بالتحريك المتقطع'),
      ok: tx('Hands clear, inch button held: the dirty half came round at crawl speed.', 'اليدان بعيدتان وزر التحريك مضغوط: ظهر النصف المتسخ ببطء.'),
    },
    {
      id: 'wash2', station: 'unit', pose: 'reach', reach: [0.52, 0.5, 0.2], needs: ['inch'], running: false,
      label: tx('Release the button and wipe the second half', 'اترك الزر وامسح النصف الثاني'),
      ok: tx('Blanket clean all round.', 'البطانية نظيفة بالكامل.'),
    },
    {
      id: 'rag', station: 'unit', pose: 'reach', reach: [0.9, -0.5, 0.6], needs: ['wash'],
      label: tx('Put the rag in the closed metal bin', 'ضع الخرقة في الصندوق المعدني المغلق'),
      ok: tx('Rag in the self-closing safety bin. Wash bottle capped.', 'الخرقة في صندوق الأمان ذاتي الإغلاق. وأُغلقت زجاجة المنظف.'),
    },
    {
      id: 'restart', station: 'console', pose: 'operate', reach: [0.17, 0.12, 1.05], needs: ['wash2'], running: true, goal: true, set: { inch: 0, guard: 1 },
      label: tx('Close the guard and restart the press', 'أغلق الواقي وأعد تشغيل الماكينة'),
      ok: tx('Guard closed, interlock made, horn sounded, press running. First black sheets are clean.', 'أُغلق الواقي واكتمل القفل البيني وانطلق التنبيه والماكينة تعمل. أول الأفرخ السوداء نظيفة.'),
      hazards: [{
        when: { notDone: ['rag'] },
        outcome: {
          kind: 'incident', id: 'prt-fire', effect: 'fire', at: [0.9, -0.6, 0.6], severity: 2,
          title: tx('The solvent rag caught fire', 'اشتعلت الخرقة المشبعة بالمذيب'),
          what: tx('The rag left on the press frame was near the hot dryer. The vapour ignited.', 'الخرقة المتروكة على إطار الماكينة كانت قرب المجفف الساخن، فاشتعلت أبخرتها.'),
          harm: tx('Solvent rags start many printing-works fires; some heat up and ignite on their own.', 'الخرق المشبعة بالمذيب سبب كثير من حرائق المطابع، وبعضها يسخن ويشتعل وحده.'),
          rule: tx('Used rags go straight into the closed metal bin, emptied every shift.', 'الخرق المستعملة توضع فورًا في الصندوق المعدني المغلق ويُفرغ كل وردية.'),
          sign: { kind: 'prohibition', pic: 'noFlame' },
        },
      }],
    },
  ],
};
