/**
 * Session breakdown helpers for the DASH-9 Agent/Model row.
 *
 * Flattens `SessionRow[]` into `{ label, value }` pairs suitable for the
 * `BarListChart` primitive — one for agent_name, one for model_id. Missing
 * values are bucketed under `"unknown"` rather than dropped so the user
 * sees a complete picture of what landed in the range.
 */

import type { SessionRow } from './api'

export interface BreakdownDatum {
  label: string
  value: number
}

const UNKNOWN = 'unknown'

function aggregateBy(
  rows: SessionRow[],
  pick: (r: SessionRow) => string | null | undefined,
  topN: number,
): BreakdownDatum[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const raw = pick(r)
    const key = raw == null || raw === '' ? UNKNOWN : raw
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const out: BreakdownDatum[] = []
  for (const [label, value] of counts.entries()) {
    out.push({ label, value })
  }
  out.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  return out.slice(0, topN)
}

/**
 * Top-N sessions grouped by `session.agent_name`. Sorted descending by
 * count; ties broken alphabetically. `null`/`undefined`/empty strings map
 * to `"unknown"`.
 */
export function aggregateByAgent(
  rows: SessionRow[],
  topN = 10,
): BreakdownDatum[] {
  return aggregateBy(rows, (r) => r.session.agent_name, topN)
}

/**
 * Top-N sessions grouped by `session.model_id`. Same ordering rules as
 * `aggregateByAgent`.
 */
export function aggregateByModel(
  rows: SessionRow[],
  topN = 10,
): BreakdownDatum[] {
  return aggregateBy(rows, (r) => r.session.model_id, topN)
}
