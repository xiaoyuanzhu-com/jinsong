# Metrics Specification

Definitive reference for all metrics in the Agent Experience (AX) framework.

Two-layer architecture: **operational metrics** (objective, per-event and per-session measurements for engineering teams) feed into **experience metrics** organized into five orthogonal quality pillars — Responsiveness, Reliability, Autonomy, Correctness, Completion. Operational metrics tell you what changed; experience metrics tell you whether users care.

---

## 1. Operational Metrics

### 1.1 Session-Level Metrics

Computed once per session. Used for regression detection and dashboard monitoring.

| ID | Name | Unit | Formula / Definition | Example |
|----|------|------|---------------------|---------|
| `tokens_per_session` | Tokens per Session | count | Sum of all tokens consumed (input + output + reasoning) across all turns in the session | 2,400 tokens |
| `turns_per_session` | Turns per Session | count | Number of user-agent exchange cycles (Working episodes) | 5 turns |
| `tool_calls_per_session` | Tool Calls per Session | count | Count of Working → Stalled(tool_call) transitions | 4 tool calls |
| `duration_seconds` | Duration per Session | seconds | Wall-clock time from `prompt_submit` to `session_end` | 35.1s |
| `errors_per_session` | Errors per Session | count | Count of all `error` events (recoverable + fatal) across all states | 2 errors |
| `time_per_turn_avg` | Avg Time per Turn | seconds | (`duration_seconds` - time_in_Waiting) / `turns_per_session` | 7.0s |

### 1.2 Per-Event Metrics

Computed per occurrence within a session. Used for diagnosing where in a session quality breaks down.

| ID | Name | Unit | Formula / Definition | Example |
|----|------|------|---------------------|---------|
| `time_to_first_token` | Time to First Token | seconds | Wall-clock time from `prompt_submit` to `first_token` event (duration of Starting state) | 1.2s |
| `tokens_per_turn` | Tokens per Turn | count | Total tokens consumed in a single user-agent exchange cycle | 480 tokens |
| `tool_call_duration_ms` | Tool Call Duration | milliseconds | Wall-clock time from `tool_call_start` to `tool_call_end` for a single invocation | 2,100ms |
| `tool_success` | Tool Success | boolean | `true` if `tool_call_end.status = success`; `false` otherwise | true |
| `retry_count` | Retry Count | count | Number of `retry_start` events per error event within a Stalled(retry) episode | 3 retries |
| `stall_duration_ms` | Stall Duration | milliseconds | Duration of a single Stalled episode, from state entry to exit | 8,300ms |

---

## 2. Experience Metrics — Five Pillars

Observability levels: **L1** = client-side timestamps only. **L2** = agent framework events. **L3** = derived from L1+L2. **L4** = requires evaluation judge (human or LLM).

All thresholds marked *proposed* require empirical validation via real session telemetry (Paper-1).

### 2.1 Responsiveness — "Is it fast?"

| ID | Name | Unit | Formula | Inputs | Obs. | Good | Fair | Poor |
|----|------|------|---------|--------|------|------|------|------|
| `time_to_first_token` | Time to First Token | seconds | `first_token.timestamp - prompt_submit.timestamp` | `prompt_submit`, `first_token` events | L1 | < 2s | 2–5s | > 5s *proposed* |
| `output_speed` | Output Speed | tokens/s | Visible output tokens emitted / time spent in Working state | `output_chunk` events, Working state duration | L1 | > 40 tok/s | 15–40 tok/s | < 15 tok/s *proposed* |
| `resume_speed` | Resume Speed | seconds | `first output_chunk.timestamp after user_input_received` - `user_input_received.timestamp` | `user_input_received`, `output_chunk` events | L1 | < 2s | 2–5s | > 5s *proposed* |
| `time_per_turn` | Time per Turn | seconds | Wall-clock time per user-agent exchange cycle (Working + Stalled time within the turn, excluding Waiting) | State durations per turn | L1 | < 10s | 10–30s | > 30s *proposed* |

**Research basis for thresholds.** TTFT Good/Poor boundaries follow web UX research: 2s is the "responsive" threshold (Google RAIL), 5s triggers attention breaks (Nielsen). Output Speed ranges derived from typical reading speed (~250 wpm / ~5 tok/s) with headroom for scanning code output.

### 2.2 Reliability — "Does it work without breaking?"

