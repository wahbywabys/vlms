/**
 * CNC machining. The V-Lab is a quality fault test on a CNC lathe: the part
 * comes off oversize or rough, and the learner has to find out why without
 * reaching into the work area while the spindle can still start.
 */
import { criterionLabels, faultRubric } from './shared.js';
import { reading, tx, type Fault, type LabDef } from './types.js';


const mm3 = (v: number) => `${v.toFixed(3)} mm`;
const L = (en: string, ar: string) => tx(en, ar);

const FAULTS: Fault[] = [
  { code: 'F-INSERT-WORN', componentRef: 'T01_insert', condition: 'worn',
    title: tx('T01 insert flank wear beyond limit', 'تآكل جانب لقمة T01 فوق الحد'),
    symptom: tx('Test cut: Ø25.040 is oversize and the finish is dull and torn.', 'قطع تجريبي: القطر Ø25.040 أكبر من المطلوب والسطح باهت وممزق.'),
    correctIsolationSteps: ['CHUCK:pressure', 'PART:dia', 'PART:ra', 'T01:flank'] },
  { code: 'F-OFFSET-X', componentRef: 'offset_x', condition: 'wrong_value',
    title: tx('T01 X wear offset entered wrong (+0.100)', 'إزاحة تآكل X للعدة T01 مُدخلة خطأ (+0.100)'),
    symptom: tx('Test cut: Ø25.090 is oversize, but the finish looks good.', 'قطع تجريبي: القطر Ø25.090 أكبر من المطلوب، لكن السطح جيد.'),
    correctIsolationSteps: ['CHUCK:pressure', 'PART:dia', 'PART:ra', 'CTRL:offset_x'] },
  { code: 'F-JAW-LOOSE', componentRef: 'chuck_jaws', condition: 'loose',
    title: tx('Chuck jaws not gripping (worn serrations)', 'فكوك الظرف لا تمسك جيدًا (أسنان متآكلة)'),
    symptom: tx('Test cut: chatter marks and a wobble you can see on the part.', 'قطع تجريبي: علامات اهتزاز وتذبذب ظاهر في القطعة.'),
    correctIsolationSteps: ['CHUCK:pressure', 'PART:ra', 'SPINDLE:runout'] },
  { code: 'F-COOLANT-LEAN', componentRef: 'coolant', condition: 'low',
    title: tx('Coolant mix too lean (1.5%)', 'تركيز سائل التبريد منخفض جدًا (1.5%)'),
    symptom: tx('Test cut: smoky cut, built-up edge on the insert, finish Ra 2.6.', 'قطع تجريبي: دخان أثناء القطع، وتراكم على حد اللقمة، وخشونة Ra 2.6.'),
    correctIsolationSteps: ['CHUCK:pressure', 'PART:ra', 'T01:flank', 'COOLANT:conc'] },
];

