/**
 * Electrical installation. Its V-Lab is the DOL motor-starter fault test
 * (VLAB-DOL-STARTER); the rubric is the same JSON as RB-DOL-FAULT in
 * db/seed.sql, scored by the real rubric engine from the API.
 */
import { criterionLabels, faultRubric } from './shared.js';
import { tx, type Fault, type LabDef, type TestPoint } from './types.js';

const ohms = (r: number | null) => ({ reading: r, unit: 'Ω', display: r === null ? 'OL' : `${r.toFixed(1)} Ω` });

const TEST_POINTS: TestPoint[] = [
  // Incoming terminals sit upstream of the isolator: always live.
  { ref: 'X1:L1-L2', label: tx('X1 incoming supply L1–L2', 'X1 التغذية الداخلة L1–L2'), inside: false, instrument: 'V AC',
    read: () => ({ reading: 401.2, unit: 'V', display: '401.2 V' }) },
  { ref: 'Q1:load_side', label: tx('Q1 load side (prove dead)', 'مخرج Q1 (إثبات انعدام الجهد)'), inside: false, instrument: 'V AC',
    read: ({ rig }) => (rig.locked ? { reading: 0, unit: 'V', display: '0.0 V' } : { reading: 400.8, unit: 'V', display: '400.8 V' }) },
  { ref: 'Q1:control_supply', label: tx('Control supply via F1', 'تغذية التحكم عبر F1'), inside: true, instrument: 'Ω',
    read: ({ isFaulty }) => ohms(isFaulty('F1_fuse') ? null : 0.4) },
  { ref: 'S1:stop_pb', label: tx('S1 stop button (NC)', 'S1 زر الإيقاف (NC)'), inside: true, instrument: 'Ω',
    read: ({ isFaulty }) => ohms(isFaulty('S1_stop') ? null : 0.1) },
  // NO contact: open at rest is normal.
  { ref: 'S2:start_pb', label: tx('S2 start button (NO)', 'S2 زر التشغيل (NO)'), inside: true, instrument: 'Ω', read: () => ohms(null) },
  { ref: 'F2:95-96', label: tx('F2 overload contact 95–96', 'تلامس الحمل الزائد F2 ‏95–96'), inside: true, instrument: 'Ω',
    read: ({ isFaulty }) => ohms(isFaulty('F2_overload') ? null : 0.1) },
  { ref: 'KM1:A1-A2', label: tx('KM1 coil A1–A2', 'ملف KM1 ‏A1–A2'), inside: true, instrument: 'Ω',
    read: ({ isFaulty }) => ohms(isFaulty('KM1_coil') ? null : 540) },
];

