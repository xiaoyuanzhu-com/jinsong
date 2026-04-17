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

/** Mirrors the computed-metrics shape from `src/types.ts`. */
export interface SessionMetrics {
  session_id: string

  // Operational — session level
  tokens_per_session: number
  turns_per_session: number
  tool_calls_per_session: number
  duration_seconds: number
  errors_per_session: number
  time_per_turn_avg: number

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

  // Completion
  comp_task_completion_rate: number
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
