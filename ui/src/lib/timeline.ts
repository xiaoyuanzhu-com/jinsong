/**
 * Presentational helpers for the Trends row timeline charts.
 *
 * Aggregation now happens server-side (`/api/aggregate` as of DASH-11);
 * this module only exports the axis-date and compact-number formatters
 * used by the chart ticks.
 */

/**
 * Format an ISO day string (`"2026-04-17"`) as `"Apr 17"`. Parsed as UTC
 * so it matches the UTC-day buckets the server emits in `timelines.*`,
 * avoiding a potential off-by-one near midnight local time.
 */
export function formatAxisDate(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(t)) return day
  const d = new Date(t)
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const dayNum = d.getUTCDate()
  return `${month} ${dayNum}`
}

/** `1,234` / `45.2K` / `1.23M`. Mirrors the KpiCard token formatter. */
export function abbreviateNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs < 1000) return Math.round(n).toLocaleString('en-US')
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  return `${(n / 1_000_000_000).toFixed(2)}B`
}
