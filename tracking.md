# Client-Side Tracking and Collection Specification

How data flows from agent runtime to storage. This document describes the instrumentation design: where we hook in, what we capture, and how the collection pipeline works.

Companion documents:
- `metrics.md` --- what we measure (35 metrics)
- `data-model.md` --- what we store (events, sessions, metrics tables)
- `docs/agent/paper-0.md` --- theoretical foundation (state machine, observability levels)

---

## 1. Overview

**Goal.** Capture the 15 event types defined in `data-model.md` from real agent sessions, maintain a live state machine per session, and compute metrics with minimal impact on the agent runtime.

**Design philosophy.**

- **Local-first.** All collection, state tracking, and metric computation happen on the client machine. No cloud dependency for basic operation. Data leaves the machine only if the user opts in.
- **Privacy-respecting.** We capture metadata, timestamps, and counts --- never prompt content, output content, file contents, or credentials. See Section 8 for the full privacy contract.
- **Minimal performance impact.** The instrumentation budget is < 1ms latency per event and < 1MB memory overhead for the collector process. Instrumentation must never be the bottleneck.
- **Two collection modes.** Passive (observe from outside, L1) and active (SDK integration, L2+). Passive mode works with any agent. Active mode requires framework cooperation but yields richer data.

**Observability levels** (from the paper):

| Level | Source | What It Gets You |
|-------|--------|------------------|
| L1 | Client-side timestamps only | Responsiveness metrics, stall detection via heuristics, cancellation tracking |
| L2 | Agent framework events | Tool call lifecycle, retry events, explicit user input requests, error classification |
| L3 | Derived from L1 + L2 | Composite metrics: first-try success rate, work multiplier, user active time % |
| L4 | Evaluation judge (human or LLM) | Output quality score, quality decay |

This document covers L1 and L2 instrumentation. L3 metrics are computed from L1/L2 data at query time. L4 is out of scope (requires separate evaluation infrastructure).

---

## 2. Collection Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Agent Runtime                                │
│                                                                      │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐    │
│  │ Agent        │    │ Instrumentation Layer                    │    │
│  │ Framework    │───>│                                          │    │
│  │ (Claude Code,│    │  - Event emitters at framework hooks     │    │
│  │  LangChain,  │    │  - Timestamp capture                     │    │
│  │  CrewAI, etc)│    │  - Payload construction                  │    │
│  └─────────────┘    └──────────────┬───────────────────────────┘    │
│                                     │ events (typed, timestamped)    │
│                                     v                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Local Collector                                               │    │
│  │                                                               │    │
│  │  - Receives events via in-process queue or local socket       │    │
│  │  - Maintains session state machine (Section 4)                │    │
│  │  - Accumulates state durations in real time                   │    │
│  │  - Computes real-time operational metrics                     │    │
│  │  - Buffers events for batch write                             │    │
│  └──────────────┬──────────────────────────────────────────────┘    │
│                  │                                                    │
└──────────────────┼────────────────────────────────────────────────────┘
                   │ batch write (every N events or M seconds)
                   v
         ┌──────────────────┐       ┌──────────────────────┐
         │ Local Storage     │──────>│ Cloud Sync (opt-in)   │
         │ (SQLite / DuckDB) │       │ Aggregation, dashboards│
         └──────────────────┘       └──────────────────────┘
