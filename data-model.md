# Data Model Specification

Database schema for the Agent Experience (AX) framework. Three levels of data — Events (raw telemetry), Sessions (aggregated per session), Metrics (computed per session) — plus dimension lookups and a tool call sub-table.

An engineer reads this and knows exactly what tables to create.

---

## 1. Overview

```
┌─────────────────────────────────────────────────────────┐
│                       Data Layers                        │
├──────────┬──────────────────────────────────────────────┤
│ Events   │ Raw telemetry. Append-only. Finest grain.    │
│ Sessions │ One record per session. Aggregated from      │
│          │ events. Dashboard queries hit this table.     │
│ Metrics  │ Computed metrics per session. One row per     │
│          │ session, one column per metric. Derived from  │
│          │ sessions + events.                            │
├──────────┼──────────────────────────────────────────────┤
│ ToolCalls│ Sub-table. Many per session.                  │
│ Dimensions│ Enum/lookup tables for slicing.              │
└──────────┴──────────────────────────────────────────────┘
```

---

## 2. Events Table

Raw event stream emitted by the client SDK. Each row is one event. Append-only, immutable.

### 2.1 Base Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `event_id` | UUID | not null | Primary key. Generated client-side. |
| `session_id` | UUID | not null | FK to sessions. Groups events into a session. |
| `timestamp` | timestamp (ms) | not null | ISO 8601 with millisecond precision. Client clock. |
| `event_type` | enum | not null | One of the 15 event types defined below. |
| `payload` | JSON | not null | Event-type-specific fields. Schema per type below. |

**Indexes:** `(session_id, timestamp)` for session replay, `(event_type, timestamp)` for type-filtered queries.

### 2.2 Event Types and Payloads

#### `session_start`

User initiates an agent session.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `agent_name` | string | yes | Name of the agent (e.g., "Claude Code"). |
| `agent_version` | string | yes | Semantic version of the agent. |
| `agent_framework` | string | no | Framework powering the agent (e.g., "Anthropic Agent SDK"). |
| `model_provider` | string | yes | LLM provider (e.g., "Anthropic", "OpenAI"). |
| `model_id` | string | yes | Model identifier (e.g., "claude-opus-4-20250514"). |
| `interface_type` | enum | yes | `CLI`, `IDE_extension`, `web_chat`, `API_direct`, `mobile`, `embedded`, `voice`. |
| `session_mode` | enum | yes | `single_turn`, `multi_turn_interactive`, `multi_turn_autonomous`, `background_batch`. |
| `client_id` | string | no | Anonymized client/device identifier. |

#### `prompt_submit`

User sends a prompt to the agent. Marks the beginning of a turn.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `prompt_hash` | string | yes | SHA-256 hash of the prompt text (privacy-preserving). |
| `turn_number` | int | yes | 1-indexed turn within the session. |
| `token_count` | int | no | Number of tokens in the prompt. |
| `task_category` | enum | no | Inferred or user-tagged: `code_generation`, `code_review`, `debugging`, `refactoring`, `Q&A`, `data_analysis`, `writing`, `research`, `multi_step_workflow`, `system_administration`, `other`. |
| `complexity_tier` | enum | no | `trivial`, `simple`, `moderate`, `complex`, `heroic`. |

#### `first_token`

First visible output token rendered to the user. Triggers Starting -> Working transition.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `latency_ms` | int | yes | Milliseconds since the preceding `prompt_submit`. |

#### `output_chunk`

Batch of output tokens delivered to the user during Working state.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `token_count` | int | yes | Number of visible tokens in this chunk. |
| `chunk_type` | enum | yes | `text`, `code`, `markdown`, `artifact`, `status_update`. |
| `cumulative_tokens` | int | no | Running total of output tokens in this turn. |
| `is_valid` | bool | no | Whether the chunk passes syntax/format validation. |

#### `tool_call_start`