const NO_PULL_IN = tx('Nothing happens. KM1 does not pull in and the motor stays still.', 'لا شيء يحدث. لا يجذب KM1 ويبقى المحرك ساكنًا.');
const FAULTS: Fault[] = [
  { code: 'F-OL-OPEN', componentRef: 'F2_overload', condition: 'open', symptom: NO_PULL_IN,
    title: tx('Overload NC contact 95-96 open-circuit', 'تلامس الحمل الزائد NC ⁦95-96⁩ مفتوح'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb', 'F2:95-96'] },
  { code: 'F-S1-OPEN', componentRef: 'S1_stop', condition: 'open', symptom: NO_PULL_IN,
    title: tx('Stop push-button NC contact open', 'تلامس زر الإيقاف NC مفتوح'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb'] },
  { code: 'F-KM-COIL', componentRef: 'KM1_coil', condition: 'open', symptom: NO_PULL_IN,
    title: tx('Contactor coil A1-A2 open-circuit', 'ملف الكونتاكتور ⁦A1-A2⁩ مفتوح'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb', 'F2:95-96', 'KM1:A1-A2'] },
  { code: 'F-F1-BLOWN', componentRef: 'F1_fuse', condition: 'blown', symptom: NO_PULL_IN,
    title: tx('Control fuse F1 blown', 'فيوز التحكم F1 محروق'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply'] },
];

const L = (en: string, ar: string) => tx(en, ar);

export const dolLab: LabDef = {
  trade: 'elec',
  code: 'VLAB-DOL-STARTER',
  title: tx('DOL starter fault test', 'اختبار أعطال بادئ DOL'),
  unit: { code: 'ELEC-L3-U04', title: tx('Diagnose faults in motor control circuits', 'تشخيص أعطال دوائر تحكم المحركات') },
  intro: tx('DOL motor starter · Fault test', 'بادئ المحرك المباشر DOL · اختبار الأعطال'),
  rigTitle: tx('Starter panel', 'لوحة البادئ'),
  rubric: faultRubric({
    id: 'RB-DOL-FAULT', isolate: 'LOTO applied before panel work', hazard: 'No contact with live parts',
    check: { ref: 'X1:L1-L2', label: 'Supply voltage within ±5%', expected: 400, relTol: 0.05 },
    competency: { isolate: 'ELEC-L3-U04-E1', diagnose: 'ELEC-L3-U04-E2' },
  }),
  criterionLabels: criterionLabels(
    tx('LOTO applied before panel work', 'تطبيق LOTO قبل العمل داخل اللوحة'),
    tx('No contact with live parts', 'عدم لمس أجزاء حية'),
    tx('Supply voltage within ±5%', 'جهد التغذية ضمن ±5%'),
  ),
  faults: FAULTS,
  components: [
    { ref: 'F1_fuse', label: tx('F1 control fuse', 'F1 فيوز التحكم') },
    { ref: 'S1_stop', label: tx('S1 stop push-button', 'S1 زر الإيقاف') },
    { ref: 'S2_start', label: tx('S2 start push-button', 'S2 زر التشغيل') },
    { ref: 'F2_overload', label: tx('F2 thermal overload relay', 'F2 مرحل الحمل الزائد الحراري') },
    { ref: 'KM1_coil', label: tx('KM1 contactor coil', 'KM1 ملف الكونتاكتور') },
  ],
  conditions: [
    { value: 'open', label: tx('Open circuit / contact open', 'دائرة مفتوحة / تلامس مفتوح') },
    { value: 'blown', label: tx('Blown', 'محروق') },
    { value: 'welded', label: tx('Contacts welded shut', 'تلامسات ملتحمة') },
    { value: 'short', label: tx('Short circuit', 'قصر') },
  ],
  testPoints: TEST_POINTS,
  ppe: { button: tx('Put on PPE', 'ارتدِ معدات الوقاية') },
  isolation: { ref: 'Q1', chip: 'Q1', lock: tx('Lock off Q1 (LOTO)', 'افصل واقفل Q1 (LOTO)'), unlock: tx('Remove lock & tag', 'إزالة القفل والبطاقة'),
    on: tx('Locked off', 'مفصول ومقفول'), off: tx('Live', 'موصول') },
  enclosure: { chip: tx('Door', 'الباب'), open: tx('Open panel door', 'افتح باب اللوحة'), close: tx('Close panel door', 'أغلق باب اللوحة'),
    mustOpen: tx('is inside the panel. Open the panel door first.', 'داخل اللوحة. افتح باب اللوحة أولًا.') },
  run: { button: tx('Press START', 'اضغط START'),
    whileLocked: tx('Nothing happens: Q1 is locked off, so there is no supply.', 'لا شيء يحدث: Q1 مقفول، فلا توجد تغذية.'),
    whileOpen: tx('Close the panel door before operating the starter.', 'أغلق باب اللوحة قبل تشغيل البادئ.'),
    repaired: tx('KM1 pulls in and the motor runs. Press stop when done.', 'يجذب KM1 ويدور المحرك. اضغط الإيقاف عند الانتهاء.') },
  danger: { display: tx('230 V AC', '230 V AC'), text: tx('You touched live terminals. The control circuit is energised because Q1 is not locked off.',
    'لمست أطرافًا مكهربة. دائرة التحكم ما زالت موصولة بالتغذية لأن Q1 غير مقفول.') },
  steps: [
    { text: L('Put on PPE: arc-rated face shield, gloves, safety boots', 'ارتدِ معدات الوقاية: واقي وجه مقاوم للقوس الكهربائي، قفازات، حذاء أمان'), done: [['ppe']] },
    { text: L('Press START and note the symptom, then measure the supply at X1 L1–L2', 'اضغط START ولاحظ العَرَض، ثم قِس التغذية عند X1 ‏L1–L2'),
      done: [['start_pressed', 'measured@X1:L1-L2']] },
    { text: L('Switch off Q1, fit your lock and tag (LOTO)', 'افصل Q1 وركّب القفل والبطاقة (LOTO)'), done: [['loto_applied']] },
    { text: L('Prove dead at the Q1 load side', 'أثبت انعدام الجهد عند مخرج Q1'), done: [['measured@Q1:load_side']] },
    { text: L('Open the panel door', 'افتح باب اللوحة'), done: [['panel_opened']] },
    { text: L('Test the control circuit in order: F1 supply, S1, F2 95–96, KM1 coil', 'اختبر دائرة التحكم بالترتيب: تغذية F1، ثم S1، ثم F2 ‏95–96، ثم ملف KM1'),
      done: [['measured@Q1:control_supply', 'measured@S1:stop_pb', 'measured@F2:95-96'], ['measured@KM1:A1-A2']] },
    { text: L('Submit your diagnosis', 'سجّل تشخيصك'), done: [['diagnosis_submitted']] },
    { text: L('Replace only the faulty part, then submit for scoring', 'استبدل القطعة التالفة فقط، ثم أرسل للتقييم'), done: [['component_replaced']] },
  ],
  diagram: 'dol',
  explore: { title: tx('3-Phase Induction Motor · IEC 132M', 'محرك حثي ثلاثي الأطوار · IEC 132M'), assetTag: 'WS-ELEC-07 / MTR-0132' },
};