```

### 2.1 Instrumentation Layer

The instrumentation layer sits at the boundary between the agent framework and the user-visible output channel. It does not modify agent behavior --- it observes.

**Responsibilities:**
- Hook into framework extension points (middleware, callbacks, event listeners)
- Capture timestamps at the precise moment events become user-visible
- Construct event payloads conforming to `data-model.md` schemas
- Forward events to the local collector via an in-process event queue

**Important timing principle:** timestamps represent when the user perceives the event, not when the underlying system action occurred. For example, `first_token` timestamp = the moment the first token is rendered to the user's terminal or UI, not when the API response starts streaming from the server.

### 2.2 Local Collector

A lightweight, single-threaded process (or in-process module) that receives events and maintains session state.

**Responsibilities:**
- Maintain one state machine instance per active session (Section 4)
- Accumulate state durations: on every state transition, compute `now - state_entry_timestamp` and add to the running total for the exited state
- Run stall detection heuristics for L1 mode (Section 5)
- Buffer events in memory (configurable: default 50 events or 5 seconds, whichever comes first) and flush to local storage
- On `session_end`, compute all session-level operational metrics and write the sessions table record
- Compute and write the metrics table record after session close

**Failure mode:** if the collector crashes or is killed, buffered in-memory events are lost. The local storage contains all previously flushed events. On restart, the collector can reconstruct session state from the event log (replay from last `session_start`).

### 2.3 Storage

Local SQLite or DuckDB database. Schema matches `data-model.md` exactly (events, sessions, metrics, tool_calls tables).

**Write pattern:** append-only for events. Upsert for sessions and metrics (updated at session close or periodically for long-running sessions). Tool calls table populated from paired `tool_call_start`/`tool_call_end` events at session close.

**Cloud sync (optional):** a background process reads from local storage and uploads completed session records to a remote endpoint. Only session-level aggregates and metrics are synced by default --- raw events stay local unless the user explicitly enables event-level sync.

---

## 3. Instrumentation Points

For each of the 15 event types, organized by state machine phase.

### 3.1 Starting Phase

#### `session_start`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | Agent process initialization, before any LLM call. The moment the agent framework is ready to accept a prompt. |
| **What to capture** | `agent_name`, `agent_version`, `agent_framework`, `model_provider`, `model_id`, `interface_type`, `session_mode`, `client_id` |
| **Timing** | Timestamp = moment the agent process signals readiness. For CLI agents, this is after argument parsing and config loading. For web agents, this is the websocket connection open. |
| **Framework examples** | **Claude Code:** hook the CLI entry point after config resolution. The agent name, version, and model are available from the runtime config. **LangChain:** `on_chain_start` callback on the outermost chain/agent. Extract model info from the chain's LLM binding. **Generic OTEL:** create a new trace; the root span start is `session_start`. |

#### `prompt_submit`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The point where user input is finalized and sent to the LLM. Not when the user starts typing --- when the message is dispatched. |
| **What to capture** | `prompt_hash` (SHA-256 of prompt text), `turn_number`, `token_count`, `task_category` (if classifiable), `complexity_tier` (if classifiable) |
| **Timing** | Timestamp = moment the prompt leaves the client and enters the agent's processing pipeline. For CLI: when the user presses Enter. For web: when the send button fires. |
| **Framework examples** | **Claude Code:** intercept at the message submission handler, before the API call. Hash the prompt text, count tokens using the tokenizer. **LangChain:** `on_llm_start` callback. The prompt is available in the `messages` argument. **Generic OTEL:** emit an OTEL event on the session trace with `prompt_submit` attributes. |

**Note on `task_category` and `complexity_tier`:** these are optional and may be inferred post-hoc or tagged by the user. The instrumentation layer should not block on classification. If a lightweight classifier is available (keyword-based), run it; otherwise leave these fields null and populate them during metrics computation.

#### `first_token`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The streaming output handler, at the point where the first token is written to the user-visible output channel. |
| **What to capture** | `latency_ms` (computed as `first_token.timestamp - most_recent_prompt_submit.timestamp`) |
| **Timing** | Timestamp = moment the first token is rendered to the user. This is critical: the timestamp is taken at the UI/terminal write point, not at the API stream start. The difference accounts for any client-side processing, buffering, or rendering delay. |
| **Framework examples** | **Claude Code:** hook the terminal output writer. The first call to write a non-empty, non-status output token after a `prompt_submit` triggers this event. **LangChain:** `on_llm_new_token` callback, first invocation per turn. **Generic OTEL:** emit an event on the current span when the output stream handler receives its first token. |

**Edge case:** if the agent emits a status message ("Thinking...") before real output, that is NOT `first_token`. The event fires on the first substantive output token. Status messages are invisible to the state machine unless the framework explicitly marks them as output. Define "substantive" as: token is part of the model's response content, not a framework-generated status indicator.

### 3.2 Working Phase

#### `output_chunk`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The streaming output handler, on each batch of tokens written to the user. Batching granularity is framework-dependent. |
| **What to capture** | `token_count`, `chunk_type` (`text`, `code`, `markdown`, `artifact`, `status_update`), `cumulative_tokens` (running total this turn), `is_valid` (optional syntax check) |
| **Timing** | Timestamp = moment this chunk is rendered to the user. |
| **Framework examples** | **Claude Code:** hook terminal write calls. Each write of model output content is one chunk. Classify chunk type by content (code fences = `code`, otherwise `text`). **LangChain:** `on_llm_new_token` callback with token batching (aggregate tokens over a 100ms window to avoid per-token event overhead). **Generic OTEL:** emit OTEL events with token count attributes. |

**Batching guidance:** emitting one event per token is wasteful. Batch into chunks of ~50-200ms of output or ~10-50 tokens, whichever comes first. The goal is to capture output cadence for stall detection and output speed computation, not to record every individual token.

**Chunk type classification:** use simple heuristics. If the chunk contains a code fence or is within a code block, `code`. If it contains markdown headers or lists, `markdown`. Otherwise `text`. The `artifact` type is for framework-specific structured outputs (e.g., Claude's artifacts). `status_update` is for framework-generated progress messages.

### 3.3 Stalled Phase

#### `tool_call_start`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The agent framework's tool dispatch point, when the agent decides to invoke a tool and before the tool execution begins. |
| **What to capture** | `tool_call_id` (UUID, generated here), `tool_name`, `tool_provider`, `mcp_server` (if applicable), `tool_category`, `stall_reason` (always `tool_call`) |
| **Timing** | Timestamp = moment the tool invocation is dispatched. Not when the agent decides to call the tool (which may be mid-token-generation), but when the actual tool execution request is sent. |
| **Framework examples** | **Claude Code:** hook the tool execution dispatcher. Each tool (Bash, Read, Edit, etc.) passes through a common dispatch point. **LangChain:** `on_tool_start` callback. Tool name and input are available. **Generic OTEL:** start a child span with `tool.name` attribute. |

**L2 only.** This event requires framework-level integration. At L1, tool calls are invisible --- they manifest as output gaps detected by the stall heuristic (Section 5).

#### `tool_call_end`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The tool execution return point, when the tool result is available to the agent (regardless of whether the result is shown to the user). |
| **What to capture** | `tool_call_id` (matches the start event), `tool_name`, `status` (`success`, `failure`, `timeout`), `duration_ms`, `error_message` (if not success) |
| **Timing** | Timestamp = moment the tool result is returned to the agent framework. `duration_ms` = `tool_call_end.timestamp - tool_call_start.timestamp` for the matching `tool_call_id`. |
| **Framework examples** | **Claude Code:** hook the tool result handler. **LangChain:** `on_tool_end` or `on_tool_error` callback. **Generic OTEL:** end the child span started at `tool_call_start`. |

#### `retry_start`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The agent framework's retry logic, when a failed operation is being retried. |
| **What to capture** | `retry_reason` (`tool_failure`, `model_error`, `rate_limit`, `timeout`, `validation_error`), `attempt_number` (1-indexed, 1 = first retry), `original_event_id` (optional, reference to the triggering error/failure), `stall_reason` (always `retry`) |
| **Timing** | Timestamp = moment the retry attempt begins. |
| **Framework examples** | **Claude Code:** hook the retry wrapper around API calls and tool executions. **LangChain:** wrap the retry logic in `RetryOutputParser` or custom retry handlers. **Generic OTEL:** emit an event on the current span with retry attributes. |

**L2 only.** Retries are internal to the framework. At L1, they are invisible (they contribute to stall duration but cannot be distinguished from slow tool calls).

#### `retry_end`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The point where a retry attempt completes, regardless of outcome. |
| **What to capture** | `status` (`success`, `failure`, `budget_exhausted`), `attempt_number`, `duration_ms` |
| **Timing** | Timestamp = moment the retry result is available. |
| **Framework examples** | Same hooks as `retry_start`, capturing the outcome. |

### 3.4 Waiting Phase

#### `user_input_requested`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The point where the agent framework emits a question or approval request to the user, halting autonomous progress. |
| **What to capture** | `input_type` (`clarification`, `approval`, `choice`, `information`, `confirmation`), `question_hash` (optional, SHA-256 of question text) |
| **Timing** | Timestamp = moment the question is rendered to the user. |
| **Framework examples** | **Claude Code:** hook the permission/approval prompt system (e.g., tool approval dialogs). **LangChain:** `HumanApprovalCallbackHandler` or custom input request handlers. **Generic OTEL:** emit an event when the agent's output includes an explicit question directed at the user. |

**L2 required for reliable detection.** At L1, distinguishing "the agent asked a question" from "the agent finished its response and is waiting for the next turn" is ambiguous. L2 frameworks explicitly signal when they are blocking on user input.

#### `user_input_received`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The point where the user's response to a `user_input_requested` event is received by the agent framework. |
| **What to capture** | `wait_duration_ms` (time since the matching `user_input_requested`), `response_token_count` (optional) |
| **Timing** | Timestamp = moment the user's input is submitted (Enter pressed, button clicked). |
| **Framework examples** | **Claude Code:** hook the stdin reader that follows an approval/input prompt. **LangChain:** capture the return from the human input handler. **Generic OTEL:** emit an event when user input is received after a Waiting state. |

### 3.5 Correction Events

#### `user_correction`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | At `prompt_submit` time (a correction is a special kind of prompt). The instrumentation layer must classify whether a prompt is a correction or a new instruction. |
| **What to capture** | `turn_number`, `correction_type` (`redirect`, `refine`, `reject`, `clarify`) |
| **Timing** | Timestamp = same as the associated `prompt_submit`. A `user_correction` event is emitted alongside (not instead of) the `prompt_submit` event. |
| **Framework examples** | **Claude Code:** at prompt submission, run the correction heuristic (Section 6). If it matches, emit both `prompt_submit` and `user_correction`. **LangChain:** same approach in the `on_llm_start` callback. **Generic OTEL:** emit a `user_correction` event as a sibling to the `prompt_submit` event on the session trace. |

**Detection difficulty.** This is the hardest event to capture reliably. See Section 6 for the full detection specification.

### 3.6 Error Events

#### `error`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The agent framework's error handler --- both caught (recoverable) and uncaught (fatal) errors. |
| **What to capture** | `error_type` (`model_error`, `tool_error`, `auth_error`, `rate_limit`, `context_overflow`, `timeout`, `crash`, `validation_error`, `unknown`), `is_fatal` (true if unrecoverable), `error_code`, `error_message`, `current_state` |
| **Timing** | Timestamp = moment the error is detected by the framework. |
| **Framework examples** | **Claude Code:** hook the global error handler and per-tool error handlers. Classify errors by their source. **LangChain:** `on_llm_error`, `on_tool_error`, `on_chain_error` callbacks. **Generic OTEL:** record an exception event on the current span with error attributes. |

**`current_state` population:** the instrumentation layer queries the local collector's state machine for the current state at error time. This requires the collector to expose a synchronous `get_current_state()` call.

### 3.7 Terminal Events

#### `task_complete`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The point where the agent framework signals that the task is done. |
| **What to capture** | `completion_type` (`full`, `partial`), `output_token_count` (total visible output tokens in the session) |
| **Timing** | Timestamp = moment the completion signal is emitted. |
| **Framework examples** | **Claude Code:** hook the turn completion logic. If the agent's final message does not request user input and is not an error, emit `task_complete`. **LangChain:** `on_chain_end` on the outermost chain, when the agent returns a final answer. **Generic OTEL:** emit an event when the agent's execution loop terminates normally. |

**Ambiguity in multi-turn sessions:** in an interactive session, the agent may complete individual tasks within a longer conversation. `task_complete` fires when the agent signals it has finished the current task, not necessarily when the session ends. A session may contain multiple `task_complete` events (one per task within the conversation).

#### `user_cancel`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The user's cancellation action: Ctrl-C in a terminal, stop button in a UI, closing the session window. |
| **What to capture** | `current_state` (state at cancellation time), `turns_completed` (complete turns before cancel) |
| **Timing** | Timestamp = moment the cancellation signal is received. |
| **Framework examples** | **Claude Code:** hook the SIGINT handler. On Ctrl-C, query the state machine for current state and emit the event before teardown. **LangChain:** hook the chain's cancellation token. **Generic OTEL:** emit a cancellation event and end the trace. |

**Race condition:** if the user cancels while an event is in flight (e.g., a tool call is running), the `user_cancel` event must be emitted after the in-flight event is resolved or abandoned. The state machine must not have two events processed simultaneously. Use a mutex or event queue serialization.

#### `session_end`

| Aspect | Detail |
|--------|--------|
| **Where to hook** | The final teardown point. Every session must emit exactly one `session_end` event, regardless of how it ended. |
| **What to capture** | `end_reason` (`completed`, `failed`, `user_cancelled`, `timeout`), `total_duration_ms`, `total_tokens_in`, `total_tokens_out`, `total_tool_calls` |
| **Timing** | Timestamp = moment the session is being torn down, after all other terminal events have been emitted. |
| **Framework examples** | **Claude Code:** hook the process exit handler. Emit `session_end` as the last event. Use `atexit` or equivalent to guarantee emission even on crashes. **LangChain:** `on_chain_end` on the outermost chain, after `task_complete` or error handling. **Generic OTEL:** end the root trace span. |

**Guaranteed emission:** `session_end` is the most important event for data integrity. If it is missing, the session record cannot be finalized. Strategies for guaranteeing emission:
- Register a shutdown hook (`atexit`, `process.on('exit')`, `Runtime.addShutdownHook`)
- Use a heartbeat: if the collector receives no events for a configurable timeout (default: 5 minutes), it synthesizes a `session_end` with `end_reason = timeout`
- On collector restart, scan for sessions with a `session_start` but no `session_end` and close them with `end_reason = timeout`

---

## 4. State Machine Tracker

The local collector maintains one state machine instance per active session. The state machine is the core of the collection system --- it converts a stream of events into state durations, which are the inputs to most metrics.

### 4.1 State Machine Instance

Each session's state machine tracks:

- **`current_state`**: one of `Starting`, `Working`, `Stalled`, `Waiting`, `Failed`, `Ended`
- **`state_entry_timestamp`**: when the current state was entered (millisecond precision)
- **`state_durations`**: a map of `{state -> accumulated_ms}`, updated on every transition
- **`stall_reason`**: when in `Stalled`, the reason (`tool_call`, `retry`, `rate_limit`, `model_latency`)
- **`turn_number`**: current turn count
- **`pending_tool_calls`**: set of `tool_call_id` values for in-flight tool calls

### 4.2 State Transition Table

The collector processes events sequentially (ordered by timestamp) and applies the following transition rules. If an event does not match any rule for the current state, it is recorded but does not trigger a transition.

| Event | From State | To State | Side Effects |
|-------|-----------|----------|--------------|
| `session_start` | *(initial)* | Starting | Initialize session. Set `state_entry_timestamp`. |
| `prompt_submit` | Starting | Starting | Record turn start. Increment `turn_number`. No state change (remain in Starting). |
| `prompt_submit` | Working | Starting | New turn begins. Flush accumulated Working time. Increment `turn_number`. |
| `prompt_submit` | Waiting | Starting | User responded with a new prompt (not via `user_input_received`). Flush Waiting time. |
| `first_token` | Starting | Working | Flush Starting time to `state_durations["Starting"]`. Compute `latency_ms`. |
| `output_chunk` | Working | Working | No state change. Update `last_output_timestamp` (used by L1 stall detection). |
| `output_chunk` | Stalled | Working | Output resumed after stall. Flush Stalled time. (L1 mode: stall ended because output appeared.) |
| `tool_call_start` | Working | Stalled | Flush Working time. Set `stall_reason = tool_call`. Add `tool_call_id` to `pending_tool_calls`. |
| `tool_call_start` | Stalled | Stalled | Nested tool call (rare). Add to `pending_tool_calls`. No state change. |
| `tool_call_end` | Stalled | Working | Remove `tool_call_id` from `pending_tool_calls`. If `pending_tool_calls` is now empty, flush Stalled time and transition to Working. If other calls remain, stay Stalled. |
| `retry_start` | Stalled | Stalled | No state change (already stalled). Update `stall_reason = retry` if not already. |
| `retry_start` | Working | Stalled | Flush Working time. Set `stall_reason = retry`. |
| `retry_end` | Stalled | Working | If `status = success` and no pending tool calls, flush Stalled time, transition to Working. If `status = failure`, remain Stalled (another retry may follow). If `status = budget_exhausted`, transition to Failed. |
| `user_input_requested` | Working | Waiting | Flush Working time. |
| `user_input_received` | Waiting | Working | Flush Waiting time. |
| `user_correction` | Working | Working | No state change. Increment correction counter. |
| `error` (fatal) | *any active* | Failed | Flush current state time. |
| `error` (non-fatal) | *any active* | *same* | No state change. Increment error counter. The agent may retry (entering Stalled). |
| `task_complete` | Working | Ended | Flush Working time. |
| `user_cancel` | *any active* | Ended | Flush current state time. Record `current_state` at cancellation. |
| `session_end` | *any* | Ended | Flush current state time. Finalize session record. |

**"Active" states:** Starting, Working, Stalled, Waiting. Not Failed or Ended.

### 4.3 Duration Accumulation

On every state transition:

```
exited_state_duration = now - state_entry_timestamp
state_durations[exited_state] += exited_state_duration
state_entry_timestamp = now
```

This means `state_durations` always reflects the total time spent in each state up to the most recent transition. To get the current total including time in the present state, compute:

```
live_duration[current_state] = state_durations[current_state] + (now - state_entry_timestamp)
```

This supports real-time dashboard queries without waiting for state transitions.

### 4.4 Turn Tracking

A "turn" is one user-agent exchange cycle: `prompt_submit` through the agent's response (until the next `prompt_submit`, `task_complete`, `user_cancel`, or `session_end`). The collector tracks per-turn metrics by maintaining a `turn_start_timestamp` set on each `prompt_submit`, and computing turn duration when the turn ends.

Turn boundaries:
- **Turn starts:** `prompt_submit` event
- **Turn ends:** next `prompt_submit`, `task_complete`, `user_cancel`, or `session_end`
- **Turn duration:** `turn_end_timestamp - turn_start_timestamp`, excluding any Waiting time within the turn (Waiting time is the user's time, not the agent's)

---

## 5. Stall Detection

Stall detection determines when the agent transitions from Working to Stalled. This is the trickiest part of the instrumentation because the user's perception of "stalled" does not always align with a discrete framework event.

### 5.1 L2 Explicit Detection

When framework events are available (`tool_call_start`, `tool_call_end`, `retry_start`, `retry_end`), stall detection is straightforward:

- `tool_call_start` -> enter Stalled (reason: `tool_call`)
- `tool_call_end` (last pending) -> exit Stalled, enter Working
- `retry_start` -> enter or remain in Stalled (reason: `retry`)
- `retry_end` (success) -> exit Stalled, enter Working

No heuristic needed. The framework tells us exactly when stalls begin and end. Stall duration is precise.

### 5.2 L1 Heuristic Detection

When no framework events are available (passive observation only), stalls must be inferred from output gaps.

**The heuristic:** while in Working state, if no `output_chunk` event arrives for **N seconds**, infer a transition to Stalled.

**Proposed default: N = 2 seconds.**

Rationale:
- The paper cites web UX research (Google RAIL model): 2 seconds is the threshold where users perceive a system as "responsive." Below 2s, gaps feel like natural pauses in generation. Above 2s, users begin to wonder if something is wrong.
- Typical LLM streaming output produces tokens every 50-200ms. A 2-second gap is 10-40x the normal inter-token interval, strongly suggesting the model is not actively generating visible output.
- Setting the threshold too low (e.g., 500ms) would produce false positives from normal streaming jitter, network micro-delays, or model "thinking" pauses during complex reasoning.
- Setting the threshold too high (e.g., 5s) would miss stalls that users perceive as problematic.

**Implementation:** the collector sets a timer on each `output_chunk` event. If the timer fires (2s elapsed with no new `output_chunk`), the collector synthesizes a state transition to Stalled with `stall_reason = model_latency` (since we cannot distinguish tool calls from model pauses at L1). When the next `output_chunk` arrives, the collector transitions back to Working.

**Stall end detection at L1:** the next `output_chunk` event ends the stall. The stall duration is `output_chunk.timestamp - (last_output_chunk.timestamp + N)`. Note: the stall is considered to have started N seconds after the last output, not at the moment of the last output. This avoids counting normal inter-chunk gaps as stall time.

More precisely:
- Stall start timestamp = `last_output_chunk.timestamp + N`
- Stall end timestamp = `next_output_chunk.timestamp`
- Stall duration = `stall_end - stall_start`

### 5.3 Hybrid Mode

When L2 events are available for some stall types but not others, use a hybrid approach:

- Use `tool_call_start`/`tool_call_end` for tool call stalls (L2, precise)
- Use the L1 heuristic for model processing pauses and other unobservable stalls
- When both signal simultaneously (e.g., a tool call takes longer than 2s and the L1 timer fires during an already-active L2 stall), the L2 signal takes precedence. Suppress the heuristic transition.

**Priority rule:** if the state machine is already in Stalled (via L2 event), ignore L1 heuristic triggers. If the state machine is in Working and an L1 heuristic fires, transition to Stalled only if no L2 stall is currently pending.

### 5.4 Edge Cases

**Model "thinking" pauses.** Some models pause mid-generation to reason (extended thinking). These pauses produce no output tokens but are not errors or tool calls. At L1, these are indistinguishable from stalls and will be detected by the heuristic. At L2, if the framework exposes a "thinking" or "reasoning" signal, the collector should record the stall with `stall_reason = model_latency` and mark it as expected (not an error). For metrics, these pauses still count as Stalled time --- from the user's perspective, the agent is not producing visible output, regardless of the internal reason.

**Streaming gaps from network latency.** Brief output gaps (< 2s) caused by network jitter should not trigger stall detection. The 2-second threshold accounts for this. If operating in a high-latency environment (satellite internet, congested network), the threshold may need to be increased. Expose the threshold as a configurable parameter.

**Rapid tool calls.** If the agent makes multiple tool calls in quick succession (e.g., Read file A, Read file B, Read file C), L2 detects each as a separate stall episode. This is correct: each is a distinct stall with its own duration. At L1, the entire sequence appears as one long stall (no output between the tool calls). This is a known precision loss at L1.

**Tool calls that produce user-visible output.** Some tools (e.g., Bash running a command that streams output) may produce visible output while "stalled." If the framework reports `tool_call_start` but the user sees output, the collector should remain in or transition to Working if `output_chunk` events arrive. The rule: `output_chunk` events during a tool call suppress the Stalled state. This handles tools that stream their results.

---

## 6. User Correction Detection

Detecting when a user message is a correction (steering the agent back on track) versus a continuation (providing new instructions) is inherently imprecise. This section specifies the detection approaches at each observability level.

### 6.1 L1 Heuristic Detection

At L1, the only signal is the user's message text (which we do not store, but can analyze transiently for classification purposes --- the classification result is stored, not the text).

**Pattern-matching heuristic.** Classify a `prompt_submit` as a correction if the message matches any of the following patterns (case-insensitive, applied to the first 100 characters of the message):

**Strong correction signals** (high confidence):
- Starts with negation: "no,", "no ", "nope", "wrong", "incorrect", "that's not"
- Starts with redirection: "actually,", "actually ", "I meant", "I mean", "what I wanted", "not what I asked"
- Starts with stop/undo: "stop", "undo", "revert", "go back", "start over", "try again"
- Explicit rejection: "that's wrong", "that doesn't work", "that broke"

**Weak correction signals** (lower confidence, require additional context):
- Starts with "but" or "however" (could be continuation)
- Contains "instead" in the first sentence
- Repeats key nouns from the previous prompt (suggests re-explaining the same request)

**Classification output:**
- If strong signal matches: emit `user_correction` with `correction_type = reject` (for negation/stop) or `redirect` (for redirection)
- If weak signal matches and the turn number is > 1 (not the first prompt): emit `user_correction` with `correction_type = refine`
- If no signal matches: do not emit `user_correction`

**Acknowledged limitations:**
- False negatives: polite corrections ("Could you maybe try a different approach?") will be missed
- False positives: "No, I don't need that feature removed" starts with "no" but may not be a correction
- Language-dependent: the heuristic assumes English. Other languages need separate pattern sets.
- Accuracy estimate: likely 60-70% recall, 70-80% precision for English-language corrections. Adequate for aggregate metrics (per-session `user_corrections` count) but not for individual event analysis.

### 6.2 L2 Framework Detection

If the agent framework exposes explicit signals:
- **User interrupt:** user presses stop/cancel and then provides new input. The framework can emit `user_correction` with `correction_type = reject`.
- **Thumbs down / feedback button:** UI frameworks may expose a negative feedback signal. Map to `user_correction` with `correction_type = reject`.
- **Edit previous message:** some chat UIs allow editing a previous prompt. The re-submission is a correction.

L2 detection is more precise but requires framework cooperation. Not all frameworks expose these signals.

### 6.3 Hybrid Approach

Use L2 signals when available. Fall back to L1 heuristic otherwise. Never double-count: if both L1 and L2 detect the same message as a correction, emit only one `user_correction` event (prefer L2 classification for `correction_type`).

---

## 7. Session Boundary Detection

### 7.1 Explicit Signals

The preferred method. The framework emits `session_start` at the beginning and `session_end` at the conclusion.

- **CLI agents** (Claude Code): session starts when the process starts, ends when the process exits. One process = one session. Clear boundaries.
- **Web chat agents**: session starts when the user opens a new conversation, ends when they close it or navigate away.
- **API-direct agents**: the caller must explicitly signal session boundaries via the SDK. No implicit detection.

### 7.2 Implicit Detection (Timeout)

For long-running or always-on agents where explicit session boundaries are unclear:

**Inactivity timeout:** if no event is received for **T minutes**, consider the session ended. Emit a synthetic `session_end` with `end_reason = timeout`.

**Proposed default: T = 30 minutes.**

Rationale:
- For interactive sessions, 30 minutes of silence strongly suggests the user has disengaged.
- For autonomous workflows, the timeout should be longer (configurable up to hours) because the agent may be executing a long-running task.
- The timeout resets on any event: `output_chunk`, `tool_call_start`, `user_input_received`, etc.

### 7.3 Multi-Turn vs Single-Turn

**Single-turn sessions** (`session_mode = single_turn`): one prompt, one response, done. The session starts at `session_start`, ends after `task_complete` or `session_end`. Simple.

**Multi-turn interactive sessions** (`session_mode = multi_turn_interactive`): multiple prompt-response cycles within one session. Each `prompt_submit` starts a new turn but not a new session. The session continues until the user explicitly ends it, the agent emits `session_end`, or the inactivity timeout fires.

**Multi-turn autonomous sessions** (`session_mode = multi_turn_autonomous`): the agent works independently after an initial prompt. Tool calls and output may span hours. Use a longer inactivity timeout. The session ends when the agent signals completion or the user cancels.

**Background batch sessions** (`session_mode = background_batch`): the agent runs without real-time user presence. Session boundaries are defined by the batch job. Inactivity timeout is inappropriate --- use explicit signals only.

### 7.4 Session ID Generation

- Generated client-side at `session_start` time.
- Format: UUID v4 (random). No PII embedded.
- The session ID is included in every event's `session_id` field.
- For multi-turn sessions, the session ID persists across all turns.
- If the same user starts a new conversation, a new session ID is generated.

---

## 8. Privacy and Performance

### 8.1 What We Do NOT Capture

The tracking system explicitly excludes:

| Excluded Data | Reason |
|---------------|--------|
| Prompt text / content | Privacy. We store `prompt_hash` (SHA-256) for deduplication, never the text itself. |
| Output text / content | Privacy. We store token counts, chunk types, and validation status, never the text. |
| File contents | Privacy. Tool calls record file paths (hashed if configured) and operation type, never file content. |
| Credentials, API keys, tokens | Security. Error messages are sanitized to remove credential fragments. |
| IP addresses | Privacy. `client_id` is a locally generated anonymous identifier, not derived from network identity. |
| Prompt embeddings | Privacy. Embeddings can be reversed to approximate original text. |

### 8.2 Anonymization

- **`user_id`**: optional. If provided, it must be a one-way hash (SHA-256 of the actual identifier + a local salt). The salt stays on the client and is never transmitted. Without the salt, the hash cannot be reversed or correlated across installations.
- **`client_id`**: a random UUID generated on first run and stored locally. Not derived from hardware identifiers, MAC addresses, or other fingerprintable data.
- **`prompt_hash` and `question_hash`**: SHA-256 hashes. Used for deduplication and redo rate detection, not for content recovery.
- **`error_message`**: sanitized before storage. A regex-based sanitizer strips patterns matching API keys, bearer tokens, file paths containing home directories, and email addresses.

### 8.3 Performance Budget

| Resource | Budget | Rationale |
|----------|--------|-----------|
| Latency per event | < 1ms | Event emission is a non-blocking enqueue to an in-memory buffer. No I/O on the hot path. |
| Memory overhead | < 1MB | The collector's in-memory state: one state machine (~200 bytes), event buffer (50 events x ~500 bytes = 25KB), plus overhead. Well under 1MB. |
| Disk I/O | Batch writes every 5s or 50 events | Avoids per-event disk writes. SQLite WAL mode for non-blocking reads during writes. |
| CPU | < 0.1% of one core | Event processing is trivial: timestamp comparison, counter increment, hash lookup. |
| Network | Zero (local-first) | No network I/O unless cloud sync is enabled. Cloud sync uses a background thread with backpressure. |

**Failure mode:** if the event buffer fills (collector cannot write to disk), drop the oldest events and increment a `dropped_events` counter on the session record. Never block the agent runtime.

### 8.4 Local-First Architecture

All data stays on the local machine by default. The tracking system functions fully without any network connectivity.

**Cloud sync (opt-in) behavior:**
- Disabled by default. Enabled via configuration flag.
- Syncs completed session records (sessions table + metrics table) to a configured endpoint.
- Raw events are NOT synced by default. Event-level sync is a separate opt-in.
- Sync uses a background thread. If the endpoint is unreachable, data queues locally and retries with exponential backoff.
- The user can delete all local data at any time via a `flush --delete` command.

### 8.5 Data Retention Defaults

| Data Layer | Default Retention | Rationale |
|------------|-------------------|-----------|
| Raw events | 30 days | Events are high-volume and primarily useful for debugging recent sessions. Older events are summarized in session/metrics records. |
| Session records | 1 year | Session-level data supports trend analysis and regression detection over deployment cycles. |
| Metrics records | Indefinite | Metrics are compact (one row per session, ~500 bytes) and support long-term quality tracking. |
| Tool call records | 90 days | More granular than sessions but less voluminous than events. Useful for tool-specific performance analysis. |

Retention is enforced by a background cleanup job that runs daily. The user can override defaults via configuration.

---

## 9. SDK Surface Area

Two integration patterns for different levels of framework access.

### 9.1 Pattern A: Framework Middleware

A plugin or middleware that wraps the agent framework and captures events automatically. The user installs the middleware; no code changes to the agent itself.

**How it works:**
- The middleware intercepts framework callbacks (LangChain callbacks, Anthropic Agent SDK hooks, CrewAI event listeners)
- It maps framework events to the 15 AX event types
- It initializes the local collector and manages session lifecycle

**Advantages:** zero-code instrumentation. The user adds one line (register the middleware) and gets full L2 coverage.

**Disadvantages:** framework-specific. Each supported framework needs a dedicated middleware adapter. Middleware may lag behind framework updates.

**Example: LangChain middleware.** A `CallbackHandler` implementation that maps:
- `on_chain_start` (outermost) -> `session_start`
- `on_llm_start` -> `prompt_submit`
- `on_llm_new_token` (first) -> `first_token`
- `on_llm_new_token` (subsequent, batched) -> `output_chunk`
- `on_tool_start` -> `tool_call_start`
- `on_tool_end` / `on_tool_error` -> `tool_call_end`
- `on_chain_end` (outermost) -> `task_complete` + `session_end`

**Example: Claude Code middleware.** A process wrapper that:
- Hooks stdin/stdout to capture prompt submission and output rendering timestamps
- Intercepts tool dispatch and result handlers for L2 tool call events
- Hooks SIGINT for `user_cancel`
- Hooks process exit for `session_end`

### 9.2 Pattern B: Manual Instrumentation

Explicit API calls for frameworks without middleware support, custom agents, or when the user wants precise control over event emission.

**Minimal API surface:**

| Function | Purpose | When to Call |
|----------|---------|-------------|
| `init(config)` | Initialize the tracker. Creates the local collector, opens the database, sets configuration (thresholds, retention, sync). | Once, at agent process startup. |
| `session_start(metadata)` | Begin tracking a session. Creates the state machine instance. `metadata` includes agent name, version, model, interface type, session mode. | When the agent is ready to accept its first prompt. |
| `event(type, payload)` | Record an event. `type` is one of the 15 event type strings. `payload` is a dict/map matching the schema in `data-model.md`. The collector validates the payload and processes the state transition. | At each instrumentation point described in Section 3. |
| `session_end(reason)` | End the session. `reason` is one of `completed`, `failed`, `user_cancelled`, `timeout`. Triggers session record computation and metrics calculation. | When the agent session is over, for any reason. |
| `flush()` | Force-write all pending events to storage. Useful before process exit or in crash handlers. | In shutdown hooks, crash handlers, or when the user wants to ensure data is persisted. |
| `get_state()` | Return the current state machine state for this session. | When other code needs to know the current state (e.g., to populate `current_state` on error events). |

**Usage pattern:**

```
tracker = init({db_path: "~/.ax/data.db", stall_threshold_ms: 2000})
tracker.session_start({agent_name: "my-agent", model_id: "claude-opus-4-20250514", ...})

