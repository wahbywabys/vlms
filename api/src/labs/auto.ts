/**
 * Automotive mechanics. The V-Lab is a no-crank fault on a light vehicle's
 * starting circuit; the hazard is a spanner across the starter B+ terminal
 * with the battery still connected.
 */
import { criterionLabels, faultRubric } from './shared.js';
import { reading, tx, type Fault, type LabDef } from './types.js';


const L = (en: string, ar: string) => tx(en, ar);
const NO_CLICK = tx('Key to START: the dash lights come on, but there is no click and the engine does not crank.',
  'المفتاح على START: تضيء لمبات التابلوه، لكن لا توجد طقة ولا يدور المحرك.');

const FAULTS: Fault[] = [
  { code: 'F-K3-COIL', componentRef: 'K3_relay', condition: 'open', symptom: NO_CLICK,
    title: tx('Starter relay K3 coil open-circuit', 'ملف مرحل البادئ K3 مفتوح'),
    correctIsolationSteps: ['BAT:terminals', 'IGN:start_signal', 'F12:fuse', 'K3:coil'] },
  { code: 'F-F12-BLOWN', componentRef: 'F12_fuse', condition: 'blown', symptom: NO_CLICK,
    title: tx('Starter fuse F12 (30 A) blown', 'فيوز البادئ F12 ‏(30 أمبير) محروق'),
    correctIsolationSteps: ['BAT:terminals', 'IGN:start_signal', 'F12:fuse'] },
  { code: 'F-SOL-OPEN', componentRef: 'M1_solenoid', condition: 'open',
    symptom: tx('Key to START: the relay clicks under the bonnet, but the starter does not move.', 'المفتاح على START: يطقّ المرحل تحت الكبوت، لكن البادئ لا يتحرك.'),
    title: tx('Starter solenoid pull-in winding open', 'ملف السحب في سولينويد البادئ مفتوح'),
    correctIsolationSteps: ['BAT:terminals', 'IGN:start_signal', 'F12:fuse', 'K3:coil', 'M1:solenoid'] },
  { code: 'F-GND-CORR', componentRef: 'ground_strap', condition: 'corroded',
    symptom: tx('Key to START: the dash lights dim heavily and the starter clicks rapidly.', 'المفتاح على START: تخفت لمبات التابلوه بشدة ويطقطق البادئ بسرعة.'),
    title: tx('Engine ground strap corroded (high resistance)', 'شريط أرضي المحرك متآكل (مقاومة عالية)'),
    correctIsolationSteps: ['BAT:terminals', 'GND:strap'] },
];

