/**
 * Helpers for the Activity heatmap — a 7 × 24 grid of session counts
 * (day-of-week × hour-of-day).
 *
 * All aggregation is pure and sync; the component memoizes the result
 * so the cost of rebuilding on every range change is negligible.
 *
 * Day indexing is Mon-first (0 = Mon … 6 = Sun) — matches how most
 * calendars read top-to-bottom and keeps weekends visually grouped at
 * the bottom of the grid.
 *
 * Times are computed in the browser's local timezone. We use
 * `new Date(started_at).getHours() / .getDay()` directly — which is
 * what the user sees in their system clock. This is intentional: the
 * dashboard audience is the single local user.
 */

import type { SessionRow } from './api'

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
 * Convert JS's Sun-first `getDay()` (Sun=0..Sat=6) into a Mon-first
 * index (Mon=0..Sun=6).
 */
export function getDayIndexMonFirst(date: Date): number {
  const js = date.getDay() // 0 = Sun
  return (js + 6) % 7 // 0 = Mon
}

/**
 * Build a 7 × 24 matrix of session counts. Rows are Mon-first days,
 * columns are hours 0..23 in local time. Sessions with invalid
 * timestamps are skipped.
 */
export function buildHeatmapCounts(rows: SessionRow[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0),
  )
  for (const r of rows) {
    const t = Date.parse(r.session.started_at)
    if (!Number.isFinite(t)) continue
    const d = new Date(t)
    const day = getDayIndexMonFirst(d)
    const hour = d.getHours()
    if (hour < 0 || hour > 23) continue
    grid[day][hour] += 1
  }
  return grid
}

/**
 * Quantize a value into one of `buckets` integer levels (0..buckets-1)
 * based on `max`. A value of 0 always maps to bucket 0 (empty), so
 * the lowest non-empty value still reads distinctly from "no activity".
 *
 * We use a linear scale — session counts in a week aren't usually wide
 * enough to warrant a log scale, and linear keeps the legend intuitive.
 */
export function quantize(
  value: number,
  max: number,
  buckets = 5,
): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (!Number.isFinite(max) || max <= 0) return 0
  const clamped = Math.min(value, max)
  // Shift the range so any positive count lands in bucket >= 1.
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
