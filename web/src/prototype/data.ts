/**
 * Sample data for the clickable prototype, in English and Arabic. Names,
 * scores and figures are illustrative; shapes follow db/schema.sql so the
 * screens can later be wired to the API without changing the components.
 */
import { tx, type Txt } from './i18n';

export type StationStatus = 'done' | 'working' | 'alert' | 'idle';

export interface Station {
  no: number;
  learner: Txt;
  jobCard: string;
  task: Txt;
  status: StationStatus;
  /** Score once signed off. */
  score?: number;
  passed?: boolean;
}

export const BAY = {
  name: tx('CNC Bay 2', 'ورشة CNC رقم 2'),
  cohort: tx('Mechatronics Y2-B', 'ميكاترونكس، السنة الثانية ب'),
  trainer: tx('Eng. Huda Kamal', 'م. هدى كمال'),
};

const TURN = tx('Turn Ø25 h7 shaft, Ra 1.6', 'خراطة عمود Ø25 h7، خشونة Ra 1.6');
const FACE = tx('Face & chamfer Ø40 flange', 'تسوية وشطف فلنجة Ø40');
export const STATIONS: Station[] = [
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

/** Workshop observation rubric for JC-118. Gates are pinned to the top. */
export type ObsCriterion =
  | { key: string; label: Txt; kind: 'gate' }
  | { key: string; label: Txt; kind: 'rating'; weight: number }
  | { key: string; label: Txt; kind: 'tolerance'; weight: number; nominal: number; lower: number; upper: number; unit: string };

export const OBS_RUBRIC: ObsCriterion[] = [
  { key: 'ppe', label: tx('PPE worn (glasses, boots, no loose sleeves)', 'ارتداء معدات الوقاية (نظارة، حذاء أمان، بلا أكمام فضفاضة)'), kind: 'gate' },
  { key: 'safe_op', label: tx('Safe operation (guard closed, chuck key removed)', 'تشغيل آمن (الواقي مغلق، مفتاح الظرف مُزال)'), kind: 'gate' },
  { key: 'setup', label: tx('Machine setup', 'ضبط الماكينة'), kind: 'rating', weight: 20 },
  // Ø25 h7: upper deviation 0, lower −0.021 mm (ISO 286).
  { key: 'dia', label: tx('Diameter Ø25 h7', 'القطر Ø25 h7'), kind: 'tolerance', weight: 35, nominal: 25, lower: -0.021, upper: 0, unit: 'mm' },
  { key: 'finish', label: tx('Surface finish Ra 1.6', 'جودة السطح Ra 1.6'), kind: 'rating', weight: 25 },
  { key: 'housekeeping', label: tx('Housekeeping', 'النظافة والترتيب'), kind: 'rating', weight: 20 },
];
export const OBS_PASS = 70;

export const FLOOR_FOOTER = [
  { label: tx('Tools out', 'عُدد مُعارة'), value: tx('3', '3') },
  { label: tx('Ø30 bar stock', 'خامة قضبان Ø30'), value: tx('4.2 m left · reorder at 5 m', '4.2 م متبقية · إعادة الطلب عند 5 م'), warn: true },
  { label: tx('Next session', 'الحصة التالية'), value: tx('10:30 · Y2-C', '10:30 · السنة الثانية ج') },
];

// ---------------------------------------------------------------------------
// Director dashboard
// ---------------------------------------------------------------------------
export const INSTITUTIONS = [
  { region: 'Cairo', name: tx('ATS Cairo East', 'مدرسة شرق القاهرة التطبيقية') },
  { region: 'Giza', name: tx('ATS Giza West', 'مدرسة غرب الجيزة التطبيقية') },
  { region: 'Alexandria', name: tx('ATS Alexandria', 'مدرسة الإسكندرية التطبيقية') },
  { region: undefined, name: tx('All schools', 'كل المدارس') },
];
export const TERMS = [tx('Term 1 2026/27', 'الفصل الأول 2026/27'), tx('Term 2 2025/26', 'الفصل الثاني 2025/26')];
export const TRADES = [tx('All trades', 'كل التخصصات'), tx('Electrical', 'كهرباء'), tx('Mechatronics', 'ميكاترونكس'), tx('Welding', 'لحام')];

export const REGIONS = [
  { key: 'Cairo', name: tx('Cairo', 'القاهرة') },
  { key: 'Giza', name: tx('Giza', 'الجيزة') },
  { key: 'Alexandria', name: tx('Alexandria', 'الإسكندرية') },
  { key: 'Delta', name: tx('Delta', 'الدلتا') },
  { key: 'Upper', name: tx('Upper Egypt', 'الصعيد') },
];
export const UNITS = [
  { code: 'U01', title: tx('Workshop safety & LOTO', 'سلامة الورشة والعزل والإقفال (LOTO)') },
  { code: 'U02', title: tx('Measuring & inspection', 'القياس والفحص') },
  { code: 'U03', title: tx('Manual machining', 'التشغيل على الماكينات') },
  { code: 'U04', title: tx('Motor control fault finding', 'تتبع أعطال دوائر تحكم المحركات') },
  { code: 'U05', title: tx('PLC fundamentals', 'أساسيات PLC') },
  { code: 'U06', title: tx('Hydraulics & pneumatics', 'الهيدروليك والنيوماتيك') },
];
/** % of learners at "autonomous" or above (v_regional_skill_heatmap). */
export const HEATMAP: number[][] = [
  [91, 78, 66, 58, 84, 72],
  [86, 71, 52, 63, 74, 55],
  [93, 88, 74, 69, 90, 67],
  [82, 64, 49, 44, 61, 58],
  [76, 59, 41, 38, 52, 47],
];

export const ASSETS = [
  { tag: 'CNC-01', name: tx('CNC lathe (Bay 2)', 'مخرطة CNC (ورشة 2)'), pct: 92 },
  { tag: 'CNC-02', name: tx('CNC lathe (Bay 2)', 'مخرطة CNC (ورشة 2)'), pct: 88 },
  { tag: 'MILL-04', name: tx('Vertical mill', 'فريزة رأسية'), pct: 71 },
  { tag: 'PLC-R1', name: tx('PLC training rig', 'جهاز تدريب PLC'), pct: 47 },
  { tag: 'HYD-02', name: tx('Hydraulics trainer', 'جهاز تدريب هيدروليك'), pct: 39 },
  { tag: 'WELD-03', name: tx('MIG welding booth', 'كابينة لحام MIG'), pct: 31 },
];

export interface Kpi {
  key: string;
  label: Txt;
  value: number;
  unit: '%' | '' | '/5';
  delta: number;
  /** true when a rise is good. */
  upIsGood: boolean;
  trend: number[];
  note: Txt;
}
export const KPIS: Kpi[] = [
  { key: 'attain', label: tx('Competency attainment', 'تحقق الجدارات'), value: 72, unit: '%', delta: 4, upIsGood: true,
    trend: [61, 63, 64, 66, 68, 68, 70, 72],
    note: tx('Learners at autonomous or above on ≥ 80% of enrolled units', 'المتدربون بمستوى "مستقل" أو أعلى في 80% على الأقل من وحداتهم') },
  { key: 'util', label: tx('Workshop utilisation', 'استغلال الورش'), value: 64, unit: '%', delta: -2, upIsGood: true,
    trend: [67, 66, 68, 65, 63, 66, 65, 64],
    note: tx('Booked machine-hours ÷ available machine-hours, last 30 days', 'ساعات الماكينات المحجوزة ÷ الساعات المتاحة، آخر 30 يومًا') },
  { key: 'wbl', label: tx('WBL hours on track', 'ساعات التدريب في مواقع العمل'), value: 81, unit: '%', delta: 3, upIsGood: true,
    trend: [70, 72, 74, 75, 77, 78, 78, 81],
    note: tx('Apprentices whose signed logbook hours match the plan', 'المتدربون الذين تطابق ساعات سجلاتهم المعتمدة الخطة') },
  { key: 'incidents', label: tx('Safety incidents', 'حوادث السلامة'), value: 3, unit: '', delta: -1, upIsGood: false,
    trend: [6, 5, 5, 4, 4, 4, 4, 3],
    note: tx('Recordable incidents this term (near-misses excluded)', 'الحوادث المسجلة هذا الفصل (دون الحوادث الوشيكة)') },
  { key: 'employer', label: tx('Employer satisfaction', 'رضا أصحاب العمل'), value: 4.3, unit: '/5', delta: 0.1, upIsGood: true,
    trend: [3.9, 4.0, 4.0, 4.1, 4.1, 4.2, 4.2, 4.3],
    note: tx('Mean of employer mentor surveys, WBL placements', 'متوسط استبيانات مشرفي جهات العمل') },
];
export const TREND_LABELS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => tx(`W${n}`, `أسبوع ${n}`));

