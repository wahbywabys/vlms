/** One safety simulator scenario per trade, keyed by trade id. */
import { autoSafety } from './auto';
import { cncSafety } from './cnc';
import { elecSafety } from './elec';
import { grinderSafety } from './grinder';
import type { Scenario } from './types';
import { weldSafety } from './weld';

export const SAFETY_SCENARIOS: Record<string, Scenario[]> = {
  cnc: [cncSafety, grinderSafety],
  auto: [autoSafety],
  elec: [elecSafety],
  weld: [weldSafety, grinderSafety],
};
export { autoSafety, cncSafety, elecSafety, grinderSafety, weldSafety };
export type { Scenario } from './types';
