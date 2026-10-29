/** Pieces every trade's fault test shares: the rubric shape and the heatmap generator. */
import type { Rubric } from '../../../../api/src/services/rubricEngine';
import { tx, type Txt } from '../i18n';
import { crit } from './types';

/**
 * The fault-finding rubric used by every trade's V-Lab. Safety gates are the
 * same three ideas everywhere (PPE first, isolate before reaching in, never
 * touch the hazard); the fixed measurement differs per rig.
 */
export function faultRubric(o: {
  id: string;
  isolate: string;
  hazard: string;
  check: { ref: string; label: string; expected: number; relTol: number };
  competency: { isolate: string; diagnose: string };
}): Rubric {
  return {
    id: o.id,
    passThreshold: 70,
    criteria: [
      crit('ppe', 'PPE donned before work', 5, true,
        { rule: 'precedes', first: 'ppe_donned', then: ['panel_opened', 'measured', 'component_replaced'] }),
      crit('loto', o.isolate, 10, true,
        { rule: 'precedes', first: 'loto_applied', then: ['panel_opened', 'component_replaced'] }, o.competency.isolate),
      crit('no_contact', o.hazard, 5, true, { rule: 'absent', verb: 'energized_contact' }),
      crit('diagnosis', 'Correct fault identified', 35, false, { rule: 'fault_diagnosed', componentOnlyCredit: 50 }, o.competency.diagnose),
      crit('isolation', 'Logical test-point sequence', 20, false, { rule: 'isolation_steps' }, o.competency.diagnose),
      crit('supply', o.check.label, 10, false,
        { rule: 'measurement_tolerance', objectRef: o.check.ref, expected: o.check.expected, relTol: o.check.relTol }),
      crit('parts', 'No unnecessary part swaps', 10, false, { rule: 'penalty_per', verb: 'component_replaced', per: 50 }),
      crit('time', 'Completed within target time', 5, false, { rule: 'time', targetS: 900, maxS: 1800 }),
    ],
  };
}

/** Arabic + English names for the shared criteria; each trade adds its own isolate / hazard / check wording. */
export function criterionLabels(isolate: Txt, hazard: Txt, check: Txt): Record<string, Txt> {
  return {
    ppe: tx('PPE donned before work', 'ارتداء معدات الوقاية قبل العمل'),
    loto: isolate,
    no_contact: hazard,
    diagnosis: tx('Correct fault identified', 'تحديد العطل الصحيح'),
    isolation: tx('Logical test-point sequence', 'تسلسل منطقي لنقاط القياس'),
    supply: check,
    parts: tx('No unnecessary part swaps', 'عدم استبدال قطع سليمة'),
    time: tx('Completed within target time', 'الإنجاز ضمن الزمن المستهدف'),
  };
}

/** Same five regions for every trade (Cairo, Giza, Alexandria, Delta, Upper Egypt). */
const REGION_SHIFT = [4, -2, 8, -6, -13];

/** Regions × units heatmap from a per-unit baseline, with a small stable wobble per cell. */
export function heatmap(unitBase: number[], salt: number): number[][] {
  return REGION_SHIFT.map((shift, r) => unitBase.map((b, c) => {
    const wobble = ((r * 7 + c * 13 + salt * 5) % 9) - 4;
    return Math.max(18, Math.min(97, b + shift + wobble));
  }));
}
