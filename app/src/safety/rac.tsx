/**
 * Split AC: braze a leaking joint at the outdoor unit and recommission.
 * Traps: opening the unit without isolating it, connecting hoses without
 * gloves and glasses, brazing with refrigerant still in the pipe, brazing
 * without a nitrogen purge, and restarting with the fan cover off.
 */
import { tx } from '../models/kit';
import { splitAc } from '../models/splitAc';
import type { Scenario } from './types';

type V3 = [number, number, number];
const VALVES: V3 = [1.05, -0.5, 0.4];
const INSIDE: V3 = [0.45, 0.2, 0.3];
const KIT: V3 = [2.8, -1.3, 0.35];

export const racSafety: Scenario = {
  id: 'sim-rac-leak',
  trade: 'rac',
  model: splitAc,
  minutes: 120,
  title: tx('Repair a leaking joint and recommission the split unit', 'أصلح وصلة مسربة وأعد تشغيل التكييف'),
  brief: tx(
    'A 1.5 hp R32 split unit is blowing warm air. The leak detector found oil and a leak at a brazed joint on the suction line inside the outdoor unit. The unit is still running.',
    'تكييف سبليت 1.5 حصان بفريون R32 يخرج هواءً دافئًا. كشف جهاز التسرب زيتًا وتسربًا عند وصلة ملحومة في خط السحب داخل الوحدة الخارجية. الوحدة ما زالت تعمل.'),
  task: tx('Recover the charge, braze the joint, pressure-test, evacuate and recharge, and leave it cooling.', 'استرجع الشحنة والحم الوصلة واختبر الضغط وفرّغ واشحن، واتركها تبرد.'),
  params: { cover: 0, hoses: 0, pressure: 0.6, recover: 0, nitrogen: 0 },
  startRunning: true,
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Liquid refrigerant in the eye freezes it; brazing needs shaded goggles as well.', 'الفريون السائل في العين يجمدها؛ واللحام بالمونة يحتاج نظارة مظللة أيضًا.') },
    { key: 'gloves-leather', need: 'required', why: tx('Refrigerant at −40 °C gives frostbite; the same gloves protect from the hot joint.', 'الفريون عند −40 درجة يسبب قضمة الصقيع؛ والقفاز نفسه يحمي من الوصلة الساخنة.') },
    { key: 'boots', need: 'required', why: tx('Recovery cylinders and the outdoor unit are heavy.', 'أسطوانات الاسترجاع والوحدة الخارجية ثقيلة.') },
  ],
  actions: [
    {
      id: 'isolate', station: 'front', pose: 'inspect', reach: [0.3, -0.2, 0.6], running: false, hideWhen: { done: ['isolate'] },
      label: tx('Switch off and lock the isolator beside the outdoor unit', 'أطفئ مفتاح العزل بجوار الوحدة الخارجية واقفله'),
      ok: tx('Isolator off and locked, tested dead at the terminal block.', 'مفتاح العزل مطفأ ومقفل، وثبت انعدام الجهد عند أطراف التوصيل.'),
    },
    {
      id: 'cover', station: 'inside', pose: 'reach', reach: INSIDE, set: { cover: 1 }, hideWhen: { done: ['cover'] },
      label: tx('Take the cover off the outdoor unit', 'فك غطاء الوحدة الخارجية'),
      ok: tx('Cover off. The joint is oily: that is the leak.', 'فُك الغطاء. الوصلة عليها زيت: هذا هو التسرب.'),
      hazards: [{
        when: { notDone: ['isolate'] },
        outcome: {
          kind: 'incident', id: 'rac-live', effect: 'shock', at: INSIDE, toward: 'hand', severity: 2,
          title: tx('The unit was still live', 'الوحدة كانت ما زالت مكهربة'),
          what: tx('Your hand brushed the capacitor terminals as the cover came off. The fan also restarted on its timer.', 'لمست يدك أطراف المكثف أثناء فك الغطاء. وعادت المروحة للدوران بالمؤقت.'),
          rule: tx('Isolate, lock and test dead before you open any unit.', 'اعزل واقفل واختبر انعدام الجهد قبل فتح أي وحدة.'),
          ref: 'LOTO', sign: { kind: 'mandatory', pic: 'lockout' },
        },
      }],
    },
    {
      id: 'hoses', station: 'valves', pose: 'crouch', reach: VALVES, set: { hoses: 1 },
      label: tx('Connect the manifold hoses to the service valves', 'وصّل خراطيم المانيفولد بمحابس الخدمة'),
      ok: tx('Hoses on, low side reads 3.1 bar standing: the system is short of charge.', 'رُكبت الخراطيم والضغط المنخفض 3.1 بار والوحدة متوقفة: الشحنة ناقصة.'),
      hazards: [
        {
          when: { notWearing: ['glasses'] },
          outcome: {
            kind: 'incident', id: 'rac-eye', effect: 'steam', at: VALVES, toward: 'face', severity: 2,
            title: tx('Refrigerant sprayed into your eye', 'رُش الفريون في عينك'),
            what: tx('The Schrader core spat liquid as the coupler went on. It hit your eye at −40 °C.', 'خرج سائل من البلف أثناء تركيب الوصلة، وأصاب عينك عند −40 درجة.'),
            harm: tx('Frozen eye tissue can scar the cornea.', 'تجمد أنسجة العين قد يترك ندبة في القرنية.'),
            rule: tx('Glasses and gloves on before any hose goes on or off.', 'النظارة والقفاز قبل تركيب أو فك أي خرطوم.'),
            sign: { kind: 'mandatory', pic: 'glasses' },
          },
        },
        {
          when: { notWearing: ['gloves-leather'] },
          outcome: {
            kind: 'incident', id: 'rac-frost', effect: 'steam', at: VALVES, toward: 'hand', severity: 1,
            title: tx('Frostbite on your fingers', 'قضمة صقيع في أصابعك'),
            what: tx('Liquid refrigerant ran over your bare fingers as the coupler sealed.', 'سال الفريون السائل على أصابعك العارية أثناء إحكام الوصلة.'),
            rule: tx('Refrigerant gloves whenever you work on the charge.', 'قفاز الفريون كلما عملت على الشحنة.'),
            sign: { kind: 'mandatory', pic: 'gloves' },
          },
        },
      ],
    },
    {
      id: 'recover', station: 'kit', pose: 'crouch', reach: KIT, needs: ['hoses'], set: { recover: 1, pressure: 0 },
      label: tx('Recover the refrigerant into the recovery cylinder', 'استرجع الفريون إلى أسطوانة الاسترجاع'),
      ok: tx('0.6 kg recovered and logged. System at 0 bar.', 'استُرجع 0.6 كجم وسُجل. النظام عند 0 بار.'),
    },
    {
      id: 'purge', station: 'kit', pose: 'crouch', reach: KIT, needs: ['hoses'], set: { nitrogen: 1 }, hideWhen: { done: ['purge'] },
      label: tx('Start a low nitrogen purge through the pipe', 'ابدأ سريان نيتروجين خفيف داخل الماسورة'),
      ok: tx('Nitrogen at 0.1 bar flowing through the suction line.', 'نيتروجين عند 0.1 بار يسري في خط السحب.'),
    },
    {
      id: 'braze', station: 'inside', pose: 'reach', reach: INSIDE, needs: ['cover'], set: { recover: 0 },
      label: tx('Braze the joint', 'الحم الوصلة بالمونة'),
      ok: tx('Joint cleaned, brazed with 15 % silver rod. Bright inside, no scale.', 'نُظفت الوصلة ولُحمت بسلك فضة 15٪. لامعة من الداخل بلا قشور.'),
      hazards: [
        {
          when: { notDone: ['recover'] },
          outcome: {
            kind: 'incident', id: 'rac-fire', effect: 'fire', at: INSIDE, toward: 'face', severity: 3,
            title: tx('You heated a pipe full of R32', 'سخنت ماسورة مملوءة بفريون R32'),
            what: tx('R32 is flammable. The joint opened under the flame and the escaping gas caught fire, then broke down into toxic fumes.', 'فريون R32 قابل للاشتعال. انفتحت الوصلة تحت اللهب واشتعل الغاز المتسرب ثم تحلل إلى أبخرة سامة.'),
            harm: tx('Burning refrigerant makes hydrogen fluoride: it burns the lungs.', 'احتراق الفريون يولد فلوريد الهيدروجين: يحرق الرئتين.'),
            rule: tx('Recover the charge completely before any flame goes near the system.', 'استرجع الشحنة بالكامل قبل أن يقترب أي لهب من النظام.'),
            ref: 'ISO 5149 · F-gas', sign: { kind: 'prohibition', pic: 'noFlame' },
          },
        },
        {
          when: { notDone: ['purge'] },
          outcome: {
            kind: 'blocked', id: 'rac-scale', effect: 'fumes', at: INSIDE,
            title: tx('Black scale inside the pipe', 'قشور سوداء داخل الماسورة'),
            what: tx('Without nitrogen inside, the hot copper oxidised. The flakes will block the expansion valve within weeks.', 'بدون نيتروجين بالداخل تأكسد النحاس الساخن. ستسد القشور صمام التمدد خلال أسابيع.'),
            rule: tx('Always braze with a low nitrogen purge.', 'الحم دائمًا مع سريان نيتروجين خفيف.'),
            sign: { kind: 'mandatory', pic: 'gas' },
          },
        },
      ],
    },
    {
      id: 'test', station: 'kit', pose: 'crouch', reach: KIT, needs: ['braze'], set: { nitrogen: 1 },
      label: tx('Pressure-test with nitrogen, then evacuate', 'اختبر الضغط بالنيتروجين ثم فرّغ'),
      ok: tx('40 bar held for 30 minutes. Evacuated to 300 microns, held. Charged 1.1 kg by weight.', 'ثبت ضغط 40 بار لمدة 30 دقيقة. فُرغ إلى 300 ميكرون وثبت. شُحن 1.1 كجم بالوزن.'),
    },
    {
      id: 'refit', station: 'inside', pose: 'reach', reach: INSIDE, needs: ['braze'], set: { cover: 0 }, hideWhen: { done: ['refit'] },
      label: tx('Refit the cover', 'أعد تركيب الغطاء'),
      ok: tx('Cover on, all screws in.', 'رُكب الغطاء وكل المسامير.'),
    },
    {
      id: 'start', station: 'front', pose: 'inspect', reach: [0.3, -0.2, 0.6], needs: ['test'], set: { nitrogen: 0, hoses: 0, pressure: 1 }, running: true, goal: true,
      label: tx('Remove your lock, start the unit and check it', 'انزع القفل وشغّل الوحدة وافحصها'),
      ok: tx('Suction 9.5 bar, superheat 6 K, 11 °C off the indoor coil. Customer has cool air.', 'ضغط السحب 9.5 بار والتحميص 6 كلفن، والهواء 11 درجة من الملف الداخلي. العميل لديه هواء بارد.'),
      hazards: [{
        when: { notDone: ['refit'] },
        outcome: {
          kind: 'incident', id: 'rac-fan', effect: 'entangle', at: [0.2, 0.0, 0.3], toward: 'hand', severity: 2,
          title: tx('The fan started with the cover off', 'بدأت المروحة والغطاء مفكوك'),
          what: tx('You reached in to check the joint as the fan spun up. The blade caught your glove.', 'مددت يدك لفحص الوصلة أثناء دوران المروحة. علقت الريشة بقفازك.'),
          rule: tx('Covers and guards back on before you restore power.', 'الأغطية والحواجز في مكانها قبل إعادة الكهرباء.'),
          sign: { kind: 'warning', pic: 'rotating' },
        },
      }],
    },
  ],
};