| ID | Name | Unit | Formula | Inputs | Obs. | Good | Fair | Poor |
|----|------|------|---------|--------|------|------|------|------|
| `start_failure_rate` | Start Failure Rate | % | (sessions with Starting → Failed) / total sessions × 100 | State transitions | L2 | < 1% | 1–5% | > 5% *proposed* |
| `stall_ratio` | Stall Ratio | % | time_in_Stalled / (time_in_Working + time_in_Stalled) × 100 | State durations | L1/L2 | < 10% | 10–20% | > 20% *proposed* |
| `stall_count` | Stall Count | count/session | Count of Working → Stalled transitions per session | State transitions | L2 | ≤ 3 | 4–10 | > 10 *proposed* |
| `avg_stall_duration` | Avg Stall Duration | seconds | mean(all `stall_duration_ms` in session) / 1000 | `stall_duration_ms` per episode | L1 | < 2s | 2–5s | > 5s *proposed* |
| `error_rate` | Error Rate | count/session | Count of `error` events per session | `error` events | L2 | 0 | 1–2 | > 2 *proposed* |
| `hidden_retries` | Hidden Retries | count/session | Count of `retry_start` events not visible to the user per session | `retry_start` events where no user-visible output accompanies the retry | L2 | 0 | 1–3 | > 3 *proposed* |

**Research basis.** Stall Ratio is the direct analogue of Zhang's Buffering Ratio — the single strongest predictor of viewer disengagement. The 10% Good boundary parallels video streaming's 1% buffering ratio threshold scaled for the higher inherent tool-call overhead in agent sessions.

### 2.3 Autonomy — "Can it handle it on its own?"

| ID | Name | Unit | Formula | Inputs | Obs. | Good | Fair | Poor |
|----|------|------|---------|--------|------|------|------|------|
| `questions_asked` | Questions Asked | count/session | Count of Working → Waiting transitions per session | State transitions | L2 | 0 | 1–2 | > 2 *proposed* |
| `user_corrections` | User Corrections | count/session | Count of `user_correction` events during Working state per session | `user_correction` events | L1 | 0 | 1 | > 1 *proposed* |
| `first_try_success_rate` | First-Try Success Rate | % | (sessions where `user_corrections` = 0 AND `questions_asked` = 0 AND `task_complete` = true) / completed sessions × 100 | `user_correction`, state transitions, `task_complete` | L3 | > 80% | 50–80% | < 50% *proposed* |
| `user_active_time_pct` | User Active Time % | % | (time_in_Waiting + steering_recovery_time + user_input_time) / `duration_seconds` × 100 | State durations, `user_correction` timestamps | L3 | < 10% | 10–30% | > 30% *proposed* |
| `work_multiplier` | Work Multiplier | ratio | time_in_Working / (time_in_Waiting + user_input_time) | State durations | L3 | > 10x | 3–10x | < 3x *proposed* |

**Threshold notes.** Autonomy thresholds are highly content-type-dependent. The values above assume `guided_task`. For `quick_answer`, any question asked is Poor. For `autonomous_workflow`, Questions Asked > 0 is unexpected but the threshold is more forgiving on Work Multiplier.

### 2.4 Correctness — "Is the output right?"

| ID | Name | Unit | Formula | Inputs | Obs. | Good | Fair | Poor |
|----|------|------|---------|--------|------|------|------|------|
| `output_quality_score` | Output Quality Score | 0–1 | Evaluation judge (human or LLM-as-judge) assessing correctness, completeness, and instruction adherence of final output | Final output artifact, original prompt, evaluation rubric | L4 | > 0.85 | 0.60–0.85 | < 0.60 *proposed* |
| `clean_output_rate` | Clean Output Rate | % | (output chunks passing validation: valid syntax, valid markdown, no truncation) / total output chunks × 100 | `output_chunk` events with parse/validation check | L2 | > 95% | 80–95% | < 80% *proposed* |
| `quality_decay` | Quality Decay | 0–1 | `output_quality_score` in final third of turns / `output_quality_score` in first third of turns. 1.0 = no decay. | Per-turn `output_quality_score` assessments | L4 | > 0.90 | 0.70–0.90 | < 0.70 *proposed* |
| `useful_token_pct` | Useful Token % | % | visible_output_tokens / `tokens_per_session` × 100 | `output_chunk` token counts, `tokens_per_session` | L2 | > 30% | 15–30% | < 15% *proposed* |

**Note.** `output_quality_score` and `quality_decay` require L4 instrumentation (evaluation judge). At L2, use `clean_output_rate` and `first_try_success_rate` as proxies.

### 2.5 Completion — "Did it finish the job?"

| ID | Name | Unit | Formula | Inputs | Obs. | Good | Fair | Poor |
|----|------|------|---------|--------|------|------|------|------|
| `task_completion_rate` | Task Completion Rate | % | (sessions with `task_complete` signal AND no user_correction within post-completion window) / total sessions × 100 | `task_complete`, `user_correction` events | L2 | > 85% | 60–85% | < 60% *proposed* |
| `redo_rate` | Redo Rate | % | (sessions followed by a semantically related prompt within configurable time window) / completed sessions × 100 | Post-session prompt semantic similarity | L3 | < 5% | 5–15% | > 15% *proposed* |
| `gave_up_rate` | Gave-Up Rate | % | (sessions terminated by `user_cancel` before `task_complete`) / total sessions × 100 | `user_cancel`, `task_complete` events | L1 | < 5% | 5–15% | > 15% *proposed* |
| `where_they_gave_up` | Where They Gave Up | categorical | State at time of `user_cancel` event: Starting, Working, Stalled, Waiting | `user_cancel.current_state` | L1 | — | — | — |
| `time_to_done` | Time to Done | seconds | `task_complete.timestamp` - `prompt_submit.timestamp` | `prompt_submit`, `task_complete` events | L1 | Content-type dependent (see below) | | |
| `came_back_rate` | Came Back Rate | % | (users who initiate a new session within 24h) / total users × 100 | User-level session history | L1 | > 70% | 40–70% | < 40% *proposed* |

