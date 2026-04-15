import type {
  AgentEvent,
  Session,
  SessionMetrics,
  ToolCallEndPayload,
  FirstTokenPayload,
  OutputChunkPayload,
  UserInputReceivedPayload,
} from '../types.js';
import { SessionTracker } from './tracker.js';

/**
 * Compute all metrics for a session given its events.
 * Replays events through the tracker, then derives all 35 metrics.
 */
export function computeMetrics(events: AgentEvent[]): { session: Session; metrics: SessionMetrics } {
  const tracker = new SessionTracker();
  for (const event of events) {
    tracker.processEvent(event);
  }

  const session = tracker.buildSession();
  const metrics = deriveMetrics(session, events, tracker);
  return { session, metrics };
}

function deriveMetrics(
  session: Session,
  events: AgentEvent[],
  tracker: SessionTracker
): SessionMetrics {
  const now = new Date().toISOString();

  // ─── Collect tool call durations ───────────────────────────────────────
  const toolCallDurations: number[] = [];
  let toolSuccessCount = 0;
  let toolTotalCount = 0;

  for (const e of events) {
    if (e.event_type === 'tool_call_end') {
      const p = e.payload as ToolCallEndPayload;
      toolCallDurations.push(p.duration_ms);
      toolTotalCount++;
      if (p.status === 'success') toolSuccessCount++;
    }
  }

  // ─── Time to first token ──────────────────────────────────────────────
  let timeToFirstToken: number | null = null;
  for (const e of events) {
    if (e.event_type === 'first_token') {
      const p = e.payload as FirstTokenPayload;
      timeToFirstToken = p.latency_ms / 1000;
      break;
    }
  }

  // ─── Output chunks analysis ────────────────────────────────────────────
  let totalOutputChunkTokens = 0;
  let validChunks = 0;
  let totalChunks = 0;

  for (const e of events) {
    if (e.event_type === 'output_chunk') {
      const p = e.payload as OutputChunkPayload;
      totalOutputChunkTokens += p.token_count;
      totalChunks++;
      if (p.is_valid !== false) validChunks++;
    }
  }

  // ─── Resume speed ─────────────────────────────────────────────────────
  let resumeSpeed: number | null = null;
  for (let i = 0; i < events.length; i++) {
    if (events[i].event_type === 'user_input_received') {
      const receivedTs = new Date(events[i].timestamp).getTime();
      // Find next output_chunk after this
      for (let j = i + 1; j < events.length; j++) {
        if (events[j].event_type === 'output_chunk') {
          const chunkTs = new Date(events[j].timestamp).getTime();
          resumeSpeed = (chunkTs - receivedTs) / 1000;
          break;
        }
      }
      break; // Use first occurrence
    }
  }

  // ─── Stall episodes ───────────────────────────────────────────────────
  const stallEpisodeDurations: number[] = [];
  let stallStart: number | null = null;

  // Re-derive stall episodes from events
  for (const e of events) {
    if (e.event_type === 'tool_call_start' || e.event_type === 'retry_start') {
      if (stallStart === null) {
        stallStart = new Date(e.timestamp).getTime();
      }
    }
    if (stallStart !== null) {
      if (
        e.event_type === 'tool_call_end' ||
        e.event_type === 'retry_end' ||
        e.event_type === 'output_chunk' ||
        e.event_type === 'first_token'
      ) {
        const end = new Date(e.timestamp).getTime();
        stallEpisodeDurations.push(end - stallStart);
        stallStart = null;
      }
    }
  }

  // ─── Hidden retries ───────────────────────────────────────────────────
  // Count retry_start events (all retries are "hidden" from user in the MVP sense)
  let hiddenRetries = 0;
  for (const e of events) {
    if (e.event_type === 'retry_start') hiddenRetries++;
  }

  // ─── Compute operational metrics ──────────────────────────────────────
  const tokensPerSession = session.total_tokens_in + session.total_tokens_out + (session.total_tokens_reasoning ?? 0);
  const turnsPerSession = session.total_turns;
  const toolCallsPerSession = session.total_tool_calls;
  const durationSeconds = session.duration_ms / 1000;
  const errorsPerSession = session.total_errors;

  // time_per_turn_avg: (duration - waiting) / turns
  const activeTimeMs = session.duration_ms - session.time_in_waiting_ms;
  const timePerTurnAvg = turnsPerSession > 0 ? (activeTimeMs / 1000) / turnsPerSession : 0;

  const tokensPerTurnAvg = turnsPerSession > 0 ? tokensPerSession / turnsPerSession : 0;

  // Tool call duration stats
  const toolCallDurationMsAvg =
    toolCallDurations.length > 0
      ? toolCallDurations.reduce((a, b) => a + b, 0) / toolCallDurations.length
      : null;

  const sortedDurations = [...toolCallDurations].sort((a, b) => a - b);
  const toolCallDurationMsP50 = percentile(sortedDurations, 50);
  const toolCallDurationMsP95 = percentile(sortedDurations, 95);

  const toolSuccessRate = toolTotalCount > 0 ? toolSuccessCount / toolTotalCount : null;

  const stallDurationMsAvg =
    stallEpisodeDurations.length > 0
      ? stallEpisodeDurations.reduce((a, b) => a + b, 0) / stallEpisodeDurations.length
      : null;
  const stallDurationMsTotal = session.time_in_stalled_ms;

  // ─── Responsiveness ────────────────────────────────────────────────────
  const rTimeToFirstToken = timeToFirstToken;
  const workingTimeSec = session.time_in_working_ms / 1000;
  const rOutputSpeed = workingTimeSec > 0 ? totalOutputChunkTokens / workingTimeSec : null;
  const rResumeSpeed = resumeSpeed;
  // time per turn: (Working + Stalled) / turns, excluding Waiting
  const rTimePerTurn =
    turnsPerSession > 0
      ? (session.time_in_working_ms + session.time_in_stalled_ms) / 1000 / turnsPerSession
      : 0;

  // ─── Reliability ───────────────────────────────────────────────────────
  const relStartFailureRate = tracker.getStartFailed() ? 1.0 : 0.0;
  const activeMsSum = session.time_in_working_ms + session.time_in_stalled_ms;
  const relStallRatio = activeMsSum > 0 ? session.time_in_stalled_ms / activeMsSum : 0;
  const relStallCount = tracker.getStallTransitions();
  const relAvgStallDuration =
    stallEpisodeDurations.length > 0
      ? stallEpisodeDurations.reduce((a, b) => a + b, 0) / stallEpisodeDurations.length / 1000
      : null;
  const relErrorRate = session.total_errors;
  const relHiddenRetries = hiddenRetries;

  // ─── Autonomy ──────────────────────────────────────────────────────────
  const aQuestionsAsked = tracker.getQuestionsAsked();
  const aUserCorrections = tracker.getUserCorrections();
  const aFirstTrySuccessRate =
    aUserCorrections === 0 && aQuestionsAsked === 0 && session.task_completed ? 1.0 : 0.0;

  // user_active_time_pct: (Waiting time) / duration * 100
  // Simplified: we count waiting time as user active time
  const aUserActiveTimePct =
    session.duration_ms > 0 ? (session.time_in_waiting_ms / session.duration_ms) * 100 : 0;

  // work_multiplier: Working / (Waiting + user_input_time)
  const userTimeDenominator = session.time_in_waiting_ms;
  const aWorkMultiplier =
    userTimeDenominator > 0 ? session.time_in_working_ms / userTimeDenominator : null;

  // ─── Correctness ───────────────────────────────────────────────────────
  const cOutputQualityScore: number | null = null; // L4
  const cCleanOutputRate = totalChunks > 0 ? validChunks / totalChunks : null;
  const cQualityDecay: number | null = null; // L4
  const cUsefulTokenPct = tokensPerSession > 0 ? (session.total_tokens_out / tokensPerSession) * 100 : 0;

  // ─── Completion ────────────────────────────────────────────────────────
  const compTaskCompletionRate = session.task_completed ? 1.0 : 0.0;
  const compRedoRate: number | null = null; // requires cross-session analysis
  const compGaveUpRate = session.end_reason === 'user_cancelled' && !session.task_completed ? 1.0 : 0.0;
  const cancelState = tracker.getCancelState();
  const compWhereTheyGaveUp = compGaveUpRate > 0 ? cancelState : null;

  // time_to_done: from first prompt_submit to task_complete
  let compTimeToDone: number | null = null;
  const firstPromptTs = tracker.getFirstPromptTimestamp();
  const taskCompleteTs = tracker.getTaskCompleteTimestamp();
  if (firstPromptTs !== null && taskCompleteTs !== null) {
    compTimeToDone = (taskCompleteTs - firstPromptTs) / 1000;
  }

  const compCameBackRate: number | null = null; // requires cross-session analysis

  return {
    session_id: session.session_id,
    computed_at: now,

    tokens_per_session: tokensPerSession,
    turns_per_session: turnsPerSession,
    tool_calls_per_session: toolCallsPerSession,
    duration_seconds: durationSeconds,
    errors_per_session: errorsPerSession,
    time_per_turn_avg: timePerTurnAvg,

    time_to_first_token: timeToFirstToken,
    tokens_per_turn_avg: tokensPerTurnAvg,
    tool_call_duration_ms_avg: toolCallDurationMsAvg,
    tool_call_duration_ms_p50: toolCallDurationMsP50,
    tool_call_duration_ms_p95: toolCallDurationMsP95,
    tool_success_rate: toolSuccessRate,
    retry_count_total: session.total_retries,
    stall_duration_ms_avg: stallDurationMsAvg,
    stall_duration_ms_total: stallDurationMsTotal,

    r_time_to_first_token: rTimeToFirstToken,
    r_output_speed: rOutputSpeed,
    r_resume_speed: rResumeSpeed,
    r_time_per_turn: rTimePerTurn,

    rel_start_failure_rate: relStartFailureRate,
    rel_stall_ratio: relStallRatio,
    rel_stall_count: relStallCount,
    rel_avg_stall_duration: relAvgStallDuration,
    rel_error_rate: relErrorRate,
    rel_hidden_retries: relHiddenRetries,

    a_questions_asked: aQuestionsAsked,
    a_user_corrections: aUserCorrections,
    a_first_try_success_rate: aFirstTrySuccessRate,
    a_user_active_time_pct: aUserActiveTimePct,
    a_work_multiplier: aWorkMultiplier,

    c_output_quality_score: cOutputQualityScore,
    c_clean_output_rate: cCleanOutputRate,
    c_quality_decay: cQualityDecay,
    c_useful_token_pct: cUsefulTokenPct,

    comp_task_completion_rate: compTaskCompletionRate,
    comp_redo_rate: compRedoRate,
    comp_gave_up_rate: compGaveUpRate,
    comp_where_they_gave_up: compWhereTheyGaveUp,
    comp_time_to_done: compTimeToDone,
    comp_came_back_rate: compCameBackRate,
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
