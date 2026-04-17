/**
 * Timeline-chart helpers shared by the Trends row (DASH-5).
 *
 * Kept separate from `aggregate.ts` so the scalar/KPI path there stays lean —
 * these helpers return object-shaped daily rows that Recharts consumes
 * directly.
 */

import type { SessionRow } from './api'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Format an ISO day string (`"2026-04-17"`) as `"Apr 17"`. Parsed as UTC to
 * match the UTC-day buckets produced by `bucketByDay` / `bucketByDayMulti`,
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

/**
 * Linear-interpolation percentile of a finite-only list. Returns `null` when
 * no finite values are present so callers can render a gap instead of zero.
 *
 * `p` is a fraction in [0, 1]. Example: `percentile(xs, 0.95)` → p95.
 */
export function percentile(
  xs: Array<number | null | undefined>,
  p: number,
): number | null {
  const finite: number[] = []
  for (const x of xs) {
    if (x == null) continue
    if (typeof x !== 'number') continue
    if (!Number.isFinite(x)) continue
    finite.push(x)
  }
  if (finite.length === 0) return null
  finite.sort((a, b) => a - b)
  if (finite.length === 1) return finite[0]
  const clamped = Math.min(1, Math.max(0, p))
  const rank = clamped * (finite.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return finite[lo]
  const frac = rank - lo
  return finite[lo] + (finite[hi] - finite[lo]) * frac
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

/**
 * Bucket rows by UTC day into object-shaped daily rows — generalisation of
 * `bucketByDay` in `aggregate.ts` for multi-series charts.
 *
 * The aggregator receives the day's rows and returns an object; the final
 * row always includes the ISO day key as `day`. Empty days are included so
 * Recharts draws a full, continuous x-axis.
 */
export function bucketByDayMulti<T extends Record<string, number | null>>(
  rows: SessionRow[],
  days: number,
  now: number,
  aggregator: (rowsInDay: SessionRow[]) => T,
): Array<T & { day: string }> {
  const endDay = new Date(now)
  endDay.setUTCHours(0, 0, 0, 0)
  const endMs = endDay.getTime()

  const byDay = new Map<string, SessionRow[]>()
  for (const r of rows) {
    const t = Date.parse(r.session.started_at)
    if (!Number.isFinite(t)) continue
    const d = new Date(t)
    d.setUTCHours(0, 0, 0, 0)
    const key = d.toISOString().slice(0, 10)
    const arr = byDay.get(key)
    if (arr) arr.push(r)
    else byDay.set(key, [r])
  }

  const out: Array<T & { day: string }> = []
  for (let i = days - 1; i >= 0; i--) {
    const ms = endMs - i * DAY_MS
    const key = new Date(ms).toISOString().slice(0, 10)
    const bucket = byDay.get(key) ?? []
    const agg = aggregator(bucket)
    out.push({ ...agg, day: key })
  }
  return out
}

/**
 * Pick the bucket count for a given Range-to-days value, clamped for 'all'.
 *
 * For `range === 'all'` the caller passes `null` and we default to 90 — a
 * stable, reasonable window that keeps daily resolution readable. If the
 * observed sessions span more than 90 days the caller can widen by passing
 * the observed span instead; this is a convenience default.
 */
export function defaultTimelineDays(rangeDays: number | null): number {
  return rangeDays ?? 90
}
