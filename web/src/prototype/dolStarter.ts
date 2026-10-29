/**
 * Simulated DOL motor-starter fault test (VLAB-DOL-STARTER).
 *
 * The rubric below is the same JSON as RB-DOL-FAULT in db/seed.sql, and it is
 * scored by the real rubric engine from api/src/services/rubricEngine.ts, so a
 * learner's score here is the score the API would compute for the same stream.
 */
import {
  ScoringRule, detectGateViolations, evaluate,
  type InjectedFault, type Rubric, type TelemetryEvent,
} from '../../../api/src/services/rubricEngine';
import { tx, type Txt } from './i18n';

export { evaluate, detectGateViolations, levelForScore } from '../../../api/src/services/rubricEngine';
export type { EvaluationResult, TelemetryEvent } from '../../../api/src/services/rubricEngine';

const c = (key: string, label: string, weight: number, isGate: boolean, scoring: unknown, competencyId: string | null = null) =>
  ({ key, label, weight, isGate, competencyId, scoring: ScoringRule.parse(scoring) });

export const DOL_RUBRIC: Rubric = {
  id: 'RB-DOL-FAULT',
  passThreshold: 70,
  criteria: [
    c('ppe', 'PPE donned before work', 5, true,
      { rule: 'precedes', first: 'ppe_donned', then: ['panel_opened', 'measured', 'component_replaced'] }),
    c('loto', 'LOTO applied before panel work', 10, true,
      { rule: 'precedes', first: 'loto_applied', then: ['panel_opened', 'component_replaced'] }, 'ELEC-L3-U04-E1'),
    c('no_contact', 'No contact with live parts', 5, true, { rule: 'absent', verb: 'energized_contact' }),
    c('diagnosis', 'Correct fault identified', 35, false, { rule: 'fault_diagnosed', componentOnlyCredit: 50 }, 'ELEC-L3-U04-E2'),
    c('isolation', 'Logical test-point sequence', 20, false, { rule: 'isolation_steps' }, 'ELEC-L3-U04-E2'),
    c('supply', 'Supply voltage within ±5%', 10, false,
      { rule: 'measurement_tolerance', objectRef: 'X1:L1-L2', expected: 400, relTol: 0.05 }),
    c('parts', 'No unnecessary part swaps', 10, false, { rule: 'penalty_per', verb: 'component_replaced', per: 50 }),
    c('time', 'Completed within target time', 5, false, { rule: 'time', targetS: 900, maxS: 1800 }),
  ],
};

