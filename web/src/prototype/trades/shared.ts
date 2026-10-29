/** Sample-data helpers shared by the trade files. */

/** Same five regions for every trade (Cairo, Giza, Alexandria, Delta, Upper Egypt). */
const REGION_SHIFT = [4, -2, 8, -6, -13];

/** Regions × units heatmap from a per-unit baseline, with a small stable wobble per cell. */
export function heatmap(unitBase: number[], salt: number): number[][] {
  return REGION_SHIFT.map((shift, r) => unitBase.map((b, c) => {
    const wobble = ((r * 7 + c * 13 + salt * 5) % 9) - 4;
    return Math.max(18, Math.min(97, b + shift + wobble));
  }));
}
