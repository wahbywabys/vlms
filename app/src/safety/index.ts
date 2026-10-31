/** One safety simulator scenario per trade, keyed by trade id. */
import { aitSafety } from './ait';
import { autoSafety } from './auto';
import { cncSafety } from './cnc';
import { cncMillSafety } from './cncMill';
import { eimSafety } from './eim';
import { elecSafety } from './elec';
import { grinderSafety } from './grinder';
import { prtSafety } from './prt';
import { rmgSafety } from './rmg';
import type { Scenario } from './types';
import { weldSafety } from './weld';

export const SAFETY_SCENARIOS: Record<string, Scenario[]> = {
  cnc: [cncSafety, cncMillSafety, grinderSafety],
  auto: [autoSafety],
  elec: [elecSafety],
  weld: [weldSafety, grinderSafety],
  rmg: [rmgSafety],
  eim: [eimSafety],
  prt: [prtSafety],
  ait: [aitSafety],
};
export { aitSafety, autoSafety, cncMillSafety, cncSafety, eimSafety, elecSafety, grinderSafety, prtSafety, rmgSafety, weldSafety };
export type { Scenario } from './types';
