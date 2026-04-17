/**
 * Presentational metadata for the Distributions row donut cards.
 *
 * Aggregation now happens server-side (`/api/aggregate` as of DASH-11).
 * This module only exports the display order, labels, and colors the
 * donut renderer zips against the server payload.
 */

// ─── Content type ─────────────────────────────────────────────────────────

export type ContentType =
  | 'quick_answer'
  | 'guided_task'
  | 'deep_session'
  | 'autonomous_workflow'

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
