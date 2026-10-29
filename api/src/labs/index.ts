/** Lab registry, the server-side simulator, and the public catalogue sent to clients. */
import type { TelemetryEvent } from '../services/rubricEngine.js';
import { autoLab } from './auto.js';
import { cncLab } from './cnc.js';
import { dolLab } from './dol.js';
import { migLab } from './mig.js';
import type { LabDef, Reading, RigState, StepCheck, Txt } from './types.js';

export const LABS: LabDef[] = [cncLab, autoLab, dolLab, migLab];
export const labByCode = (code: string): LabDef | undefined => LABS.find((l) => l.code === code);
export type { Diagram, Fault, LabDef, Reading, RigState, StepCheck, TestPoint, Txt } from './types.js';

/** Rig state is derived from the recorded stream, never trusted from the client. */
export function rigFrom(events: TelemetryEvent[]): RigState {
  const rig: RigState = { ppe: false, locked: false, panelOpen: false, replaced: [] };
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (e.verb === 'ppe_donned') rig.ppe = true;
    else if (e.verb === 'loto_applied') rig.locked = true;
    else if (e.verb === 'loto_removed') rig.locked = false;
    else if (e.verb === 'panel_opened') rig.panelOpen = true;
    else if (e.verb === 'panel_closed') rig.panelOpen = false;
    else if (e.verb === 'component_replaced' && e.objectRef && !rig.replaced.includes(e.objectRef)) rig.replaced.push(e.objectRef);
  }
  return rig;
}

export interface MeterReading extends Reading {
  /** The probe touched a hazard (live terminals, armed spindle…): record `energized_contact`. */
  live?: boolean;
}

/** What the instrument shows at a test point, given the injected fault components. */
export function readMeter(lab: LabDef, testPoint: string, faultComponents: string[], rig: RigState): MeterReading {
  const tp = lab.testPoints.find((t) => t.ref === testPoint);
  if (!tp) throw new Error(`unknown test point ${testPoint}`);
  if (tp.inside && !rig.locked) return { reading: null, unit: '', display: lab.danger.display.en, live: true };
  const isFaulty = (c: string) => faultComponents.includes(c) && !rig.replaced.includes(c);
  return tp.read({ isFaulty, rig });
}

/** Does the machine work when run? Only once every faulty part is fixed. */
export const machineRuns = (faultComponents: string[], rig: RigState) =>
  !rig.locked && faultComponents.every((c) => rig.replaced.includes(c));

/** What the learner observes on running the machine: the first unfixed fault's symptom, or the repaired result. */
export function runObservation(lab: LabDef, faultComponents: string[], rig: RigState): Txt {
  if (rig.locked) return lab.run.whileLocked;
  const open = lab.faults.find((f) => faultComponents.includes(f.componentRef) && !rig.replaced.includes(f.componentRef));
  return open ? open.symptom : lab.run.repaired;
}

/** Guided-step completion from the event stream. */
export function stepDone(check: StepCheck, events: Pick<TelemetryEvent, 'verb' | 'objectRef'>[], rig: Pick<RigState, 'ppe'>): boolean {
  const has = (token: string) => {
    if (token === 'ppe') return rig.ppe;
    const [verb, ref] = token.split('@');
    return events.some((e) => e.verb === verb && (ref === undefined || e.objectRef === ref));
  };
  return check.some((group) => group.every(has));
}

/**
 * Everything a client needs to draw and run the rig, minus anything that would
 * reveal readings: no read functions, no isolation paths, no symptoms.
 */
export function publicCatalogue(lab: LabDef) {
  return {
    code: lab.code, trade: lab.trade, title: lab.title, unit: lab.unit, intro: lab.intro, rigTitle: lab.rigTitle,
    passThreshold: lab.rubric.passThreshold,
    criterionLabels: lab.criterionLabels,
    faults: lab.faults.map((f) => ({ code: f.code, componentRef: f.componentRef, condition: f.condition, title: f.title })),
    components: lab.components, conditions: lab.conditions,
    testPoints: lab.testPoints.map((t) => ({ ref: t.ref, label: t.label, inside: t.inside, instrument: t.instrument })),
    ppe: lab.ppe, isolation: lab.isolation, enclosure: lab.enclosure,
    run: { button: lab.run.button, whileLocked: lab.run.whileLocked, whileOpen: lab.run.whileOpen },
    danger: lab.danger, steps: lab.steps, diagram: lab.diagram, explore: lab.explore ?? null,
  };
}
export type PublicLab = ReturnType<typeof publicCatalogue>;
