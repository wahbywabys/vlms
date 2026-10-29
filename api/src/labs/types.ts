/**
 * V-Lab catalogue: one definition per virtual lab, shared by the API (which
 * computes every reading from the hidden fault), the web app (which renders
 * the rig from the public part) and the clickable prototype.
 *
 * To add a lab, write one file shaped like `cnc.ts`, list it in `index.ts`,
 * and seed its virtual_labs / lab_faults / rubric rows (db/demo_trades.sql).
 */
import { ScoringRule, type InjectedFault, type Rubric } from '../services/rubricEngine.js';

export interface Txt { en: string; ar: string }
export const tx = (en: string, ar: string): Txt => ({ en, ar });

export interface Fault extends InjectedFault {
  title: Txt;
  /** Condition value the learner must pick, with componentRef, to score full diagnosis credit. */
  condition: string;
  /** What the learner sees when they run the machine with this fault present. */
  symptom: Txt;
}

export interface RigState { ppe: boolean; locked: boolean; panelOpen: boolean; replaced: string[] }

export interface Reading { reading: number | null; unit: string; display: string }
/** What a probe can know: whether a component is faulty right now (injected and not yet replaced), and the rig. */
export interface Probe { isFaulty: (component: string) => boolean; rig: RigState }

export interface TestPoint {
  ref: string;
  label: Txt;
  /** Inside the enclosure: needs it open, and is dangerous unless isolated. */
  inside: boolean;
  /** Instrument shown on the meter face, e.g. 'V AC', 'Ω', 'mm'. */
  instrument: string;
  read: (p: Probe) => Reading;
}

/** A reading that is normal unless one of the listed components is faulty. */
export function reading(unit: string, normal: number | null, faulty: Record<string, number | null>, fmt: (v: number) => string = (v) => `${v} ${unit}`) {
  return ({ isFaulty }: Probe): Reading => {
    const hit = Object.keys(faulty).find(isFaulty);
    const v = hit !== undefined ? faulty[hit]! : normal;
    return { reading: v, unit, display: v === null ? 'OL' : fmt(v) };
  };
}

/** Data-driven drawing for the rig. Coordinates are in a 640×330 viewBox and never mirrored for Arabic. */
export interface Diagram {
  captions: { x: number; y: number; text: Txt }[];
  boxes: { x: number; y: number; w: number; h: number; label: string; sub?: string; round?: boolean; isolator?: boolean }[];
  /** SVG path data for the wiring / piping. */
  wires: string;
  points: { ref: string; x: number; y: number; label: Txt; dx?: number; dy?: number }[];
  /** Area hidden until the enclosure is opened. */
  cover: { x: number; y: number; w: number; h: number; text: Txt };
}

/**
 * When a guided step counts as done: any one of the groups, where every token
 * in the group is present. A token is `verb` or `verb@objectRef`; `ppe` means
 * PPE is on.
 */
export type StepCheck = string[][];

export interface LabDef {
  code: string;
  /** Trade id (trades.id in the database). */
  trade: string;
  title: Txt;
  unit: { code: string; title: Txt };
  intro: Txt;
  rigTitle: Txt;
  rubric: Rubric;
  criterionLabels: Record<string, Txt>;
  faults: Fault[];
  components: { ref: string; label: Txt }[];
  conditions: { value: string; label: Txt }[];
  testPoints: TestPoint[];
  ppe: { button: Txt };
  isolation: { ref: string; chip: string; lock: Txt; unlock: Txt; on: Txt; off: Txt };
  enclosure: { chip: Txt; open: Txt; close: Txt; mustOpen: Txt };
  run: { button: Txt; whileLocked: Txt; whileOpen: Txt; repaired: Txt };
  /** Touching an inside point while not isolated. */
  danger: { display: Txt; text: Txt };
  steps: { text: Txt; done: StepCheck }[];
  /** `'dol'` uses the hand-drawn ladder diagram; anything else is drawn from data. */
  diagram: 'dol' | Diagram;
  /** 3D model the Explore tab opens, when the lab has one. */
  explore?: { title: Txt; assetTag: string };
}

/** Build a rubric criterion; scoring is validated by the same zod schema the API uses. */
export const crit = (key: string, label: string, weight: number, isGate: boolean, scoring: unknown, competencyId: string | null = null) =>
  ({ key, label, weight, isGate, competencyId, scoring: ScoringRule.parse(scoring) });
