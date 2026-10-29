/**
 * Safety simulator scenarios: a real job at a real machine, done by the WABYS
 * student, where the learner chooses the PPE and the order of the work and
 * mistakes have consequences. Each action can carry hazards: conditions on
 * what has been done and what is being worn that, if true when the action is
 * taken, play an incident (or a machine safeguard stopping it) with what
 * happened, the harm it does in real workshops and the rule that prevents it.
 * The learner rewinds and tries again until the job is done safely.
 */
import type { ReactNode } from 'react';
import type { Effect } from '../components/fx';
import type { Vec3 } from '../components/MachineExplorer';
import type { ModelDef, Pose, Txt } from '../models/kit';
import type { Pictogram, SignKind } from '../models/textures';

/** PPE and dress items on the rack. 'no-jewellery' and 'cuffs' are things the student does (take off a watch, fasten cuffs). */
export type PpeKey = 'glasses' | 'earmuffs' | 'boots' | 'gloves-leather' | 'gloves-nitrile' | 'gloves-insulated'
  | 'helmet-welding' | 'visor' | 'mask' | 'apron' | 'no-jewellery' | 'cuffs';

export interface PpeItem {
  key: PpeKey;
  /** required: must wear; forbidden: must not wear here; optional: good practice. */
  need: 'required' | 'forbidden' | 'optional';
  why: Txt;
}

/** True when every listed condition holds. An empty condition is always true. */
export interface Cond {
  done?: string[];
  notDone?: string[];
  wearing?: PpeKey[];
  notWearing?: PpeKey[];
}

export interface Outcome {
  /** incident: someone is hurt (or nearly). blocked: a safeguard stopped it; a mistake, but nobody hurt. */
  kind: 'incident' | 'blocked';
  id: string;
  effect: Effect;
  /** Where the effect starts, model units. */
  at: Vec3;
  /** Where it goes: the student's face or hand, or a point. */
  toward?: 'face' | 'hand' | Vec3;
  object?: 'key' | 'part' | 'gauge';
  /** 1 minor, 2 lost-time injury, 3 life-changing. */
  severity?: 1 | 2 | 3;
  title: Txt;
  /** What happened, as the learner watched it. */
  what: Txt;
  /** What this does to people in real workshops. */
  harm?: Txt;
  /** The rule that prevents it. */
  rule: Txt;
  /** Standard or sign reference. */
  ref?: string;
  sign?: { kind: SignKind; pic: Pictogram };
}

export interface Hazard { when: Cond; outcome: Outcome }

export interface SimAction {
  id: string;
  label: Txt;
  detail?: Txt;
  /** Where the student goes to do it (a station of the model's env). */
  station: string;
  pose?: Pose;
  reach?: Vec3;
  /** Must be done first; otherwise a note says what is missing (no penalty). */
  needs?: string[];
  /** Model params after doing it. */
  set?: Record<string, number>;
  /** The machine runs (true) or stops (false) after it. */
  running?: boolean;
  /** Checked in order; the first that holds is what happens. */
  hazards?: Hazard[];
  /** Feedback when it went safely. */
  ok: Txt;
  /** Doing this safely finishes the job. */
  goal?: boolean;
  /** Hide from the list while this holds (e.g. "Close the guard" once it is closed). */
  hideWhen?: Cond;
  /** Can be done more than once. */
  repeat?: boolean;
  /** Undoes another action (e.g. opening the guard undoes closing it). */
  undoes?: string[];
}

export interface SimView { done: Set<string>; worn: Set<PpeKey>; fx: Effect | null; fxT: React.RefObject<number>; running: boolean }

export interface SimProp {
  id: string;
  when?: Cond;
  render: (v: SimView) => ReactNode;
}

export interface Scenario {
  id: string;
  trade: string;
  model: ModelDef;
  title: Txt;
  brief: Txt;
  task: Txt;
  ppe: PpeItem[];
  actions: SimAction[];
  /** Model params at the start. */
  params?: Record<string, number>;
  /** The machine is running when the job starts. */
  startRunning?: boolean;
  props?: SimProp[];
  /** Minutes the job takes in the real workshop (shown in the brief). */
  minutes?: number;
}

export const holds = (c: Cond | undefined, done: Set<string>, worn: Set<PpeKey>) => !c || (
  (c.done ?? []).every((d) => done.has(d)) && (c.notDone ?? []).every((d) => !done.has(d))
  && (c.wearing ?? []).every((w) => worn.has(w)) && (c.notWearing ?? []).every((w) => !worn.has(w)));
