/**
 * A trade (specialisation) bundles everything the prototype shows for one
 * workshop: its competency units, the trainer's bay, the assets and
 * consumables, the V-Lab fault test, question-bank items and sample learners.
 *
 * To add a trade, write one file shaped like `cnc.ts` and list it in
 * `trades/index.ts`. Every screen reads the active trade from the store, so
 * nothing else needs to change.
 */
import { ScoringRule, type InjectedFault, type Rubric } from '../../../../api/src/services/rubricEngine';
import type { Txt } from '../i18n';

export type TradeId = string;

export type StationStatus = 'done' | 'working' | 'alert' | 'idle';
export interface Station {
  no: number;
  learner: Txt;
  jobCard: string;
  task: Txt;
  status: StationStatus;
  /** Score once signed off. */
  score?: number;
  passed?: boolean;
}

/** Workshop observation rubric row. Gates are pinned to the top. */
export type ObsCriterion =
  | { key: string; label: Txt; kind: 'gate' }
  | { key: string; label: Txt; kind: 'rating'; weight: number }
  | { key: string; label: Txt; kind: 'tolerance'; weight: number; nominal: number; lower: number; upper: number; unit: string; measure: Txt };

export interface Unit { code: string; title: Txt }
export interface Asset { tag: string; name: Txt; pct: number }
export interface Consumable { code: string; name: Txt; onHand: number; reorderAt: number; unit: Txt }
export interface BankItem { id: string; unit: string; stem: Txt; p: number; d: number }
export interface SeedEval { learner: Txt; mode: 'Guided' | 'Exam'; score: number; passed: boolean; gateFailures: string[]; at: Txt }

// ---------------------------------------------------------------------------
// V-Lab fault test
// ---------------------------------------------------------------------------
export interface Fault extends InjectedFault {
  title: Txt;
  /** Condition value the learner must pick, with componentRef, to score full diagnosis credit. */
  condition: string;
  /** What the learner sees when they run the machine with this fault present. */
  symptom: Txt;
}

export interface RigState { ppe: boolean; locked: boolean; panelOpen: boolean; replaced: string[] }

export interface Reading { reading: number | null; unit: string; display: string }
export interface TestPoint {
  ref: string;
  label: Txt;
  /** Inside the enclosure: needs it open, and is dangerous unless isolated. */
  inside: boolean;
  /** Instrument shown on the meter face, e.g. 'V AC', 'Ω', 'mm'. */
  instrument: string;
  read: (fault: Fault, rig: RigState) => Reading;
}

/** Shorthand for a reading that is normal unless the named component is faulty and not yet replaced. */
export function reading(unit: string, normal: number | null, faulty: Record<string, number | null>, fmt: (v: number) => string = (v) => `${v} ${unit}`) {
  return (fault: Fault, rig: RigState): Reading => {
    const hit = fault.componentRef in faulty && !rig.replaced.includes(fault.componentRef);
    const v = hit ? faulty[fault.componentRef]! : normal;
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

export type Has = (verb: string, ref?: string) => boolean;

export interface Lab {
  code: string;
  title: Txt;
  unit: Unit;
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
  steps: { text: Txt; done: (has: Has, rig: RigState) => boolean }[];
  /** `'dol'` uses the hand-drawn ladder diagram; anything else is drawn from data. */
  diagram: 'dol' | Diagram;
  /** 3D model the Explore tab opens, when the trade has one. */
  explore?: { title: Txt; assetTag: string };
}

export interface Trade {
  id: TradeId;
  /** Short code used in competency and lab codes. */
  code: string;
  name: Txt;
  /** Path data for a 24×24 line icon. */
  icon: string;
  framework: { code: string; title: Txt };
  units: Unit[];
  bay: { name: Txt; cohort: Txt; trainer: Txt; trainerInitials: Txt; jobCards: string };
  learner: { name: Txt; initials: Txt };
  stations: Station[];
  obsRubric: ObsCriterion[];
  obsNote: Txt;
  initialAlert: { stationNo: number; learner: Txt; text: Txt };
  assets: Asset[];
  consumables: Consumable[];
  bank: BankItem[];
  /** % of learners at autonomous or above, regions × units. */
  heatmap: number[][];
  heatNote: Txt;
  assetNote: Txt;
  /** Headline numbers for the director's trade overview. */
  overview: { learners: number; attainment: number; utilisation: number; wbl: number };
  lab: Lab;
  seedEvals: SeedEval[];
}

/** Build a rubric criterion; scoring is validated by the same zod schema the API uses. */
export const crit = (key: string, label: string, weight: number, isGate: boolean, scoring: unknown, competencyId: string | null = null) =>
  ({ key, label, weight, isGate, competencyId, scoring: ScoringRule.parse(scoring) });
