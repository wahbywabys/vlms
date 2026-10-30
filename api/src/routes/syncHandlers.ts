/** The writes a device may queue offline, mapped to the same code the live endpoints use. */
import type { z } from 'zod';
import { isStaff, type Principal } from '../lib/auth.js';
import type { Tx } from '../lib/db.js';
import { Movement, recordMovement } from './inventory.js';
import { MachineScan, recordOfflineScan } from './machineOffline.js';
import { Entry, recordEntry } from './logbook.js';
import { Observation, recordObservation } from './observations.js';
import { CheckIn, recordCheckin } from './ojt.js';

interface Handler<S extends z.ZodTypeAny> {
  schema: S;
  allowed: (p: Principal) => boolean;
  apply: (tx: Tx, p: Principal, body: z.infer<S>) => Promise<{ replayed: boolean }>;
}
const handler = <S extends z.ZodTypeAny>(h: Handler<S>) => h;

export const syncHandlers = {
  observation: handler({ schema: Observation, allowed: isStaff, apply: recordObservation }),
  checkin: handler({ schema: CheckIn, allowed: (p) => p.roles.includes('student'), apply: (tx, p, b) => recordCheckin(tx, p, b) }),
  logbook: handler({ schema: Entry, allowed: (p) => p.roles.includes('student'), apply: recordEntry }),
  consumable: handler({ schema: Movement, allowed: isStaff, apply: recordMovement }),
  machine_scan: handler({ schema: MachineScan, allowed: () => true, apply: recordOfflineScan }),
};
