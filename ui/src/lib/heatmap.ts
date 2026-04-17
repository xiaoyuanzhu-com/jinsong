/**
 * Presentational helpers for the Activity heatmap (7 × 24 grid).
 *
 * Aggregation now happens server-side (`/api/aggregate` as of DASH-11);
 * this module only exports the axis labels and the quantize/max/total
 * helpers that `ActivityHeatmap` uses to map counts to the 5-color ramp.
 */

export const HOURS: readonly number[] = Array.from(
  { length: 24 },
  (_, i) => i,
)

export const DAYS_MON_FIRST: readonly string[] = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]

/**
 * Quantize a value into one of `buckets` integer levels (0..buckets-1)
 * based on `max`. A value of 0 always maps to bucket 0 (empty), so
 * the lowest non-empty value still reads distinctly from "no activity".
 */
export function quantize(
  value: number,
  max: number,
  buckets = 5,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(max) || max <= 0) return 0
  const clamped = Math.min(value, max)
  const ratio = clamped / max
  const level = Math.ceil(ratio * (buckets - 1))
  if (level < 1) return 1
  if (level > buckets - 1) return buckets - 1
  return level
}

/** Sum of every cell in the grid — used for the "N sessions shown" line. */
export function totalFromGrid(grid: number[][]): number {
  let total = 0
  for (const row of grid) {
    for (const v of row) total += v
  }
  return total
}

/** Maximum observed count — used as the quantize denominator. */
export function maxFromGrid(grid: number[][]): number {
  let max = 0
  for (const row of grid) {
    for (const v of row) if (v > max) max = v
  }
  return max
}
