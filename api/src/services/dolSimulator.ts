/**
 * Server-side model of the DOL motor-starter rig (VLAB-DOL-STARTER).
 *
 * The injected fault never leaves the server: the learner's client asks for a
 * multimeter reading at a test point and gets back only what the meter shows.
 */
export const TEST_POINTS = [
  'X1:L1-L2', 'Q1:load_side', 'Q1:control_supply', 'S1:stop_pb', 'S2:start_pb', 'F2:95-96', 'KM1:A1-A2',
] as const;
export type TestPointRef = (typeof TEST_POINTS)[number];

/** Test points inside the panel: they need the door open and are live unless Q1 is locked off. */
export const INSIDE_PANEL = new Set<TestPointRef>(['Q1:control_supply', 'S1:stop_pb', 'S2:start_pb', 'F2:95-96', 'KM1:A1-A2']);

export interface RigState { locked: boolean; panelOpen: boolean; replaced: string[] }

export interface MeterReading {
  /** null for an open circuit (OL). */
  reading: number | null;
  unit: 'V' | 'Ω';
  display: string;
  /** The probe touched energised terminals: the client must record `energized_contact`. */
  live?: boolean;
}

export function readMeter(tp: TestPointRef, faultComponents: string[], rig: RigState): MeterReading {
  if (INSIDE_PANEL.has(tp) && !rig.locked) return { reading: 230, unit: 'V', display: '230 V AC', live: true };
  const open = (component: string) => faultComponents.includes(component) && !rig.replaced.includes(component);
  const ohms = (r: number | null): MeterReading => ({ reading: r, unit: 'Ω', display: r === null ? 'OL' : `${r.toFixed(1)} Ω` });
  switch (tp) {
    // Incoming terminals sit upstream of the isolator: always live.
    case 'X1:L1-L2': return { reading: 401.2, unit: 'V', display: '401.2 V' };
    case 'Q1:load_side': return rig.locked ? { reading: 0, unit: 'V', display: '0.0 V' } : { reading: 400.8, unit: 'V', display: '400.8 V' };
    case 'Q1:control_supply': return ohms(open('F1_fuse') ? null : 0.4);
    case 'S1:stop_pb': return ohms(open('S1_stop') ? null : 0.1);
    case 'S2:start_pb': return ohms(null); // NO contact: open at rest is normal
    case 'F2:95-96': return ohms(open('F2_overload') ? null : 0.1);
    case 'KM1:A1-A2': return ohms(open('KM1_coil') ? null : 540);
  }
}

/** Does the motor run when START is pressed? Only once every faulty part is replaced. */
export const motorRuns = (faultComponents: string[], rig: RigState) =>
  !rig.locked && faultComponents.every((c) => rig.replaced.includes(c));
