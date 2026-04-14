# METRICS — Agent Experience Metrics Design

## Meta
- Status: in-progress
- Parent roadmap: RM-1
- Created: 2026-04-14

## Goal
Define the formal metrics taxonomy and agent state machine for Paper-0. This is the core intellectual contribution: a principled mapping from observable agent states to measurable quality metrics, directly paralleling Zhang et al.'s player state machine for video streaming (SIGCOMM 2011).

---

## METRICS-1: Agent State Machine

### 1.1 Design Rationale

Zhang's video player state machine has four states and clean transitions:

```
  ┌──────────┐     success     ┌─────────┐    rebuffer    ┌────────────┐
  │ Joining  │ ──────────────→ │ Playing │ ─────────────→ │ Buffering  │
  └──────────┘                 └─────────┘                └────────────┘
       │                         │    ↑                        │
       │ fail/abandon            │    └────────────────────────┘
       ↓                         │          resume
  ┌──────────┐                   ↓
  │ Failed   │              ┌─────────┐
  └──────────┘              │ Stopped │
                            └─────────┘
```

Every video quality metric maps to this machine: Join Time = duration in Joining; Buffering Ratio = time in Buffering / (time in Playing + Buffering); Buffer Frequency = transitions into Buffering; etc.

The agent domain is structurally richer than video for three reasons:

1. **Bidirectional interaction.** Video is unidirectional (server → client). Agents require user ↔ agent exchanges mid-session: clarification questions, approval gates, steering corrections. This demands a dedicated state.
2. **Tool use as observable substates.** When an agent invokes an external tool (API call, code execution, file read), it enters a latency bubble visible to the user — functionally equivalent to buffering, but semantically distinct because the agent chose to enter it.
3. **Error recovery loops.** Video either plays or fails. Agents frequently encounter errors (tool failures, model errors, rate limits) and retry autonomously before the user sees anything. These retries consume wall-clock time and must be captured.