Agent invokes an external tool. Triggers Working -> Stalled transition.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `tool_call_id` | UUID | yes | Unique identifier for this tool invocation. |
| `tool_name` | string | yes | Name of the tool (e.g., "Bash", "Read", "web_search"). |
| `tool_provider` | string | no | Provider of the tool (e.g., "built-in", "Tavily", "GitHub"). |
| `mcp_server` | string | no | MCP server ID, if tool is served via MCP. |
| `tool_category` | enum | no | `execution`, `retrieval`, `file_system`, `communication`, `code_analysis`, `browser`, `other`. |
| `stall_reason` | enum | yes | Always `tool_call` for this event type. |

#### `tool_call_end`

Tool returns a result. Triggers Stalled -> Working transition (on success).

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `tool_call_id` | UUID | yes | Matches the `tool_call_start` event. |
| `tool_name` | string | yes | Same tool name as the start event. |
| `status` | enum | yes | `success`, `failure`, `timeout`. |
| `duration_ms` | int | yes | Wall-clock milliseconds from start to end. |
| `error_message` | string | no | Error details if status is not `success`. |

#### `retry_start`

Agent initiates a retry of a failed operation. Enters or remains in Stalled state.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `retry_reason` | enum | yes | `tool_failure`, `model_error`, `rate_limit`, `timeout`, `validation_error`. |
| `attempt_number` | int | yes | 1-indexed retry attempt (1 = first retry, not original attempt). |
| `original_event_id` | UUID | no | Reference to the event that triggered the retry. |
| `stall_reason` | enum | yes | Always `retry` for this event type. |

#### `retry_end`

Retry attempt completes.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `status` | enum | yes | `success`, `failure`, `budget_exhausted`. |
| `attempt_number` | int | yes | Which attempt just completed. |
| `duration_ms` | int | yes | Wall-clock time of this retry attempt. |

#### `user_input_requested`

Agent asks the user a question. Triggers Working -> Waiting transition.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `input_type` | enum | yes | `clarification`, `approval`, `choice`, `information`, `confirmation`. |
| `question_hash` | string | no | SHA-256 hash of the question text. |

#### `user_input_received`

User responds to the agent's question. Triggers Waiting -> Working transition.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `wait_duration_ms` | int | yes | Milliseconds between `user_input_requested` and this event. |
| `response_token_count` | int | no | Number of tokens in the user's response. |

#### `user_correction`

User sends a corrective/steering message during the Working state. Does NOT cause a state transition.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `turn_number` | int | yes | Turn in which the correction occurred. |
| `correction_type` | enum | no | `redirect`, `refine`, `reject`, `clarify`. |

#### `error`

An error occurs during the session. May trigger transitions to Failed or Stalled.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `error_type` | enum | yes | `model_error`, `tool_error`, `auth_error`, `rate_limit`, `context_overflow`, `timeout`, `crash`, `validation_error`, `unknown`. |
| `is_fatal` | bool | yes | `true` if unrecoverable (triggers -> Failed). `false` if agent can retry. |
| `error_code` | string | no | Machine-readable error code. |
| `error_message` | string | no | Human-readable description. |
| `current_state` | enum | yes | State machine state when error occurred: `Starting`, `Working`, `Stalled`, `Waiting`. |

#### `task_complete`

Agent signals that the task is done. Triggers Working -> Ended transition.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `completion_type` | enum | yes | `full`, `partial`. |
| `output_token_count` | int | no | Total visible output tokens produced. |

#### `user_cancel`

User cancels or stops the session. Triggers -> Ended from any active state.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `current_state` | enum | yes | State at cancellation: `Starting`, `Working`, `Stalled`, `Waiting`. |
| `turns_completed` | int | no | Number of complete turns before cancellation. |

#### `session_end`

Session terminates. Final event in every session.

| Payload Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `end_reason` | enum | yes | `completed`, `failed`, `user_cancelled`, `timeout`. |
| `total_duration_ms` | int | yes | Wall-clock session duration. |
| `total_tokens_in` | int | no | Total input tokens consumed. |
| `total_tokens_out` | int | no | Total output tokens produced. |
| `total_tool_calls` | int | no | Total tool invocations. |