export interface ComplianceItem { id: string; severity: 'warn' | 'ok'; text: Txt; action?: Txt; doneText?: Txt }
export const COMPLIANCE: ComplianceItem[] = [
  { id: 'logbooks', severity: 'warn', text: tx('14 WBL logbooks awaiting sign-off for more than 7 days', '14 سجل تدريب عملي بانتظار الاعتماد منذ أكثر من 7 أيام'),
    action: tx('Remind mentors', 'تذكير المشرفين'), doneText: tx('Mentors reminded', 'تم تذكير المشرفين') },
  { id: 'loto', severity: 'warn', text: tx('2 trainers’ LOTO certification expires within 30 days', 'شهادة LOTO لمدربَين تنتهي خلال 30 يومًا'),
    action: tx('Book renewal', 'حجز التجديد'), doneText: tx('Renewal booked', 'تم حجز التجديد') },
  { id: 'evidence', severity: 'warn', text: tx('6 practical assessments missing photo evidence', '6 تقييمات عملية بلا صور إثبات'),
    action: tx('Notify trainers', 'إبلاغ المدربين'), doneText: tx('Trainers notified', 'تم إبلاغ المدربين') },
  { id: 'sampling', severity: 'ok', text: tx('IQA sampling plan: 12 of 12 units verified', 'خطة عينات ضمان الجودة الداخلي: تم التحقق من 12 من 12 وحدة') },
];

