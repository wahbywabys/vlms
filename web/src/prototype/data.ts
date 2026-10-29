/**
 * Network-wide sample data for the clickable prototype, in English and
 * Arabic; per-trade data lives in trades/. Names, scores and figures are
 * illustrative; shapes follow db/schema.sql so the
 * screens can later be wired to the API without changing the components.
 */
import { tx, type Txt } from './i18n';
import { TRADES, type TradeId } from './trades';

export type { ObsCriterion, Station, StationStatus } from './trades/types';
export const OBS_PASS = 70;

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

export const REGIONS = [
  { key: 'Cairo', name: tx('Cairo', 'القاهرة') },
  { key: 'Giza', name: tx('Giza', 'الجيزة') },
  { key: 'Alexandria', name: tx('Alexandria', 'الإسكندرية') },
  { key: 'Delta', name: tx('Delta', 'الدلتا') },
  { key: 'Upper', name: tx('Upper Egypt', 'الصعيد') },
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

export interface EvalRow {
  id: string;
  trade: TradeId;
  learner: Txt;
  mode: 'Guided' | 'Exam';
  score: number;
  passed: boolean;
  gateFailures: string[];
  at: Txt;
  live?: boolean;
}
export const SEED_EVALS: EvalRow[] = TRADES.flatMap((t) => t.seedEvals.map((e, i) => ({ ...e, id: `${t.id}-e${i}`, trade: t.id })));