---

## 3. Sessions Table

One record per agent session. Populated by aggregating events at session close. This is the primary table for dashboards and queries.

### 3.1 Schema

#### Identity

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `session_id` | UUID | not null | Primary key. Matches event stream `session_id`. |
| `user_id` | string | yes | Anonymized/hashed user identifier. Null if anonymous. |

#### Timestamps

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `started_at` | timestamp (ms) | not null | Timestamp of the `session_start` event. |
| `ended_at` | timestamp (ms) | not null | Timestamp of the `session_end` event. |
| `duration_ms` | int | not null | `ended_at - started_at` in milliseconds. |

#### Session Shape (Operational Counters)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `total_turns` | int | not null | Count of `prompt_submit` events. |
| `total_tokens_in` | int | not null | Sum of all input tokens (prompts + user responses). |
| `total_tokens_out` | int | not null | Sum of all visible output tokens. |
| `total_tokens_reasoning` | int | yes | Reasoning/thinking tokens if reported by the model. |
| `total_tool_calls` | int | not null | Count of `tool_call_start` events. |
| `total_errors` | int | not null | Count of `error` events (fatal + non-fatal). |
| `total_retries` | int | not null | Count of `retry_start` events. |

#### State Durations

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `time_in_starting_ms` | int | not null | Total ms in Starting state. Sum of all Starting episodes. |
| `time_in_working_ms` | int | not null | Total ms in Working state. Sum of all Working episodes. |
| `time_in_stalled_ms` | int | not null | Total ms in Stalled state. Sum of all Stalled episodes. |
| `time_in_waiting_ms` | int | not null | Total ms in Waiting state. Sum of all Waiting episodes. |

#### Outcome

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `end_reason` | enum | not null | `completed`, `failed`, `user_cancelled`, `timeout`. |
| `task_completed` | bool | not null | `true` if at least one `task_complete` event was emitted. |
| `completion_type` | enum | yes | `full`, `partial`, null if not completed. |

#### Dimensions (Core)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `agent_name` | string | not null | Agent name from `session_start`. |
| `agent_version` | string | not null | Agent version from `session_start`. |
| `agent_framework` | string | yes | Agent framework from `session_start`. |
| `model_provider` | string | not null | Primary model provider. |
| `model_id` | string | not null | Primary model identifier. |
| `interface_type` | enum | not null | `CLI`, `IDE_extension`, `web_chat`, `API_direct`, `mobile`, `embedded`, `voice`. |
| `task_category` | enum | yes | Inferred or tagged task category. |
| `complexity_tier` | enum | yes | `trivial`, `simple`, `moderate`, `complex`, `heroic`. |
| `session_mode` | enum | not null | `single_turn`, `multi_turn_interactive`, `multi_turn_autonomous`, `background_batch`. |
| `content_type` | enum | yes | Derived from session shape: `quick_answer`, `guided_task`, `deep_session`, `autonomous_workflow`. |

#### Dimensions (Extended)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `context_utilization_pct` | float | yes | Peak context window utilization (0.0-100.0). |
| `compaction_count` | int | yes | Number of context compaction/summarization events. |
| `user_segment` | string | yes | User cohort (e.g., plan tier, geography). |

---

## 4. Metrics Table

One row per session, one column per metric. All 35 metric IDs from `metrics.md`. Computed after session ends (or periodically for long-running sessions).

### 4.1 Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `session_id` | UUID | not null | PK and FK to sessions. |
| `computed_at` | timestamp | not null | When metrics were last computed. |

