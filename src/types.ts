// ─── Event Types ───────────────────────────────────────────────────────────

export type EventType =
  | 'session_start'
  | 'prompt_submit'
  | 'first_token'
  | 'output_chunk'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'retry_start'
  | 'retry_end'
  | 'user_input_requested'
  | 'user_input_received'
  | 'user_correction'
  | 'error'
  | 'task_complete'
  | 'user_cancel'
  | 'session_end';

export type InterfaceType =
  | 'CLI'
  | 'IDE_extension'
  | 'web_chat'
  | 'API_direct'
  | 'mobile'
  | 'embedded'
  | 'voice';

export type SessionMode =
  | 'single_turn'
  | 'multi_turn_interactive'
  | 'multi_turn_autonomous'
  | 'background_batch';

export type TaskCategory =
  | 'code_generation'
  | 'code_review'
  | 'debugging'
  | 'refactoring'
  | 'Q&A'
  | 'data_analysis'
  | 'writing'
  | 'research'
  | 'multi_step_workflow'
  | 'system_administration'
  | 'other';

export type ComplexityTier = 'trivial' | 'simple' | 'moderate' | 'complex' | 'heroic';

export type ContentType = 'quick_answer' | 'guided_task' | 'deep_session' | 'autonomous_workflow';

export type EndReason = 'completed' | 'failed' | 'user_cancelled' | 'timeout';

export type CompletionType = 'full' | 'partial';

export type ChunkType = 'text' | 'code' | 'markdown' | 'artifact' | 'status_update';

export type ToolCategory =
  | 'execution'
  | 'retrieval'
  | 'file_system'
  | 'communication'
  | 'code_analysis'
  | 'browser'
  | 'other';

export type ErrorType =
  | 'model_error'
  | 'tool_error'
  | 'auth_error'
  | 'rate_limit'
  | 'context_overflow'
  | 'timeout'
  | 'crash'
  | 'validation_error'
  | 'unknown';

export type RetryReason =
  | 'tool_failure'
  | 'model_error'
  | 'rate_limit'
  | 'timeout'
  | 'validation_error';

export type InputType = 'clarification' | 'approval' | 'choice' | 'information' | 'confirmation';

export type CorrectionType = 'redirect' | 'refine' | 'reject' | 'clarify';

export type ToolStatus = 'success' | 'failure' | 'timeout';

export type RetryStatus = 'success' | 'failure' | 'budget_exhausted';

// ─── Payload Types ─────────────────────────────────────────────────────────

export interface SessionStartPayload {
  agent_name: string;
  agent_version: string;
  agent_framework?: string;
  model_provider: string;
  model_id: string;
  interface_type: InterfaceType;
  session_mode: SessionMode;
  client_id?: string;
}

export interface PromptSubmitPayload {
  prompt_hash: string;
  turn_number: number;
  token_count?: number;
  task_category?: TaskCategory;
  complexity_tier?: ComplexityTier;
}

export interface FirstTokenPayload {
  latency_ms: number;
}

export interface OutputChunkPayload {
  token_count: number;
  chunk_type: ChunkType;
  cumulative_tokens?: number;
  is_valid?: boolean;
}

export interface ToolCallStartPayload {
  tool_call_id: string;
  tool_name: string;
  tool_provider?: string;
  mcp_server?: string;
  tool_category?: ToolCategory;
  stall_reason: 'tool_call';
}

export interface ToolCallEndPayload {
  tool_call_id: string;
  tool_name: string;
  status: ToolStatus;
  duration_ms: number;
  error_message?: string;
}

export interface RetryStartPayload {
  retry_reason: RetryReason;
  attempt_number: number;
  original_event_id?: string;
  stall_reason: 'retry';
}

export interface RetryEndPayload {
  status: RetryStatus;
  attempt_number: number;
  duration_ms: number;
}

export interface UserInputRequestedPayload {
  input_type: InputType;
  question_hash?: string;
}

export interface UserInputReceivedPayload {
  wait_duration_ms: number;
  response_token_count?: number;
}

export interface UserCorrectionPayload {
  turn_number: number;
  correction_type?: CorrectionType;
}

export interface ErrorPayload {
  error_type: ErrorType;
  is_fatal: boolean;
  error_code?: string;
  error_message?: string;
  current_state: TrackerState;
}

