/**
 * A trade (specialisation) bundles everything the prototype shows for one
 * workshop: its competency units, the trainer's bay, the assets and
 * consumables, the V-Lab fault test, question-bank items and sample learners.
 *
 * To add a trade, write one file shaped like `cnc.ts` and list it in
 * `trades/index.ts`. Every screen reads the active trade from the store, so
 * nothing else needs to change.
 */
import type { LabDef } from '../../../../api/src/labs/types';
import type { Txt } from '../i18n';
import type { Lesson } from '../../components/LessonPlayer';
import type { ModelDef } from '../../models/kit';

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

// The V-Lab definitions live with the API (api/src/labs) so the server, the app
// and this prototype share one catalogue.
export type { Diagram, Fault, LabDef as Lab, RigState, TestPoint } from '../../../../api/src/labs/types';

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
  lab: LabDef;
  seedEvals: SeedEval[];
  /** Colour that marks this trade's screens. */
  accent: string;
  /** 3D digital twins for the "3D & VR" tab; the first opens by default. */
  models: ModelDef[];
  /** Interactive video lessons (at least two per trade). */
  lessons: Lesson[];
}
