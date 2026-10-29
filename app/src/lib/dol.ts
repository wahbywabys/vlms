/**
 * Client-side catalogue for the DOL motor-starter V-Lab (VLAB-DOL-STARTER):
 * labels, test points and the fault-code catalogue the learner diagnoses
 * against. Which fault is injected, and every meter reading, come from the
 * API; nothing here decides a score.
 */
import { tx, type Txt } from './i18n';

export interface Fault { code: string; componentRef: string; title: Txt }
export const FAULTS: Fault[] = [
  { code: 'F-OL-OPEN', componentRef: 'F2_overload', title: tx('Overload NC contact 95-96 open-circuit', 'تلامس الحمل الزائد NC \u206695-96\u2069 مفتوح') },
  { code: 'F-S1-OPEN', componentRef: 'S1_stop', title: tx('Stop push-button NC contact open', 'تلامس زر الإيقاف NC مفتوح') },
  { code: 'F-KM-COIL', componentRef: 'KM1_coil', title: tx('Contactor coil A1-A2 open-circuit', 'ملف الكونتاكتور \u2066A1-A2\u2069 مفتوح') },
  { code: 'F-F1-BLOWN', componentRef: 'F1_fuse', title: tx('Control fuse F1 blown', 'فيوز التحكم F1 محروق') },
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

/** Condition the learner picks in the diagnosis form, per fault code. */
export const conditionOf = (code: string) => (code === 'F-F1-BLOWN' ? 'blown' : 'open');

export interface RigState { ppe: boolean; locked: boolean; panelOpen: boolean; replaced: string[] }
