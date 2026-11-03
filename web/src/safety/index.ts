/** One safety simulator scenario per trade, keyed by trade id. */
import { aitSafety } from './ait';
import { aveSafety } from './ave';
import { csnSafety } from './csn';
import { hamSafety } from './ham';
import { ielSafety } from './iel';
import { iemSafety } from './iem';
import { oeqSafety } from './oeq';
import { racSafety } from './rac';
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
  iel: [ielSafety],
  csn: [csnSafety],
  rac: [racSafety],
  ham: [hamSafety],
  oeq: [oeqSafety],
  ave: [aveSafety],
  iem: [iemSafety],
};
export { aitSafety, aveSafety, csnSafety, hamSafety, ielSafety, iemSafety, oeqSafety, racSafety, autoSafety, cncMillSafety, cncSafety, eimSafety, elecSafety, grinderSafety, prtSafety, rmgSafety, weldSafety };
export type { Scenario } from './types';
