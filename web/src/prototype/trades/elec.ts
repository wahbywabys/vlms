/**
 * Electrical installation. Its V-Lab is the DOL motor-starter fault test
 * (VLAB-DOL-STARTER); the rubric is the same JSON as RB-DOL-FAULT in
 * db/seed.sql, scored by the real rubric engine from the API.
 */
import { tx } from '../i18n';
import { heatmap } from './shared';
import { starterPanel } from '../../models/starterPanel';
import { elecLessons } from '../../lessons/elec';
import { motorModel } from '../motorAr';
import { elecSafety } from '../../safety/elec';
import type { Trade } from './types';
import { dolLab } from '../../../../api/src/labs/dol';

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
  lab: dolLab,
  accent: '#e8a70a',
  models: [starterPanel, motorModel],
  lessons: elecLessons,
  safety: [elecSafety],
};
