/**
 * Welding & fabrication. The V-Lab is a MIG/MAG weld-defect test: the test
 * bead shows a defect and the learner traces it to gas, tip, polarity or
 * liner, without touching the wire drive while the welder is live.
 */
import { criterionLabels, faultRubric } from './shared.js';
import { reading, tx, type Fault, type LabDef } from './types.js';


const L = (en: string, ar: string) => tx(en, ar);

const FAULTS: Fault[] = [
  { code: 'F-GAS-LEAK', componentRef: 'gas_hose', condition: 'leak',
    title: tx('Split shielding-gas hose', 'خرطوم غاز الحماية مشقوق'),
    symptom: tx('Test bead: surface porosity (pin-holes) all along the weld.', 'خط لحام تجريبي: مسامية سطحية (ثقوب دقيقة) على طول اللحام.'),
    correctIsolationSteps: ['Q1:supply', 'GAS:flow', 'HOSE:leak'] },
  { code: 'F-TIP-WORN', componentRef: 'contact_tip', condition: 'worn',
    title: tx('Contact tip bore worn oversize', 'فتحة طرف التلامس متآكلة وأوسع من اللازم'),
    symptom: tx('Test bead: the arc wanders and the wire burns back irregularly.', 'خط لحام تجريبي: القوس يتذبذب والسلك يحترق للخلف بشكل غير منتظم.'),
    correctIsolationSteps: ['Q1:supply', 'GAS:flow', 'TIP:bore'] },
  { code: 'F-POLARITY', componentRef: 'polarity_lead', condition: 'reversed',
    title: tx('Torch polarity reversed (DCEN on solid wire)', 'قطبية المشعل معكوسة (DCEN مع سلك مصمت)'),
    symptom: tx('Test bead: heavy spatter, a narrow ropey bead and shallow penetration.', 'خط لحام تجريبي: رذاذ كثيف، وخط ضيق متكتل، واختراق ضحل.'),
    correctIsolationSteps: ['Q1:supply', 'GAS:flow', 'TORCH:polarity'] },
  { code: 'F-LINER', componentRef: 'liner', condition: 'blocked',
    title: tx('Torch liner blocked with swarf', 'بطانة المشعل مسدودة ببرادة'),
    symptom: tx('Test bead: the wire stutters, then birdnests at the drive rolls.', 'خط لحام تجريبي: السلك يتقطع ثم يتشابك عند بكرات التغذية.'),
    correctIsolationSteps: ['Q1:supply', 'GAS:flow', 'LINER:drag'] },
];