export interface Fault extends InjectedFault { title: Txt }
export const FAULTS: Fault[] = [
  { code: 'F-OL-OPEN', componentRef: 'F2_overload', title: tx('Overload NC contact 95-96 open-circuit', 'تلامس الحمل الزائد NC \u206695-96\u2069 مفتوح'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb', 'F2:95-96'] },
  { code: 'F-S1-OPEN', componentRef: 'S1_stop', title: tx('Stop push-button NC contact open', 'تلامس زر الإيقاف NC مفتوح'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb'] },
  { code: 'F-KM-COIL', componentRef: 'KM1_coil', title: tx('Contactor coil A1-A2 open-circuit', 'ملف الكونتاكتور \u2066A1-A2\u2069 مفتوح'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply', 'S1:stop_pb', 'F2:95-96', 'KM1:A1-A2'] },
  { code: 'F-F1-BLOWN', componentRef: 'F1_fuse', title: tx('Control fuse F1 blown', 'فيوز التحكم F1 محروق'),
    correctIsolationSteps: ['X1:L1-L2', 'Q1:control_supply'] },
];

export const COMPONENTS = [
  { ref: 'F1_fuse', label: tx('F1 control fuse', 'F1 فيوز التحكم') },
  { ref: 'S1_stop', label: tx('S1 stop push-button', 'S1 زر الإيقاف') },
  { ref: 'S2_start', label: tx('S2 start push-button', 'S2 زر التشغيل') },
  { ref: 'F2_overload', label: tx('F2 thermal overload relay', 'F2 مرحل الحمل الزائد الحراري') },
  { ref: 'KM1_coil', label: tx('KM1 contactor coil', 'KM1 ملف الكونتاكتور') },
];

export interface TestPoint {
  ref: string;
  label: Txt;
  /** Inside the panel: needs the door open, and is live unless locked off. */
  inside: boolean;
  mode: 'V' | 'Ω';
}
export const TEST_POINTS: TestPoint[] = [
  { ref: 'X1:L1-L2', label: tx('X1 incoming supply L1–L2', 'X1 التغذية الداخلة L1–L2'), inside: false, mode: 'V' },
  { ref: 'Q1:load_side', label: tx('Q1 load side (prove dead)', 'مخرج Q1 (إثبات انعدام الجهد)'), inside: false, mode: 'V' },
  { ref: 'Q1:control_supply', label: tx('Control supply via F1', 'تغذية التحكم عبر F1'), inside: true, mode: 'Ω' },
  { ref: 'S1:stop_pb', label: tx('S1 stop button (NC)', 'S1 زر الإيقاف (NC)'), inside: true, mode: 'Ω' },
  { ref: 'S2:start_pb', label: tx('S2 start button (NO)', 'S2 زر التشغيل (NO)'), inside: true, mode: 'Ω' },
  { ref: 'F2:95-96', label: tx('F2 overload contact 95–96', 'تلامس الحمل الزائد F2 ‏95–96'), inside: true, mode: 'Ω' },
  { ref: 'KM1:A1-A2', label: tx('KM1 coil A1–A2', 'ملف KM1 ‏A1–A2'), inside: true, mode: 'Ω' },
];

export interface RigState { ppe: boolean; locked: boolean; panelOpen: boolean; replaced: string[] }

/** What the multimeter shows. `reading` is null for an open circuit (OL). */
export function readMeter(tp: TestPoint, fault: Fault, rig: RigState): { reading: number | null; unit: string; display: string } {
  const repaired = rig.replaced.includes(fault.componentRef);
  const open = (component: string) => !repaired && fault.componentRef === component;
  const ohms = (r: number | null) => ({ reading: r, unit: 'Ω', display: r === null ? 'OL' : `${r.toFixed(1)} Ω` });
  switch (tp.ref) {
    // Incoming terminals sit upstream of the isolator: always live.
    case 'X1:L1-L2': return { reading: 401.2, unit: 'V', display: '401.2 V' };
    case 'Q1:load_side': return rig.locked ? { reading: 0, unit: 'V', display: '0.0 V' } : { reading: 400.8, unit: 'V', display: '400.8 V' };
    case 'Q1:control_supply': return ohms(open('F1_fuse') ? null : 0.4);
    case 'S1:stop_pb': return ohms(open('S1_stop') ? null : 0.1);
    case 'S2:start_pb': return ohms(null); // NO contact: open at rest is normal
    case 'F2:95-96': return ohms(open('F2_overload') ? null : 0.1);
    case 'KM1:A1-A2': return ohms(open('KM1_coil') ? null : 540);
    default: return ohms(null);
  }
}

export type Verb =
  | 'ppe_donned' | 'loto_applied' | 'loto_removed' | 'panel_opened' | 'panel_closed'
  | 'measured' | 'energized_contact' | 'start_pressed' | 'diagnosis_submitted' | 'component_replaced';

export function toEvent(seq: number, verb: string, objectRef?: string, value: Record<string, unknown> = {}): TelemetryEvent {
  return { seq, occurredAt: new Date(), verb, objectRef: objectRef ?? null, value };
}

export const GUIDED_STEPS: Txt[] = [
  tx('Put on PPE: arc-rated face shield, gloves, safety boots', 'ارتدِ معدات الوقاية: واقي وجه مقاوم للقوس الكهربائي، قفازات، حذاء أمان'),
  tx('Press START and note the symptom, then measure the supply at X1 L1–L2', 'اضغط START ولاحظ العَرَض، ثم قِس التغذية عند X1 ‏L1–L2'),
  tx('Switch off Q1, fit your lock and tag (LOTO)', 'افصل Q1 وركّب القفل والبطاقة (LOTO)'),
  tx('Prove dead at the Q1 load side', 'أثبت انعدام الجهد عند مخرج Q1'),
  tx('Open the panel door', 'افتح باب اللوحة'),
  tx('Test the control circuit in order: F1 supply, S1, F2 95–96, KM1 coil', 'اختبر دائرة التحكم بالترتيب: تغذية F1، ثم S1، ثم F2 ‏95–96، ثم ملف KM1'),
  tx('Submit your diagnosis', 'سجّل تشخيصك'),
  tx('Replace only the faulty part, then submit for scoring', 'استبدل القطعة التالفة فقط، ثم أرسل للتقييم'),
];

/** Arabic names for the rubric criteria (the engine returns the English labels). */
export const CRITERION_LABELS: Record<string, Txt> = {
  ppe: tx('PPE donned before work', 'ارتداء معدات الوقاية قبل العمل'),
  loto: tx('LOTO applied before panel work', 'تطبيق LOTO قبل العمل داخل اللوحة'),
  no_contact: tx('No contact with live parts', 'عدم لمس أجزاء حية'),
  diagnosis: tx('Correct fault identified', 'تحديد العطل الصحيح'),
  isolation: tx('Logical test-point sequence', 'تسلسل منطقي لنقاط القياس'),
  supply: tx('Supply voltage within ±5%', 'جهد التغذية ضمن ±5%'),
  parts: tx('No unnecessary part swaps', 'عدم استبدال قطع سليمة'),
  time: tx('Completed within target time', 'الإنجاز ضمن الزمن المستهدف'),
};
