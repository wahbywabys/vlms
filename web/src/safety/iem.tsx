/**
 * Motor rewinding: rewind a burnt 15 kW motor and prove it. Traps: burning
 * out the old coils, gloves at the coil winder, varnish without a mask, a
 * surge test with the test gate open, and handling the winding before it is
 * earthed after the test.
 */
import { tx } from '../models/kit';
import { motorRewind } from '../models/motorRewind';
import type { Scenario } from './types';

type V3 = [number, number, number];
const STATOR: V3 = [-0.4, 0.6, 0.4];
const WINDER: V3 = [0.7, 0.35, 0.3];
const TEST: V3 = [1.9, -0.7, 0.1];

export const iemSafety: Scenario = {
  id: 'sim-iem-rewind',
  trade: 'iem',
  model: motorRewind,
  minutes: 480,
  title: tx('Rewind a burnt 15 kW motor', 'أعد لف محرك 15 كيلووات محروق'),
  brief: tx(
    'A 15 kW pump motor tripped on earth fault and smells burnt. The megger reads 0.2 MΩ on phase W. The stator is on the cradle; the winding data card is filled in.',
    'فصل محرك مضخة 15 كيلووات بعطل أرضي ورائحته محروقة. يقرأ الميجر 0.2 ميجا أوم على الوجه W. العضو الثابت على المهد وبطاقة بيانات اللف مملوءة.'),
  task: tx('Strip, rewind, varnish and test the stator, then hand it over safe.', 'افك الملفات وأعد اللف والورنيش واختبر العضو الثابت، ثم سلّمه آمنًا.'),
  params: { wind: 0, coils: 0, oven: 0, test: 0, guard: 0 },
  startRunning: false,
  ppe: [
    { key: 'glasses', need: 'required', why: tx('Cut wire ends and old insulation flick out when you strip a stator.', 'أطراف الأسلاك المقطوعة والعزل القديم تتطاير عند فك الملفات.') },
    { key: 'boots', need: 'required', why: tx('A 15 kW stator weighs about 60 kg.', 'العضو الثابت لمحرك 15 كيلووات يزن حوالي 60 كجم.') },
    { key: 'mask', need: 'required', why: tx('Solvent vapour from the varnish tank.', 'أبخرة المذيبات من حوض الورنيش.') },
    { key: 'gloves-leather', need: 'forbidden', why: tx('Not at the coil winder: a glove caught on the turning former pulls your hand in.', 'ليس عند ماكينة اللف: القفاز الذي يعلق بالقالب الدوار يسحب يدك.') },
  ],
  actions: [
    {
      id: 'burn', station: 'stator', pose: 'reach', reach: STATOR, hideWhen: { done: ['strip'] },
      label: tx('Burn the old varnish out with the gas torch', 'احرق الورنيش القديم بشعلة الغاز'),
      ok: tx('', ''),
      hazards: [{
        when: {},
        outcome: {
          kind: 'incident', id: 'iem-burnout', effect: 'fumes', at: STATOR, toward: 'face', severity: 2,
          title: tx('Toxic smoke and a damaged core', 'دخان سام وقلب تالف'),
          what: tx('The burning varnish gave off thick, acrid smoke. The flame also overheated the laminations: the core losses go up and the rewound motor runs hot.', 'أطلق الورنيش المحترق دخانًا كثيفًا لاذعًا. وسخّن اللهب الرقائق أكثر من اللازم: تزيد مفاقيد القلب ويسخن المحرك بعد اللف.'),
          rule: tx('Cut the old coils out (or use a controlled burn-off oven below 360 °C), never an open flame.', 'اقطع الملفات القديمة (أو استخدم فرن حرق مضبوطًا تحت 360 درجة)، ولا تستخدم لهبًا مكشوفًا أبدًا.'),
          ref: 'IEC 60034-23', sign: { kind: 'prohibition', pic: 'noFlame' },
        },
      }],
    },
    {
      id: 'strip', station: 'stator', pose: 'reach', reach: STATOR,
      label: tx('Cut off one end winding and pull the old coils out', 'اقطع رأس الملفات من جهة واسحب الملفات القديمة'),
      ok: tx('One end cut on the coil cutter, coils pulled, slots cleaned. Core test: no hot spots.', 'قُطع رأس الملفات بالقاطع وسُحبت الملفات ونُظفت المجاري. اختبار القلب: لا نقاط ساخنة.'),
    },
    {
      id: 'wind', station: 'winder', pose: 'operate', reach: WINDER, needs: ['strip'], set: { wind: 1 }, running: true,
      label: tx('Wind 36 coils of 12 turns on the coil winder', 'لف 36 ملفًا بـ12 لفة على ماكينة اللف'),
      ok: tx('36 coils, counter checked on each, wire 1.25 mm from the card.', '36 ملفًا، فُحص العداد لكل ملف، والسلك 1.25 مم حسب البطاقة.'),
      hazards: [{
        when: { wearing: ['gloves-leather'] },
        outcome: {
          kind: 'incident', id: 'iem-winder', effect: 'entangle', at: WINDER, toward: 'hand', severity: 2,
          title: tx('Your glove was caught on the former', 'علق قفازك بالقالب'),
          what: tx('You guided the wire with a gloved hand. The glove caught and the former pulled your fingers in before the pedal came up.', 'وجهت السلك بيد مرتدية القفاز. علق القفاز وسحب القالب أصابعك قبل أن ترفع قدمك عن الدواسة.'),
          rule: tx('No gloves at the coil winder. Guide the wire through the tensioner, not your hand.', 'لا قفازات عند ماكينة اللف. وجّه السلك عبر الشد لا بيدك.'),
          sign: { kind: 'prohibition', pic: 'noGloves' },
        },
      }],
    },
    {
      id: 'insert', station: 'stator', pose: 'reach', reach: STATOR, needs: ['wind'], set: { wind: 0, coils: 1 }, running: false,
      label: tx('Insert the coils, slot liners and wedges, connect in delta', 'ركب الملفات وعوازل المجاري والأسافين ووصّل دلتا'),
      ok: tx('Coils in, phase separators fitted, connected Δ, end windings laced.', 'رُكبت الملفات وعوازل الأوجه ووُصلت دلتا وربطت رؤوس الملفات.'),
    },
    {
      id: 'varnish', station: 'oven', pose: 'reach', reach: [-2.3, -0.6, 0.4], needs: ['insert'], set: { oven: 1 },
      label: tx('Pre-heat, dip in varnish and bake', 'سخّن مسبقًا واغمر بالورنيش وجفف'),
      ok: tx('Pre-heated 2 h, dipped until bubbling stopped, drained, baked 4 h at 160 °C.', 'سُخن مسبقًا ساعتين وغُمر حتى توقف الفقاعات وصُفي وجُفف 4 ساعات عند 160 درجة.'),
      hazards: [{
        when: { notWearing: ['mask'] },
        outcome: {
          kind: 'incident', id: 'iem-solvent', effect: 'fumes', at: [-2.3, -1.2, 0.6], toward: 'face', severity: 1,
          title: tx('Dizzy from the varnish vapour', 'دوار من أبخرة الورنيش'),
          what: tx('You leaned over the dip tank to watch the bubbles. The solvent vapour made you light-headed.', 'انحنيت فوق الحوض لترى الفقاعات. جعلتك أبخرة المذيبات تشعر بالدوار.'),
          rule: tx('Respirator on, extraction running, no ignition sources near the tank.', 'كمامة التنفس والشفاط يعمل، ولا مصادر اشتعال قرب الحوض.'),
          sign: { kind: 'mandatory', pic: 'mask' },
        },
      }],
    },
    {
      id: 'gate', station: 'test', pose: 'operate', reach: TEST, set: { guard: 1 }, hideWhen: { done: ['gate'] },
      label: tx('Close the test gate and check nobody is inside', 'أغلق بوابة الاختبار وتأكد أن لا أحد بالداخل'),
      ok: tx('Gate closed, interlock made, area clear, warning lamp ready.', 'البوابة مغلقة ومفتاح الأمان موصل والمنطقة خالية ومصباح التحذير جاهز.'),
    },
    {
      id: 'test', station: 'test', pose: 'operate', reach: TEST, needs: ['varnish'], set: { test: 1 },
      label: tx('Run the insulation, surge and resistance tests', 'شغّل اختبارات العزل والصدمة والمقاومة'),
      ok: tx('Insulation 2.4 GΩ at 1 kV, surge waveforms matched at 3.5 kV, phase resistance within 0.8 %.', 'العزل 2.4 جيجا أوم عند 1 كيلو فولت، وموجات الصدمة متطابقة عند 3.5 كيلو فولت، ومقاومة الأوجه ضمن 0.8٪.'),
      hazards: [{
        when: { notDone: ['gate'] },
        outcome: {
          kind: 'incident', id: 'iem-hv', effect: 'shock', at: [-0.4, 0.6, 0.6], toward: 'hand', severity: 3,
          title: tx('A colleague touched the winding during the surge test', 'لمس زميل الملف أثناء اختبار الصدمة'),
          what: tx('The gate was open. A colleague reached in to straighten a lead as the tester fired 3.5 kV pulses.', 'كانت البوابة مفتوحة. مد زميل يده لتعديل سلك بينما أطلق الجهاز نبضات 3.5 كيلو فولت.'),
          harm: tx('High-voltage test sets kill. The interlocked gate is what keeps people out.', 'أجهزة اختبار الجهد العالي تقتل. البوابة ذات مفتاح الأمان هي ما يبعد الناس.'),
          rule: tx('Close and interlock the test area, warn everyone, then test.', 'أغلق منطقة الاختبار بمفتاح الأمان ونبّه الجميع ثم اختبر.'),
          ref: 'EN 50191', sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
    {
      id: 'earth', station: 'test', pose: 'operate', reach: TEST, needs: ['test'], set: { test: 0 }, hideWhen: { done: ['earth'] },
      label: tx('Earth the winding with the discharge stick', 'وصّل الملف بالأرضي بعصا التفريغ'),
      ok: tx('Discharge stick on each phase for a minute. Meter reads 0 V.', 'عصا التفريغ على كل وجه لمدة دقيقة. الجهاز يقرأ 0 فولت.'),
    },
    {
      id: 'handover', station: 'stator', pose: 'reach', reach: STATOR, needs: ['test'], set: { test: 0, guard: 0 }, goal: true,
      label: tx('Open the gate, fit the terminal links and sign the test certificate', 'افتح البوابة وركّب قضبان الأطراف ووقع شهادة الاختبار'),
      ok: tx('Links on, test results on the certificate, motor tagged ready for assembly.', 'رُكبت القضبان وسُجلت النتائج في الشهادة ووُضعت بطاقة جاهز للتجميع.'),
      hazards: [{
        when: { notDone: ['earth'] },
        outcome: {
          kind: 'incident', id: 'iem-stored', effect: 'shock', at: STATOR, toward: 'hand', severity: 2,
          title: tx('The winding was still charged', 'كان الملف ما زال مشحونًا'),
          what: tx('A big winding is a capacitor. After 1 kV it held a charge, and it went through your hand as you fitted the links.', 'الملف الكبير مكثف. بعد 1 كيلو فولت احتفظ بشحنة مرت عبر يدك وأنت تركب القضبان.'),
          rule: tx('Earth the winding after every insulation or surge test, for at least as long as the test ran.', 'وصّل الملف بالأرضي بعد كل اختبار عزل أو صدمة، لمدة لا تقل عن مدة الاختبار.'),
          sign: { kind: 'warning', pic: 'electric' },
        },
      }],
    },
  ],
};
