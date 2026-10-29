/**
 * Sample data for the clickable prototype. Names, scores and figures are
 * illustrative; shapes follow db/schema.sql so the screens can later be wired
 * to the API without changing the components.
 */

export type StationStatus = 'done' | 'working' | 'alert' | 'idle';

export interface Station {
  no: number;
  learner: string;
  jobCard: string;
  task: string;
  status: StationStatus;
  /** Score once signed off. */
  score?: number;
  passed?: boolean;
}

export const BAY = { name: 'CNC Bay 2', cohort: 'Mechatronics Y2-B', trainer: 'Eng. Huda Kamal' };

const TURN = 'Turn Ø25 h7 shaft, Ra 1.6';
const FACE = 'Face & chamfer Ø40 flange';
export const STATIONS: Station[] = [
  { no: 1, learner: 'Mariam Adel', jobCard: 'JC-118', task: TURN, status: 'done', score: 91, passed: true },
  { no: 2, learner: 'Youssef Hamdy', jobCard: 'JC-118', task: TURN, status: 'working' },
  { no: 3, learner: 'Nour El-Sayed', jobCard: 'JC-121', task: FACE, status: 'working' },
  { no: 4, learner: 'Omar Lotfy', jobCard: 'JC-118', task: TURN, status: 'working' },
  { no: 5, learner: 'Karim Fathy', jobCard: 'JC-118', task: TURN, status: 'alert' },
  { no: 6, learner: 'Salma Mostafa', jobCard: 'JC-121', task: FACE, status: 'working' },
  { no: 7, learner: 'Ahmed Ragab', jobCard: 'JC-118', task: TURN, status: 'idle' },
  { no: 8, learner: 'Habiba Samir', jobCard: 'JC-118', task: TURN, status: 'working' },
  { no: 9, learner: 'Mostafa Zaki', jobCard: 'JC-121', task: FACE, status: 'done', score: 78, passed: true },
  { no: 10, learner: 'Laila Farouk', jobCard: 'JC-118', task: TURN, status: 'working' },
  { no: 11, learner: 'Tarek Nabil', jobCard: 'JC-121', task: FACE, status: 'idle' },
  { no: 12, learner: 'Yasmin Hosny', jobCard: 'JC-118', task: TURN, status: 'working' },
];

/** Workshop observation rubric for JC-118. Gates are pinned to the top. */
export type ObsCriterion =
  | { key: string; label: string; kind: 'gate' }
  | { key: string; label: string; kind: 'rating'; weight: number }
  | { key: string; label: string; kind: 'tolerance'; weight: number; nominal: number; lower: number; upper: number; unit: string };

export const OBS_RUBRIC: ObsCriterion[] = [
  { key: 'ppe', label: 'PPE worn (glasses, boots, no loose sleeves)', kind: 'gate' },
  { key: 'safe_op', label: 'Safe operation (guard closed, chuck key removed)', kind: 'gate' },
  { key: 'setup', label: 'Machine setup', kind: 'rating', weight: 20 },
  // Ø25 h7: upper deviation 0, lower −0.021 mm (ISO 286).
  { key: 'dia', label: 'Diameter Ø25 h7', kind: 'tolerance', weight: 35, nominal: 25, lower: -0.021, upper: 0, unit: 'mm' },
  { key: 'finish', label: 'Surface finish Ra 1.6', kind: 'rating', weight: 25 },
  { key: 'housekeeping', label: 'Housekeeping', kind: 'rating', weight: 20 },
];
export const OBS_PASS = 70;

export const FLOOR_FOOTER = [
  { label: 'Tools out', value: '3' },
  { label: 'Ø30 bar stock', value: '4.2 m left · reorder at 5 m', warn: true },
  { label: 'Next session', value: '10:30 · Y2-C' },
];

// ---------------------------------------------------------------------------
// Director dashboard
// ---------------------------------------------------------------------------
export const INSTITUTIONS = ['ATS Cairo East', 'ATS Giza West', 'ATS Alexandria', 'All schools'] as const;
export const TERMS = ['Term 1 2026/27', 'Term 2 2025/26'] as const;
export const TRADES = ['All trades', 'Electrical', 'Mechatronics', 'Welding'] as const;