These differences motivate six primary states (vs. Zhang's four).

### 1.2 The Agent State Machine

```
                              ┌─────────────────────────────────────────────────┐
                              │                                                 │
                              │          ┌─────────────────────────────┐        │
                              │          │                             │        │
                              ↓          ↓                             │        │
┌───────────┐  first    ┌──────────┐  resume   ┌─────────────┐        │        │
│           │  output   │          │ ←──────── │  Waiting     │        │        │
│ Starting  │ ────────→ │ Working  │ ────────→ │  (on user)   │        │        │
│           │           │          │  ask user  └─────────────┘        │        │
└───────────┘           └──────────┘                                   │        │
     │                    │  │  ↑  │                                   │        │
     │                    │  │  │  │  tool call returns /              │        │
     │ fail /             │  │  │  │  retry succeeds                  │        │
     │ timeout /          │  │  │  └──────────────────────┐           │        │
     │ abandon            │  │  │                         │           │        │
     ↓                    │  │  │  tool call    ┌────────────────┐    │        │
┌───────────┐             │  │  └────────────── │  Stalled       │    │        │
│           │             │  │                  │  (tool/retry)  │ ───┘        │
│ Failed    │             │  │  error/retry     └────────────────┘  error      │
│           │             │  └────────────────→        ↑               exceeds │
└───────────┘             │                            │               retry   │
     ↑                    │       retry loop           │               budget  │
     │                    │       (same error)  ───────┘                       │
     │ unrecoverable      │                                                    │
     │ error              │  task done /                                        │
     └────────────────────│  user stops                                        │
                          ↓                                                    │
                   ┌──────────┐                                                │
                   │          │ ←──────────────────────────────────────────────┘
                   │ Ended    │
                   │          │
                   └──────────┘
```

### 1.3 State Definitions

| State | Entry Condition | Exit Condition | Observable Signal | Zhang Parallel |
|-------|----------------|----------------|-------------------|----------------|
| **Starting** | User submits a prompt/task | First visible output token appears; OR timeout/error occurs | Prompt submission event; no output yet rendered | Joining |
| **Working** | Agent produces visible output (tokens, artifacts, progress indicators) | Agent finishes, stalls, asks user, or fails | Output tokens streaming; progress updates appearing | Playing |
| **Stalled** | Agent enters a latency gap with no user-visible output — tool call in flight, retry in progress, rate limit wait, or model processing pause | Tool returns, retry succeeds, or error budget exhausted | Output stream paused; tool invocation event logged; no new tokens for configurable threshold (e.g., >2s) | Buffering |
| **Waiting** | Agent explicitly requests user input (clarification, approval, choice) | User provides input and agent resumes | Agent emits a question/prompt directed at user; output stream stops with a user-input widget or question mark | *(no parallel — video is non-interactive)* |
| **Failed** | Unrecoverable error: crash, auth failure, context overflow, retry budget exhausted, timeout | Session is terminal (user must start new request) | Error message rendered; or timeout with no output | Failed (Zhang treats this as Joining→exit) |
| **Ended** | Task completed (agent signals done); OR user explicitly stops/cancels | Session is terminal | Completion signal; user stop action; final output rendered | Stopped |

### 1.4 Transitions

| From | To | Trigger | Observable Event |
|------|-----|---------|-----------------|
| Starting → Working | First visible output | `first_token` event |
| Starting → Failed | Timeout, crash, auth error | `error` event with no prior output |
| Starting → Ended | User cancels before output | `user_cancel` event |
| Working → Stalled | Tool invocation; model pause >threshold; retry initiated | `tool_call_start` or output gap exceeding threshold |
| Working → Waiting | Agent asks user a question | `user_input_requested` event |
| Working → Ended | Task completion; user stops | `task_complete` or `user_stop` event |
| Working → Failed | Unrecoverable error during work | `error` event (fatal) |
| Stalled → Working | Tool returns result; retry succeeds | `tool_call_end` or `retry_success` event; output tokens resume |
| Stalled → Failed | Retry budget exhausted; tool permanently fails | `error` event after max retries |
| Stalled → Ended | User cancels during stall | `user_cancel` event |
| Waiting → Working | User provides input | `user_input_received` event; output tokens resume |
| Waiting → Ended | User abandons / cancels | `user_cancel` or session timeout |

### 1.5 Key Design Decisions

**Why "Stalled" instead of separate "Tool-Calling" and "Retrying" states.**
From the user's perspective, both tool calls and retries manifest identically: the output stream stops and the user waits. Splitting them would add states without adding measurably different user experience. However, we record a `stall_reason` attribute (enum: `tool_call`, `retry`, `rate_limit`, `model_latency`) on every Stalled entry event so that diagnostic analysis can distinguish causes without inflating the state machine.

**Why "Waiting" is a first-class state, not a substate of Stalled.**
Stalled and Waiting are both pauses, but the locus of control differs — and this is the critical distinction. In Stalled, the agent controls when progress resumes (tool returns, retry succeeds). In Waiting, the user controls it. This difference is measurable (the agent framework knows whether it emitted a question vs. made a tool call) and has different quality implications: Stall Duration reflects system performance; Wait Duration reflects interaction design.

**Why "Failed" is terminal.**
In video streaming, a failed join is terminal — the user must re-initiate. We adopt the same convention. If an agent encounters an error and recovers, it never entered Failed; it was in Stalled (retrying) and transitioned back to Working. Failed means no recovery occurred. This keeps the state machine acyclic from Failed (no outgoing transitions), which simplifies reliability metrics.

**Observability constraint.**
Every state and transition is defined by events observable at the client/framework boundary: token emission, tool call lifecycle events, user input events, error events, and timeout thresholds. No state requires inspecting model weights, attention patterns, or internal chain-of-thought. This is deliberate — metrics must be instrumentable by any agent framework, not only by model providers.

### 1.6 Parallel to Zhang (Explicit Mapping)

| Zhang State | Agent State | Structural Correspondence |
|-------------|------------|--------------------------|
| Joining | Starting | Latency before first useful output. Both are the "cold start" phase. |
| Playing | Working | The "value delivery" state. User perceives forward progress. |
| Buffering | Stalled | System-side pause. User waits involuntarily. The key metric territory. |
| *(none)* | Waiting | **New.** Interactive systems have a fundamentally new pause type: the system waiting on the user. Video has no parallel because the viewer is passive. |
| Failed (implicit in Zhang) | Failed | Terminal error. Zhang treats this as an exit from Joining; we make it explicit because agent failure can occur at any phase. |
| Stopped | Ended | Session complete — either success or user-initiated stop. |

The agent state machine is a strict superset of Zhang's. Remove Waiting and collapse the stall_reason attribute, and you recover the video player state machine exactly. This is the right relationship: agents are interactive video.

---

## METRICS-2: Metrics Taxonomy

### 2.0 Critical Evaluation of the PRD Metrics

Before formalizing, we identify issues with the PRD's initial metric set:

**Redundancies to resolve:**
- `Start Success Rate` and `Start Failure Rate` are exact complements (sum to 100%). **Resolution:** keep Start Failure Rate only — failure is the actionable signal, matching Zhang's convention of measuring "join failure rate" not "join success rate." Derive success rate trivially if needed.
- `Abandonment Rate` (Phase 5) and `Abandon Before Response` (Phase 1) overlap. **Resolution:** rename Phase 1 metric to `Pre-Response Abandonment Rate` (abandonment specifically before first output) and keep Phase 5 `Abandonment Rate` as the all-phase version. Pre-Response Abandonment is a subset.
- `Stall Rate` (% of session time) and `Stall Duration` partially overlap — if you know stall count and stall duration distribution, you can compute stall rate. **Resolution:** keep both. Stall Rate is the Zhang "buffering ratio" analogue (the single most predictive metric in video); Stall Duration is the per-event distribution. They serve different analytical purposes.

**Metrics that are unmeasurable without agent internals (flag for Paper-1/SDK):**
- `Delivery Quality Score` — requires a judge (human or LLM) to evaluate correctness, completeness, and adherence. Not observable from client-side instrumentation alone. **Decision:** keep in taxonomy but mark as `requires_evaluation_judge`. This is analogous to video "perceptual quality" (MOS scores) which also requires external measurement.
- `Net Satisfaction` — requires explicit user feedback or a satisfaction model. Same treatment.

**Missing metrics (gaps vs. Zhang):**
- **Rendering Quality / Output Fidelity:** Zhang measures video bitrate and resolution — the quality of what is delivered during the Playing state, not just whether it plays. Our Working state equivalent: are output tokens arriving at a useful granularity? Are code blocks syntactically valid? Is formatting correct? We add `Output Fidelity Rate`.
- **Multi-turn Degradation:** Zhang's paper tracks how quality changes over session duration. Agent sessions that span many turns may degrade (context window fills, coherence drops). We add `Turn-over-Turn Coherence`.
- **Time to Task Completion (TTTC):** The PRD has Session Duration but not the tighter metric of time from prompt to verified task completion. Session Duration includes post-completion idle time. We add `Time to Task Completion`.
- **Cost Efficiency:** Not in Zhang (video cost is negligible per-stream), but agent invocations carry significant per-token and per-tool-call costs. Relevant for the agent domain even if it lacks a video analogue. We add `Token Efficiency Ratio`.

**Metrics to split:**
- `Effort Ratio` is defined as "user active time vs agent active time" — this conflates two things: (a) how much of the session the user had to be engaged, and (b) the leverage ratio of agent work to user work. **Resolution:** split into `User Attention Ratio` (fraction of wall-clock time user was actively engaged) and `Leverage Ratio` (agent working time / user input time).

### 2.1 Formalized Metric Table

#### Phase 1: Initiation

| # | Name | Type | Unit | State/Transition | Definition | Observable From | Zhang Analogue |
|---|------|------|------|-----------------|------------|-----------------|----------------|
| 1.1 | **Time to First Response (TTFR)** | histogram | seconds | Duration of Starting state | Wall-clock time from user prompt submission to the first visible output token rendered to the user. | Client-side: timestamp delta between `prompt_submit` and `first_token` events. | Join Time |
| 1.2 | **Start Failure Rate** | rate | percentage | Starting → Failed transition | Fraction of initiated sessions where the agent fails to produce any output (error, timeout, or crash before first token). | Agent framework: count of Starting→Failed transitions / total sessions. | Join Failure Rate |
| 1.3 | **Pre-Response Abandonment Rate** | rate | percentage | Starting → Ended (user cancel) | Fraction of sessions where the user cancels or navigates away before the first output token. | Client-side: `user_cancel` event while in Starting state / total sessions. | Abandonment Before Video Start |
| 1.4 | **Start Retry Rate** | rate | percentage | Starting state (internal) | Fraction of sessions where the framework auto-retried the initial request before first output (e.g., retry after 429 or model overload). | Agent framework: retry events during Starting state. | *(none — new)* |

#### Phase 2: Progress

| # | Name | Type | Unit | State/Transition | Definition | Observable From | Zhang Analogue |
|---|------|------|------|-----------------|------------|-----------------|----------------|
| 2.1 | **Stall Ratio** | gauge | percentage | Time in Stalled / (Time in Working + Stalled) | Fraction of active session time (excluding Waiting and Ended) spent in the Stalled state. The single most important progress metric. | Client-side: sum of Stalled durations / sum of (Working + Stalled) durations. | Buffering Ratio |
| 2.2 | **Stall Frequency** | counter | count per session | Working → Stalled transitions | Number of times the agent enters the Stalled state per session. | Agent framework: count of Working→Stalled transition events. | Rebuffering Frequency |
| 2.3 | **Stall Duration Distribution** | histogram | seconds | Duration of each Stalled episode | Distribution (p50, p90, p95) of individual stall event durations. | Client-side: per-stall duration from `stall_start` to `stall_end`. | Rebuffering Duration |
| 2.4 | **Progress Cadence** | gauge | events per minute | Within Working state | Rate of user-visible progress signals (new output chunks, status updates, artifact deliveries) during the Working state. | Client-side: count of progress events / time in Working. | Bitrate (sustained throughput) |
| 2.5 | **Perceived Throughput** | gauge | tokens per second (or output-units per second) | Within Working state | Rate of meaningful user-facing output delivery during Working, excluding tool-call metadata and internal reasoning tokens. | Client-side: visible output tokens / time in Working. | Video Bitrate |
| 2.6 | **Output Fidelity Rate** | rate | percentage | Within Working state | Fraction of output chunks that are well-formed (valid syntax for code, valid markdown, no truncation artifacts). | Client-side: parse/validate each output chunk. | Rendering Quality |

#### Phase 3: Interaction

| # | Name | Type | Unit | State/Transition | Definition | Observable From | Zhang Analogue |
|---|------|------|------|-----------------|------------|-----------------|----------------|
| 3.1 | **Interaction Frequency** | counter | count per session | Working → Waiting transitions | Number of times the agent pauses to request user input per session. | Agent framework: count of Working→Waiting transitions. | *(none — new)* |
| 3.2 | **Wait Duration Distribution** | histogram | seconds | Duration of each Waiting episode | Distribution (p50, p90, p95) of time the agent is blocked in the Waiting state per episode. | Client-side: `user_input_requested` to `user_input_received` timestamps. | *(none — new)* |
| 3.3 | **Resumption Latency** | histogram | seconds | Waiting → Working transition | Wall-clock time from user providing input to the agent producing the next visible output token. Measures the "cold restart" cost of re-entering Working after a Waiting pause. | Client-side: `user_input_received` to next `output_token` event. | *(analogous to rebuffer-exit latency)* |
| 3.4 | **Steering Event Count** | counter | count per session | User correction within Working state | Number of times the user sends a corrective signal (interrupt, redirect, "no, I meant...") while the agent is in the Working state. Does NOT cause a state transition — the agent remains Working but changes direction. | Client-side: heuristic detection of corrective user messages during Working. | *(none — new)* |
| 3.5 | **Steering Recovery Time** | histogram | seconds | Within Working state | Time from a steering event to the agent producing output aligned with the correction. | Client-side + evaluation: `steering_event` to first aligned output. Partial automation possible; full precision requires a judge. | *(none — new)* |
| 3.6 | **Interaction Overhead Ratio** | gauge | percentage | (Waiting time + Steering Recovery time) / Session Duration | Fraction of total session wall-clock time consumed by interaction overhead. | Client-side: computed from state durations. | *(none — new)* |

#### Phase 4: Delivery

| # | Name | Type | Unit | State/Transition | Definition | Observable From | Zhang Analogue |
|---|------|------|------|-----------------|------------|-----------------|----------------|
| 4.1 | **Task Completion Rate** | rate | percentage | Working → Ended (task_complete) | Fraction of sessions where the agent signals task completion and the user does not dispute it (no immediate follow-up correction). | Agent framework + client: `task_complete` event with no `steering_event` within a configurable post-completion window. | *(none — video has no "task")* |
| 4.2 | **First-Attempt Success Rate** | rate | percentage | Sessions with 0 steering events AND task_complete | Fraction of completed sessions where the agent reached task_complete without any steering events or Waiting episodes initiated by the agent. | Derived: sessions where Steering Event Count = 0 AND Interaction Frequency = 0 AND task_complete. | *(none — new)* |
| 4.3 | **Delivery Quality Score** | gauge | 0–1 scale | Ended state (post-hoc evaluation) | Composite score evaluating correctness, completeness, and instruction adherence of the final output. **Requires an evaluation judge (human or LLM-as-judge); not purely client-observable.** | Evaluation pipeline (offline). | Perceptual Quality (MOS) |
| 4.4 | **Rework Rate** | rate | percentage | Post-Ended: user re-submits related prompt | Fraction of sessions followed by a closely related prompt within a configurable time window, indicating the output was insufficient. | Client-side: semantic similarity of follow-up prompt to original, within time window. | *(none — new)* |
| 4.5 | **Partial Delivery Rate** | rate | percentage | Working → Ended (partial) | Fraction of sessions where the agent completes some but not all sub-goals, and either signals partial completion or the user identifies missing parts. | Agent framework: `partial_complete` signal; or client-side: user follow-up requesting "the rest." | *(none — new)* |
| 4.6 | **Token Efficiency Ratio** | gauge | ratio | Across session | Ratio of visible output tokens to total tokens consumed (input + output + tool-call overhead). Measures how much of the compute budget produced user-facing value. | Agent framework: total token counts from model API responses vs. visible output token count. | *(none — video has no per-stream cost analogue)* |

#### Phase 5: Resolution

| # | Name | Type | Unit | State/Transition | Definition | Observable From | Zhang Analogue |
|---|------|------|------|-----------------|------------|-----------------|----------------|
| 5.1 | **Time to Task Completion (TTTC)** | histogram | seconds | Starting entry → Ended (task_complete) entry | Wall-clock time from prompt submission to task completion signal. Excludes post-completion idle time. The most holistic single-number quality metric. | Client-side: `prompt_submit` to `task_complete` timestamps. | Total Session Duration (but tighter) |
| 5.2 | **Session Duration** | histogram | seconds | Starting entry → Ended entry | Total wall-clock time from prompt to session end, regardless of outcome (completion, failure, or abandonment). | Client-side: session boundary timestamps. | Session Duration |
| 5.3 | **User Attention Ratio** | gauge | percentage | (Waiting time + steering time + user-input time) / Session Duration | Fraction of session wall-clock time requiring active user engagement. Lower is better — the agent handled more autonomously. | Client-side: sum of user-active intervals / session duration. | *(none — viewer is always passive)* |
| 5.4 | **Leverage Ratio** | gauge | ratio | Working time / (Waiting time + steering input time) | Ratio of agent productive time to user input time. Measures the "multiplication factor" — how much agent work each unit of user input generates. | Client-side: derived from state durations. | *(none — new)* |
| 5.5 | **Abandonment Rate** | rate | percentage | Any non-terminal state → Ended (user_cancel) | Fraction of sessions terminated by user action before task completion. | Client-side: `user_cancel` events / total sessions. | Abandonment Rate |
| 5.6 | **Abandonment Phase** | histogram | categorical (phase 1–4) | State at time of abandonment | Distribution of which state the user was in when they abandoned. Pinpoints where the experience breaks. | Client-side: current state at `user_cancel` event. | *(none — but Zhang tracks "time to abandon")* |
| 5.7 | **Return Rate** | rate | percentage | Post-session | Fraction of users who initiate a new session within a configurable time window (e.g., 24h). Proxy for overall satisfaction and utility. | Client-side: user-level session history. | *(none — but standard engagement metric)* |
| 5.8 | **Net Satisfaction** | gauge | -1 to +1 scale | Post-session | Composite satisfaction signal combining explicit feedback (thumbs up/down, ratings) and implicit signals (return rate, rework rate, abandonment). **Requires feedback collection or model; not purely client-observable.** | Feedback pipeline (explicit) + derived metrics (implicit). | *(none — QoE survey equivalent)* |
| 5.9 | **Turn-over-Turn Coherence** | gauge | 0–1 scale | Across Working episodes | Measures whether output quality and relevance degrade as the session progresses through multiple turns. Computed as the ratio of Delivery Quality Score in the final third of turns vs. the first third. **Requires evaluation judge.** | Evaluation pipeline (offline). | *(analogous to bitrate degradation over session)* |

### 2.2 Metric-to-State Mapping Summary

Every metric maps to the state machine. This table provides the reverse index:

| State | Metrics Measured |
|-------|-----------------|
| **Starting** | TTFR (1.1), Start Failure Rate (1.2), Pre-Response Abandonment Rate (1.3), Start Retry Rate (1.4) |
| **Working** | Stall Ratio (2.1, denominator), Progress Cadence (2.4), Perceived Throughput (2.5), Output Fidelity Rate (2.6), Steering Event Count (3.4), Steering Recovery Time (3.5) |
| **Stalled** | Stall Ratio (2.1, numerator), Stall Frequency (2.2), Stall Duration Distribution (2.3) |
| **Waiting** | Interaction Frequency (3.1), Wait Duration Distribution (3.2), Resumption Latency (3.3), Interaction Overhead Ratio (3.6) |
| **Failed** | Start Failure Rate (1.2), Abandonment Phase (5.6) |
| **Ended** | Task Completion Rate (4.1), First-Attempt Success Rate (4.2), Delivery Quality Score (4.3), Rework Rate (4.4), Partial Delivery Rate (4.5), Token Efficiency Ratio (4.6) |
| **Cross-state** | TTTC (5.1), Session Duration (5.2), User Attention Ratio (5.3), Leverage Ratio (5.4), Abandonment Rate (5.5), Abandonment Phase (5.6), Return Rate (5.7), Net Satisfaction (5.8), Turn-over-Turn Coherence (5.9) |

### 2.3 Observability Classification

A metric is only as useful as its measurability. We classify each metric by what is required to capture it:

| Class | Requirement | Metrics |
|-------|-------------|---------|
| **L1: Client-side only** | Timestamps and event stream visible in the UI layer. No framework access needed. | TTFR, Pre-Response Abandonment Rate, Stall Ratio*, Stall Duration, Progress Cadence, Perceived Throughput, Wait Duration, Resumption Latency, Session Duration, TTTC, Abandonment Rate, Abandonment Phase |
| **L2: Agent framework** | Access to framework-level events: tool call lifecycle, retry logic, error types, token counts. | Start Failure Rate, Start Retry Rate, Stall Frequency, Interaction Frequency, Task Completion Rate, Token Efficiency Ratio, Output Fidelity Rate |
| **L3: Derived / composite** | Computed from L1 + L2 metrics. No new instrumentation, just aggregation. | Stall Ratio, First-Attempt Success Rate, User Attention Ratio, Leverage Ratio, Interaction Overhead Ratio, Rework Rate, Partial Delivery Rate |
| **L4: Requires evaluation judge** | Needs an external evaluator (human or LLM-as-judge) to assess output quality. Cannot be automated from instrumentation alone. Candidates for Paper-1 / SDK phase. | Delivery Quality Score, Steering Recovery Time (full precision), Net Satisfaction, Turn-over-Turn Coherence |

*Stall Ratio at L1 uses a client-side heuristic (output gap > threshold). At L2 it uses explicit tool-call events. Both are valid; L2 is more precise.

### 2.4 Metric Interactions and Tradeoffs

Several metrics exhibit inherent tensions that are important for Paper-0 to acknowledge:

1. **TTFR vs. Delivery Quality:** Streaming the first token instantly (low TTFR) may come at the cost of the agent "thinking aloud" with low-quality prefill. Optimizing TTFR naively degrades quality.

2. **Stall Frequency vs. Stall Duration:** An agent can make many short tool calls (high frequency, low duration) or batch them into fewer long calls (low frequency, high duration). Both produce the same Stall Ratio but feel different to the user. This motivates reporting all three: ratio, frequency, and duration distribution.

3. **Interaction Frequency vs. First-Attempt Success Rate:** An agent that never asks questions may complete tasks on the first attempt more often (high first-attempt rate) but fail badly when its assumptions are wrong. An agent that asks clarifying questions (high interaction frequency) may have a lower first-attempt rate but higher overall Task Completion Rate. Neither extreme is optimal.

4. **Token Efficiency vs. Delivery Quality:** Chain-of-thought and internal reasoning consume tokens without producing visible output, reducing Token Efficiency Ratio. But they typically improve Delivery Quality Score. This tradeoff is fundamental and should be reported rather than optimized away.

### 2.5 Comparison Table: Zhang Video Metrics → Agent Metrics

| Zhang et al. Metric | Agent Equivalent | Notes |
|---------------------|-----------------|-------|
| Join Time | TTFR (1.1) | Direct parallel. |
| Join Failure Rate | Start Failure Rate (1.2) | Direct parallel. |
| Buffering Ratio | Stall Ratio (2.1) | Direct parallel — the "headline" metric. |
| Buffering Frequency | Stall Frequency (2.2) | Direct parallel. |
| Buffering Duration | Stall Duration Distribution (2.3) | Direct parallel. |
| Average Bitrate | Perceived Throughput (2.5) | Conceptual parallel: sustained output rate. |
| Rendering Quality | Output Fidelity Rate (2.6) | Conceptual parallel: quality of what is delivered. |
| Rate of Buffering | Progress Cadence (2.4) | Inverse parallel: cadence measures presence of progress; buffering rate measures absence. |
| Abandonment Rate | Abandonment Rate (5.5) | Direct parallel. |
| Session Duration | Session Duration (5.2) | Direct parallel. |
| *(none)* | All Interaction metrics (3.x) | **Gap.** Video has no interaction dimension. This is the primary novelty. |
| *(none)* | Delivery metrics (4.x) | **Gap.** Video has no "task" concept — it plays or it doesn't. Task completion is the agent domain's unique concern. |
| *(none)* | Token Efficiency (4.6) | **Gap.** Video cost is amortized at CDN level; agent cost is per-invocation. |

---

## Appendix A: Event Schema (Reference)

For instrumentability, the state machine assumes the following minimal event stream. This is not a specification (that belongs in the SDK phase) but a reference for evaluating whether a given agent framework can support L1/L2 metrics.

```
event: prompt_submit       { session_id, timestamp, prompt_hash }
event: first_token         { session_id, timestamp }
event: output_chunk        { session_id, timestamp, token_count, chunk_type }
event: tool_call_start     { session_id, timestamp, tool_name }
event: tool_call_end       { session_id, timestamp, tool_name, status, duration_ms }
event: retry_start         { session_id, timestamp, retry_reason, attempt_number }
event: retry_end           { session_id, timestamp, status }
event: user_input_requested { session_id, timestamp, input_type }
event: user_input_received { session_id, timestamp }
event: steering_event      { session_id, timestamp }
event: error               { session_id, timestamp, error_type, is_fatal }
event: task_complete       { session_id, timestamp, completion_type }
event: user_cancel         { session_id, timestamp, current_state }
event: session_end         { session_id, timestamp, end_reason }
```

## Appendix B: Open Questions for Paper Discussion

1. **Stall detection threshold.** For L1 (client-only) observation, how long must the output stream pause before we declare a Stalled state? Too short (200ms) and normal model generation gaps trigger false stalls. Too long (5s) and real stalls are under-counted. This likely needs empirical calibration (Paper-1 territory) but Paper-0 should propose a default and justify it.

2. **Steering event detection.** Identifying when a user message is a "correction" vs. a "continuation" is non-trivial without semantic analysis. For L1 instrumentation, simple heuristics (message starts with "no", "actually", "I meant") may suffice. For L2, the framework could expose a `user_interrupt` vs. `user_continue` signal. Paper-0 should acknowledge this ambiguity.

3. **Multi-agent sessions.** When Agent A delegates to Agent B, is that a tool call (Stalled) or a nested session? Paper-0 should define the boundary: if the sub-agent's output is not streamed to the user, it is a tool call. If it is, it is a nested session with its own state machine instance. This composability property should be stated.

4. **Composite score (AXS).** Now formalized in METRICS-4 below. See §4.1–4.9.

---

## METRICS-3: Diagnostic Dimensions

### 3.1 Purpose

Metrics answer *how well*. Dimensions answer *why* and *where*. A diagnostic dimension is a categorical or ordinal attribute attached to every metric observation that enables slicing, filtering, and root-cause analysis. Without dimensions, a drop in start-success rate is an alarm; with dimensions, it becomes "start failure rate for Claude 3.5 Sonnet on multi-turn coding tasks via the VS Code extension rose 12% after the 2024-11-15 model update."

The dimension system serves three roles:

1. **Fault isolation** — narrow a quality regression to a specific model, tool, or interface.
2. **Cohort comparison** — compare quality across agent frameworks, task types, or user segments.
3. **Weight moderation** — certain dimensions change which metrics matter most (see §3.4).

Zhang never formalized a dimension system — his paper sliced by content type (Short VoD, Long VoD, Live) and CDN but did not systematize the concept. Conviva later operationalized slicing across hundreds of dimensions (ISP, device, geography, CDN, content) as the core of their product. We adopt Conviva's spirit while defining a dimension taxonomy specific to agents.

### 3.2 Dimension Catalog

#### 3.2.1 Core Dimensions

Core dimensions are always present in any instrumented agent system. They require no special integration beyond standard request metadata.

##### D1: Agent

| Attribute | Value |
|-----------|-------|
| **Description** | Identifies the agent software producing the experience. |
| **Sub-attributes** | `{agent_name, agent_version, agent_framework}` |
| **Values** | Open enumeration — e.g., `("Claude Code", "1.2.3", "Anthropic Agent SDK")`, `("Cursor Tab", "0.45", "Cursor")`, `("Devin", "2.1", "Cognition")`. |
| **Cardinality** | Medium (~10s of agents × ~100s of versions in a large deployment). |
| **Observable from** | User-agent string, SDK metadata, agent self-report at session start. |
| **Example slices** | "Stall ratio by agent framework", "Start failure rate for Claude Code v1.2 vs v1.3", "AXS trend by agent_name over the past 30 days". |

##### D2: Model

| Attribute | Value |
|-----------|-------|
| **Description** | The LLM(s) serving inference for the agent. Captures provider, model ID, and position in the fallback chain. |
| **Sub-attributes** | `{provider, model_id, fallback_position}` |
| **Values** | Open enumeration — e.g., `("Anthropic", "claude-opus-4-20250514", 0)`, `("OpenAI", "gpt-4o", 1)`. `fallback_position` = 0 for primary, 1+ for fallbacks. |
| **Cardinality** | Medium (~10s of providers × ~100s of model versions). |
| **Observable from** | API request headers, model routing logs, agent configuration. |
| **Example slices** | "TTFR by model provider", "Start failure rate when falling back from Opus to Sonnet", "Delivery Quality delta between GPT-4o and Claude Sonnet on coding tasks". |

##### D3: Interface

| Attribute | Value |
|-----------|-------|
| **Description** | The surface through which the user interacts with the agent. |
| **Sub-attributes** | `{interface_type}` |
| **Values** | Controlled enumeration: `{CLI, IDE_extension, web_chat, API_direct, mobile, embedded, voice}`. |
| **Cardinality** | Low (< 10 categories). |
| **Observable from** | Client type header, SDK client identifier, session metadata. |
| **Example slices** | "Start failure rate CLI vs IDE", "Interaction flow score by interface type", "Abandonment rate on mobile vs web_chat". |

##### D4: Task

| Attribute | Value |
|-----------|-------|
| **Description** | What the user asked the agent to do. This is the most analytically important dimension — the equivalent of "content" in video. |
| **Sub-attributes** | `{task_category, complexity_tier}` |
| **Values** | **task_category** — controlled enumeration: `{code_generation, code_review, debugging, refactoring, Q&A, data_analysis, writing, research, multi_step_workflow, system_administration, other}`. **complexity_tier** — ordinal: `{trivial, simple, moderate, complex, heroic}`, operationally defined by expected tool calls (0, 1-3, 4-10, 11-30, 30+) and expected turns (1, 1-3, 4-10, 11-30, 30+). |
| **Cardinality** | Medium (11 categories × 5 tiers = 55 cells, but distribution is heavy-tailed). |
| **Observable from** | Intent classifier on first user message (keyword + heuristic sufficient for v1), retrospective labeling from tool-call patterns, user-supplied tags. |
| **Example slices** | "Task completion rate for debugging vs code_generation", "Stall ratio by complexity tier", "AXS for heroic tasks over time". |

##### D5: Session Type

| Attribute | Value |
|-----------|-------|
| **Description** | The interaction pattern of the session. |
| **Sub-attributes** | `{session_mode}` |
| **Values** | Controlled enumeration: `{single_turn, multi_turn_interactive, multi_turn_autonomous, background_batch}`. |
| **Cardinality** | Low (4 values). |
| **Observable from** | Turn count, presence of user messages after first, autonomy flags in agent config, batch-job markers. |
| **Example slices** | "Stall freedom for autonomous vs interactive sessions", "TTFR distribution by session type". |

#### 3.2.2 Extended Dimensions

Extended dimensions require deeper instrumentation or integration with specific infrastructure.

##### D6: Tool

| Attribute | Value |
|-----------|-------|
| **Description** | The external tools invoked by the agent during the session. Multi-valued per session (an agent may use many tools). |
| **Sub-attributes** | `{tool_name, tool_provider, mcp_server, tool_category}` |
| **Values** | **tool_name**: open enumeration — e.g., `"Bash"`, `"Read"`, `"web_search"`. **tool_provider**: open enumeration — e.g., `"built-in"`, `"Tavily"`, `"GitHub"`. **mcp_server**: nullable string (MCP server ID, if applicable). **tool_category**: controlled enumeration — `{execution, retrieval, file_system, communication, code_analysis, browser, other}`. |
| **Cardinality** | High (unbounded tool names, ~10s of providers, ~10 categories). |
| **Observable from** | Tool-call lifecycle events (`tool_call_start`, `tool_call_end`), MCP server registration metadata, function-call metadata in LLM API responses. |
| **Example slices** | "Stall duration distribution by tool_name", "Tool success rate by MCP server", "Start failure rate when Bash tool is the first tool invoked". |

##### D7: Context

| Attribute | Value |
|-----------|-------|
| **Description** | The state of the agent's context window — how much capacity is used and whether compaction or summarization occurred. |
| **Sub-attributes** | `{window_utilization_pct, compaction_event_count, context_source_types}` |
| **Values** | **window_utilization_pct**: continuous 0-100 (bin into quartiles for practical slicing: 0-25, 25-50, 50-75, 75-100). **compaction_event_count**: integer >= 0. **context_source_types**: set from `{user_message, file_content, tool_output, system_prompt, retrieved_docs}`. |
| **Cardinality** | High (continuous + combinatorial). Binned cardinality is manageable. |
| **Observable from** | Token counter on prompt assembly, compaction/summarization event logs, context manager metadata. |
| **Example slices** | "Delivery Quality Score when context > 75% utilized", "Turn-over-Turn Coherence after compaction events", "Stall ratio by context utilization quartile". |

##### D8: User

| Attribute | Value |
|-----------|-------|
| **Description** | Attributes of the human user. Useful for segment-level quality assurance, analogous to Conviva's CDN/geography slicing. |
| **Sub-attributes** | `{user_segment, geography, plan_tier}` |
| **Values** | **user_segment**: organization-defined — e.g., `"enterprise"`, `"startup"`, `"individual"`. **geography**: ISO region — e.g., `"US-West"`, `"EU-West"`, `"APAC"`. **plan_tier**: open — e.g., `"free"`, `"pro"`, `"team"`, `"enterprise"`. |
| **Cardinality** | Medium (segments × geographies × tiers). |
| **Observable from** | Account metadata, IP geolocation, billing system. |
| **Example slices** | "TTFR by geography (latency-sensitive)", "Start failure rate free-tier vs pro-tier", "AXS by user_segment". |

#### 3.2.3 Derived Dimensions

Derived dimensions are computed from raw dimensions or from metric values. They do not exist in raw telemetry.

##### D9: Agent Content Type (the moderating variable — see §3.4)

| Attribute | Value |
|-----------|-------|
| **Description** | A composite classification of the "kind of agent experience," analogous to Zhang's Short VoD / Long VoD / Live distinction. Computed from Session Type × Task Complexity × observed interaction patterns. |
| **Sub-attributes** | `{content_type}` |
| **Values** | Controlled enumeration: `{quick_answer, guided_task, deep_session, autonomous_workflow}` (full definitions in §3.4). |
| **Cardinality** | Low (4 values). |
| **Observable from** | Derived at session close (or estimated mid-session) from D4 `complexity_tier`, D5 `session_mode`, turn count, tool-call count, and session duration. |
| **Example slices** | "AXS by content type", "Which metric dominates AXS variance for deep_session vs quick_answer". |

##### D10: Quality Regime

| Attribute | Value |
|-----------|-------|
| **Description** | Whether the session operated in a normal, degraded, or failed regime. Computed from metric values against SLO thresholds. |
| **Sub-attributes** | `{regime}` |
| **Values** | `{nominal, degraded, failed}`. Thresholds defined per-metric — e.g., TTFR > 10s → degraded; start failure → failed; stall ratio > 15% → degraded. |
| **Cardinality** | Low (3 values). |
| **Observable from** | Real-time metric evaluation against SLO thresholds. |
| **Example slices** | "% sessions in degraded regime by model provider", "Mean time spent in degraded before recovery or failure". |

##### D11: Error Class

| Attribute | Value |
|-----------|-------|
| **Description** | The category of error when a session enters the Failed state or a Stalled episode fails. Enables root-cause clustering. |
| **Sub-attributes** | `{error_class, error_source}` |
| **Values** | **error_class**: controlled enumeration — `{auth_failure, rate_limit, timeout, context_overflow, tool_crash, model_error, network_error, user_abort, unknown}`. **error_source**: `{model_provider, tool_provider, agent_framework, client, infrastructure}`. |
| **Cardinality** | Low-Medium (9 classes × 5 sources = 45 cells). |
| **Observable from** | Error events in the event stream, mapped via error code taxonomy. |
| **Example slices** | "Start failure rate by error_class", "Rate-limit stalls by model provider over time". |

### 3.3 Dimension Classification Summary

| ID | Name | Class | Cardinality | Always Available? | Key Sub-attributes |
|----|------|-------|-------------|-------------------|--------------------|
| D1 | Agent | Core | Medium | Yes | agent_name, agent_version, agent_framework |
| D2 | Model | Core | Medium | Yes | provider, model_id, fallback_position |
| D3 | Interface | Core | Low | Yes | interface_type |
| D4 | Task | Core | Medium | Yes (with classifier) | task_category, complexity_tier |
| D5 | Session Type | Core | Low | Yes | session_mode |
| D6 | Tool | Extended | High | With tool-call logging | tool_name, tool_provider, mcp_server, tool_category |
| D7 | Context | Extended | High | With context manager | window_utilization_pct, compaction_event_count |
| D8 | User | Extended | Medium | With account system | user_segment, geography, plan_tier |
| D9 | Content Type | Derived | Low | Computed post-hoc | content_type |
| D10 | Quality Regime | Derived | Low | Computed from metrics | regime |
| D11 | Error Class | Derived | Low-Medium | Computed from error events | error_class, error_source |

### 3.4 The Moderating Variable: Agent Content Types

Zhang's key insight was that video "content type" (Short VoD, Long VoD, Live) fundamentally changed user expectations and therefore changed which metrics mattered most. A 2-second rebuffer during live sports is a crisis; during a 2-hour movie, it is a minor irritant. The content type moderated the relationship between quality metrics and user engagement (abandonment, return rate).

We need the same concept for agent experiences. **Agent Content Types** define qualitatively different modes of interaction where user expectations — and therefore metric weights — shift. This is not merely a convenience for reporting; it is a structural feature of the metric framework. Reporting AXS without conditioning on content type is like reporting video quality without distinguishing live from VoD — the number is technically correct but analytically meaningless.

#### Quick Answer (`quick_answer`)
- **Definition**: Single-turn or very short multi-turn interaction. User expects a fast, direct response. Typically 0-2 tool calls, 1-2 turns, < 30 seconds total.
- **Classification rule**: `complexity_tier ∈ {trivial, simple}` AND `turn_count ≤ 2` AND `tool_call_count ≤ 2`.
- **Zhang analog**: Short VoD.
- **Dominant quality factors**: TTFR, start failure rate, Delivery Quality Score (correctness of the single response).
- **Tolerated**: No progress visibility needed; minimal tool use.
- **Example**: "What does this error mean?", "Convert this JSON to YAML."

#### Guided Task (`guided_task`)
- **Definition**: Multi-turn interactive session where user and agent collaborate toward a goal. Typically 3-15 turns, 3-20 tool calls, 1-15 minutes. User stays engaged and provides feedback.
- **Classification rule**: `session_mode = multi_turn_interactive` AND `complexity_tier ∈ {simple, moderate, complex}` AND `3 ≤ turn_count ≤ 15`.
- **Zhang analog**: Long VoD (user expects to invest time but wants smooth playback throughout).
- **Dominant quality factors**: Stall ratio and stall frequency (flow disruption is most salient), Interaction Overhead Ratio (is the agent asking too many questions?), Task Completion Rate.
- **Tolerated**: Moderate per-turn latency if progress is visible. Some tool-call stalls are expected and acceptable.
- **Example**: "Help me refactor this module to use dependency injection."

#### Deep Session (`deep_session`)
- **Definition**: Extended multi-turn session with high complexity. 15-50+ turns, 20-100+ tool calls, 15-60+ minutes. User is deeply invested; abandonment cost is high.
- **Classification rule**: `complexity_tier ∈ {complex, heroic}` AND `turn_count ≥ 15` AND `tool_call_count ≥ 20`.
- **Zhang analog**: Live content (any disruption is acutely felt because the user is in a flow state; the session cannot be "rewound").
- **Dominant quality factors**: Stall freedom (mid-session failures are catastrophic — the user has invested 20+ minutes), Turn-over-Turn Coherence (quality degradation over a long session is the deep-session-specific pathology), Resolution (did we actually finish after all that time?).
- **Tolerated**: Higher initial latency if the agent demonstrates competence early. More tool calls expected and accepted.
- **Example**: "Implement the authentication system across these 12 files."

#### Autonomous Workflow (`autonomous_workflow`)
- **Definition**: Agent operates with minimal or no user interaction after the initial instruction. May run for minutes to hours. User checks back for results.
- **Classification rule**: `session_mode ∈ {multi_turn_autonomous, background_batch}`.
- **Zhang analog**: No direct parallel. Closest is a DVR recording (user cares about the result, not the journey) or a batch transcoding job.
- **Dominant quality factors**: Task Completion Rate and Delivery Quality Score (outcome is everything), Start Failure Rate (did it even begin?), Token Efficiency Ratio (cost matters when running unattended).
- **Tolerated**: High latency, many tool calls, long runtime — all acceptable if the outcome is correct.
- **Example**: "Run the full test suite, fix all failures, and open a PR."

#### Content Type Weight Modifiers (Qualitative)

The following table shows how content type shifts relative metric importance. Formal weight parameterization appears in METRICS-4 §4.5.

| Metric Domain | quick_answer | guided_task | deep_session | autonomous_workflow |
|---------------|:---:|:---:|:---:|:---:|
| Initiation (TTFR, Start Failure) | ★★★ | ★★ | ★★ | ★★★ |
| Progress (Stall Ratio, Stall Freq) | ★ | ★★★ | ★★★ | ★ |
| Interaction (Flow, Overhead) | ★ | ★★★ | ★★ | ★ |
| Delivery (Quality, Fidelity) | ★★★ | ★★ | ★★ | ★★★ |
| Resolution (Completion, Coherence) | ★★ | ★★ | ★★★ | ★★★ |

*(★ = low relative importance, ★★ = moderate, ★★★ = high)*

### 3.5 Dimension Interaction Patterns

Some dimensions interact in ways that affect analysis. Failing to account for these leads to Simpson's Paradox effects or misattributed root causes.

1. **Model × Task** (confounding): Model quality varies dramatically by task category. A model that excels at Q&A may struggle at multi-step debugging. Always cross-slice these two dimensions together before drawing conclusions.

2. **Interface × Session Type** (confounding): CLI users skew toward deep sessions; web chat users skew toward quick answers. Comparing AXS across interfaces without controlling for session type mix will produce misleading results. Report conditional distributions.

3. **Tool × Context** (causal chain): Heavy tool use fills the context window. Tool-rich sessions disproportionately trigger compaction, which may degrade Turn-over-Turn Coherence. This is a causal chain (Tool → Context pressure → Coherence degradation), not merely a correlation. Dimensional analysis should follow the chain, not just report the endpoints.

4. **Content Type × everything** (stratification): Content type is the primary stratification variable. Report all top-level metrics broken down by content type *before* any other slice. This mirrors Zhang's practice of always reporting metrics separately by content type first.

5. **Model × Error Class** (diagnostic): When Start Failure Rate spikes, the first diagnostic slice is Model × Error Class. This tells you whether the failures are rate limits from one provider, auth errors from another, or context overflows from a specific model's token limit.

6. **User × Interface × Geography** (latency attribution): TTFR varies with geography (network latency to model provider) and interface (web chat adds rendering overhead vs. CLI's direct stream). Slice all three together to separate infrastructure latency from agent latency.

### 3.6 Dimension Governance

To prevent dimension explosion (a real operational risk — Conviva reportedly tracks 200+ dimension combinations), we propose the following governance rules:

1. **Core dimensions are mandatory.** Every metric observation carries D1-D5 as labels. No exceptions.
2. **Extended dimensions are opt-in.** They are captured when the instrumentation is available but do not gate metric computation.
3. **Derived dimensions are computed in the analysis layer**, not at collection time. This avoids retroactive classification errors — if the content type classification rule changes, you can re-derive without re-collecting.
4. **Cardinality limits.** Any dimension with cardinality > 1000 distinct values must be binned or aggregated before use in dashboards. The raw high-cardinality values remain available for ad-hoc drill-down.
5. **New dimensions require a schema review.** Adding a dimension to the core set is a breaking change (it changes what every observation must carry). Extended dimensions can be added freely.

---

## METRICS-4: AXS — Agent Experience Score

### 4.1 Philosophy: What a Composite Score Must Do

A composite score collapses a multi-dimensional quality space into a single number. This is inherently lossy. The question is not whether information is lost — it always is — but whether the compression is useful enough to justify the loss.

**The gain is real.** Organizations need a single indicator to answer: "Is agent experience getting better or worse?" Without it, teams drown in dashboards. Conviva built a business on this insight. Apdex (Application Performance Index) succeeded in web monitoring not because it was technically sophisticated — it is crude — but because it gave executives a number they could track weekly and set targets against. MOS (Mean Opinion Score) unified decades of telephony quality research into a 1-5 scale that every telecom engineer understands.

**The loss is also real.** VMAF (Video Multi-Method Assessment Fusion) demonstrated that a single score can mask component failures: a video with perfect color but stuttering playback can score the same as one with smooth playback but washed-out color. Netflix addressed this by training VMAF on subjective quality data, but the masking problem persists for novel distortion types outside the training distribution.

**Our position**: AXS is an *executive metric*, not a diagnostic metric. It answers "how good?" and "is it trending up or down?" It does not answer "why?" — that is what the dimension system (METRICS-3) and the individual phase metrics (METRICS-2) are for. AXS earns its place by being the single number printed at the top of every quality report, the number that triggers investigation when it drops. It is the agent equivalent of Conviva's Experience Score or Netflix's VMAF.

**Design principles for AXS:**

| # | Principle | Implication |
|---|-----------|-------------|
| P1 | **Interpretable scale** | A human should develop intuition for what "AXS 85" means without a reference card. |
| P2 | **Sensitive to real degradation** | A model update that increases stalls by 20% must visibly move AXS. |
| P3 | **Resistant to gaming** | Optimizing AXS should require genuinely improving the experience, not manipulating one cheap component. |
| P4 | **Content-type-aware** | AXS weights shift by Agent Content Type (§3.4). |
| P5 | **Decomposable** | You can always drill from AXS into its component sub-scores. |
| P6 | **Open formula** | The formula, weights, and thresholds are published. No proprietary black box. |

### 4.2 Score Architecture: Gated Multiplicative-Additive Hybrid

AXS uses a **gated multiplicative-additive hybrid** structure. This design choice is deliberate and requires justification.

**Why not a pure weighted sum?** `AXS = w₁·S₁ + w₂·S₂ + ...` allows a catastrophic failure in one component to be masked by excellence in others. An agent that never starts (S_start = 0) but has "excellent" delivery quality on the sessions that somehow work could still score 60+. This is nonsensical — a user who cannot start the agent has zero experience quality. Weighted sums are compensatory by construction; agent quality has non-compensatory failure modes.

**Why not a pure multiplicative model?** `AXS = S₁ · S₂ · S₃ · S₄ · S₅` (each on 0-1) is too punitive. If any component is 0, AXS is 0 — which is correct for Start Failure but too harsh for a minor interaction flow hiccup. It also compresses the scale: 0.8⁵ = 0.33, which maps poorly to human intuition on a 0-100 scale.

**Why a gated hybrid?** The agent experience has a clear hierarchical structure:

1. **Prerequisite layer** (must be non-zero): Can the agent start? Does it resolve the task? If either fails, quality is zero regardless of how smooth the middle was.
2. **Quality layer** (continuous, compensatory): Given that the agent starts and resolves, how smooth, fast, and reliable was the experience?

This maps naturally to a gate (multiplicative, non-compensatory) on the prerequisites and a weighted sum (additive, compensatory) on the quality factors.

#### Formula

```
AXS = G × Q × 100
```

Where:
- **G** (Gate Score, 0-1): captures prerequisite quality requirements that can veto the entire experience.
- **Q** (Quality Score, 0-1): captures continuous quality dimensions in a weighted sum.
- **100**: scales to a 0-100 range for interpretability.

#### Gate Score (G)

```
G = S_start^α × S_res^β
```

- **S_start** (Start Success Score, 0-1): At session level, binary (0 or 1). At cohort level (the reporting level for AXS), equals the start success rate across sessions.
- **S_res** (Resolution Score, 0-1): A composite of resolution metrics (see §4.3). Continuous at both session and cohort levels.
- **α** (start gate exponent): Controls how aggressively start failure pulls down AXS. Default: **α = 1.0** (linear gate — each 1% drop in start success causes ~1% drop in AXS).
- **β** (resolution gate exponent): Controls resolution gate sensitivity. Default: **β = 0.8** (slightly softened — partial resolution still delivers some value).

**Rationale for gating on Start Success and Resolution**: These are the *bookends* of the experience. If you cannot start, nothing else matters. If you do not resolve, the effort was wasted. This mirrors Zhang's finding that join failures and premature exits dominate quality impact — the video analogues of our bookends. By making them gates rather than weighted-sum components, we ensure that no amount of smooth mid-session quality can compensate for an inability to start or finish.

#### Quality Score (Q)

```
Q = w₁·S_stall + w₂·S_del + w₃·S_flow
```

- **S_stall** (Stall Freedom Score, 0-1): How free was the session from unexpected interruptions?
- **S_del** (Delivery Quality Score, 0-1): How well did the agent's tool calls and outputs perform?
- **S_flow** (Interaction Flow Score, 0-1): How smooth was the turn-by-turn experience?

Default weights (for `guided_task` content type):

| Component | Symbol | Weight | Rationale |
|-----------|--------|--------|-----------|
| Stall Freedom | w₁ | **0.40** | Stalls are the most salient negative experience. Users tolerate slowness but not hangs. Zhang found buffering ratio was the #1 predictor of abandonment. This is our highest-weight quality factor. |
| Delivery Quality | w₂ | **0.35** | Tool failures and incorrect outputs directly undermine trust and require rework. |
| Interaction Flow | w₃ | **0.25** | Latency and streaming smoothness matter, but are less catastrophic than stalls or errors. Users adapt to consistent (even if slow) response times. |

Constraint: w₁ + w₂ + w₃ = 1.0.

### 4.3 Phase Sub-Score Definitions

Each sub-score maps to underlying metrics from METRICS-2. The formulas below specify how raw metrics compress into 0-1 sub-scores.

#### S_start (Start Success Score)

**Session level:**
```
S_start = 1  if Starting → Working transition occurred
S_start = 0  if Starting → Failed or Starting → Ended (abandon)
```

**Cohort level (for AXS reporting):**
```
S_start = start_success_rate × (1 - λ × fraction_slow_starts)
```

where:
- `start_success_rate` = (sessions reaching Working) / (total sessions)
- `fraction_slow_starts` = (successful starts with TTFR > TTFR_SLO) / (successful starts)
- `TTFR_SLO` = 10 seconds (configurable; proposed default based on web UX research showing 10s as the attention limit)
- **λ = 0.3** — slow starts are bad but not as bad as failures. A cohort where every start succeeds but 50% are slow would score 0.85, not 1.0.

#### S_stall (Stall Freedom Score)

```
S_stall_base = 1 - clamp(stall_ratio / stall_ratio_max, 0, 1)
S_stall = S_stall_base × (1 - μ × clamp(stall_count / stall_count_max, 0, 1))
```

where:
- `stall_ratio` = time in Stalled / (time in Working + Stalled), from metric 2.1
- `stall_ratio_max` = **0.20** — a session that is 20%+ stalled scores 0 on the base component
- `stall_count` = number of Working → Stalled transitions, from metric 2.2
- `stall_count_max` = **10** — more than 10 stalls per session saturates the penalty
- **μ = 0.3** — the stall-count penalty is secondary to the stall-ratio penalty

**Design note**: The multiplicative structure for stall count means that many short stalls (same total ratio but high count) score worse than one long stall. This is intentional — each stall breaks user attention, and attention restoration has a fixed cost regardless of stall duration. This mirrors Zhang's finding that rebuffering frequency has an independent negative effect beyond rebuffering ratio.

#### S_del (Delivery Quality Score)

```
S_del = γ₁·tool_success_rate + γ₂·first_attempt_correctness + γ₃·(1 - error_recovery_failure_rate)
```

| Parameter | Value | Source Metric |
|-----------|-------|---------------|
| γ₁ | 0.40 | Derived from tool_call_end events with status=success / total tool calls |
| γ₂ | 0.35 | First-Attempt Success Rate (metric 4.2) — fraction of sessions with no steering events and task_complete |
| γ₃ | 0.25 | 1 - (failed error recoveries / total error recovery attempts) |

**Note on first_attempt_correctness**: At L4 observability (requires evaluation judge), this can be replaced with the full Delivery Quality Score (metric 4.3). At L2, we use the proxy of no-steering-events as an imperfect but instrumentable measure of getting-it-right-the-first-time.

#### S_flow (Interaction Flow Score)

```
S_flow = δ₁·latency_score + δ₂·streaming_score + δ₃·responsiveness_score
```

where:
- `latency_score` = 1 - clamp(median_TTFR / TTFR_max, 0, 1), with **TTFR_max = 15s**
- `streaming_score` = 1 - clamp(token_gap_ratio, 0, 1), measuring streaming smoothness (fraction of output time with gaps > 500ms between token chunks)
- `responsiveness_score` = 1 - clamp(median_inter_turn_latency / ITL_max, 0, 1), with **ITL_max = 30s**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| δ₁ | 0.40 | First-response latency sets the tone for the entire interaction |
| δ₂ | 0.25 | Streaming smoothness matters for perceived responsiveness but is less impactful than overall latency |
| δ₃ | 0.35 | Inter-turn latency compounds over multi-turn sessions |

#### S_res (Resolution Score)

```
S_res = ε₁·task_completion_rate + ε₂·resolution_quality + ε₃·(1 - abandonment_rate)
```

| Parameter | Value | Source |
|-----------|-------|--------|
| ε₁ | 0.45 | Task Completion Rate (metric 4.1) — the headline resolution number |
| ε₂ | 0.35 | Delivery Quality Score (metric 4.3) — partial vs full resolution quality. At L2, approximate with (1 - Partial Delivery Rate) |
| ε₃ | 0.20 | 1 - Abandonment Rate (metric 5.5) — sessions the user gave up on signal failed experience even without explicit error |

### 4.4 Scale and Interpretation

AXS runs from 0 to 100. The scale is designed so that the distribution of real-world scores clusters meaningfully around interpretable ranges.

| AXS Range | Label | Interpretation | Action Trigger |
|-----------|-------|----------------|----------------|
| 90-100 | **Excellent** | Agent starts reliably, resolves tasks consistently, interactions are smooth. Comparable to a senior engineer pair-programming with you. | None — maintain. |
| 75-89 | **Good** | Occasional hiccups — a retry here, a slow response there — but the agent delivers clear value. Users are satisfied and return. | Monitor for trends. |
| 50-74 | **Fair** | Noticeable quality issues. Frequent stalls, partial resolutions, or inconsistent tool use. Users succeed but with friction. | Investigate. Drill into sub-scores and dimensions. |
| 25-49 | **Poor** | Significant quality problems. Many sessions fail to resolve, stalls are common, users frequently abandon. Trust erodes. | Urgent. Identify root cause within 24 hours. |
| 0-24 | **Failing** | The agent is not functional for its intended purpose. Start failures, cascading errors, or near-total inability to resolve. | Critical. Incident response. Consider rollback. |

**Calibration anchor**: An AXS of 75 should correspond approximately to "a user who tried the agent would use it again tomorrow." This is analogous to:
- Apdex 0.85 ("satisfied" threshold)
- MOS 3.5 ("fair-to-good" boundary)
- VMAF 80 (Netflix's "good quality" threshold for encoding decisions)

We propose validating this anchor empirically in Paper-1 by correlating AXS with Return Rate (metric 5.7) and Net Satisfaction (metric 5.8).

### 4.5 Content-Type Weight Adaptation

AXS weights shift by Agent Content Type (§3.4). The gate exponents and quality weights are parameterized per content type.

| Parameter | quick_answer | guided_task | deep_session | autonomous_workflow |
|-----------|:---:|:---:|:---:|:---:|
| α (start gate exponent) | 1.0 | 1.0 | 1.0 | 1.0 |
| β (resolution gate exponent) | 1.0 | 0.8 | 0.9 | 1.0 |
| w₁ (stall freedom) | 0.20 | 0.40 | 0.45 | 0.15 |
| w₂ (delivery quality) | 0.30 | 0.35 | 0.35 | 0.50 |
| w₃ (interaction flow) | 0.50 | 0.25 | 0.20 | 0.35 |

**Rationale for each profile:**

**quick_answer** — Interaction flow dominates (w₃ = 0.50) because the user cares about speed above all else for a simple question. Resolution gate is hard (β = 1.0) because failing to answer a trivial question is unacceptable — there is no "partial credit" for quick answers. Stall freedom weight is lowest (w₁ = 0.20) because the session is too short for stalls to accumulate meaningfully.

**guided_task** — The balanced default profile. Stall freedom is highest quality weight (w₁ = 0.40) because multi-turn collaboration is destroyed by hangs — each stall breaks the user's problem-solving flow state. Resolution gate is softened (β = 0.8) because partial resolution during collaboration still has value: the user can pick up where the agent left off, and the collaborative context is itself valuable.

**deep_session** — Stall freedom has its highest weight of any content type (w₁ = 0.45). A hang at turn 30 of a 40-turn session is devastating — the user has invested significant time and cannot easily restart. Resolution gate is tightened from guided_task (β = 0.9) because the time investment makes non-resolution more costly. Interaction flow weight is lowest (w₃ = 0.20) because the user has already committed to the session; per-turn latency matters less than cumulative progress.

**autonomous_workflow** — Delivery quality dominates (w₂ = 0.50) because the agent is unsupervised; every tool call and decision must be correct since there is no human to catch mistakes mid-stream. Interaction flow weight is moderate (w₃ = 0.35) despite low interactivity — this captures the quality of the final output delivery and any status check-in interactions. Stall freedom is lowest (w₁ = 0.15) because the user is not watching in real-time; stalls only matter insofar as they extend total runtime.

**Aggregate AXS**: When reporting AXS across a mixed workload, compute the content-type-specific AXS for each session using the appropriate weight profile, then average. Do not apply a single weight profile to the aggregate — this would distort the score for every content type. Formally:

```
AXS_aggregate = (1/N) × Σᵢ AXSᵢ(content_typeᵢ)
```

where AXSᵢ uses the weight profile for session i's content type.

### 4.6 Worked Example

Consider a cohort of 1,000 `guided_task` sessions over one week:

| Input Metric | Value |
|--------------|-------|
| Start success rate | 0.96 |
| Fraction slow starts (TTFR > 10s) | 0.10 |
| Stall ratio (cohort mean) | 0.08 |
| Stall count (cohort mean) | 3.2 |
| Tool success rate | 0.89 |
| First-attempt correctness | 0.72 |
| Error recovery failure rate | 0.15 |
| Median TTFR | 3.5s |
| Token gap ratio | 0.12 |
| Median inter-turn latency | 8s |
| Task completion rate | 0.81 |
| Resolution quality proxy | 0.74 |
| Abandonment rate | 0.12 |

**Step 1: Compute sub-scores**

S_start:
```
S_start = 0.96 × (1 - 0.3 × 0.10) = 0.96 × 0.97 = 0.931
```

S_stall:
```
S_stall_base = 1 - (0.08 / 0.20) = 1 - 0.40 = 0.600
S_stall = 0.600 × (1 - 0.3 × (3.2 / 10)) = 0.600 × 0.904 = 0.542
```

S_del:
```
S_del = 0.40×0.89 + 0.35×0.72 + 0.25×(1-0.15)
      = 0.356 + 0.252 + 0.213 = 0.821
```

S_flow:
```
latency_score = 1 - (3.5/15.0) = 0.767
streaming_score = 1 - 0.12 = 0.880
responsiveness_score = 1 - (8.0/30.0) = 0.733
S_flow = 0.40×0.767 + 0.25×0.880 + 0.35×0.733
       = 0.307 + 0.220 + 0.257 = 0.784
```

S_res:
```
S_res = 0.45×0.81 + 0.35×0.74 + 0.20×(1-0.12)
      = 0.365 + 0.259 + 0.176 = 0.800
```

**Step 2: Compute G and Q (guided_task weights: α=1.0, β=0.8)**

```
G = 0.931^1.0 × 0.800^0.8 = 0.931 × 0.842 = 0.784
Q = 0.40×0.542 + 0.35×0.821 + 0.25×0.784
  = 0.217 + 0.287 + 0.196 = 0.700
```

**Step 3: Compute AXS**

```
AXS = 0.784 × 0.700 × 100 = 54.9
```

**Interpretation**: AXS 54.9 falls in the "Fair" range. Decomposition reveals two actionable findings:

1. **Stall Freedom is the primary quality drag** (S_stall = 0.542). The 8% stall ratio with 3.2 stalls per session means users experience a stall roughly every 3 minutes of active work. The stall count penalty (μ term) further reduces the score because 3.2 stalls per session is well above the "barely noticeable" threshold. **Action**: investigate stall causes via D2 (Model) × D6 (Tool) × D11 (Error Class) dimensional slicing — likely tool timeouts or model latency spikes.

2. **The gate score (G = 0.784) caps the ceiling.** Even if quality were perfect (Q = 1.0), AXS could not exceed 78.4. The 4% start failure rate (S_start = 0.931) and 81% task completion rate (S_res = 0.800, gated at β=0.8) jointly suppress the maximum achievable score. **Action**: improve start reliability first (likely a model provider stability issue), then resolution rate.

3. **Interaction Flow is relatively healthy** (S_flow = 0.784). Median TTFR of 3.5s and inter-turn latency of 8s are adequate for guided tasks. This is not where to focus optimization effort.

### 4.7 Sensitivity Analysis

To understand how AXS responds to changes, we compute partial sensitivities around the worked-example operating point:

| Change | AXS Impact | Sensitivity |
|--------|------------|-------------|
| Start success rate 0.96 → 0.98 (+2pp) | 54.9 → 56.1 | +1.2 per 2pp improvement |
| Task completion rate 0.81 → 0.90 (+9pp) | 54.9 → 59.4 | +4.5 per 9pp improvement |
| Stall ratio 0.08 → 0.04 (halved) | 54.9 → 62.3 | +7.4 for halving stall ratio |
| Median TTFR 3.5s → 1.5s (-2s) | 54.9 → 56.0 | +1.1 for 2s TTFR reduction |
| All metrics at "good" level | ~82 | Target for "Good" range |

The largest lever is stall ratio — halving it yields +7.4 points, confirming that the w₁ = 0.40 weight for guided_task is driving the right optimization incentive. TTFR improvements yield modest gains, consistent with interaction flow's lower weight (w₃ = 0.25) for this content type.

### 4.8 Pitfalls and Mitigations

#### Pitfall 1: Goodhart's Law (Gaming)

**Risk**: Teams optimize the score rather than the experience. Example: improving start success by lowering the bar for what counts as "started" (emitting a placeholder response immediately) or improving task completion rate by having the agent claim completion prematurely.

**Mitigation**: The gated structure makes gaming harder — you cannot inflate Q to compensate for a low G, and the gate components (S_start, S_res) are harder to game because they have external validators (user actually receives output; task is actually completed). The Rework Rate (metric 4.4) serves as a "gaming detector" — if task completion rate is high but rework rate is also high, the agent is claiming false completion. Additionally, the sub-score decomposition is always published alongside AXS; anomalous component profiles (e.g., S_start = 0.99 but S_res = 0.40) are visible and flaggable.

#### Pitfall 2: Masking (Simpson's Paradox)

**Risk**: AXS is stable at the aggregate level while specific cohorts (e.g., `deep_session` on Claude Opus) are degrading, hidden by improvements in other cohorts.

**Mitigation**: Always report AXS broken down by content type and at least one core dimension. The dimension system (METRICS-3) exists specifically to prevent this. **Operational rule: never report aggregate AXS without at least one dimensional slice alongside it.**

#### Pitfall 3: Context-Dependence (Apples to Oranges)

**Risk**: Comparing AXS across fundamentally different workloads or organizations. "Our agent has AXS 80" is meaningless without knowing the content type mix, task complexity distribution, and threshold calibration.

**Mitigation**: Content-type-specific weights (§4.5) partially address within-organization comparison. For cross-organization comparison, we propose a **normalized AXS** that adjusts for content-type mix: `AXS_normalized = AXS_observed / AXS_expected(content_type_distribution)`. This is analogous to risk-adjusted returns in finance. Full specification deferred to Paper-1.

#### Pitfall 4: Threshold Sensitivity

**Risk**: The clamp/max parameters (stall_ratio_max = 0.20, TTFR_max = 15s, etc.) are design choices that affect score distribution. Poorly chosen thresholds can make the score insensitive to real changes or overly sensitive to noise.

**Mitigation**: Thresholds should be calibrated empirically from observed distributions (Paper-1). We propose setting thresholds at the **95th percentile of "acceptable" sessions**, where "acceptable" is identified via user satisfaction correlation. All thresholds are published as a named **configuration profile** (e.g., "AXS-v1-2026") so scores are reproducible and comparable across time and organizations. Changing thresholds produces a new version, never a retroactive rewrite.

#### Pitfall 5: Temporal Aggregation

**Risk**: Averaging AXS over a week hides within-week variance. A Tuesday outage that cratered quality to AXS 20 for 4 hours may barely dent the weekly average.

**Mitigation**: Report AXS at multiple temporal granularities: **real-time** (per-session), **hourly**, **daily**, **weekly**. Alert on hourly AXS drops exceeding a threshold (proposed default: > 15 points below trailing 24-hour average). The per-session AXS is always computable and stored; aggregation is a presentation choice, not a data-loss choice.

#### Pitfall 6: Cold Start and Low-N Cohorts

**Risk**: A cohort with 3 sessions has high AXS variance. Reporting "AXS for Claude Opus on heroic tasks via CLI" when there were 2 sessions this week is statistically meaningless.

**Mitigation**: Require a minimum sample size (proposed: N ≥ 30 sessions) before reporting AXS for any dimensional slice. For slices below the threshold, report "insufficient data" rather than a noisy number. This is standard practice in A/B testing and should carry over to quality monitoring.

### 4.9 Comparison to Industry Composite Scores

| Score | Domain | Structure | What Worked | What Didn't | Lesson for AXS |
|-------|--------|-----------|-------------|-------------|-----------------|
| **Apdex** | Web applications | Categorical: `(Satisfied + 0.5×Tolerating) / Total`, mapped to 0-1 | Dead simple. Any team can compute it. Universal adoption in APM tools (New Relic, Datadog). | Too crude — a 3s response and a 12s response are both "tolerating." Single-threshold bucketing loses information. No component decomposition. | Simplicity drives adoption. AXS should be simple to explain even if the formula is richer. But we need more gradient than Apdex's 3 buckets. |
| **MOS** | Voice telephony | 1-5 mean opinion score, often predicted algorithmically (PESQ, POLQA) | Grounded in subjective perception via large-scale listening tests. The 1-5 scale is universally understood. ITU standardization ensures reproducibility. | Expensive to calibrate (requires human tests). Algorithmic proxies (PESQ) can diverge from real MOS for novel codecs. Scale compression — most real-world scores fall in 3.0-4.5. | Ground AXS in user satisfaction data (Paper-1). Don't let the formula become disconnected from perceived quality. Use the full 0-100 range, not just a narrow band. |
| **VMAF** | Video streaming | Machine-learned fusion of VIF (visual information fidelity), DLM (detail loss metric), and temporal features. Trained on Netflix subjective quality dataset. | Best-in-class correlation with human perception of video quality. Content-adaptive. | Opaque — hard to explain why VMAF changed. Training data biases (mostly entertainment content; struggles with user-generated content and animation). Not decomposable into actionable sub-scores. | Transparency matters. AXS components must be individually interpretable. Avoid ML-learned weights until we have enough user satisfaction data (Paper-1+). Start with expert-defined weights; refine empirically. |
| **Conviva Experience Score** | Video streaming (operational) | Proprietary weighted composite of buffer ratio, bitrate, startup time, video start failures, and picture quality. | Real-time, at-scale operational use. Powers dashboards at every major streaming platform. Dimension slicing is the core value proposition. | Proprietary formula — cannot reproduce, validate, or compare. Weights are opaque and tuned per-customer. Lock-in risk. | **Publish the formula. Open the weights. Let the community validate and adapt.** This is our single strongest differentiator vs. a future proprietary "agent quality score" from a vendor. |

### 4.10 Open Questions for Paper-1 (Empirical Validation)

1. **Weight calibration**: The default weights proposed here are based on analogical reasoning from video QoE literature and domain intuition. Paper-1 should empirically derive weights via regression of AXS against user satisfaction signals (Return Rate, Net Satisfaction, retention).

2. **Gate exponent tuning**: Are α = 1.0 and β = 0.8 the right gate sensitivities? Empirical data on how start failures and non-resolution affect overall perceived quality will determine this. Specifically: does a 1% start failure rate feel twice as bad as a 1% non-resolution rate, or is the relationship non-linear?

3. **Content type boundaries**: The four content types and their classification rules are hypothesized. Cluster analysis on real session telemetry (using turn count, tool-call count, session duration, session mode) may reveal different natural groupings or different boundary thresholds.

4. **Threshold calibration**: All clamp/max parameters (stall_ratio_max, TTFR_max, ITL_max, stall_count_max, TTFR_SLO) need empirical grounding. The 95th-percentile-of-acceptable heuristic is a starting point. The values proposed here are educated guesses that should be replaced with data-driven values.

5. **Cross-domain validity**: Does AXS generalize across agent domains? A coding agent, a customer service agent, and a research agent have different task structures. The content type system may absorb this variance, or we may need domain-specific sub-score weights (a "domain" dimension beyond what D4 Task captures).

6. **Subjective validation**: Like MOS for voice and VMAF for video, AXS ultimately needs validation against human perception. Paper-1 should include a study where users rate their agent experience on a simple scale, and we measure the correlation between AXS and those ratings. Target: Pearson r ≥ 0.7 (comparable to early VMAF validation results).
