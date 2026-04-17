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
