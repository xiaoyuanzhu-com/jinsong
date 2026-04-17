/**
 * Client-side API layer.
 *
 * Types mirror the subset of `src/types.ts` the dashboard actually consumes —
 * intentionally duplicated (not imported) so the UI bundle stays self-contained
 * and doesn't pull server-only code through Vite's module graph.
 */

export type EndReason = 'completed' | 'failed' | 'user_cancelled' | 'timeout'

/** Trimmed to fields the dashboard reads today. Extend as new widgets land. */
export interface Session {
  session_id: string
  started_at: string
  ended_at: string
  duration_ms: number
  total_turns: number
  total_tool_calls: number
  total_tokens_in: number
  total_tokens_out: number
  task_completed: boolean
  end_reason: EndReason
  agent_name: string
  model_id: string
}

/**
 * Mirrors the computed-metrics shape from `src/types.ts`.
 *
 * Most fields are optional here because older server builds / mock rows
 * may only populate a subset. The detail page (DASH-10) reaches for the
 * full set; existing dashboard widgets only touch the fields they know
 * about. Unknown fields always render as `—` in the UI.
 */
export interface SessionMetrics {
  session_id: string

  // Operational — session level (metrics.md §1.1)
  tokens_per_session: number
  turns_per_session: number
  tool_calls_per_session: number
  duration_seconds: number
  errors_per_session: number
  time_per_turn_avg: number

  // Operational — per-event aggregates (metrics.md §1.2). Optional because
  // pre-DASH-10 builds only set the r_* mirror, not these aggregates.
  time_to_first_token?: number | null
  tokens_per_turn_avg?: number
  tool_call_duration_ms_avg?: number | null
  tool_call_duration_ms_p50?: number | null
  tool_call_duration_ms_p95?: number | null
  tool_success_rate?: number | null
  retry_count_total?: number
  stall_duration_ms_avg?: number | null
  stall_duration_ms_total?: number

  // Responsiveness (r_* families we currently surface)
  r_time_to_first_token: number | null
  r_output_speed: number | null
  r_resume_speed: number | null
  r_time_per_turn: number

  // Reliability
  rel_start_failure_rate: number
  rel_stall_ratio: number
  rel_stall_count: number
  rel_avg_stall_duration: number | null
  rel_error_rate: number
  rel_hidden_retries?: number

  // Autonomy — some fields (a_user_active_time_pct) not emitted yet.
  a_questions_asked?: number
  a_user_corrections?: number
  a_first_try_success_rate?: number
  a_user_active_time_pct?: number
  a_work_multiplier?: number | null

  // Correctness — mostly L4 (judge) or not yet emitted.
  c_output_quality_score?: number | null
  c_clean_output_rate?: number | null
  c_quality_decay?: number | null
  c_useful_token_pct?: number

  // Completion
  comp_task_completion_rate: number
  comp_redo_rate?: number | null
  comp_gave_up_rate?: number
  comp_where_they_gave_up?: string | null
  comp_time_to_done?: number | null
  comp_came_back_rate?: number | null
}

/**
 * Per-tool call counts for a single session. `calls` comes from
 * `tool_call_start` (authoritative call count — pending calls included).
 * `successes` / `failures` come from `tool_call_end`; their sum can be less
 * than `calls` when some invocations are still pending (no end event yet).
 *
 * Success rate is computed over completed calls only:
 * `successes / (successes + failures)`.
 */
export interface ToolStats {
  calls: number
  successes: number
  failures: number
}

export interface SessionRow {
  session: Session
  metrics: SessionMetrics | null
  /**
   * Per-session count of tool invocations grouped by category
   * (execution / file_system / browser / other). Added in DASH-6 for the
   * Distributions row. Absent on very old server builds; treat `undefined`
   * as "no data yet" and render the donut's empty state.
   */
  tool_category_counts?: Record<string, number>
  /**
   * Per-session, per-tool call stats. Added in DASH-7 for the Tool
   * Performance row. `undefined` on older server builds → UI shows empty
   * state.
   */
  tool_stats?: Record<string, ToolStats>
}

interface SessionsResponse {
  sessions: SessionRow[]
}

/**
 * Fetch every known session from the server. The endpoint returns the full
 * list (no pagination yet), which is fine for the single-user local tool.
 *
 * Callers narrow to the active time range client-side via `filterByRange`.
 */
export async function fetchSessions(): Promise<SessionRow[]> {
  const res = await fetch('/api/sessions', { headers: { accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`fetchSessions: HTTP ${res.status}`)
  }
  const body = (await res.json()) as SessionsResponse
  return Array.isArray(body?.sessions) ? body.sessions : []
}

/**
 * Sentinel thrown by `fetchSessionById` when the server responds 404.
 * The detail page checks for this so it can render a dedicated
 * "Session not found" state instead of a generic error banner.
 */
export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`)
    this.name = 'SessionNotFoundError'
  }
}

/**
 * Fetch a single session's detail payload. Throws `SessionNotFoundError`
 * on 404 and a generic `Error` for any other failure (network, 5xx, malformed
 * JSON). The returned shape matches one entry from `/api/sessions`.
 */
export async function fetchSessionById(id: string): Promise<SessionRow> {
  const res = await fetch(`/api/session/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
  })
  if (res.status === 404) {
    throw new SessionNotFoundError(id)
  }
  if (!res.ok) {
    throw new Error(`fetchSessionById: HTTP ${res.status}`)
  }
  return (await res.json()) as SessionRow
}