#### Operational Metrics — Session-Level

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `tokens_per_session` | int | not null | Total tokens (in + out + reasoning). |
| `turns_per_session` | int | not null | Count of user-agent exchange cycles. |
| `tool_calls_per_session` | int | not null | Count of tool invocations. |
| `duration_seconds` | float | not null | Wall-clock session duration in seconds. |
| `errors_per_session` | int | not null | Count of all error events. |
| `time_per_turn_avg` | float | not null | `duration_seconds / turns_per_session` (excluding Waiting time). |

#### Operational Metrics — Per-Event Aggregates

These store session-level aggregates of per-event metrics. Individual per-event values live in the events table.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `time_to_first_token` | float | yes | Seconds from first `prompt_submit` to first `first_token`. Null if session failed before first token. |
| `tokens_per_turn_avg` | float | not null | Mean tokens per turn across the session. |
| `tool_call_duration_ms_avg` | float | yes | Mean tool call duration. Null if no tool calls. |
| `tool_call_duration_ms_p50` | float | yes | Median tool call duration. |
| `tool_call_duration_ms_p95` | float | yes | 95th percentile tool call duration. |
| `tool_success_rate` | float | yes | Fraction of tool calls with `status = success`. Null if no tool calls. |
| `retry_count_total` | int | not null | Total retry attempts in the session. |
| `stall_duration_ms_avg` | float | yes | Mean stall episode duration. Null if no stalls. |
| `stall_duration_ms_total` | int | not null | Total ms spent in Stalled state. |

#### Responsiveness

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `r_time_to_first_token` | float | yes | Seconds. Same value as `time_to_first_token` but scored in pillar context. |
| `r_output_speed` | float | yes | Tokens/second. Visible output tokens / Working state duration. |
| `r_resume_speed` | float | yes | Seconds. Time from `user_input_received` to first `output_chunk`. Null if no Waiting episodes. |
| `r_time_per_turn` | float | not null | Seconds. Mean wall-clock time per turn (Working + Stalled, excluding Waiting). |

#### Reliability

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `rel_start_failure_rate` | float | not null | 0.0 or 1.0 for this session (aggregated to % across sessions). |
| `rel_stall_ratio` | float | not null | `time_in_stalled_ms / (time_in_working_ms + time_in_stalled_ms)`. 0.0 if no active time. |
| `rel_stall_count` | int | not null | Count of Working -> Stalled transitions. |
| `rel_avg_stall_duration` | float | yes | Seconds. Mean stall episode duration. Null if no stalls. |
| `rel_error_rate` | int | not null | Count of error events in this session. |
| `rel_hidden_retries` | int | not null | Count of retry events not accompanied by user-visible output. |

#### Autonomy

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `a_questions_asked` | int | not null | Count of Working -> Waiting transitions. |
| `a_user_corrections` | int | not null | Count of `user_correction` events. |
| `a_first_try_success_rate` | float | not null | 1.0 if `user_corrections = 0` AND `questions_asked = 0` AND `task_completed = true`; else 0.0. Aggregated to % across sessions. |
| `a_user_active_time_pct` | float | not null | `(time_in_waiting_ms + steering_recovery_ms + user_input_ms) / duration_ms * 100`. |
| `a_work_multiplier` | float | yes | `time_in_working_ms / (time_in_waiting_ms + user_input_ms)`. Null if denominator is 0. |

#### Correctness

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `c_output_quality_score` | float | yes | 0.0-1.0. Requires L4 evaluation judge. Null until evaluated. |
| `c_clean_output_rate` | float | yes | Fraction of output chunks passing validation. Null if no output chunks. |
| `c_quality_decay` | float | yes | 0.0-1.0. Quality score in final third / first third of turns. Null if < 3 turns or no L4 evaluation. |
| `c_useful_token_pct` | float | not null | `visible_output_tokens / total_tokens * 100`. |

