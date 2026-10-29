/**
 * CNC machining. The V-Lab is a quality fault test on a CNC lathe: the part
 * comes off oversize or rough, and the learner has to find out why without
 * reaching into the work area while the spindle can still start.
 */
import { tx } from '../i18n';
import { heatmap } from './shared';
import { cncLathe } from '../../models/cncLathe';
import { cncLessons } from '../../lessons/cnc';
import { motorModel } from '../motorAr';
import { cncSafety } from '../../safety/cnc';
import { grinderSafety } from '../../safety/grinder';
import { benchGrinder } from '../../models/benchGrinder';
import type { Trade } from './types';
import { cncLab } from '../../../../api/src/labs/cnc';

export const cnc: Trade = {
  id: 'cnc',
  code: 'CNC',
  name: tx('CNC machining', 'تشغيل ماكينات CNC'),
  icon: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10.5 2h3l.5 2.6 2 .9 2.2-1.5 2.1 2.1-1.5 2.2.9 2 2.6.5v3l-2.6.5-.9 2 1.5 2.2-2.1 2.1-2.2-1.5-2 .9-.5 2.6h-3l-.5-2.6-2-.9-2.2 1.5-2.1-2.1 1.5-2.2-.9-2L2 13.5v-3l2.6-.5.9-2L4 5.8l2.1-2.1 2.2 1.5 2-.9z',
  framework: { code: 'NTQF-CNC-L3', title: tx('CNC Machining Technician L3', 'فني تشغيل ماكينات CNC — المستوى 3') },
  units: [
    { code: 'U01', title: tx('Machine shop safety', 'سلامة ورشة الماكينات') },
    { code: 'U02', title: tx('Measuring & inspection', 'القياس والفحص') },
    { code: 'U03', title: tx('Manual turning & milling', 'الخراطة والتفريز اليدوي') },
    { code: 'U04', title: tx('CNC programming (G-code)', 'برمجة CNC ‏(G-code)') },
    { code: 'U05', title: tx('CNC setting & offsets', 'ضبط CNC والإزاحات') },
    { code: 'U06', title: tx('Machining quality fault finding', 'تتبع أعطال جودة التشغيل') },
  ],
  bay: {
    name: tx('CNC Bay 2', 'ورشة CNC رقم 2'),
    cohort: tx('CNC machining Y2-B', 'تشغيل CNC، السنة الثانية ب'),
    trainer: tx('Eng. Huda Kamal', 'م. هدى كمال'), trainerInitials: tx('HK', 'ه'),
    jobCards: 'JC-118, JC-121',
  },
  learner: { name: tx('Omar Lotfy', 'عمر لطفي'), initials: tx('OL', 'ع') },
  stations: (() => {
    const TURN = tx('Turn Ø25 h7 shaft, Ra 1.6', 'خراطة عمود Ø25 h7، خشونة Ra 1.6');
    const FACE = tx('Face & chamfer Ø40 flange', 'تسوية وشطف فلنجة Ø40');
    return [
      { no: 1, learner: tx('Mariam Adel', 'مريم عادل'), jobCard: 'JC-118', task: TURN, status: 'done', score: 91, passed: true },
      { no: 2, learner: tx('Youssef Hamdy', 'يوسف حمدي'), jobCard: 'JC-118', task: TURN, status: 'working' },
      { no: 3, learner: tx('Nour El-Sayed', 'نور السيد'), jobCard: 'JC-121', task: FACE, status: 'working' },
      { no: 4, learner: tx('Omar Lotfy', 'عمر لطفي'), jobCard: 'JC-118', task: TURN, status: 'working' },
      { no: 5, learner: tx('Karim Fathy', 'كريم فتحي'), jobCard: 'JC-118', task: TURN, status: 'alert' },
      { no: 6, learner: tx('Salma Mostafa', 'سلمى مصطفى'), jobCard: 'JC-121', task: FACE, status: 'working' },
      { no: 7, learner: tx('Ahmed Ragab', 'أحمد رجب'), jobCard: 'JC-118', task: TURN, status: 'idle' },
      { no: 8, learner: tx('Habiba Samir', 'حبيبة سمير'), jobCard: 'JC-118', task: TURN, status: 'working' },
      { no: 9, learner: tx('Mostafa Zaki', 'مصطفى زكي'), jobCard: 'JC-121', task: FACE, status: 'done', score: 78, passed: true },
      { no: 10, learner: tx('Laila Farouk', 'ليلى فاروق'), jobCard: 'JC-118', task: TURN, status: 'working' },
      { no: 11, learner: tx('Tarek Nabil', 'طارق نبيل'), jobCard: 'JC-121', task: FACE, status: 'idle' },
      { no: 12, learner: tx('Yasmin Hosny', 'ياسمين حسني'), jobCard: 'JC-118', task: TURN, status: 'working' },
    ];
  })(),
  obsRubric: [
    { key: 'ppe', label: tx('PPE worn (glasses, boots, no loose sleeves)', 'ارتداء معدات الوقاية (نظارة، حذاء أمان، بلا أكمام فضفاضة)'), kind: 'gate' },
    { key: 'safe_op', label: tx('Safe operation (guard closed, chuck key removed)', 'تشغيل آمن (الواقي مغلق، مفتاح الظرف مُزال)'), kind: 'gate' },
    { key: 'setup', label: tx('Machine setup', 'ضبط الماكينة'), kind: 'rating', weight: 20 },
    // Ø25 h7: upper deviation 0, lower −0.021 mm (ISO 286).
    { key: 'dia', label: tx('Diameter Ø25 h7', 'القطر Ø25 h7'), kind: 'tolerance', weight: 35, nominal: 25, lower: -0.021, upper: 0, unit: 'mm',
      measure: tx('Measured diameter in mm', 'القطر المقاس بالمليمتر') },
    { key: 'finish', label: tx('Surface finish Ra 1.6', 'جودة السطح Ra 1.6'), kind: 'rating', weight: 25 },
    { key: 'housekeeping', label: tx('Housekeeping', 'النظافة والترتيب'), kind: 'rating', weight: 20 },
  ],
  obsNote: tx('e.g. Good tool-height setting; remind about chip hook', 'مثال: ضبط جيد لارتفاع العدة؛ ذكّره باستخدام خطاف الرايش'),
  initialAlert: { stationNo: 5, learner: tx('Karim Fathy', 'كريم فتحي'),
    text: tx('Guard open while spindle running', 'الواقي مفتوح أثناء دوران عمود الدوران') },
  assets: [
    { tag: 'CNC-01', name: tx('CNC lathe (Bay 2)', 'مخرطة CNC (ورشة 2)'), pct: 92 },
    { tag: 'CNC-02', name: tx('CNC lathe (Bay 2)', 'مخرطة CNC (ورشة 2)'), pct: 88 },
    { tag: 'VMC-01', name: tx('Vertical machining centre', 'مركز تشغيل رأسي'), pct: 76 },
    { tag: 'MILL-04', name: tx('Manual vertical mill', 'فريزة رأسية يدوية'), pct: 71 },
    { tag: 'LATHE-03', name: tx('Manual centre lathe', 'مخرطة يدوية'), pct: 33 },
  ],
  consumables: [
    { code: 'BAR-30', name: tx('Ø30 mild-steel bar stock', 'خامة قضبان صلب طري Ø30'), onHand: 4.2, reorderAt: 5, unit: tx('m', 'م') },
    { code: 'CNMG', name: tx('CNMG 120408 turning inserts', 'لقم خراطة CNMG 120408'), onHand: 36, reorderAt: 20, unit: tx('pcs', 'قطعة') },
    { code: 'COOL', name: tx('Soluble coolant concentrate', 'مركّز سائل تبريد قابل للذوبان'), onHand: 22, reorderAt: 10, unit: tx('L', 'لتر') },
  ],
  bank: [
    { id: 'Q-0877', unit: 'U02', stem: tx('Read the vernier: main 23 mm, vernier line 17…', 'اقرأ الورنية: التدريج الرئيسي 23 مم، خط الورنية 17…'), p: 0.91, d: 0.12 },
    { id: 'Q-0921', unit: 'U04', stem: tx('Which G-code sets constant surface speed on a lathe?', 'أي كود G يضبط سرعة القطع السطحية الثابتة في المخرطة؟'), p: 0.17, d: 0.28 },
    { id: 'Q-0954', unit: 'U05', stem: tx('A part is 0.06 mm oversize on diameter. The X wear offset change is…', 'قطعة أكبر بـ 0.06 مم في القطر. تعديل إزاحة تآكل X هو…'), p: 0.46, d: 0.11 },
    { id: 'Q-0310', unit: 'U01', stem: tx('Before opening the guard to measure, you must first…', 'قبل فتح الواقي للقياس يجب عليك أولًا…'), p: 0.93, d: 0.07 },
  ],
  heatmap: heatmap([90, 76, 68, 55, 60, 52], 1),
  heatNote: tx('Weakest unit: U06 machining quality fault finding. The CNC lathe V-Lab is assigned there next term.',
    'أضعف وحدة: U06 تتبع أعطال جودة التشغيل. سيُخصَّص لها معمل مخرطة CNC الافتراضي في الفصل القادم.'),
  assetNote: tx('Both CNC lathes run above 85%: add a Saturday CNC slot or move JC-121 to MILL-04. LATHE-03 is under-used.',
    'المخرطتان CNC تعملان فوق 85%: أضف فترة CNC يوم السبت أو انقل JC-121 إلى MILL-04. والمخرطة LATHE-03 مستغلة استغلالًا ضعيفًا.'),
  overview: { learners: 186, attainment: 71, utilisation: 72, wbl: 79 },
  seedEvals: [
    { learner: tx('Mariam Adel', 'مريم عادل'), mode: 'Exam', score: 86, passed: true, gateFailures: [], at: tx('Today 08:20', 'اليوم 08:20') },
    { learner: tx('Karim Fathy', 'كريم فتحي'), mode: 'Exam', score: 58, passed: false, gateFailures: ['no_contact'], at: tx('Today 07:48', 'اليوم 07:48') },
    { learner: tx('Salma Mostafa', 'سلمى مصطفى'), mode: 'Guided', score: 79, passed: true, gateFailures: [], at: tx('Yesterday 13:40', 'أمس 13:40') },
  ],
  lab: cncLab,
  accent: '#2f8fd8',
  models: [cncLathe, benchGrinder, motorModel],
  lessons: cncLessons,
  safety: [cncSafety, grinderSafety],
};
