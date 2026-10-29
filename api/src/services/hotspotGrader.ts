/**
 * Schematic pinpointing: the learner drops pins on a wiring diagram or
 * blueprint to mark the fault (an open overload contact, a burnt coil, a
 * cracked weld toe). Targets and distractors are regions in the drawing's
 * own coordinate system (its SVG viewBox), so grading does not depend on the
 * screen size or zoom the learner used.
 *
 *   - each target is credited once, by the nearest pin inside it (plus tolerance)
 *   - a pin on a distractor is named in the feedback (a common wrong answer)
 *   - pins beyond the targets' count cost `extraPinPenalty` points each
 *
 * Pure TypeScript; the prototype runs the same grader.
 */
export type Shape =
  | { shape: 'circle'; cx: number; cy: number; r: number }
  | { shape: 'rect'; x: number; y: number; w: number; h: number }
  | { shape: 'polygon'; points: [number, number][] };

export type Hotspot = Shape & {
  key: string;
  role: 'target' | 'distractor';
  /** Extra slack around the region, in drawing units. */
  tolerance?: number;
  /** Marks for finding this target (default 1). */
  credit?: number;
  label?: string;
  feedback?: { en: string; ar: string };
};

export interface Pin { x: number; y: number }
export interface HotspotOptions { maxPins?: number; extraPinPenalty?: number }

export interface HotspotResult {
  score: number;
  maxScore: number;
  pct: number;
  correct: boolean;
  hits: { key: string; pin: number; distance: number }[];
  missed: string[];
  distractorHits: string[];
  strayPins: number[];
}

/** Signed distance from a point to the region: ≤ 0 inside, else the gap to its edge. */
export function distanceTo(h: Shape, p: Pin): number {
  if (h.shape === 'circle') return Math.hypot(p.x - h.cx, p.y - h.cy) - h.r;
  if (h.shape === 'rect') {
    const dx = Math.max(h.x - p.x, 0, p.x - (h.x + h.w));
    const dy = Math.max(h.y - p.y, 0, p.y - (h.y + h.h));
    return dx === 0 && dy === 0 ? -Math.min(p.x - h.x, h.x + h.w - p.x, p.y - h.y, h.y + h.h - p.y) : Math.hypot(dx, dy);
  }
  const pts = h.points;
  let inside = false, best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
    // distance to segment
    const vx = xj - xi, vy = yj - yi, len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - xi) * vx + (p.y - yi) * vy) / len2));
    best = Math.min(best, Math.hypot(p.x - (xi + t * vx), p.y - (yi + t * vy)));
  }
  return inside ? -best : best;
}

export function gradeHotspots(spots: Hotspot[], pins: Pin[], opts: HotspotOptions = {}): HotspotResult {
  const targets = spots.filter((s) => s.role === 'target');
  const maxPins = opts.maxPins ?? Math.max(1, targets.length) + 1;
  const used = pins.slice(0, maxPins);
  const maxScore = targets.reduce((a, t) => a + (t.credit ?? 1), 0);

  // Greedy assignment by distance: the closest (target, pin) pairs are matched first.
  const pairs: { t: Hotspot; i: number; d: number }[] = [];
  for (const t of targets) used.forEach((p, i) => { const d = distanceTo(t, p); if (d <= (t.tolerance ?? 0)) pairs.push({ t, i, d }); });
  pairs.sort((a, b) => a.d - b.d);
  const takenPins = new Set<number>(), takenTargets = new Set<string>();
  const hits: HotspotResult['hits'] = [];
  for (const pr of pairs) {
    if (takenPins.has(pr.i) || takenTargets.has(pr.t.key)) continue;
    takenPins.add(pr.i); takenTargets.add(pr.t.key);
    hits.push({ key: pr.t.key, pin: pr.i, distance: Math.max(0, pr.d) });
  }
  const distractorHits = new Set<string>();
  const strayPins: number[] = [];
  used.forEach((p, i) => {
    if (takenPins.has(i)) return;
    const d = spots.find((s) => s.role === 'distractor' && distanceTo(s, p) <= (s.tolerance ?? 0));
    if (d) distractorHits.add(d.key);
    strayPins.push(i);
  });
  const earned = hits.reduce((a, h) => a + (targets.find((t) => t.key === h.key)!.credit ?? 1), 0);
  const extras = Math.max(0, used.length - targets.length);
  const score = Math.max(0, earned - extras * (opts.extraPinPenalty ?? 0.5));
  const pct = maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0;
  return {
    score, maxScore, pct, correct: score >= maxScore,
    hits, missed: targets.filter((t) => !takenTargets.has(t.key)).map((t) => t.key),
    distractorHits: [...distractorHits], strayPins,
  };
}