export const autoLab: LabDef = {
  trade: 'auto',
  code: 'VLAB-AUTO-NOCRANK',
  title: tx('No-crank fault test', 'اختبار عطل عدم دوران المحرك'),
  unit: { code: 'AUTO-L3-U04', title: tx('Diagnose starting circuit faults', 'تشخيص أعطال دائرة البدء') },
  intro: tx('Starting circuit · No-crank fault', 'دائرة البدء · المحرك لا يدور'),
  rigTitle: tx('Training car 2 · starting circuit', 'سيارة التدريب 2 · دائرة البدء'),
  rubric: faultRubric({
    id: 'RB-AUTO-NOCRANK', isolate: 'Battery isolated before working on the starter', hazard: 'No short across the starter B+',
    check: { ref: 'BAT:terminals', label: 'Battery voltage read within ±5%', expected: 12.6, relTol: 0.05 },
    competency: { isolate: 'AUTO-L3-U04-E1', diagnose: 'AUTO-L3-U04-E2' },
  }),
  criterionLabels: criterionLabels(
    tx('Battery isolated before working on the starter', 'فصل البطارية قبل العمل على البادئ'),
    tx('No short across the starter B+', 'عدم قصر طرف B+ في البادئ'),
    tx('Battery voltage read within ±5%', 'قراءة جهد البطارية ضمن ±5%'),
  ),
  faults: FAULTS,
  components: [
    { ref: 'F12_fuse', label: tx('F12 starter fuse 30 A', 'فيوز البادئ F12 ‏30 أمبير') },
    { ref: 'K3_relay', label: tx('K3 starter relay', 'مرحل البادئ K3') },
    { ref: 'M1_solenoid', label: tx('Starter solenoid', 'سولينويد البادئ') },
    { ref: 'ground_strap', label: tx('Engine ground strap', 'شريط أرضي المحرك') },
    { ref: 'ign_switch', label: tx('Ignition switch', 'مفتاح الإشعال') },
  ],
  conditions: [
    { value: 'open', label: tx('Open circuit', 'دائرة مفتوحة') },
    { value: 'blown', label: tx('Blown', 'محروق') },
    { value: 'corroded', label: tx('Corroded / high resistance', 'متآكل / مقاومة عالية') },
    { value: 'short', label: tx('Short to ground', 'قصر مع الأرضي') },
  ],
  testPoints: [
    { ref: 'BAT:terminals', label: tx('Battery terminals', 'أطراف البطارية'), inside: false, instrument: 'V DC',
      read: reading('V', 12.6, {}, (v) => `${v.toFixed(2)} V`) },
    { ref: 'IGN:start_signal', label: tx('Start signal at K3 pin 86 (key in START)', 'إشارة البدء عند الطرف 86 في K3 (المفتاح على START)'), inside: false, instrument: 'V DC',
      read: ({ rig }) => (rig.locked ? { reading: 0, unit: 'V', display: '0.00 V' } : { reading: 12.1, unit: 'V', display: '12.10 V' }) },
    { ref: 'F12:fuse', label: tx('F12 fuse continuity', 'استمرارية الفيوز F12'), inside: true, instrument: 'Ω',
      read: reading('Ω', 0.02, { F12_fuse: null }, (v) => `${v.toFixed(2)} Ω`) },
    { ref: 'K3:coil', label: tx('K3 relay coil 85–86', 'ملف المرحل K3 ‏85–86'), inside: true, instrument: 'Ω',
      read: reading('Ω', 82, { K3_relay: null }, (v) => `${v.toFixed(1)} Ω`) },
    { ref: 'M1:solenoid', label: tx('Solenoid pull-in winding', 'ملف السحب في السولينويد'), inside: true, instrument: 'Ω',
      read: reading('Ω', 0.4, { M1_solenoid: null }, (v) => `${v.toFixed(2)} Ω`) },
    { ref: 'GND:strap', label: tx('Engine ground strap', 'شريط أرضي المحرك'), inside: true, instrument: 'Ω',
      read: reading('Ω', 0.01, { ground_strap: 1.8 }, (v) => `${v.toFixed(2)} Ω`) },
  ],
  ppe: { button: tx('PPE on & chock wheels', 'ارتدِ الوقاية وثبّت العجلات') },
  isolation: { ref: 'BAT-', chip: 'BAT −', lock: tx('Disconnect battery (−) & tag', 'افصل القطب السالب للبطارية وعلّق البطاقة'),
    unlock: tx('Reconnect battery', 'أعد توصيل البطارية'), on: tx('Isolated', 'مفصولة'), off: tx('Connected', 'موصولة') },
  enclosure: { chip: tx('Covers', 'الأغطية'), open: tx('Remove fuse-box & starter covers', 'افتح غطاء الفيوزات وغطاء البادئ'),
    close: tx('Refit covers', 'أعد تركيب الأغطية'), mustOpen: tx('is under a cover. Remove the covers first.', 'تحت غطاء. افتح الأغطية أولًا.') },
  run: { button: tx('Turn key to START', 'أدر المفتاح إلى START'),
    whileLocked: tx('Nothing at all: the battery is disconnected.', 'لا شيء مطلقًا: البطارية مفصولة.'),
    whileOpen: tx('Refit the covers before cranking the engine.', 'أعد تركيب الأغطية قبل تدوير المحرك.'),
    repaired: tx('The engine cranks briskly and starts.', 'يدور المحرك بقوة ويعمل.') },
  danger: { display: tx('⚡ SHORT', '⚡ قصر'), text: tx('Your spanner bridged the starter B+ terminal to the body with the battery connected: a dead short that can burn you or start a fire. Disconnect the negative terminal first.',
    'المفتاح الذي تمسكه وصل طرف B+ في البادئ بجسم السيارة والبطارية موصولة: قصر كامل قد يحرقك أو يشعل حريقًا. افصل القطب السالب أولًا.') },
  steps: [
    { text: L('Put on PPE and chock the wheels', 'ارتدِ معدات الوقاية وثبّت العجلات'), done: [['ppe']] },
    { text: L('Turn the key to START, note the symptom, then measure the battery', 'أدر المفتاح إلى START ولاحظ العَرَض، ثم قِس جهد البطارية'),
      done: [['start_pressed', 'measured@BAT:terminals']] },
    { text: L('Check the start signal at K3 with the key in START', 'افحص إشارة البدء عند K3 والمفتاح على START'), done: [['measured@IGN:start_signal']] },
    { text: L('Disconnect the battery negative and tag it', 'افصل القطب السالب للبطارية وعلّق البطاقة'), done: [['loto_applied']] },
    { text: L('Remove the fuse-box and starter covers', 'افتح غطاء الفيوزات وغطاء البادئ'), done: [['panel_opened']] },
    { text: L('Test in order: F12, K3 coil, solenoid, ground strap', 'اختبر بالترتيب: F12، ملف K3، السولينويد، شريط الأرضي'),
      done: [['measured@F12:fuse', 'measured@K3:coil'], ['measured@GND:strap'], ['measured@M1:solenoid']] },
    { text: L('Submit your diagnosis', 'سجّل تشخيصك'), done: [['diagnosis_submitted']] },
    { text: L('Replace only the faulty part, then submit for scoring', 'استبدل القطعة التالفة فقط، ثم أرسل للتقييم'), done: [['component_replaced']] },
  ],
  diagram: {
    captions: [
      { x: 16, y: 22, text: tx('BATTERY & IGNITION · 12 V', 'البطارية والإشعال · 12 فولت') },
      { x: 16, y: 320, text: tx('UNDER THE COVERS', 'تحت الأغطية') },
    ],
    boxes: [
      { x: 20, y: 44, w: 110, h: 48, label: 'BATTERY', sub: '12 V 60 Ah', isolator: true },
      { x: 250, y: 44, w: 100, h: 48, label: 'IGN SW', sub: 'START' },
      { x: 470, y: 44, w: 130, h: 48, label: 'ECU', sub: 'immobiliser' },
      { x: 50, y: 176, w: 70, h: 44, label: 'F12', sub: '30 A' },
      { x: 210, y: 166, w: 100, h: 64, label: 'K3', sub: 'relay 85–86' },
      { x: 390, y: 160, w: 130, h: 76, label: 'M1 STARTER', sub: 'solenoid', round: true },
      { x: 540, y: 254, w: 80, h: 40, label: 'GND', sub: 'strap' },
    ],
    wires: 'M130,68H250M350,68H470M300,92V140H260V166M75,92V176M85,220V262H350V236H455M120,198H210M310,198H390M520,198H580V254M580,294V312H40V92',
    points: [
      { ref: 'BAT:terminals', x: 160, y: 68, label: tx('BAT', 'البطارية'), dy: -14 },
      { ref: 'IGN:start_signal', x: 300, y: 116, label: tx('Pin 86', 'طرف 86'), dx: 44, dy: 4 },
      { ref: 'F12:fuse', x: 85, y: 156, label: tx('F12', 'F12'), dx: 32, dy: 4 },
      { ref: 'K3:coil', x: 260, y: 252, label: tx('85–86', '85–86'), dy: 30 },
      { ref: 'M1:solenoid', x: 455, y: 150, label: tx('Sol.', 'السولينويد'), dx: 50, dy: 4 },
      { ref: 'GND:strap', x: 580, y: 236, label: tx('GND', 'الأرضي'), dx: 34, dy: -10 },
    ],
    cover: { x: 30, y: 132, w: 596, h: 194, text: tx('Covers fitted · remove them to reach the parts', 'الأغطية مركّبة · افتحها للوصول إلى القطع') },
  },
};