#### Completion

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `comp_task_completion_rate` | float | not null | 1.0 if `task_complete` emitted with no steering in post-completion window; else 0.0. Aggregated to % across sessions. |
| `comp_redo_rate` | float | yes | 1.0 if a semantically related prompt follows within time window; else 0.0. Null if not yet determinable. |
| `comp_gave_up_rate` | float | not null | 1.0 if `user_cancel` before `task_complete`; else 0.0. |
| `comp_where_they_gave_up` | enum | yes | State at `user_cancel`: `Starting`, `Working`, `Stalled`, `Waiting`. Null if session was not cancelled. |
| `comp_time_to_done` | float | yes | Seconds from `prompt_submit` to `task_complete`. Null if task not completed. |
| `comp_came_back_rate` | float | yes | 1.0 if user starts a new session within 24h; else 0.0. Null until window elapses. Aggregated to % across users. |

---

## 5. Tool Calls Table

Denormalized sub-table for per-tool-call analysis. One row per tool invocation within a session.

### 5.1 Schema

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `tool_call_id` | UUID | not null | PK. Matches `tool_call_start.payload.tool_call_id`. |
| `session_id` | UUID | not null | FK to sessions. |
| `tool_name` | string | not null | Name of the tool invoked. |
| `tool_provider` | string | yes | Provider (e.g., "built-in", "GitHub"). |
| `mcp_server` | string | yes | MCP server ID if applicable. |
| `tool_category` | enum | yes | `execution`, `retrieval`, `file_system`, `communication`, `code_analysis`, `browser`, `other`. |
| `started_at` | timestamp (ms) | not null | Timestamp of `tool_call_start`. |
| `ended_at` | timestamp (ms) | yes | Timestamp of `tool_call_end`. Null if tool call was interrupted. |
| `duration_ms` | int | yes | `ended_at - started_at`. Null if not completed. |
| `status` | enum | not null | `success`, `failure`, `timeout`, `interrupted`. |
| `retry_count` | int | not null | Number of retries for this specific tool call. Default 0. |
| `error_message` | string | yes | Error details if status is not `success`. |
| `turn_number` | int | not null | Turn in which this tool call occurred. |

**Indexes:** `(session_id, started_at)`, `(tool_name, status)`.

---

## 6. Dimensions

### 6.1 Inline Dimensions (columns on Sessions table)

Low-to-medium cardinality dimensions stored directly as columns on the sessions table.

| Dimension | Column(s) | Possible Values |
|-----------|-----------|-----------------|
| **Agent** | `agent_name`, `agent_version`, `agent_framework` | Open enumeration. Examples: `("Claude Code", "1.2.3", "Anthropic Agent SDK")`. |
| **Model** | `model_provider`, `model_id` | Open enumeration. Examples: `("Anthropic", "claude-opus-4-20250514")`, `("OpenAI", "gpt-4o")`. |
| **Interface** | `interface_type` | `CLI`, `IDE_extension`, `web_chat`, `API_direct`, `mobile`, `embedded`, `voice`. |
| **Task** | `task_category`, `complexity_tier` | **task_category:** `code_generation`, `code_review`, `debugging`, `refactoring`, `Q&A`, `data_analysis`, `writing`, `research`, `multi_step_workflow`, `system_administration`, `other`. **complexity_tier:** `trivial`, `simple`, `moderate`, `complex`, `heroic`. |
| **Session Type** | `session_mode` | `single_turn`, `multi_turn_interactive`, `multi_turn_autonomous`, `background_batch`. |
| **Content Type** | `content_type` | `quick_answer`, `guided_task`, `deep_session`, `autonomous_workflow`. Derived from session shape (turns, tool calls, duration, user engagement pattern). |

### 6.2 Separate Table: Tool Dimension

High-cardinality. Lives in the `tool_calls` table, not the sessions table.

| Attribute | Type | Values |
|-----------|------|--------|
| `tool_name` | string | Open enumeration. E.g., `"Bash"`, `"Read"`, `"web_search"`. |
| `tool_provider` | string | Open enumeration. E.g., `"built-in"`, `"Tavily"`, `"GitHub"`. |
| `mcp_server` | string (nullable) | MCP server ID. |
| `tool_category` | enum | `execution`, `retrieval`, `file_system`, `communication`, `code_analysis`, `browser`, `other`. |

