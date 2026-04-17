/**
 * Per-tool aggregation helpers for the DASH-7 Tool Performance row.
 *
 * Aggregates the server-provided `tool_stats` map (per session, per tool)
 * into flat arrays ready for the horizontal bar charts:
 *   - `aggregateToolCounts` → Top-10 by invocation count.
 *   - `aggregateToolSuccessRates` → Tools with N+ calls in range, sorted
 *     ascending by success rate (worst first).
 *
 * Success rate semantics: `successes / (successes + failures)`. Pending
 * calls (a `tool_call_start` without a matching `tool_call_end`) are NOT
 * counted toward either the numerator or the denominator — we only rate
 * completed invocations. This keeps the metric honest when a session is
 * truncated or still in flight.
 */

import type { SessionRow, ToolStats } from './api'

export interface ToolCount {
  tool: string
  count: number
}

export interface ToolSuccessRate {
  tool: string
  /** 0..1, or `null` if no completed calls in range. */
  rate: number | null
  /** Call count (from tool_call_start). Used for the >= N filter + label. */
  calls: number
  successes: number
  failures: number
}

function mergeStats(rows: SessionRow[]): Map<string, ToolStats> {
  const out = new Map<string, ToolStats>()
  for (const r of rows) {
    const ts = r.tool_stats
    if (!ts) continue
    for (const [tool, s] of Object.entries(ts)) {
      if (!s) continue
      let acc = out.get(tool)
      if (!acc) {
        acc = { calls: 0, successes: 0, failures: 0 }
        out.set(tool, acc)
      }
      if (Number.isFinite(s.calls)) acc.calls += s.calls
      if (Number.isFinite(s.successes)) acc.successes += s.successes
      if (Number.isFinite(s.failures)) acc.failures += s.failures
    }
  }
  return out
}

/**
 * Check whether ANY row carries a `tool_stats` field. Used by the UI to
 * distinguish "older server build, no data yet" from "new build, zero
 * calls in this window". Matches the pattern used by `bucketByToolCategory`.
 */
export function hasToolStats(rows: SessionRow[]): boolean {
  for (const r of rows) {
    if (r.tool_stats != null) return true
  }
  return false
}

/**
 * Flatten per-session tool stats into a sorted list of
 * `{ tool, count }` pairs (descending). Returns the whole list; the caller
 * can slice to top-N.
 */
export function aggregateToolCounts(rows: SessionRow[]): ToolCount[] {
  const merged = mergeStats(rows)
  const out: ToolCount[] = []
  for (const [tool, s] of merged.entries()) {
    if (s.calls > 0) out.push({ tool, count: s.calls })
  }
  out.sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool))
  return out
}

/**
 * Flatten per-session tool stats into `{ tool, rate, calls, ... }`,
 * filtered to tools with at least `minCalls` invocations in the current
 * slice. Sorted ascending by rate (worst first); ties break by higher call
 * count, then by tool name for stability.
 *
 * Tools with no completed calls (all pending) are skipped even if they
 * pass the `minCalls` threshold — a rate of `null` isn't plottable.
 */
export function aggregateToolSuccessRates(
  rows: SessionRow[],
  minCalls = 5,
): ToolSuccessRate[] {
  const merged = mergeStats(rows)
  const out: ToolSuccessRate[] = []
  for (const [tool, s] of merged.entries()) {
    if (s.calls < minCalls) continue
    const completed = s.successes + s.failures
    if (completed <= 0) continue
    const rate = s.successes / completed
    out.push({
      tool,
      rate,
      calls: s.calls,
      successes: s.successes,
      failures: s.failures,
    })
  }
  out.sort((a, b) => {
    const ra = a.rate ?? 1
    const rb = b.rate ?? 1
    if (ra !== rb) return ra - rb
    if (a.calls !== b.calls) return b.calls - a.calls
    return a.tool.localeCompare(b.tool)
  })
  return out
}

/** Threshold colors — matches the semantic tokens in index.css. */
export function colorForSuccessRate(rate: number | null): string {
  if (rate == null) return 'hsl(var(--muted-foreground))'
  if (rate < 0.8) return 'hsl(var(--poor))'
  if (rate < 0.95) return 'hsl(var(--fair))'
  return 'hsl(var(--good))'
}
