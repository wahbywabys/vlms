/** One safety simulator scenario per trade, keyed by trade id. */
import { autoSafety } from './auto';
import { cncSafety } from './cnc';
import { elecSafety } from './elec';
import type { Scenario } from './types';
import { weldSafety } from './weld';

export const SAFETY_SCENARIOS: Record<string, Scenario[]> = {
  cnc: [cncSafety],
  auto: [autoSafety],
  elec: [elecSafety],
  weld: [weldSafety],
};
export { autoSafety, cncSafety, elecSafety, weldSafety };
export type { Scenario } from './types';