### 6.3 Separate Table: Context Snapshots (Optional)

High-cardinality, captured at key moments (e.g., per-turn or on compaction events).

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `snapshot_id` | UUID | not null | PK. |
| `session_id` | UUID | not null | FK to sessions. |
| `timestamp` | timestamp (ms) | not null | When the snapshot was taken. |
| `window_utilization_pct` | float | not null | 0.0-100.0. |
| `compaction_event` | bool | not null | Whether a compaction occurred at this point. |
| `context_source_types` | string[] | no | E.g., `["user_message", "file_content", "tool_output"]`. |

---

## 7. Relationships

```
Session 1 ──── * Event          (session_id FK on events)
Session 1 ──── * ToolCall       (session_id FK on tool_calls)
Session 1 ──── 1 Metrics        (session_id PK/FK on metrics)
Session 1 ──── * ContextSnapshot (session_id FK, optional)
```

- Every event belongs to exactly one session.
- Every tool call belongs to exactly one session.
- Every session has exactly one metrics record (computed after session ends).
- Context snapshots are optional; zero or more per session.
- `ToolCall.tool_call_id` correlates with `Event.payload.tool_call_id` for `tool_call_start` / `tool_call_end` events.

---

## 8. Example Records

A coding agent session: the user asks to fix a failing test, the agent reads the file, runs the test, stalls briefly on test execution, and completes.

### 8.1 Event Stream

```json
[
  {
    "event_id": "e001-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:00.000Z",
    "event_type": "session_start",
    "payload": {
      "agent_name": "Claude Code",
      "agent_version": "1.5.2",
      "agent_framework": "Anthropic Agent SDK",
      "model_provider": "Anthropic",
      "model_id": "claude-opus-4-20250514",
      "interface_type": "CLI",
      "session_mode": "multi_turn_interactive"
    }
  },
  {
    "event_id": "e002-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:00.200Z",
    "event_type": "prompt_submit",
    "payload": {
      "prompt_hash": "a1b2c3d4...",
      "turn_number": 1,
      "token_count": 42,
      "task_category": "debugging",
      "complexity_tier": "simple"
    }
  },
  {
    "event_id": "e003-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:01.400Z",
    "event_type": "first_token",
    "payload": {
      "latency_ms": 1200
    }
  },
  {
    "event_id": "e004-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:03.000Z",
    "event_type": "tool_call_start",
    "payload": {
      "tool_call_id": "tc01-cccc",
      "tool_name": "Read",
      "tool_provider": "built-in",
      "tool_category": "file_system",
      "stall_reason": "tool_call"
    }
  },
  {
    "event_id": "e005-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:04.800Z",
    "event_type": "tool_call_end",
    "payload": {
      "tool_call_id": "tc01-cccc",
      "tool_name": "Read",
      "status": "success",
      "duration_ms": 1800
    }
  },
  {
    "event_id": "e006-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:06.500Z",
    "event_type": "tool_call_start",
    "payload": {
      "tool_call_id": "tc02-cccc",
      "tool_name": "Bash",
      "tool_provider": "built-in",
      "tool_category": "execution",
      "stall_reason": "tool_call"
    }
  },
  {
    "event_id": "e007-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:14.800Z",
    "event_type": "tool_call_end",
    "payload": {
      "tool_call_id": "tc02-cccc",
      "tool_name": "Bash",
      "status": "success",
      "duration_ms": 8300
    }
  },
  {
    "event_id": "e008-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:20.000Z",
    "event_type": "output_chunk",
    "payload": {
      "token_count": 185,
      "chunk_type": "text",
      "cumulative_tokens": 320,
      "is_valid": true
    }
  },
  {
    "event_id": "e009-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:21.500Z",
    "event_type": "task_complete",
    "payload": {
      "completion_type": "full",
      "output_token_count": 320
    }
  },
  {
    "event_id": "e010-aaaa",
    "session_id": "s100-bbbb",
    "timestamp": "2026-04-15T14:30:21.700Z",
    "event_type": "session_end",
    "payload": {
      "end_reason": "completed",
      "total_duration_ms": 21700,
      "total_tokens_in": 42,
      "total_tokens_out": 320,
      "total_tool_calls": 2
    }
  }
]
```

