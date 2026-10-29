/** Shorthand for writing lesson timelines. */
import type { LessonShot, LessonStop } from '../components/LessonPlayer';
import type { Vec3 } from '../components/MachineExplorer';
import { tx, type Txt } from '../models/kit';

export type ShotOpts = Omit<LessonShot, 'at' | 'camera' | 'target' | 'caption'>;

/** One camera shot: start time, camera, look-at target, caption (EN, AR), options. */
export const shot = (at: number, camera: Vec3, target: Vec3, en: string, ar: string, o: ShotOpts = {}): LessonShot =>
  ({ at, camera, target, caption: tx(en, ar), ...o });

/** A checkpoint question. The first option given is the correct one; `order` shuffles them for display. */
export function stop(id: string, at: number, q: Txt, right: Txt, wrong: Txt[], explain: Txt, order: number[] = [1, 0, 2]): LessonStop {
  const all = [right, ...wrong];
  const options = order.map((i) => all[i]!);
  return { id, at, question: q, options, answer: order.indexOf(0), explain };
}

export { tx };
