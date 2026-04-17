/**
 * Client-side aggregation helpers for the dashboard.
 *
 * All helpers are pure and sync — no network I/O — so they're trivial to
 * memoize inside components and cheap to re-run as the time range changes.
 * Once /api/aggregate ships (DASH-11) most of this can move server-side;
 * the shape of the outputs will stay the same.
 */

import type { SessionRow } from './api'
import type { Range } from './range'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Map a time-range label to a day count. `'all'` returns `null`, which the
 * downstream helpers interpret as "no lower bound".
 */
export function rangeToDays(range: Range): number | null {
  if (range === '7d') return 7
  if (range === '30d') return 30
  if (range === '90d') return 90
  return null
}

/** Returns ms-epoch of midnight `days` days ago (relative to `now`). */
function windowStart(days: number, now: number): number {
  // Use a whole-day grid so "last 30 days" is stable across a session and
  // sparkline buckets line up with day boundaries.
  const end = now
  return end - days * DAY_MS
}

/**
 * Keep only rows whose `started_at` falls inside the current window.
 *
 * When `range === 'all'` we return every row unchanged — the caller still
 * gets an array copy (cheap) so downstream code can freely sort it.
 */
export function filterByRange(
  rows: SessionRow[],
  range: Range,
  now = Date.now(),
): SessionRow[] {
  const days = rangeToDays(range)
  if (days === null) return rows.slice()
  const start = windowStart(days, now)
  return rows.filter((r) => {
    const t = Date.parse(r.session.started_at)
    return Number.isFinite(t) && t >= start && t <= now
  })
}

/**
 * Keep only rows that fall in the prior window of equal size — e.g. days
 * 30–60 ago when the active range is `'30d'`. Used to compute "vs previous
 * period" deltas. Returns `null` when no comparison window exists
 * (i.e. range === 'all').
 */
export function priorWindow(
  rows: SessionRow[],
  range: Range,
  now = Date.now(),
): SessionRow[] | null {
  const days = rangeToDays(range)
  if (days === null) return null
  const currentStart = windowStart(days, now)
  const priorStart = currentStart - days * DAY_MS
  return rows.filter((r) => {
    const t = Date.parse(r.session.started_at)
    return Number.isFinite(t) && t >= priorStart && t < currentStart
  })
}

export interface DailyBucket {
  /** ISO day (YYYY-MM-DD) in UTC — stable and locale-free for sort/compare. */
  day: string
  value: number
}

/**
 * Bucket `rows` by UTC day over the last `days` days (inclusive of today).
 * Empty days are included with whatever the `aggregator` returns for `[]`
 * (usually 0, or NaN which we coerce to 0 for chart safety).
 *
 * The output is length `days` and sorted oldest → newest so Recharts draws
 * left-to-right.
 */
export function bucketByDay(
  rows: SessionRow[],
  days: number,
  now: number,
  aggregator: (rowsInDay: SessionRow[]) => number,
): DailyBucket[] {
  // Anchor on today's UTC date so buckets don't drift across timezone boundaries.
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

  const out: DailyBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const ms = endMs - i * DAY_MS
    const key = new Date(ms).toISOString().slice(0, 10)
    const bucket = byDay.get(key) ?? []
    const raw = aggregator(bucket)
    const value = Number.isFinite(raw) ? raw : 0
    out.push({ day: key, value })
  }
  return out
}

/**
 * Median of a list, ignoring null/undefined/NaN. Returns `null` if no
 * finite values remain — callers can then render "—" instead of 0.
 */
export function median(xs: Array<number | null | undefined>): number | null {
  const finite: number[] = []
  for (const x of xs) {
    if (x == null) continue
    if (typeof x !== 'number') continue
    if (!Number.isFinite(x)) continue
    finite.push(x)
  }
  if (finite.length === 0) return null
  finite.sort((a, b) => a - b)
  const mid = finite.length >> 1
  if (finite.length % 2 === 1) return finite[mid]
  return (finite[mid - 1] + finite[mid]) / 2
}

/** Percentage delta between current and prior scalars. Returns null when
 *  prior is zero/null or either side is non-finite — the UI renders "—". */
export function pctDelta(
  current: number | null,
  prior: number | null,
): number | null {
  if (current == null || prior == null) return null
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null
  if (prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}