# On prompt submission:
tracker.event("prompt_submit", {prompt_hash: sha256(prompt), turn_number: 1, ...})

# On first output token:
tracker.event("first_token", {latency_ms: 1200})

# On tool call:
tracker.event("tool_call_start", {tool_call_id: uuid(), tool_name: "Bash", ...})
# ... tool executes ...
tracker.event("tool_call_end", {tool_call_id: same_id, status: "success", duration_ms: 3400})

# On completion:
tracker.event("task_complete", {completion_type: "full", output_token_count: 520})
tracker.session_end("completed")
```

This is pseudocode illustrating the call pattern, not a language-specific API specification.

### 9.3 Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `db_path` | `~/.ax/data.db` | Path to the local SQLite/DuckDB database. |
| `stall_threshold_ms` | 2000 | L1 stall detection threshold in milliseconds. |
| `session_timeout_min` | 30 | Inactivity timeout for implicit session end, in minutes. |
| `buffer_size` | 50 | Max events buffered in memory before flush. |
| `buffer_flush_interval_ms` | 5000 | Max time between flushes. |
| `cloud_sync_enabled` | false | Whether to sync data to a remote endpoint. |
| `cloud_sync_endpoint` | null | URL for cloud sync. |
| `event_sync_enabled` | false | Whether to include raw events in cloud sync (vs sessions/metrics only). |
| `retention_events_days` | 30 | Days to retain raw events. |
| `retention_sessions_days` | 365 | Days to retain session records. |
| `retention_tool_calls_days` | 90 | Days to retain tool call records. |
| `anonymize_file_paths` | false | Whether to hash file paths in tool call events. |

---

## 10. OTEL Compatibility

The AX event model maps naturally to OpenTelemetry constructs. This section describes the mapping for teams that want to use OTEL infrastructure.

### 10.1 Structural Mapping

| AX Concept | OTEL Construct | Rationale |
|------------|---------------|-----------|
| Session | Trace | A session is a complete unit of work, like a trace. The session ID maps to the OTEL trace ID. |
| Turn | Root-level span within a trace | Each prompt-response cycle is a logical unit of work within the session. |
| Tool call | Child span | A tool call has a clear start and end, a duration, and a status --- the defining characteristics of a span. |
| Other events (`first_token`, `output_chunk`, `error`, etc.) | Span events (logs attached to spans) | These are point-in-time occurrences within a span, not units of work with duration. OTEL span events are the right fit. |
| State machine state | Span attributes | The current state can be recorded as an attribute on the active span. State transitions are span events. |
| Session metadata | Resource attributes | Agent name, version, model ID, interface type --- these are properties of the instrumented resource. |

### 10.2 Semantic Conventions

OTEL has emerging semantic conventions for generative AI (`gen_ai.*`). Where applicable:

| OTEL Attribute | AX Field | Notes |
|---------------|----------|-------|
| `gen_ai.system` | `model_provider` | E.g., "anthropic", "openai" |
| `gen_ai.request.model` | `model_id` | E.g., "claude-opus-4-20250514" |
| `gen_ai.usage.input_tokens` | `token_count` (on prompt_submit) | Per-request token count |
| `gen_ai.usage.output_tokens` | `output_token_count` | Per-request output tokens |
| `gen_ai.response.finish_reason` | `end_reason` / `completion_type` | Maps with some translation |

AX-specific attributes (no OTEL convention exists) should use the `ax.*` namespace:
- `ax.session.state` --- current state machine state
- `ax.session.turn_number` --- current turn
- `ax.stall.reason` --- stall reason enum
- `ax.tool.category` --- tool category enum
- `ax.correction.type` --- correction type enum

### 10.3 Using an OTEL Collector as the Local Collector

It is possible but not recommended as the primary approach.

**What works:** an OTEL collector can receive spans and events, batch them, and export to local storage (file exporter, OTLP to a local receiver). The collector handles buffering, retry on export failure, and multiple export destinations.

**What does not work natively:** the OTEL collector does not maintain a session state machine. It processes spans and events independently --- it cannot compute "time in Stalled state" or detect stalls via the L1 heuristic. A custom OTEL processor would be needed to implement the state machine logic.

**Recommended hybrid approach:**
1. Use the AX local collector for state machine tracking and metric computation (it is purpose-built for this)
2. Export events to an OTEL collector in parallel for integration with existing observability infrastructure
3. The AX collector emits OTEL-compatible spans/events that the OTEL collector can ingest directly

This gives teams the best of both worlds: AX-specific intelligence (state machine, stall detection, metrics) plus integration with their existing OTEL pipeline (Jaeger, Grafana Tempo, Datadog, etc.).

### 10.4 Trace Structure Example

```
Trace (session_id)
├── Span: "turn-1" (prompt_submit → turn end)
│   ├── Event: prompt_submit {prompt_hash, turn_number: 1}
│   ├── Event: first_token {latency_ms: 1200}
│   ├── Event: output_chunk {token_count: 45, chunk_type: "text"}
│   ├── Span: "tool-call: Read" (tool_call_start → tool_call_end)
│   │   └── Attributes: {tool_name: "Read", status: "success", duration_ms: 1800}
│   ├── Span: "tool-call: Bash" (tool_call_start → tool_call_end)
│   │   └── Attributes: {tool_name: "Bash", status: "success", duration_ms: 8300}
│   ├── Event: output_chunk {token_count: 185, chunk_type: "text"}
│   └── Event: task_complete {completion_type: "full"}
└── Event: session_end {end_reason: "completed", total_duration_ms: 21700}
```

---

## Appendix A: Event-to-Metric Traceability

Which events feed which metrics. An implementer can use this to verify that their instrumentation covers the metrics they need.

| Metric | Required Events | Obs. Level |
|--------|----------------|------------|
| `time_to_first_token` | `prompt_submit`, `first_token` | L1 |
| `output_speed` | `output_chunk` events, state durations (Working) | L1 |
| `resume_speed` | `user_input_received`, first `output_chunk` after | L1 |
| `time_per_turn` | `prompt_submit`, state durations per turn | L1 |
| `start_failure_rate` | `session_start`, `error` (fatal, in Starting state) | L2 |
| `stall_ratio` | State durations (Working, Stalled) | L1/L2 |
| `stall_count` | Working -> Stalled transitions | L2 (L1 via heuristic) |
| `avg_stall_duration` | Stalled episode durations | L1/L2 |
| `error_rate` | `error` events | L2 |
| `hidden_retries` | `retry_start` events without user-visible output | L2 |
| `questions_asked` | `user_input_requested` events | L2 |
| `user_corrections` | `user_correction` events | L1 (heuristic) |
| `first_try_success_rate` | `user_correction`, `user_input_requested`, `task_complete` | L3 |
| `user_active_time_pct` | State durations (Waiting), `user_correction` timestamps | L3 |
| `work_multiplier` | State durations (Working, Waiting) | L3 |
| `output_quality_score` | External evaluation judge | L4 |
| `clean_output_rate` | `output_chunk` events with `is_valid` field | L2 |
| `quality_decay` | Per-turn `output_quality_score` | L4 |
| `useful_token_pct` | `output_chunk` token counts, `session_end` total tokens | L2 |
| `task_completion_rate` | `task_complete`, `user_correction` (post-completion window) | L2 |
| `redo_rate` | `prompt_hash` comparison across sessions | L3 |
| `gave_up_rate` | `user_cancel`, `task_complete` | L1 |
| `where_they_gave_up` | `user_cancel` with `current_state` | L1 |
| `time_to_done` | `prompt_submit`, `task_complete` | L1 |
| `came_back_rate` | `session_start` events per user within 24h | L1 |

## Appendix B: What Is Easy vs Hard to Implement

Honest assessment for implementers.

**Easy (days of work):**
- `session_start` / `session_end` / `prompt_submit` / `first_token` --- clear hook points in any framework
- State machine tracker --- straightforward state/transition logic
- Local storage with SQLite --- well-understood technology
- L2 tool call events --- most frameworks already expose these callbacks

**Moderate (weeks of work):**
- Framework middleware adapters --- each framework is different, APIs change between versions
- L1 stall detection with tuned thresholds --- needs empirical validation against real sessions
- Output chunk batching and classification --- chunking strategy affects metric accuracy
- Guaranteed `session_end` emission --- handling crashes, kills, and edge cases robustly
- Cloud sync with backpressure and retry --- standard distributed systems problem but still non-trivial

**Hard (ongoing effort):**
- User correction detection --- inherently imprecise at L1, requires continuous heuristic tuning
- Content type classification --- deriving `quick_answer` vs `guided_task` vs `deep_session` vs `autonomous_workflow` from session shape requires empirical thresholds
- Redo rate detection --- requires semantic similarity comparison across sessions, not just hash matching
- Cross-framework consistency --- ensuring the same agent behavior produces the same metrics regardless of which framework adapter is used
