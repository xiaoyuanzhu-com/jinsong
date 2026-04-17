/**
 * Distribution buckets for the DASH-6 donut row.
 *
 * Content-type inference follows metrics.md §3 (turns + duration +
 * tool-call thresholds). Kept as a pure module — callers pass in rows, we
 * return plain count maps the donut components render directly. No React,
 * no fetch, trivially testable.
 */

import type { Session, SessionRow } from './api'

// ─── Content type ─────────────────────────────────────────────────────────

export type ContentType =
  | 'quick_answer'
  | 'guided_task'
  | 'deep_session'
  | 'autonomous_workflow'

const MS_15_MIN = 15 * 60 * 1000
const MS_30_SEC = 30 * 1000

/**
 * Classify a single session. Precedence matters — we check `quick_answer`
 * first (tight bound), then `autonomous_workflow` (single prompt but long
 * wall-clock), then `deep_session` (either many turns or long), else
 * `guided_task` as the default middle category.
 */
export function inferContentType(session: Session): ContentType {
  const turns = session.total_turns ?? 0
  const duration = session.duration_ms ?? 0
  const toolCalls = session.total_tool_calls ?? 0

  if (turns <= 2 && duration < MS_30_SEC && toolCalls <= 2) {
    return 'quick_answer'
  }
  if (turns <= 1 && duration >= MS_15_MIN) {
    return 'autonomous_workflow'
  }
  if (turns >= 15 || duration >= MS_15_MIN) {
    return 'deep_session'
  }
  return 'guided_task'
}

export function bucketByContentType(
  rows: SessionRow[],
): Record<ContentType, number> {
  const out: Record<ContentType, number> = {
    quick_answer: 0,
    guided_task: 0,
    deep_session: 0,
    autonomous_workflow: 0,
  }
  for (const r of rows) {
    out[inferContentType(r.session)] += 1
  }
  return out
}

export const CONTENT_TYPE_ORDER: ContentType[] = [
  'quick_answer',
  'guided_task',
  'deep_session',
  'autonomous_workflow',
]

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  quick_answer: 'Quick answer',
  guided_task: 'Guided task',
  deep_session: 'Deep session',
  autonomous_workflow: 'Autonomous workflow',
}

export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  quick_answer: 'hsl(var(--chart-1))',
  guided_task: 'hsl(var(--chart-2))',
  deep_session: 'hsl(var(--chart-3))',
  autonomous_workflow: 'hsl(var(--chart-4))',
}

// ─── End reason ───────────────────────────────────────────────────────────

/**
 * Canonical end-reason buckets. Anything else (null, typo, future value)
 * collapses into `other` so the donut always has a well-defined slice set.
 */
export type EndReasonBucket =
  | 'completed'
  | 'user_cancelled'
  | 'error'
  | 'timeout'
  | 'other'

export const END_REASON_ORDER: EndReasonBucket[] = [
  'completed',
  'user_cancelled',
  'error',
  'timeout',
  'other',
]

export const END_REASON_LABELS: Record<EndReasonBucket, string> = {
  completed: 'Completed',
  user_cancelled: 'Cancelled',
  error: 'Error',
  timeout: 'Timeout',
  other: 'Other',
}

export const END_REASON_COLORS: Record<EndReasonBucket, string> = {
  completed: 'hsl(var(--good))',
  user_cancelled: 'hsl(var(--chart-4))',
  error: 'hsl(var(--poor))',
  timeout: 'hsl(var(--chart-5))',
  other: 'hsl(var(--muted-foreground))',
}

/**
 * Normalize a raw `session.end_reason` string (which upstream has already
 * been typed but may still carry `'failed'` or unexpected values from older
 * connectors) into one of the 5 display buckets. `'failed'` maps to
 * `'error'` so the donut reads naturally.
 */
export function normalizeEndReason(raw: string | null | undefined): EndReasonBucket {
  if (raw === 'completed') return 'completed'
  if (raw === 'user_cancelled') return 'user_cancelled'
  if (raw === 'timeout') return 'timeout'
  if (raw === 'error' || raw === 'failed') return 'error'
  return 'other'
}

export function bucketByEndReason(
  rows: SessionRow[],
): Record<EndReasonBucket, number> {
  const out: Record<EndReasonBucket, number> = {
    completed: 0,
    user_cancelled: 0,
    error: 0,
    timeout: 0,
    other: 0,
  }
  for (const r of rows) {
    out[normalizeEndReason(r.session.end_reason)] += 1
  }
  return out
}

// ─── Tool category ────────────────────────────────────────────────────────

export type ToolCategoryBucket =
  | 'execution'
  | 'file_system'
  | 'browser'
  | 'other'

export const TOOL_CATEGORY_ORDER: ToolCategoryBucket[] = [
  'execution',
  'file_system',
  'browser',
  'other',
]

export const TOOL_CATEGORY_LABELS: Record<ToolCategoryBucket, string> = {
  execution: 'Execution',
  file_system: 'File system',
  browser: 'Browser',
  other: 'Other',
}

export const TOOL_CATEGORY_COLORS: Record<ToolCategoryBucket, string> = {
  execution: 'hsl(var(--chart-1))',
  file_system: 'hsl(var(--chart-2))',
  browser: 'hsl(var(--chart-3))',
  other: 'hsl(var(--muted-foreground))',
}

/**
 * Aggregate tool-call counts across all rows into the 4 display buckets.
 *
 * Returns `null` if NO row in the slice carries a `tool_category_counts`
 * field (i.e. we're running against an older server build that predates
 * DASH-6's /api/sessions extension). The UI uses `null` to render the
 * donut's empty state with a "awaiting server aggregation" subtitle.
 *
 * Upstream categories that don't map cleanly (retrieval, communication,
 * code_analysis, etc.) collapse into `other` so the donut stays at 4
 * slices. This matches the design in metrics.md §3.
 */
export function bucketByToolCategory(
  rows: SessionRow[],
): Record<ToolCategoryBucket, number> | null {
  let sawAnyField = false
  const out: Record<ToolCategoryBucket, number> = {
    execution: 0,
    file_system: 0,
    browser: 0,
    other: 0,
  }
  for (const r of rows) {
    const counts = r.tool_category_counts
    if (counts == null) continue
    sawAnyField = true
    for (const [cat, n] of Object.entries(counts)) {
      if (!Number.isFinite(n) || n <= 0) continue
      if (cat === 'execution') out.execution += n
      else if (cat === 'file_system') out.file_system += n
      else if (cat === 'browser') out.browser += n
      else out.other += n
    }
  }
  return sawAnyField ? out : null
}
