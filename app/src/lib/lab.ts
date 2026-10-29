/**
 * The public part of a V-Lab definition, as GET /v1/vlab/labs/:code returns it
 * (api/src/labs). It has labels, test points, the fault catalogue the learner
 * diagnoses against and the drawing; which fault is injected, and every meter
 * reading, stay on the API.
 */
import type { Txt } from './i18n';

export interface RigState { ppe: boolean; locked: boolean; panelOpen: boolean; replaced: string[] }
export interface TestPoint { ref: string; label: Txt; inside: boolean; instrument: string }

export interface Diagram {
  captions: { x: number; y: number; text: Txt }[];
  boxes: { x: number; y: number; w: number; h: number; label: string; sub?: string; round?: boolean; isolator?: boolean }[];
  wires: string;
  points: { ref: string; x: number; y: number; label: Txt; dx?: number; dy?: number }[];
  cover: { x: number; y: number; w: number; h: number; text: Txt };
}

export interface PublicLab {
  code: string; trade: string; title: Txt; unit: { code: string; title: Txt }; intro: Txt; rigTitle: Txt; passThreshold: number;
  criterionLabels: Record<string, Txt>;
  faults: { code: string; componentRef: string; condition: string; title: Txt }[];
  components: { ref: string; label: Txt }[];
  conditions: { value: string; label: Txt }[];
  testPoints: TestPoint[];
  ppe: { button: Txt };
  isolation: { ref: string; chip: string; lock: Txt; unlock: Txt; on: Txt; off: Txt };
  enclosure: { chip: Txt; open: Txt; close: Txt; mustOpen: Txt };
  run: { button: Txt; whileLocked: Txt; whileOpen: Txt };
  danger: { display: Txt; text: Txt };
  /** A step is done when every token of any one group is in the event stream: `verb`, `verb@objectRef` or `ppe`. */
  steps: { text: Txt; done: string[][] }[];
  diagram: 'dol' | Diagram;
  explore: { title: Txt; assetTag: string } | null;
}

export function stepDone(check: string[][], events: { verb: string; objectRef?: string | null }[], rig: Pick<RigState, 'ppe'>) {
  const has = (token: string) => {
    if (token === 'ppe') return rig.ppe;
    const [verb, ref] = token.split('@');
    return events.some((e) => e.verb === verb && (ref === undefined || e.objectRef === ref));
  };
  return check.some((group) => group.every(has));
}
