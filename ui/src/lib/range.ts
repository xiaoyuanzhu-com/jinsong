/**
 * Global time-range filter. All dashboard widgets subscribe to this via
 * `useRange()` (see `@/context/RangeContext`).
 *
 * DASH-2 wires the state + URL sync. DASH-3+ consumes it for data filtering.
 */

export type Range = '7d' | '30d' | '90d' | 'all'

export const RANGES: Range[] = ['7d', '30d', '90d', 'all']

export const DEFAULT_RANGE: Range = '30d'

export function isRange(value: string | null | undefined): value is Range {
  return value === '7d' || value === '30d' || value === '90d' || value === 'all'
}

/** Human label for a range (used in the selector). */
export function rangeLabel(r: Range): string {
  if (r === 'all') return 'All'
  return r
}

/**
 * Map a time-range label to a day count. `'all'` returns `null`, which the
 * downstream consumers interpret as "no lower bound". Small helper shared
 * by the dashboard rows so they don't need to pull `@/lib/aggregate`.
 */
export function rangeToDays(r: Range): number | null {
  if (r === '7d') return 7
  if (r === '30d') return 30
  if (r === '90d') return 90
  return null
}
