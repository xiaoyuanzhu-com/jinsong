/**
 * Presentational helpers for the Tool Performance row.
 *
 * Aggregation now happens server-side (`/api/aggregate` as of DASH-11).
 * The only helper that stayed here is the shared color ramp used by the
 * row's success-rate chart.
 */

/**
 * Traffic-light color for a tool's success rate.
 *   [0, 0.80) → poor
 *   [0.80, 0.95) → fair
 *   [0.95, 1.00] → good
 * `null` falls through to the muted placeholder color.
 */
export function colorForSuccessRate(rate: number | null): string {
  if (rate == null) return 'hsl(var(--muted-foreground))'
  if (rate < 0.8) return 'hsl(var(--poor))'
  if (rate < 0.95) return 'hsl(var(--fair))'
  return 'hsl(var(--good))'
}