### 8.2 Session Record

```json
{
  "session_id": "s100-bbbb",
  "user_id": "u-anon-7f3a",
  "started_at": "2026-04-15T14:30:00.000Z",
  "ended_at": "2026-04-15T14:30:21.700Z",
  "duration_ms": 21700,

  "total_turns": 1,
  "total_tokens_in": 42,
  "total_tokens_out": 320,
  "total_tokens_reasoning": null,
  "total_tool_calls": 2,
  "total_errors": 0,
  "total_retries": 0,

  "time_in_starting_ms": 1200,
  "time_in_working_ms": 10400,
  "time_in_stalled_ms": 10100,
  "time_in_waiting_ms": 0,

  "end_reason": "completed",
  "task_completed": true,
  "completion_type": "full",

  "agent_name": "Claude Code",
  "agent_version": "1.5.2",
  "agent_framework": "Anthropic Agent SDK",
  "model_provider": "Anthropic",
  "model_id": "claude-opus-4-20250514",
  "interface_type": "CLI",
  "task_category": "debugging",
  "complexity_tier": "simple",
  "session_mode": "multi_turn_interactive",
  "content_type": "guided_task",

  "context_utilization_pct": 12.5,
  "compaction_count": 0,
  "user_segment": null
}
```

### 8.3 Metrics Record

```json
{
  "session_id": "s100-bbbb",
  "computed_at": "2026-04-15T14:30:22.000Z",

  "tokens_per_session": 362,
  "turns_per_session": 1,
  "tool_calls_per_session": 2,
  "duration_seconds": 21.7,
  "errors_per_session": 0,
  "time_per_turn_avg": 21.7,

  "time_to_first_token": 1.2,
  "tokens_per_turn_avg": 362.0,
  "tool_call_duration_ms_avg": 5050.0,
  "tool_call_duration_ms_p50": 5050.0,
  "tool_call_duration_ms_p95": 8300.0,
  "tool_success_rate": 1.0,
  "retry_count_total": 0,
  "stall_duration_ms_avg": 5050.0,
  "stall_duration_ms_total": 10100,

  "r_time_to_first_token": 1.2,
  "r_output_speed": 30.8,
  "r_resume_speed": null,
  "r_time_per_turn": 20.5,

  "rel_start_failure_rate": 0.0,
  "rel_stall_ratio": 0.493,
  "rel_stall_count": 2,
  "rel_avg_stall_duration": 5.05,
  "rel_error_rate": 0,
  "rel_hidden_retries": 0,

  "a_questions_asked": 0,
  "a_user_corrections": 0,
  "a_first_try_success_rate": 1.0,
  "a_user_active_time_pct": 0.0,
  "a_work_multiplier": null,

  "c_output_quality_score": null,
  "c_clean_output_rate": 1.0,
  "c_quality_decay": null,
  "c_useful_token_pct": 88.4,

  "comp_task_completion_rate": 1.0,
  "comp_redo_rate": null,
  "comp_gave_up_rate": 0.0,
  "comp_where_they_gave_up": null,
  "comp_time_to_done": 21.3,
  "comp_came_back_rate": null
}
```

**Reading the example.** The user asked Claude Code to fix a failing test. The agent responded in 1.2s (Starting -> Working), read the test file (1.8s stall), ran the test suite (8.3s stall), then produced a fix and completed. Stall ratio is 49.3% — nearly half the active time was tool calls. The 8.3s Bash stall (pytest execution) is the dominant latency. No errors, no retries, no user intervention. First-try success. Content type is `guided_task` despite being single-turn because of the tool call pattern.