export interface TaskCompletePayload {
  completion_type: CompletionType;
  output_token_count?: number;
}

export interface UserCancelPayload {
  current_state: TrackerState;
  turns_completed?: number;
}

export interface SessionEndPayload {
  end_reason: EndReason;
  total_duration_ms: number;
  total_tokens_in?: number;
  total_tokens_out?: number;
  total_tool_calls?: number;
}

export type EventPayload =
  | SessionStartPayload
  | PromptSubmitPayload
  | FirstTokenPayload
  | OutputChunkPayload
  | ToolCallStartPayload
  | ToolCallEndPayload
  | RetryStartPayload
  | RetryEndPayload
  | UserInputRequestedPayload
  | UserInputReceivedPayload
  | UserCorrectionPayload
  | ErrorPayload
  | TaskCompletePayload
  | UserCancelPayload
  | SessionEndPayload;

// ─── Agent Event ───────────────────────────────────────────────────────────

export interface AgentEvent {
  event_id: string;
  session_id: string;
  timestamp: string; // ISO 8601
  event_type: EventType;
  payload: EventPayload;
}

// ─── State Machine ─────────────────────────────────────────────────────────

export type TrackerState = 'Starting' | 'Working' | 'Stalled' | 'Waiting' | 'Failed' | 'Ended';

// ─── Session Record ────────────────────────────────────────────────────────

export interface Session {
  session_id: string;
  user_id: string | null;

  started_at: string;
  ended_at: string;
  duration_ms: number;

  total_turns: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_tokens_reasoning: number | null;
  total_tool_calls: number;
  total_errors: number;
  total_retries: number;

  time_in_starting_ms: number;
  time_in_working_ms: number;
  time_in_stalled_ms: number;
  time_in_waiting_ms: number;

  end_reason: EndReason;
  task_completed: boolean;
  completion_type: CompletionType | null;

  agent_name: string;
  agent_version: string;
  agent_framework: string | null;
  model_provider: string;
  model_id: string;
  interface_type: InterfaceType;
  task_category: TaskCategory | null;
  complexity_tier: ComplexityTier | null;
  session_mode: SessionMode;
  content_type: ContentType | null;
}

// ─── Metrics Record ────────────────────────────────────────────────────────

export interface SessionMetrics {
  session_id: string;
  computed_at: string;

  // Operational — session level
  tokens_per_session: number;
  turns_per_session: number;
  tool_calls_per_session: number;
  duration_seconds: number;
  errors_per_session: number;
  time_per_turn_avg: number;

  // Operational — per-event aggregates
  time_to_first_token: number | null;
  tokens_per_turn_avg: number;
  tool_call_duration_ms_avg: number | null;
  tool_call_duration_ms_p50: number | null;
  tool_call_duration_ms_p95: number | null;
  tool_success_rate: number | null;
  retry_count_total: number;
  stall_duration_ms_avg: number | null;
  stall_duration_ms_total: number;

  // Responsiveness
  r_time_to_first_token: number | null;
  r_output_speed: number | null;
  r_resume_speed: number | null;
  r_time_per_turn: number;

  // Reliability
  rel_start_failure_rate: number;
  rel_stall_ratio: number;
  rel_stall_count: number;
  rel_avg_stall_duration: number | null;
  rel_error_rate: number;
  rel_hidden_retries: number;

  // Autonomy
  a_questions_asked: number;
  a_user_corrections: number;
  a_first_try_success_rate: number;
  a_user_active_time_pct: number;
  a_work_multiplier: number | null;

  // Correctness
  c_output_quality_score: number | null;
  c_clean_output_rate: number | null;
  c_quality_decay: number | null;
  c_useful_token_pct: number;

  // Completion
  comp_task_completion_rate: number;
  comp_redo_rate: number | null;
  comp_gave_up_rate: number;
  comp_where_they_gave_up: TrackerState | null;
  comp_time_to_done: number | null;
  comp_came_back_rate: number | null;
}

// ─── Session Filters ───────────────────────────────────────────────────────

export interface SessionFilters {
  dateFrom?: string;
  dateTo?: string;
  agentName?: string;
  modelId?: string;
  limit?: number;
}