**`time_to_done` thresholds by content type** *(proposed)*:

| Content Type | Good | Fair | Poor |
|-------------|------|------|------|
| `quick_answer` | < 10s | 10–30s | > 30s |
| `guided_task` | < 5min | 5–15min | > 15min |
| `deep_session` | < 30min | 30–60min | > 60min |
| `autonomous_workflow` | < 15min | 15–45min | > 45min |

**`where_they_gave_up` has no thresholds** — it is a diagnostic distribution, not a scored metric. Report as a histogram of abandonment by state.

---

## 3. Content Type Modifiers

Metric importance shifts across the four content types. Star ratings indicate relative weight within each content type.

| Pillar | `quick_answer` | `guided_task` | `deep_session` | `autonomous_workflow` |
|--------|:-:|:-:|:-:|:-:|
| **Responsiveness** | ★★★ | ★★ | ★★ | ★ |
| **Reliability** | ★★ | ★★★ | ★★★ | ★★ |
| **Autonomy** | ★ | ★★★ | ★★ | ★ |
| **Correctness** | ★★★ | ★★ | ★★ | ★★★ |
| **Completion** | ★★ | ★★ | ★★★ | ★★★ |

★ = low relative importance, ★★ = moderate, ★★★ = high/critical

**Content type definitions:**

| Type | Turns | Tool Calls | Duration | User Engagement |
|------|-------|------------|----------|-----------------|
| `quick_answer` | 1–2 | 0–2 | < 30s | Waiting for answer |
| `guided_task` | 3–15 | 3–20 | 1–15min | Actively collaborating |
| `deep_session` | 15–50+ | 20–100+ | 15–60min+ | Deeply invested |
| `autonomous_workflow` | 1 (initial) | Unbounded | Minutes to hours | Checks back for results |

---

## 4. Metric IDs Reference

Alphabetical list of all metric IDs for quick lookup.

| ID | Name | Layer / Pillar |
|----|------|---------------|
| `avg_stall_duration` | Avg Stall Duration | Reliability |
| `came_back_rate` | Came Back Rate | Completion |
| `clean_output_rate` | Clean Output Rate | Correctness |
| `duration_seconds` | Duration per Session | Operational (session) |
| `error_rate` | Error Rate | Reliability |
| `errors_per_session` | Errors per Session | Operational (session) |
| `first_try_success_rate` | First-Try Success Rate | Autonomy |
| `gave_up_rate` | Gave-Up Rate | Completion |
| `hidden_retries` | Hidden Retries | Reliability |
| `output_quality_score` | Output Quality Score | Correctness |
| `output_speed` | Output Speed | Responsiveness |
| `quality_decay` | Quality Decay | Correctness |
| `questions_asked` | Questions Asked | Autonomy |
| `redo_rate` | Redo Rate | Completion |
| `resume_speed` | Resume Speed | Responsiveness |
| `retry_count` | Retry Count | Operational (event) |
| `stall_count` | Stall Count | Reliability |
| `stall_duration_ms` | Stall Duration | Operational (event) |
| `stall_ratio` | Stall Ratio | Reliability |
| `start_failure_rate` | Start Failure Rate | Reliability |
| `task_completion_rate` | Task Completion Rate | Completion |
| `time_per_turn` | Time per Turn | Responsiveness |
| `time_per_turn_avg` | Avg Time per Turn | Operational (session) |
| `time_to_done` | Time to Done | Completion |
| `time_to_first_token` | Time to First Token | Responsiveness |
| `tokens_per_session` | Tokens per Session | Operational (session) |
| `tokens_per_turn` | Tokens per Turn | Operational (event) |
| `tool_call_duration_ms` | Tool Call Duration | Operational (event) |
| `tool_calls_per_session` | Tool Calls per Session | Operational (session) |
| `tool_success` | Tool Success | Operational (event) |
| `useful_token_pct` | Useful Token % | Correctness |
| `user_active_time_pct` | User Active Time % | Autonomy |
| `user_corrections` | User Corrections | Autonomy |
| `where_they_gave_up` | Where They Gave Up | Completion |
| `work_multiplier` | Work Multiplier | Autonomy |

**Total: 35 metrics** — 12 operational (6 session, 6 event) + 23 experience (4 Responsiveness, 6 Reliability, 5 Autonomy, 4 Correctness, 6 Completion, minus 2 shared with operational layer: `time_to_first_token` appears in both operational and Responsiveness).