export const FLAGGED_ITEMS = [
  { id: 'Q-0412', unit: 'U04', stem: tx('Which overload class trips fastest at 7.2 × In?', 'أي فئة من مرحلات الحمل الزائد تفصل أسرع عند 7.2 × In؟'), p: 0.14, d: 0.09 },
  { id: 'Q-0877', unit: 'U02', stem: tx('Read the vernier: main 23 mm, vernier line 17…', 'اقرأ الورنية: التدريج الرئيسي 23 مم، خط الورنية 17…'), p: 0.91, d: 0.12 },
  { id: 'Q-1033', unit: 'U05', stem: tx('In the ladder rung shown, what does contact I0.3 do…', 'في درجة السلم الموضحة، ما وظيفة التلامس I0.3…'), p: 0.18, d: 0.31 },
  { id: 'Q-0156', unit: 'U01', stem: tx('The correct order to apply a lockout is…', 'الترتيب الصحيح لتطبيق الإقفال هو…'), p: 0.88, d: 0.16 },
];

export interface EvalRow {
  id: string;
  learner: Txt;
  lab: Txt;
  mode: 'Guided' | 'Exam';
  score: number;
  passed: boolean;
  gateFailures: string[];
  at: Txt;
  live?: boolean;
}
export const DOL_LAB = tx('DOL starter fault test', 'اختبار أعطال بادئ DOL');
export const SEED_EVALS: EvalRow[] = [
  { id: 'e1', learner: tx('Mariam Adel', 'مريم عادل'), lab: DOL_LAB, mode: 'Exam', score: 88.5, passed: true, gateFailures: [], at: tx('Today 08:12', 'اليوم 08:12') },
  { id: 'e2', learner: tx('Karim Fathy', 'كريم فتحي'), lab: DOL_LAB, mode: 'Exam', score: 61, passed: false, gateFailures: ['loto'], at: tx('Today 07:55', 'اليوم 07:55') },
  { id: 'e3', learner: tx('Salma Mostafa', 'سلمى مصطفى'), lab: tx('Pneumatic cylinder sequence', 'تسلسل أسطوانة نيوماتيكية'), mode: 'Guided', score: 79, passed: true, gateFailures: [], at: tx('Yesterday 13:40', 'أمس 13:40') },
];
