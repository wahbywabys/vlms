/**
 * The V-Lab scoring core, shared by every trade's fault test. Rubrics live
 * with each trade in trades/; they are scored by the real rubric engine from
 * api/src/services/rubricEngine.ts, so a learner's score here is the score
 * the API would compute for the same telemetry stream.
 */
import type { TelemetryEvent } from '../../../api/src/services/rubricEngine';

export { evaluate, detectGateViolations, levelForScore } from '../../../api/src/services/rubricEngine';
export type { EvaluationResult, TelemetryEvent } from '../../../api/src/services/rubricEngine';

export function toEvent(seq: number, verb: string, objectRef?: string, value: Record<string, unknown> = {}): TelemetryEvent {
  return { seq, occurredAt: new Date(), verb, objectRef: objectRef ?? null, value };
}
