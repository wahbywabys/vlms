/**
 * Electrical installation. Its V-Lab is the DOL motor-starter fault test
 * (VLAB-DOL-STARTER); the rubric is the same JSON as RB-DOL-FAULT in
 * db/seed.sql, scored by the real rubric engine from the API.
 */
import { tx } from '../i18n';
import { criterionLabels, faultRubric, heatmap } from './shared';
import type { Fault, RigState, TestPoint, Trade } from './types';

const ohms = (r: number | null) => ({ reading: r, unit: 'Ω', display: r === null ? 'OL' : `${r.toFixed(1)} Ω` });
const open = (fault: Fault, rig: RigState, component: string) => !rig.replaced.includes(fault.componentRef) && fault.componentRef === component;

const TEST_POINTS: TestPoint[] = [
  // Incoming terminals sit upstream of the isolator: always live.
  { ref: 'X1:L1-L2', label: tx('X1 incoming supply L1–L2', 'X1 التغذية الداخلة L1–L2'), inside: false, instrument: 'V AC',
    read: () => ({ reading: 401.2, unit: 'V', display: '401.2 V' }) },
  { ref: 'Q1:load_side', label: tx('Q1 load side (prove dead)', 'مخرج Q1 (إثبات انعدام الجهد)'), inside: false, instrument: 'V AC',
    read: (_f, rig) => (rig.locked ? { reading: 0, unit: 'V', display: '0.0 V' } : { reading: 400.8, unit: 'V', display: '400.8 V' }) },
  { ref: 'Q1:control_supply', label: tx('Control supply via F1', 'تغذية التحكم عبر F1'), inside: true, instrument: 'Ω',
    read: (f, rig) => ohms(open(f, rig, 'F1_fuse') ? null : 0.4) },
  { ref: 'S1:stop_pb', label: tx('S1 stop button (NC)', 'S1 زر الإيقاف (NC)'), inside: true, instrument: 'Ω',
    read: (f, rig) => ohms(open(f, rig, 'S1_stop') ? null : 0.1) },
  // NO contact: open at rest is normal.
  { ref: 'S2:start_pb', label: tx('S2 start button (NO)', 'S2 زر التشغيل (NO)'), inside: true, instrument: 'Ω', read: () => ohms(null) },
  { ref: 'F2:95-96', label: tx('F2 overload contact 95–96', 'تلامس الحمل الزائد F2 ‏95–96'), inside: true, instrument: 'Ω',
    read: (f, rig) => ohms(open(f, rig, 'F2_overload') ? null : 0.1) },
  { ref: 'KM1:A1-A2', label: tx('KM1 coil A1–A2', 'ملف KM1 ‏A1–A2'), inside: true, instrument: 'Ω',
    read: (f, rig) => ohms(open(f, rig, 'KM1_coil') ? null : 540) },
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

export const elec: Trade = {
  id: 'elec',
  code: 'ELEC',
  name: tx('Electrical installation', 'التركيبات الكهربائية'),
  icon: 'M13 2 4 14h7l-1 8 9-12h-7z',
  framework: { code: 'NTQF-ELEC-L3', title: tx('Industrial Electrical Maintenance L3', 'الصيانة الكهربائية الصناعية — المستوى 3') },
  units: [
    { code: 'U01', title: tx('Safe isolation & LOTO', 'العزل الآمن والإقفال (LOTO)') },
    { code: 'U02', title: tx('Wiring regulations & containment', 'لوائح التمديدات والمجاري') },
    { code: 'U03', title: tx('Inspection & testing', 'الفحص والاختبار') },
    { code: 'U04', title: tx('Motor control fault finding', 'تتبع أعطال دوائر تحكم المحركات') },
    { code: 'U05', title: tx('Distribution boards & RCDs', 'لوحات التوزيع وأجهزة RCD') },
    { code: 'U06', title: tx('PLC fundamentals', 'أساسيات PLC') },
  ],
  bay: {
    name: tx('Electrical Lab 1', 'معمل الكهرباء 1'),
    cohort: tx('Electrical installation Y2-A', 'التركيبات الكهربائية، السنة الثانية أ'),
    trainer: tx('Eng. Mahmoud Fawzy', 'م. محمود فوزي'), trainerInitials: tx('MF', 'م'),
    jobCards: 'JC-E140, JC-E143',
  },
  learner: { name: tx('Rana Ibrahim', 'رنا إبراهيم'), initials: tx('RI', 'ر') },
  stations: (() => {
    const DOL = tx('Wire a DOL starter to drawing E-07', 'توصيل بادئ DOL حسب المخطط E-07');
    const RCBO = tx('Install an RCBO radial circuit', 'تركيب دائرة شعاعية بقاطع RCBO');
    return [
      { no: 1, learner: tx('Rana Ibrahim', 'رنا إبراهيم'), jobCard: 'JC-E140', task: DOL, status: 'working' },
      { no: 2, learner: tx('Hazem Adly', 'حازم عدلي'), jobCard: 'JC-E140', task: DOL, status: 'done', score: 84, passed: true },
      { no: 3, learner: tx('Mona Shaker', 'منى شاكر'), jobCard: 'JC-E143', task: RCBO, status: 'working' },
      { no: 4, learner: tx('Islam Badr', 'إسلام بدر'), jobCard: 'JC-E140', task: DOL, status: 'alert' },
      { no: 5, learner: tx('Dina Hamed', 'دينا حامد'), jobCard: 'JC-E143', task: RCBO, status: 'working' },
      { no: 6, learner: tx('Sherif Wagdy', 'شريف وجدي'), jobCard: 'JC-E140', task: DOL, status: 'idle' },
      { no: 7, learner: tx('Aya Mounir', 'آية منير'), jobCard: 'JC-E143', task: RCBO, status: 'done', score: 76, passed: true },
      { no: 8, learner: tx('Khaled Osman', 'خالد عثمان'), jobCard: 'JC-E140', task: DOL, status: 'working' },
      { no: 9, learner: tx('Farida Sami', 'فريدة سامي'), jobCard: 'JC-E143', task: RCBO, status: 'working' },
      { no: 10, learner: tx('Amr Tawfik', 'عمرو توفيق'), jobCard: 'JC-E140', task: DOL, status: 'working' },
    ];
  })(),
  obsRubric: [
    { key: 'ppe', label: tx('PPE worn (insulated gloves, glasses, boots)', 'ارتداء معدات الوقاية (قفازات معزولة، نظارة، حذاء أمان)'), kind: 'gate' },
    { key: 'safe_iso', label: tx('Safe isolation proved (lock, tag, test dead)', 'إثبات العزل الآمن (قفل، بطاقة، اختبار انعدام الجهد)'), kind: 'gate' },
    { key: 'layout', label: tx('Layout matches the drawing', 'التنفيذ مطابق للمخطط'), kind: 'rating', weight: 25 },
    // R1+R2 continuity: a good ring/radial reads well under 0.5 Ω.
    { key: 'r1r2', label: tx('Earth continuity R1+R2 ≤ 0.50 Ω', 'استمرارية الأرضي R1+R2 ≤ 0.50 Ω'), kind: 'tolerance', weight: 30,
      nominal: 0.25, lower: -0.25, upper: 0.25, unit: 'Ω', measure: tx('Measured R1+R2 in ohms', 'قيمة R1+R2 المقاسة بالأوم') },
    { key: 'termination', label: tx('Terminations tight, no bare copper', 'أطراف محكمة بلا نحاس مكشوف'), kind: 'rating', weight: 25 },
    { key: 'housekeeping', label: tx('Housekeeping', 'النظافة والترتيب'), kind: 'rating', weight: 20 },
  ],
  obsNote: tx('e.g. Neat trunking; label the overload setting', 'مثال: مجاري مرتبة؛ اكتب قيمة ضبط الحمل الزائد'),
  initialAlert: { stationNo: 4, learner: tx('Islam Badr', 'إسلام بدر'),
    text: tx('Panel door opened before lock-off was recorded', 'فُتح باب اللوحة قبل تسجيل الإقفال') },
  assets: [
    { tag: 'PNL-E01', name: tx('DOL starter training panel', 'لوحة تدريب بادئ DOL'), pct: 89 },
    { tag: 'PNL-E02', name: tx('Star-delta training panel', 'لوحة تدريب نجمة-دلتا'), pct: 74 },
    { tag: 'MFT-03', name: tx('Multifunction installation tester', 'جهاز اختبار التركيبات متعدد الوظائف'), pct: 81 },
    { tag: 'BOOTH-E4', name: tx('Domestic wiring booth', 'كابينة تمديدات منزلية'), pct: 58 },
    { tag: 'PLC-R1', name: tx('PLC training rig', 'جهاز تدريب PLC'), pct: 47 },
  ],
  consumables: [
    { code: 'CBL-25', name: tx('2.5 mm² twin & earth cable', 'كابل 2.5 مم² ثنائي مع أرضي'), onHand: 42, reorderAt: 100, unit: tx('m', 'م') },
    { code: 'FERR', name: tx('Bootlace ferrules 1.5 mm²', 'أطراف تثبيت 1.5 مم²'), onHand: 620, reorderAt: 300, unit: tx('pcs', 'قطعة') },
    { code: 'LOTO-T', name: tx('LOTO tags', 'بطاقات الإقفال'), onHand: 18, reorderAt: 20, unit: tx('pcs', 'قطعة') },
  ],
  bank: [
    { id: 'Q-0412', unit: 'U04', stem: tx('Which overload class trips fastest at 7.2 × In?', 'أي فئة من مرحلات الحمل الزائد تفصل أسرع عند 7.2 × In؟'), p: 0.14, d: 0.09 },
    { id: 'Q-0156', unit: 'U01', stem: tx('The correct order to apply a lockout is…', 'الترتيب الصحيح لتطبيق الإقفال هو…'), p: 0.88, d: 0.16 },
    { id: 'Q-0233', unit: 'U05', stem: tx('A 30 mA RCD must trip at 5 × IΔn within…', 'يجب أن يفصل قاطع RCD ‏30 مللي أمبير عند 5 × IΔn خلال…'), p: 0.52, d: 0.18 },
    { id: 'Q-1033', unit: 'U06', stem: tx('In the ladder rung shown, what does contact I0.3 do…', 'في درجة السلم الموضحة، ما وظيفة التلامس I0.3…'), p: 0.18, d: 0.31 },
  ],
  heatmap: heatmap([88, 74, 69, 58, 77, 61], 3),
  heatNote: tx('Weakest unit: U04 motor control fault finding. The DOL starter V-Lab is assigned there next term.',
    'أضعف وحدة: U04 تتبع أعطال دوائر تحكم المحركات. سيُخصَّص لها معمل بادئ DOL الافتراضي في الفصل القادم.'),
  assetNote: tx('PNL-E01 runs above 85%: a second DOL panel would clear the queue for JC-E140.',
    'اللوحة PNL-E01 تعمل فوق 85%: لوحة DOL ثانية ستنهي قائمة انتظار JC-E140.'),
  overview: { learners: 214, attainment: 74, utilisation: 69, wbl: 83 },
  seedEvals: [
    { learner: tx('Hazem Adly', 'حازم عدلي'), mode: 'Exam', score: 88.5, passed: true, gateFailures: [], at: tx('Today 08:12', 'اليوم 08:12') },
    { learner: tx('Islam Badr', 'إسلام بدر'), mode: 'Exam', score: 61, passed: false, gateFailures: ['loto'], at: tx('Today 07:55', 'اليوم 07:55') },
  ],
  lab: {
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
      { text: L('Put on PPE: arc-rated face shield, gloves, safety boots', 'ارتدِ معدات الوقاية: واقي وجه مقاوم للقوس الكهربائي، قفازات، حذاء أمان'), done: (_h, rig) => rig.ppe },
      { text: L('Press START and note the symptom, then measure the supply at X1 L1–L2', 'اضغط START ولاحظ العَرَض، ثم قِس التغذية عند X1 ‏L1–L2'),
        done: (h) => h('start_pressed') && h('measured', 'X1:L1-L2') },
      { text: L('Switch off Q1, fit your lock and tag (LOTO)', 'افصل Q1 وركّب القفل والبطاقة (LOTO)'), done: (h) => h('loto_applied') },
      { text: L('Prove dead at the Q1 load side', 'أثبت انعدام الجهد عند مخرج Q1'), done: (h) => h('measured', 'Q1:load_side') },
      { text: L('Open the panel door', 'افتح باب اللوحة'), done: (h) => h('panel_opened') },
      { text: L('Test the control circuit in order: F1 supply, S1, F2 95–96, KM1 coil', 'اختبر دائرة التحكم بالترتيب: تغذية F1، ثم S1، ثم F2 ‏95–96، ثم ملف KM1'),
        done: (h) => ['Q1:control_supply', 'S1:stop_pb', 'F2:95-96'].every((r) => h('measured', r)) || h('measured', 'KM1:A1-A2') },
      { text: L('Submit your diagnosis', 'سجّل تشخيصك'), done: (h) => h('diagnosis_submitted') },
      { text: L('Replace only the faulty part, then submit for scoring', 'استبدل القطعة التالفة فقط، ثم أرسل للتقييم'), done: (h) => h('component_replaced') },
    ],
    diagram: 'dol',
    explore: { title: tx('3-Phase Induction Motor · IEC 132M', 'محرك حثي ثلاثي الأطوار · IEC 132M'), assetTag: 'WS-ELEC-07 / MTR-0132' },
  },
};