export const migLab: LabDef = {
  trade: 'weld',
  code: 'VLAB-MIG-DEFECT',
  title: tx('MIG weld-defect test', 'اختبار عيوب لحام MIG'),
  unit: { code: 'WELD-L3-U06', title: tx('Diagnose weld defects and equipment faults', 'تشخيص عيوب اللحام وأعطال المعدات') },
  intro: tx('MIG/MAG welder · Weld-defect test', 'ماكينة MIG/MAG · اختبار عيوب اللحام'),
  rigTitle: tx('MIG welder MIG-01', 'ماكينة اللحام MIG-01'),
  rubric: faultRubric({
    id: 'RB-MIG-DEFECT', isolate: 'Welder isolated before opening the feeder', hazard: 'No contact with live wire or tip',
    check: { ref: 'Q1:supply', label: 'Supply voltage read within ±5%', expected: 400, relTol: 0.05 },
    competency: { isolate: 'WELD-L3-U06-E1', diagnose: 'WELD-L3-U06-E2' },
  }),
  criterionLabels: criterionLabels(
    tx('Welder isolated before opening the feeder', 'فصل ماكينة اللحام قبل فتح وحدة التغذية'),
    tx('No contact with live wire or tip', 'عدم لمس السلك أو الطرف وهو مكهرب'),
    tx('Supply voltage read within ±5%', 'قراءة جهد التغذية ضمن ±5%'),
  ),
  faults: FAULTS,
  components: [
    { ref: 'gas_hose', label: tx('Shielding-gas hose', 'خرطوم غاز الحماية') },
    { ref: 'contact_tip', label: tx('Contact tip', 'طرف التلامس') },
    { ref: 'polarity_lead', label: tx('Torch polarity lead', 'كابل قطبية المشعل') },
    { ref: 'liner', label: tx('Torch liner', 'بطانة المشعل') },
    { ref: 'drive_rolls', label: tx('Drive rolls', 'بكرات التغذية') },
  ],
  conditions: [
    { value: 'leak', label: tx('Leaking', 'به تسريب') },
    { value: 'worn', label: tx('Worn / oversize', 'متآكل / واسع') },
    { value: 'reversed', label: tx('Wrong polarity', 'قطبية معكوسة') },
    { value: 'blocked', label: tx('Blocked / kinked', 'مسدود / ملتوٍ') },
  ],
  testPoints: [
    { ref: 'Q1:supply', label: tx('Mains supply at isolator Q1', 'التغذية عند المفتاح Q1'), inside: false, instrument: 'V AC',
      read: reading('V', 398.6, {}, (v) => `${v.toFixed(1)} V`) },
    { ref: 'GAS:flow', label: tx('Gas flow at the nozzle (flow tube)', 'تدفق الغاز عند الفوهة (أنبوب قياس)'), inside: false, instrument: 'L/min',
      read: reading('L/min', 15, { gas_hose: 6 }, (v) => `${v} L/min`) },
    { ref: 'HOSE:leak', label: tx('Gas hose leak test (pressure drop)', 'اختبار تسريب خرطوم الغاز (هبوط الضغط)'), inside: true, instrument: 'bar/min',
      read: reading('bar/min', 0, { gas_hose: 0.6 }, (v) => `${v.toFixed(1)} bar/min`) },
    { ref: 'TIP:bore', label: tx('Contact tip bore (pin gauge)', 'فتحة طرف التلامس (مقياس دبوسي)'), inside: true, instrument: 'mm',
      read: reading('mm', 1.0, { contact_tip: 1.4 }, (v) => `Ø${v.toFixed(1)} mm`) },
    { ref: 'TORCH:polarity', label: tx('Torch lead polarity at output terminals', 'قطبية كابل المشعل عند أطراف الخرج'), inside: true, instrument: 'DC',
      read: ({ isFaulty }) => (isFaulty('polarity_lead')
        ? { reading: -1, unit: 'pol', display: 'DC− (EN)' } : { reading: 1, unit: 'pol', display: 'DC+ (EP)' }) },
    { ref: 'LINER:drag', label: tx('Wire feed drag (spring scale)', 'مقاومة سحب السلك (ميزان زنبركي)'), inside: true, instrument: 'N',
      read: reading('N', 8, { liner: 32 }, (v) => `${v} N`) },
  ],
  ppe: { button: tx('PPE on & extraction on', 'ارتدِ الوقاية وشغّل الشفط') },
  isolation: { ref: 'Q1', chip: 'Q1', lock: tx('Lock off Q1 & close gas', 'افصل واقفل Q1 وأغلق الغاز'), unlock: tx('Remove lock & open gas', 'أزل القفل وافتح الغاز'),
    on: tx('Locked off', 'مفصول ومقفول'), off: tx('Live', 'موصول') },
  enclosure: { chip: tx('Feeder', 'التغذية'), open: tx('Open wire-feed cover', 'افتح غطاء تغذية السلك'), close: tx('Close feed cover', 'أغلق غطاء التغذية'),
    mustOpen: tx('is inside the wire feeder. Open the feed cover first.', 'داخل وحدة تغذية السلك. افتح غطاء التغذية أولًا.') },
  run: { button: tx('Run a test bead', 'نفّذ خط لحام تجريبي'),
    whileLocked: tx('Nothing happens: the welder is locked off.', 'لا شيء يحدث: ماكينة اللحام مفصولة ومقفولة.'),
    whileOpen: tx('Close the feed cover before welding.', 'أغلق غطاء التغذية قبل اللحام.'),
    repaired: tx('Test bead: smooth, even ripples and no porosity.', 'خط لحام تجريبي: ناعم بتموجات منتظمة وبلا مسامية.') },
  danger: { display: tx('⚡ OCV 62 V', '⚡ جهد اللاحمل 62 فولت'), text: tx('You touched the wire drive and contact tip while the welder was live. Lock off Q1 before opening the feeder.',
    'لمست بكرات التغذية وطرف التلامس والماكينة موصولة. افصل واقفل Q1 قبل فتح وحدة التغذية.') },
  steps: [
    { text: L('Put on PPE and switch on fume extraction', 'ارتدِ معدات الوقاية وشغّل شفط الأبخرة'), done: [['ppe']] },
    { text: L('Run a test bead, note the defect, then check supply and gas flow', 'نفّذ خط لحام تجريبي ولاحظ العيب، ثم افحص التغذية وتدفق الغاز'),
      done: [['start_pressed', 'measured@GAS:flow']] },
    { text: L('Lock off Q1 and close the gas cylinder', 'افصل واقفل Q1 وأغلق أسطوانة الغاز'), done: [['loto_applied']] },
    { text: L('Open the wire-feed cover', 'افتح غطاء تغذية السلك'), done: [['panel_opened']] },
    { text: L('Find the cause: hose, tip, polarity or liner', 'حدّد السبب: الخرطوم أو الطرف أو القطبية أو البطانة'),
      done: [['measured@HOSE:leak'], ['measured@TIP:bore'], ['measured@TORCH:polarity'], ['measured@LINER:drag']] },
    { text: L('Submit your diagnosis', 'سجّل تشخيصك'), done: [['diagnosis_submitted']] },
    { text: L('Fix only the cause, then submit for scoring', 'أصلح السبب فقط، ثم أرسل للتقييم'), done: [['component_replaced']] },
  ],
  diagram: {
    captions: [
      { x: 16, y: 22, text: tx('SUPPLY & GAS', 'التغذية والغاز') },
      { x: 16, y: 320, text: tx('INSIDE THE WIRE FEEDER', 'داخل وحدة تغذية السلك') },
    ],
    boxes: [
      { x: 20, y: 44, w: 70, h: 48, label: 'Q1', sub: '400 V', isolator: true },
      { x: 125, y: 44, w: 150, h: 48, label: 'POWER SOURCE', sub: 'CV 250 A' },
      { x: 320, y: 44, w: 110, h: 48, label: 'M21 GAS', sub: 'regulator' },
      { x: 470, y: 44, w: 140, h: 48, label: 'TORCH', sub: 'nozzle · tip' },
      { x: 50, y: 170, w: 110, h: 70, label: 'OUTPUT', sub: '+ / −' },
      { x: 210, y: 170, w: 120, h: 70, label: 'DRIVE ROLLS', sub: '1.0 mm V', round: true },
      { x: 380, y: 186, w: 110, h: 40, label: 'GAS HOSE' },
      { x: 380, y: 256, w: 220, h: 36, label: 'LINER → TIP' },
    ],
    wires: 'M90,68H125M275,68H320M430,68H470M200,92V150H105V170M375,92V150H435V186M160,205H210M330,205H380M490,206H560V92M330,230V274H380M600,274H620V92H610',
    points: [
      { ref: 'Q1:supply', x: 107, y: 68, label: tx('Mains', 'التغذية'), dy: -32 },
      { ref: 'GAS:flow', x: 535, y: 112, label: tx('Flow', 'التدفق'), dx: 36, dy: 4 },
      { ref: 'TORCH:polarity', x: 105, y: 260, label: tx('Polarity', 'القطبية'), dy: 30 },
      { ref: 'LINER:drag', x: 270, y: 260, label: tx('Drag', 'السحب'), dy: 30 },
      { ref: 'HOSE:leak', x: 435, y: 166, label: tx('Leak', 'التسريب'), dx: 0, dy: -14 },
      { ref: 'TIP:bore', x: 560, y: 274, label: tx('Tip', 'الطرف'), dy: 30 },
    ],
    cover: { x: 30, y: 132, w: 596, h: 194, text: tx('Feed cover closed · open it to reach the drive, hose and liner', 'غطاء التغذية مغلق · افتحه للوصول إلى البكرات والخرطوم والبطانة') },
  },
};
