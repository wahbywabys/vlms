/**
 * Automotive mechanics. The V-Lab is a no-crank fault on a light vehicle's
 * starting circuit; the hazard is a spanner across the starter B+ terminal
 * with the battery still connected.
 */
import { tx } from '../i18n';
import { heatmap } from './shared';
import { carEngine } from '../../models/carEngine';
import { autoLessons } from '../../lessons/auto';
import type { Trade } from './types';
import { autoLab } from '../../../../api/src/labs/auto';

export const auto: Trade = {
  id: 'auto',
  code: 'AUTO',
  name: tx('Automotive mechanics', 'ميكانيكا السيارات'),
  icon: 'M5 17h14M3 17v-4l2-5h14l2 5v4M7 17a2 2 0 1 0 0 .1M17 17a2 2 0 1 0 0 .1M5.5 12h13',
  framework: { code: 'NTQF-AUTO-L3', title: tx('Light Vehicle Maintenance & Repair L3', 'صيانة وإصلاح المركبات الخفيفة — المستوى 3') },
  units: [
    { code: 'U01', title: tx('Workshop & vehicle safety', 'سلامة الورشة والمركبة') },
    { code: 'U02', title: tx('Engine mechanical systems', 'الأنظمة الميكانيكية للمحرك') },
    { code: 'U03', title: tx('Braking systems', 'أنظمة الفرامل') },
    { code: 'U04', title: tx('Starting & charging circuits', 'دوائر البدء والشحن') },
    { code: 'U05', title: tx('Engine management & OBD', 'إدارة المحرك وOBD') },
    { code: 'U06', title: tx('Steering & suspension', 'التوجيه والتعليق') },
  ],
  bay: {
    name: tx('Auto Bay 1 · light vehicles', 'ورشة السيارات 1 · مركبات خفيفة'),
    cohort: tx('Automotive mechanics Y2-A', 'ميكانيكا السيارات، السنة الثانية أ'),
    trainer: tx('Eng. Tamer Saleh', 'م. تامر صالح'), trainerInitials: tx('TS', 'ت'),
    jobCards: 'JC-A204, JC-A211',
  },
  learner: { name: tx('Ziad Hassan', 'زياد حسن'), initials: tx('ZH', 'ز') },
  stations: (() => {
    const CRANK = tx('Diagnose no-crank on training car 2', 'تشخيص عدم دوران المحرك في سيارة التدريب 2');
    const BRAKE = tx('Front pads & disc runout check', 'تغيير تيل الفرامل الأمامي وفحص انحراف الطنبورة');
    return [
      { no: 1, learner: tx('Ziad Hassan', 'زياد حسن'), jobCard: 'JC-A204', task: CRANK, status: 'working' },
      { no: 2, learner: tx('Malak Fouad', 'ملك فؤاد'), jobCard: 'JC-A211', task: BRAKE, status: 'done', score: 87, passed: true },
      { no: 3, learner: tx('Bassem Nagy', 'باسم ناجي'), jobCard: 'JC-A211', task: BRAKE, status: 'alert' },
      { no: 4, learner: tx('Hana Reda', 'هنا رضا'), jobCard: 'JC-A204', task: CRANK, status: 'working' },
      { no: 5, learner: tx('Seif Magdy', 'سيف مجدي'), jobCard: 'JC-A211', task: BRAKE, status: 'working' },
      { no: 6, learner: tx('Nadine Kamel', 'نادين كامل'), jobCard: 'JC-A204', task: CRANK, status: 'idle' },
      { no: 7, learner: tx('Adham Yassin', 'أدهم ياسين'), jobCard: 'JC-A211', task: BRAKE, status: 'working' },
      { no: 8, learner: tx('Rawan Helmy', 'روان حلمي'), jobCard: 'JC-A204', task: CRANK, status: 'done', score: 72, passed: true },
    ];
  })(),
  obsRubric: [
    { key: 'ppe', label: tx('PPE worn (glasses, gloves, safety boots)', 'ارتداء معدات الوقاية (نظارة، قفازات، حذاء أمان)'), kind: 'gate' },
    { key: 'secured', label: tx('Vehicle secured (lift locks or axle stands, wheels chocked)', 'تأمين المركبة (أقفال الرافعة أو حوامل المحاور، تثبيت العجلات)'), kind: 'gate' },
    { key: 'method', label: tx('Diagnostic method', 'منهجية التشخيص'), kind: 'rating', weight: 25 },
    { key: 'runout', label: tx('Disc runout ≤ 0.05 mm', 'انحراف الطنبورة ≤ 0.05 مم'), kind: 'tolerance', weight: 30,
      nominal: 0.025, lower: -0.025, upper: 0.025, unit: 'mm', measure: tx('Measured runout in mm', 'الانحراف المقاس بالمليمتر') },
    { key: 'torque', label: tx('Fasteners torqued to spec', 'ربط المسامير بالعزم المحدد'), kind: 'rating', weight: 25 },
    { key: 'housekeeping', label: tx('Housekeeping & fluid spills', 'النظافة وانسكاب السوائل'), kind: 'rating', weight: 20 },
  ],
  obsNote: tx('e.g. Good use of the wiring diagram; torque wheel nuts in a star pattern', 'مثال: استخدام جيد لمخطط الأسلاك؛ اربط صواميل العجلة بنمط النجمة'),
  initialAlert: { stationNo: 3, learner: tx('Bassem Nagy', 'باسم ناجي'),
    text: tx('Working under the car with lift locks not engaged', 'يعمل أسفل السيارة وأقفال الرافعة غير معشّقة') },
  assets: [
    { tag: 'LIFT-01', name: tx('2-post vehicle lift', 'رافعة سيارات بعمودين'), pct: 94 },
    { tag: 'LIFT-02', name: tx('2-post vehicle lift', 'رافعة سيارات بعمودين'), pct: 86 },
    { tag: 'OBD-02', name: tx('OBD-II diagnostic scanner', 'جهاز فحص OBD-II'), pct: 67 },
    { tag: 'ENG-R3', name: tx('Engine run stand', 'منصة تشغيل محرك'), pct: 52 },
    { tag: 'ALIGN-01', name: tx('Wheel alignment rig', 'جهاز ضبط زوايا العجلات'), pct: 28 },
  ],
  consumables: [
    { code: 'OIL-5W30', name: tx('Engine oil 5W-30', 'زيت محرك 5W-30'), onHand: 38, reorderAt: 40, unit: tx('L', 'لتر') },
    { code: 'PAD-F', name: tx('Front brake pad sets', 'أطقم تيل فرامل أمامي'), onHand: 9, reorderAt: 6, unit: tx('sets', 'طقم') },
    { code: 'FUSE-30', name: tx('30 A blade fuses', 'فيوزات شفرة 30 أمبير'), onHand: 25, reorderAt: 10, unit: tx('pcs', 'قطعة') },
  ],
  bank: [
    { id: 'Q-2104', unit: 'U05', stem: tx('OBD-II code P0301 points to…', 'كود OBD-II ‏P0301 يشير إلى…'), p: 0.89, d: 0.14 },
    { id: 'Q-2156', unit: 'U04', stem: tx('A resting battery reads 12.2 V. Its state of charge is about…', 'بطارية في حالة سكون تقرأ 12.2 فولت. نسبة شحنها تقريبًا…'), p: 0.31, d: 0.42 },
    { id: 'Q-2210', unit: 'U03', stem: tx('Maximum disc runout for most light vehicles is…', 'أقصى انحراف مسموح للطنبورة في أغلب المركبات الخفيفة هو…'), p: 0.16, d: 0.19 },
    { id: 'Q-2031', unit: 'U02', stem: tx('Cylinder-head bolts are tightened in which order?', 'بأي ترتيب تُربط مسامير رأس السلندر؟'), p: 0.58, d: 0.08 },
  ],
  heatmap: heatmap([86, 72, 70, 54, 49, 66], 2),
  heatNote: tx('Weakest unit: U05 engine management & OBD. Book OBD-02 for extra scanner practice next term.',
    'أضعف وحدة: U05 إدارة المحرك وOBD. احجز OBD-02 لتدريب إضافي على جهاز الفحص في الفصل القادم.'),
  assetNote: tx('Both lifts run above 85%: stagger JC-A211 brake jobs onto axle stands. The alignment rig is under-used.',
    'الرافعتان تعملان فوق 85%: وزّع مهام الفرامل JC-A211 على حوامل المحاور. وجهاز ضبط الزوايا مستغل استغلالًا ضعيفًا.'),
  overview: { learners: 241, attainment: 68, utilisation: 75, wbl: 86 },
  seedEvals: [
    { learner: tx('Malak Fouad', 'ملك فؤاد'), mode: 'Exam', score: 82, passed: true, gateFailures: [], at: tx('Today 08:05', 'اليوم 08:05') },
    { learner: tx('Seif Magdy', 'سيف مجدي'), mode: 'Guided', score: 74, passed: true, gateFailures: [], at: tx('Yesterday 12:15', 'أمس 12:15') },
  ],
  lab: autoLab,
  accent: '#d9463b',
  models: [carEngine],
  lessons: autoLessons,
};
