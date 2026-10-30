/**
 * The student's Private locker, seen from the rest of the app.
 *
 * Any screen can drop something into the locker (a machine part, a lesson, a
 * safety run, a V-Lab result) or record a private attempt, without knowing
 * where the locker is stored: it fires a window event. In the prototype the
 * Private screen is always mounted and keeps it in the browser; in the app a
 * bridge in the student workspace posts it to /v1/private.
 */
import type { Txt } from '../models/kit';

export type LockerKind = 'part' | 'lesson' | 'safety' | 'result' | 'note' | 'photo' | 'link' | 'mistake';

/** What a screen hands the locker. `ref` lets the Private screen find the source again (model + part, lesson id…). */
export interface LockerDrop {
  kind: LockerKind;
  title: Txt;
  body?: Txt | string;
  ref?: Record<string, string>;
  value?: Record<string, unknown>;
  tags?: string[];
  /** Photos (downscaled JPEG data URL) and links the student adds in the locker itself. */
  image?: string;
  url?: string;
}

/** A finished, private attempt: practice is never graded, it is kept for the student to compare. */
export interface AttemptRecord {
  id: string;
  at: string;
  kind: 'vlab' | 'lesson' | 'safety' | 'practice';
  /** Lab code, lesson id, scenario id or practice topic: attempts with the same ref are comparable. */
  ref: string;
  title: Txt;
  score: number;
  passed?: boolean;
  mode?: string;
  /** Per-criterion scores, when the attempt has them (V-Lab rubric, lesson checkpoints). */
  criteria?: { key: string; label: Txt; score: number }[];
  detail?: Txt;
}

export const LOCKER_EVENT = 'vtc:locker';
export const ATTEMPT_EVENT = 'vtc:attempt';
/** Fired back once a drop is stored, so buttons and toasts can confirm it. */
export const LOCKER_SAVED_EVENT = 'vtc:locker-saved';

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function saveToLocker(drop: LockerDrop) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LockerDrop>(LOCKER_EVENT, { detail: drop }));
}

export function recordAttempt(a: Omit<AttemptRecord, 'id' | 'at'> & { id?: string; at?: string }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AttemptRecord>(ATTEMPT_EVENT, { detail: { id: newId(), at: new Date().toISOString(), ...a } }));
}

export function lockerSaved(drop: LockerDrop, ok: boolean) {
  window.dispatchEvent(new CustomEvent(LOCKER_SAVED_EVENT, { detail: { drop, ok } }));
}