export const REGIONS = ['Cairo', 'Giza', 'Alexandria', 'Delta', 'Upper Egypt'];
export const UNITS = [
  { code: 'U01', title: 'Workshop safety & LOTO' },
  { code: 'U02', title: 'Measuring & inspection' },
  { code: 'U03', title: 'Manual machining' },
  { code: 'U04', title: 'Motor control fault finding' },
  { code: 'U05', title: 'PLC fundamentals' },
  { code: 'U06', title: 'Hydraulics & pneumatics' },
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
  { tag: 'CNC-01', name: 'CNC lathe (Bay 2)', pct: 92 },
  { tag: 'CNC-02', name: 'CNC lathe (Bay 2)', pct: 88 },
  { tag: 'MILL-04', name: 'Vertical mill', pct: 71 },
  { tag: 'PLC-R1', name: 'PLC training rig', pct: 47 },
  { tag: 'HYD-02', name: 'Hydraulics trainer', pct: 39 },
  { tag: 'WELD-03', name: 'MIG welding booth', pct: 31 },
];

export interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: '%' | '' | '/5';
  delta: number;
  /** true when a rise is good. */
  upIsGood: boolean;
  trend: number[];
  note: string;
}
export const KPIS: Kpi[] = [
  { key: 'attain', label: 'Competency attainment', value: 72, unit: '%', delta: 4, upIsGood: true,
    trend: [61, 63, 64, 66, 68, 68, 70, 72], note: 'Learners at autonomous or above on ≥ 80% of enrolled units' },
  { key: 'util', label: 'Workshop utilisation', value: 64, unit: '%', delta: -2, upIsGood: true,
    trend: [67, 66, 68, 65, 63, 66, 65, 64], note: 'Booked machine-hours ÷ available machine-hours, last 30 days' },
  { key: 'wbl', label: 'WBL hours on track', value: 81, unit: '%', delta: 3, upIsGood: true,
    trend: [70, 72, 74, 75, 77, 78, 78, 81], note: 'Apprentices whose signed logbook hours match the plan' },
  { key: 'incidents', label: 'Safety incidents', value: 3, unit: '', delta: -1, upIsGood: false,
    trend: [6, 5, 5, 4, 4, 4, 4, 3], note: 'Recordable incidents this term (near-misses excluded)' },
  { key: 'employer', label: 'Employer satisfaction', value: 4.3, unit: '/5', delta: 0.1, upIsGood: true,
    trend: [3.9, 4.0, 4.0, 4.1, 4.1, 4.2, 4.2, 4.3], note: 'Mean of employer mentor surveys, WBL placements' },
];
export const TREND_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];

export interface ComplianceItem { id: string; severity: 'warn' | 'ok'; text: string; action?: string; doneText?: string }
export const COMPLIANCE: ComplianceItem[] = [
  { id: 'logbooks', severity: 'warn', text: '14 WBL logbooks awaiting sign-off for more than 7 days', action: 'Remind mentors', doneText: 'Mentors reminded' },
  { id: 'loto', severity: 'warn', text: '2 trainers’ LOTO certification expires within 30 days', action: 'Book renewal', doneText: 'Renewal booked' },
  { id: 'evidence', severity: 'warn', text: '6 practical assessments missing photo evidence', action: 'Notify trainers', doneText: 'Trainers notified' },
  { id: 'sampling', severity: 'ok', text: 'IQA sampling plan: 12 of 12 units verified' },
];

export const FLAGGED_ITEMS = [
  { id: 'Q-0412', unit: 'U04', stem: 'Which overload class trips fastest at 7.2 × In?', p: 0.14, d: 0.09 },
  { id: 'Q-0877', unit: 'U02', stem: 'Read the vernier: main 23 mm, vernier line 17…', p: 0.91, d: 0.12 },
  { id: 'Q-1033', unit: 'U05', stem: 'In the ladder rung shown, what does contact I0.3 do…', p: 0.18, d: 0.31 },
  { id: 'Q-0156', unit: 'U01', stem: 'The correct order to apply a lockout is…', p: 0.88, d: 0.16 },
];

export interface EvalRow {
  id: string;
  learner: string;
  lab: string;
  mode: 'Guided' | 'Exam';
  score: number;
  passed: boolean;
  gateFailures: string[];
  at: string;
  live?: boolean;
}
export const SEED_EVALS: EvalRow[] = [
  { id: 'e1', learner: 'Mariam Adel', lab: 'DOL starter fault test', mode: 'Exam', score: 88.5, passed: true, gateFailures: [], at: 'Today 08:12' },
  { id: 'e2', learner: 'Karim Fathy', lab: 'DOL starter fault test', mode: 'Exam', score: 61, passed: false, gateFailures: ['loto'], at: 'Today 07:55' },
  { id: 'e3', learner: 'Salma Mostafa', lab: 'Pneumatic cylinder sequence', mode: 'Guided', score: 79, passed: true, gateFailures: [], at: 'Yesterday 13:40' },
];