export const cncLab: LabDef = {
  trade: 'cnc',
  code: 'VLAB-CNC-QUALITY',
  title: tx('CNC lathe quality fault test', 'اختبار أعطال الجودة في مخرطة CNC'),
  unit: { code: 'CNC-L3-U06', title: tx('Diagnose machining quality faults', 'تشخيص أعطال جودة التشغيل') },
  intro: tx('CNC lathe · Part out of tolerance', 'مخرطة CNC · قطعة خارج التفاوت'),
  rigTitle: tx('CNC lathe CNC-01', 'مخرطة CNC-01'),
  rubric: faultRubric({
    id: 'RB-CNC-QUALITY', isolate: 'Machine locked out before reaching in', hazard: 'No hands in the work area while armed',
    check: { ref: 'CHUCK:pressure', label: 'Chuck pressure read within ±10%', expected: 25, relTol: 0.1 },
    competency: { isolate: 'CNC-L3-U06-E1', diagnose: 'CNC-L3-U06-E2' },
  }),
  criterionLabels: criterionLabels(
    tx('Machine locked out before reaching in', 'إيقاف الماكينة وإقفالها قبل مدّ اليد'),
    tx('No hands in the work area while armed', 'عدم إدخال اليد في منطقة العمل والماكينة جاهزة للدوران'),
    tx('Chuck pressure read within ±10%', 'قراءة ضغط الظرف ضمن ±10%'),
  ),
  faults: FAULTS,
  components: [
    { ref: 'T01_insert', label: tx('T01 turning insert (CNMG)', 'لقمة الخراطة T01 ‏(CNMG)') },
    { ref: 'offset_x', label: tx('T01 X wear offset', 'إزاحة تآكل X للعدة T01') },
    { ref: 'chuck_jaws', label: tx('Chuck jaws', 'فكوك الظرف') },
    { ref: 'coolant', label: tx('Coolant mix', 'خليط سائل التبريد') },
    { ref: 'spindle_bearing', label: tx('Spindle bearings', 'رولمان عمود الدوران') },
  ],
  conditions: [
    { value: 'worn', label: tx('Worn beyond limit', 'متآكل فوق الحد') },
    { value: 'wrong_value', label: tx('Wrong value entered', 'قيمة مُدخلة خطأ') },
    { value: 'loose', label: tx('Loose / not gripping', 'مرتخٍ / لا يمسك') },
    { value: 'low', label: tx('Too lean / low', 'منخفض / ضعيف التركيز') },
  ],
  testPoints: [
    { ref: 'CHUCK:pressure', label: tx('Chuck hydraulic pressure gauge', 'مقياس ضغط هيدروليك الظرف'), inside: false, instrument: 'bar',
      read: reading('bar', 25, {}, (v) => `${v.toFixed(1)} bar`) },
    { ref: 'CTRL:offset_x', label: tx('Offset page: T01 X wear', 'صفحة الإزاحات: تآكل X للعدة T01'), inside: false, instrument: 'mm',
      read: reading('mm', 0, { offset_x: 0.1 }, (v) => `+${v.toFixed(3)} mm`) },
    { ref: 'COOLANT:conc', label: tx('Coolant concentration (refractometer)', 'تركيز سائل التبريد (رفراكتومتر)'), inside: false, instrument: '%',
      read: reading('%', 6, { coolant: 1.5 }, (v) => `${v.toFixed(1)} %`) },
    { ref: 'PART:dia', label: tx('Part diameter (micrometer)', 'قطر القطعة (ميكرومتر)'), inside: true, instrument: 'mm',
      read: reading('mm', 24.99, { T01_insert: 25.04, offset_x: 25.09, chuck_jaws: 25.006, coolant: 24.994 }, mm3) },
    { ref: 'PART:ra', label: tx('Surface roughness Ra (tester)', 'خشونة السطح Ra (جهاز قياس)'), inside: true, instrument: 'µm',
      read: reading('µm', 1.2, { T01_insert: 3.4, chuck_jaws: 4.1, coolant: 2.6 }, (v) => `Ra ${v.toFixed(1)} µm`) },
    { ref: 'SPINDLE:runout', label: tx('Part runout (dial indicator)', 'انحراف دوران القطعة (ساعة قياس)'), inside: true, instrument: 'mm TIR',
      read: reading('mm', 0.005, { chuck_jaws: 0.08 }, mm3) },
    { ref: 'T01:flank', label: tx('T01 insert flank wear VB (loupe)', 'تآكل جانب اللقمة T01 ‏VB (عدسة)'), inside: true, instrument: 'mm VB',
      read: reading('mm', 0.08, { T01_insert: 0.45, coolant: 0.22 }, (v) => `VB ${v.toFixed(2)} mm`) },
  ],
  ppe: { button: tx('Put on PPE', 'ارتدِ معدات الوقاية') },
  isolation: { ref: 'ESTOP', chip: 'E-STOP', lock: tx('E-stop & lock key in SETUP', 'اضغط الطوارئ واقفل المفتاح على SETUP'),
    unlock: tx('Release E-stop & key', 'حرّر زر الطوارئ والمفتاح'), on: tx('Locked out', 'مُقفلة'), off: tx('Armed', 'جاهزة للدوران') },
  enclosure: { chip: tx('Guard', 'الواقي'), open: tx('Open guard door', 'افتح باب الواقي'), close: tx('Close guard door', 'أغلق باب الواقي'),
    mustOpen: tx('is behind the guard. Open the guard door first.', 'خلف الواقي. افتح باب الواقي أولًا.') },
  run: { button: tx('Run test cut', 'شغّل قطعًا تجريبيًا'),
    whileLocked: tx('Cycle start does nothing: the control is in E-stop.', 'زر بدء الدورة لا يعمل: وحدة التحكم في وضع الطوارئ.'),
    whileOpen: tx('The door interlock blocks cycle start. Close the guard first.', 'قفل الباب يمنع بدء الدورة. أغلق الواقي أولًا.'),
    repaired: tx('Test cut: Ø24.990, Ra 1.2. The part is in tolerance.', 'قطع تجريبي: Ø24.990، ‏Ra 1.2. القطعة ضمن التفاوت.') },
  danger: { display: tx('HAZARD', 'خطر'), text: tx('You reached into the work area while the spindle could still start. Press E-stop and lock the key before opening the guard.',
    'مددت يدك إلى منطقة العمل وعمود الدوران ما زال قادرًا على الدوران. اضغط زر الطوارئ واقفل المفتاح قبل فتح الواقي.') },
  steps: [
    { text: L('Put on PPE: safety glasses, boots, sleeves rolled, no gloves near the spindle', 'ارتدِ معدات الوقاية: نظارة، حذاء أمان، أكمام مرفوعة، بلا قفازات قرب عمود الدوران'), done: [['ppe']] },
    { text: L('Run a test cut and read the chuck pressure gauge', 'شغّل قطعًا تجريبيًا واقرأ مقياس ضغط الظرف'),
      done: [['start_pressed', 'measured@CHUCK:pressure']] },
    { text: L('Press E-stop and lock the key in SETUP', 'اضغط زر الطوارئ واقفل المفتاح على SETUP'), done: [['loto_applied']] },
    { text: L('Open the guard door', 'افتح باب الواقي'), done: [['panel_opened']] },
    { text: L('Measure the part: diameter, then finish', 'قِس القطعة: القطر ثم خشونة السطح'), done: [['measured@PART:dia', 'measured@PART:ra']] },
    { text: L('Find the cause: runout, insert wear, offsets or coolant', 'حدّد السبب: انحراف الدوران أو تآكل اللقمة أو الإزاحات أو سائل التبريد'),
      done: [['measured@SPINDLE:runout'], ['measured@T01:flank'], ['measured@CTRL:offset_x'], ['measured@COOLANT:conc']] },
    { text: L('Submit your diagnosis', 'سجّل تشخيصك'), done: [['diagnosis_submitted']] },
    { text: L('Fix only the cause, then submit for scoring', 'أصلح السبب فقط، ثم أرسل للتقييم'), done: [['component_replaced']] },
  ],
  diagram: {
    captions: [
      { x: 16, y: 22, text: tx('CONTROL & SERVICES', 'التحكم والخدمات') },
      { x: 16, y: 320, text: tx('WORK AREA · behind the guard', 'منطقة العمل · خلف الواقي') },
    ],
    boxes: [
      { x: 20, y: 44, w: 120, h: 48, label: 'CNC CONTROL', sub: 'offsets' },
      { x: 170, y: 44, w: 80, h: 48, label: 'E-STOP', sub: 'key', isolator: true },
      { x: 280, y: 44, w: 100, h: 48, label: 'CHUCK HYD', sub: '25 bar' },
      { x: 410, y: 44, w: 90, h: 48, label: 'COOLANT', sub: 'tank' },
      { x: 530, y: 44, w: 90, h: 48, label: 'SPINDLE', sub: '11 kW' },
      { x: 56, y: 168, w: 80, h: 112, label: 'CHUCK', sub: '3-jaw' },
      { x: 136, y: 204, w: 230, h: 40, label: 'Ø25 h7' },
      { x: 400, y: 262, w: 96, h: 44, label: 'T01', sub: 'CNMG' },
      { x: 520, y: 196, w: 90, h: 56, label: 'TAILSTOCK' },
    ],
    wires: 'M140,68H170M250,68H280M330,92V150H96V168M455,92V176L420,200M575,92V140H40V224H56M366,224H520M448,262V244',
    points: [
      { ref: 'CTRL:offset_x', x: 80, y: 112, label: tx('Offset', 'الإزاحة'), dy: 4, dx: 40 },
      { ref: 'CHUCK:pressure', x: 330, y: 112, label: tx('Gauge', 'المقياس'), dx: 42, dy: 4 },
      { ref: 'COOLANT:conc', x: 490, y: 112, label: tx('Mix %', 'التركيز'), dx: 40, dy: 4 },
      { ref: 'SPINDLE:runout', x: 170, y: 186, label: tx('Runout', 'الانحراف') },
      { ref: 'PART:dia', x: 250, y: 186, label: tx('Ø', 'القطر') },
      { ref: 'PART:ra', x: 330, y: 186, label: tx('Ra', 'Ra') },
      { ref: 'T01:flank', x: 448, y: 284, label: tx('VB', 'VB'), dx: 0, dy: -28 },
    ],
    cover: { x: 30, y: 132, w: 596, h: 194, text: tx('Guard door closed · open it to reach the part and tool', 'باب الواقي مغلق · افتحه للوصول إلى القطعة والعدة') },
  },
  explore: { title: tx('Spindle drive motor · IEC 132M', 'محرك عمود الدوران · IEC 132M'), assetTag: 'CNC-01 / MTR-0132' },
};
