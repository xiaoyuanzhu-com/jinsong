# Measuring Agent Experience: A Quality Metrics Framework for AI Agents

**Abstract.** AI agents are rapidly becoming the primary interface through which knowledge workers interact with large language models --- yet the relationship between agent experience quality and user adoption remains unquantified. There is no shared vocabulary for what "quality" even means when a human collaborates with an AI agent across a multi-turn, tool-using session. We propose the Agent Experience (AX) framework, a formal metrics standard for measuring the quality of AI agent interactions. The framework comprises four contributions: (1) an agent session state machine with six states that captures the full lifecycle of an agent interaction, directly paralleling the player state machine that enabled video quality measurement; (2) a taxonomy of 29 metrics organized across five experience phases --- Initiation, Progress, Interaction, Delivery, and Resolution; (3) an 11-dimension diagnostic system that enables fault isolation and cohort comparison; and (4) the Agent Experience Score (AXS), a gated multiplicative-additive composite score that compresses multi-dimensional quality into a single actionable number. We ground every metric in observable events at the agent-framework boundary, classify each by observability level, and demonstrate the framework through worked examples spanning coding agents, customer support agents, and autonomous workflows. To the best of our knowledge, this is the first experience-centric metrics standard for AI agents. We release the framework as an open specification to serve as a foundation for empirical validation.

---

## 1. Introduction

AI agents --- software systems that use large language models to reason, plan, and act on behalf of users --- are reshaping how knowledge work is performed. The market for AI agent platforms is projected to reach $47 billion by 2030 (Markets and Markets, 2025). Enterprise adoption is accelerating: over 70% of Fortune 500 companies report deploying at least one AI agent in production workflows as of 2025 (McKinsey, 2025). Coding agents alone (Cursor, GitHub Copilot, Claude Code, Devin) serve millions of daily sessions in which developers delegate debugging, refactoring, and feature implementation to an AI collaborator. Customer support agents handle tens of millions of conversations per month. Research agents autonomously retrieve, synthesize, and summarize information across domains.

The economic stakes are substantial. Every failed agent session is a productivity loss. Every unnecessary stall is an attention break. Every abandoned interaction represents a user who tried AI-assisted work and chose to return to manual methods. Yet despite this scale, the industry lacks a shared language for agent experience quality. The vocabulary gap is striking: ask five engineering teams how they measure agent quality, and you will receive five incompatible answers --- token counts, eval scores, API latencies, thumbs-up rates, or simply "we don't."

This gap is not merely academic. Multiple stakeholders need --- and currently lack --- a standard:

- **Agent vendors** (Anthropic, OpenAI, Google, Cognition) need to benchmark their agents against competitors on dimensions that matter to users, not just model benchmarks.
- **Model providers** need to understand how model updates affect real agent interactions --- not synthetic evaluations, but the actual experience of a developer waiting for a code fix or a support agent resolving a ticket.
- **Enterprises** deploying agent fleets need operational dashboards that answer "is agent quality getting better or worse this week?" with the same rigor they apply to web application performance.
- **End users** need transparency: is this agent worth my time, or am I better off doing it myself?

The situation is analogous to video streaming circa 2010. Online video was enormous and growing, but quality measurement was fragmented. Every CDN tracked different metrics. Content providers measured buffering differently. There was no shared framework for connecting quality to engagement. Zhang et al.'s landmark study [3] changed this by formalizing a player state machine, deriving metrics from observable states, and demonstrating that specific quality metrics causally impacted viewer engagement. That work became the intellectual foundation for Conviva and, more broadly, for how the entire industry measures streaming quality today.

We argue that AI agents are at the same inflection point. The agent is the new player. The model is the new CDN. Tools are the new APIs. The user experience is the new engagement metric. What is missing is the measurement framework.

In this paper, we present the Agent Experience (AX) framework. Our contributions are:

1. **An agent session state machine** with six states (Starting, Working, Stalled, Waiting, Failed, Ended) that captures the full lifecycle of an agent interaction. The state machine is a strict superset of Zhang et al.'s player state machine, extended with a Waiting state to model the bidirectional interaction that distinguishes agents from passive media.

2. **A metrics taxonomy** of 29 quality metrics organized across five experience phases (Initiation, Progress, Interaction, Delivery, Resolution). Every metric is formally derived from states or transitions in the state machine, grounding the taxonomy in an observable, principled model rather than an ad hoc list.

3. **A diagnostic dimension system** of 11 dimensions (5 core, 3 extended, 3 derived) that enables slicing every metric by agent, model, interface, task type, session type, tool, context, user segment, content type, quality regime, and error class.

4. **The Agent Experience Score (AXS)**, a gated multiplicative-additive composite that compresses the 29 metrics into a single 0--100 number, with content-type-aware weight adaptation and an open, published formula.

The rest of this paper is organized as follows. Section 2 surveys related work and identifies the measurement gap. Section 3 presents the agent session state machine. Section 4 defines the metrics taxonomy. Section 5 introduces the diagnostic dimension system. Section 6 formalizes the AXS composite score. Section 7 walks through three illustrative examples. Section 8 discusses predictions, limitations, and future work. Section 9 concludes.

---

## 2. Background and Related Work

The landscape of AI agent monitoring is active but fragmented. We organize prior work into five categories and identify the gap that motivates our framework.

### 2.1 LLM Observability Tools

LangSmith [4], Langfuse [5], and similar platforms provide trace-level observability for LLM applications. LangSmith records trace trees (parent/child spans for chains, agents, tools, retrievers), per-step latency, token counts, cost estimates, and evaluation scores. Langfuse offers comparable functionality with open-source self-hosting and user-level session grouping. Both position themselves around developer workflows: "Debug, test, evaluate, and monitor LLM applications" (LangSmith); "Open-source LLM engineering platform" (Langfuse).

These tools are overwhelmingly implementation-focused. They know what the *system* did --- which tools were called, how many tokens were consumed, what the eval score was --- but not what the *user experienced*. Neither tool tracks time to first response as a user-experience metric, perceived throughput of the output stream, abandon-before-response events, task completion from the user's perspective, or any measure of user effort. Session grouping in Langfuse is the closest feature to user-journey tracking, but it carries no concept of session quality or experiential outcome.

### 2.2 APM with AI Extensions

Datadog LLM Observability [6] and New Relic AI Monitoring [7] extend traditional Application Performance Monitoring to cover LLM calls. Datadog bolts LLM monitoring onto its existing APM paradigm, correlating LLM call traces with infrastructure metrics (CPU, memory, network). New Relic similarly extends its distributed tracing to cover LLM transactions, adding hallucination detection and model comparison.

The mental model in both cases remains "service health," not "user health." Datadog can report the p99 latency of LLM API calls, but not whether users perceived that latency as acceptable. New Relic's "end-to-end" monitoring spans from API call to infrastructure --- not from user intent to user satisfaction. Neither tool introduces user-facing metrics, session-level experience concepts, or effort measurement. The APM heritage is both their strength (enterprise credibility, correlation with infrastructure) and their limitation (the wrong unit of analysis for experience quality).

### 2.3 AI Gateway and Proxy Tools

Helicone [8] and Portkey [9] operate as LLM proxies, providing request/response logging, latency measurement, token and cost tracking, rate limit monitoring, and (in Portkey's case) multi-provider routing and failover metrics. These tools are valuable for cost management and infrastructure reliability, but they operate below the application layer entirely. Helicone sees individual LLM API calls in isolation; it cannot correlate them into tasks, sessions, or user outcomes. Portkey optimizes the plumbing; it has no concept of what a "user" is, let alone what they experience.

### 2.4 Agent-Specific Monitoring

AgentOps [10] is the closest existing tool to experience-level thinking. It records entire agent sessions as replayable timelines, tracking tool call sequences, LLM calls with token/cost data, error rates, session duration, and multi-agent coordination. AgentOps introduces session-level awareness --- a significant advance over per-call observability.

However, AgentOps remains agent-centric rather than user-centric. Its metrics describe what the agent *did* (tools called, errors encountered), not what the user *felt* (wait frustration, steering effort, task achievement). It provides no concept of user satisfaction, no experiential metrics like stall perception or interaction overhead, and no composite quality score. It is, in their own words, a "session replay for AI agents" --- an agent flight recorder, not a user experience monitor.

### 2.5 Academic Evaluation Benchmarks

The academic community has produced numerous agent evaluation frameworks: SWE-bench [11] for coding agents, WebArena [12] for web-browsing agents, and various task-specific benchmarks. Arize/Phoenix [13] bridges academia and industry with embedding drift detection, retrieval metrics for RAG systems, and evaluation metrics including hallucination and toxicity detection.

These benchmarks measure *task-specific capability* --- can the agent solve this problem? --- not *experience quality* --- how did the user feel while the agent worked on it? A model that achieves 95% on SWE-bench may still deliver a poor experience if it takes 45 seconds to start, stalls repeatedly during tool calls, and requires three steering corrections before producing the right fix. Capability and experience are related but distinct dimensions.

### 2.6 Video Quality of Experience Literature

The work most directly relevant to ours comes from a different domain entirely. Zhang et al.'s SIGCOMM 2011 study [3] used data from Conviva's measurement platform (~40 million video views across 200+ content providers) to establish that specific, formally defined quality metrics --- join time, buffering ratio, average bitrate, rebuffering frequency --- causally impact viewer engagement. The study's power derived from three elements: (a) a player state machine that made "quality" concrete and measurable, (b) metrics derived from observable states rather than ad hoc intuitions, and (c) "money numbers" that translated quality changes to business outcomes ("1% more buffering costs 3 minutes of viewing time").

The Conviva platform subsequently operationalized these metrics at scale, with dimensional slicing (ISP, device, geography, CDN, content type) as its core value proposition. The result was a transformation in how the streaming industry measures quality: from server-side response times to user-perceived experience.

We adapt Zhang's framework to the agent domain. The adaptation is non-trivial. Agent sessions are bidirectional (requiring a new Waiting state), involve tool use as observable substates (enriching the Stalled state), include error recovery loops (demanding careful terminal-state design), and produce task outcomes rather than continuous streams (motivating entirely new Delivery and Resolution metric phases). The agent state machine is a strict superset of the video player state machine; removing the Waiting state and collapsing the stall-reason attribute recovers Zhang's model exactly. This is the right relationship: agents are interactive video.

### 2.7 The Gap

The linguistic pattern across the landscape is telling: every tool uses developer/engineering verbs (debug, monitor, evaluate, troubleshoot) with the *application* or *agent* as the object. Not a single tool positions itself around the *user's experience* of interacting with an AI agent.

The gap is structural, not accidental. Three factors explain it:

1. **Heritage bias.** Most tools evolved from APM, ML model monitoring, or developer tooling. Their mental models are "service health" or "model quality," not "user experience."
2. **Instrumentation boundary.** Current tools instrument at the LLM API call level or agent framework level. Experience metrics require instrumentation at the *interaction boundary* --- where the human and the AI meet.
3. **No established vocabulary.** Unlike web performance (which has Core Web Vitals [14], RAIL [15]) or voice quality (which has MOS [16]), there is no established vocabulary for AI agent experience metrics.

To the best of our knowledge, this paper presents the first experience-centric metrics framework for AI agents --- a framework that asks not "how is my AI system performing?" but "how is the human experiencing this AI interaction?"

---

## 3. The Agent Session Model

The conceptual anchor of our framework is a formal state machine that models the lifecycle of an agent session from the user's perspective. Every metric in our taxonomy is derived from states or transitions in this machine, ensuring that the framework is grounded in observable, principled constructs rather than an ad hoc list.

### 3.1 Design Rationale

Zhang et al.'s video player state machine has four primary states (Joining, Playing, Buffering, Stopped) and clean transitions. Every video quality metric maps directly to this machine: Join Time equals the duration of the Joining state; Buffering Ratio equals time in Buffering divided by total playback time; Buffering Frequency equals transitions into Buffering. The state machine is the single most important conceptual contribution of the video QoE framework --- it makes the abstract notion of "quality" concrete and measurable.

The agent domain is structurally richer than video for three reasons:

1. **Bidirectional interaction.** Video is unidirectional (server to client). Agents require user-to-agent exchanges mid-session: clarification questions, approval gates, steering corrections. This demands a dedicated state that video has no parallel for.
2. **Tool use as observable substates.** When an agent invokes an external tool (API call, code execution, file read), it enters a latency bubble visible to the user --- functionally equivalent to buffering, but semantically distinct because the agent chose to enter it.
3. **Error recovery loops.** Video either plays or fails. Agents frequently encounter errors (tool failures, model errors, rate limits) and retry autonomously before the user notices. These retries consume wall-clock time and must be captured.

These differences motivate six primary states (versus Zhang's four).

### 3.2 The Agent State Machine

```
                          ┌─────────────────────────────────────────────────┐
                          │                                                 │
                          │          ┌─────────────────────────────┐        │
                          │          │                             │        │
                          v          v                             │        │
┌───────────┐  first    ┌──────────┐  resume   ┌─────────────┐   │        │
│           │  output   │          │ <──────── │  Waiting     │   │        │
│ Starting  │ ────────> │ Working  │ ────────> │  (on user)   │   │        │
│           │           │          │  ask user  └─────────────┘   │        │
└───────────┘           └──────────┘                              │        │
     │                    │  │  ^  │                              │        │
     │                    │  │  │  │  tool call returns /         │        │
     │ fail /             │  │  │  │  retry succeeds             │        │
     │ timeout /          │  │  │  └──────────────────┐          │        │
     │ abandon            │  │  │                     │          │        │
     v                    │  │  │  tool call  ┌────────────────┐ │        │
┌───────────┐             │  │  └──────────── │  Stalled       │ │        │
│           │             │  │                │  (tool/retry)  │─┘        │
│ Failed    │             │  │  error/retry   └────────────────┘  error   │
│           │             │  └──────────────>        ^            exceeds │
└───────────┘             │                          │            retry   │
     ^                    │       retry loop         │            budget  │
     │                    │       (same error)  ─────┘                    │
     │ unrecoverable      │                                              │
     │ error              │  task done /                                  │
     └────────────────────│  user stops                                  │
                          v                                              │
                   ┌──────────┐                                          │
                   │          │ <─────────────────────────────────────────┘
                   │ Ended    │
                   │          │
                   └──────────┘
```

**Figure 1.** The Agent Session State Machine. Six states capture the full lifecycle of an agent interaction. The machine extends Zhang et al.'s player state machine with a Waiting state for bidirectional interaction and enriched Stalled semantics for tool use and error recovery. Removing Waiting and collapsing stall reasons recovers the video player state machine exactly.

### 3.3 State Definitions

| State | Entry Condition | Exit Condition | Observable Signal | Zhang Parallel |
|-------|----------------|----------------|-------------------|----------------|
| **Starting** | User submits a prompt or task | First visible output token appears; OR timeout/error occurs | Prompt submission event; no output yet rendered | Joining |
| **Working** | Agent produces visible output (tokens, artifacts, progress indicators) | Agent finishes, stalls, asks user, or fails | Output tokens streaming; progress updates appearing | Playing |
| **Stalled** | Agent enters a latency gap with no user-visible output --- tool call in flight, retry in progress, rate limit wait, or model processing pause | Tool returns, retry succeeds, or error budget exhausted | Output stream paused; tool invocation event logged; no new tokens for configurable threshold (default: >2s) | Buffering |
| **Waiting** | Agent explicitly requests user input (clarification, approval, choice) | User provides input and agent resumes | Agent emits a question directed at user; output stream stops | *(no parallel)* |
| **Failed** | Unrecoverable error: crash, auth failure, context overflow, retry budget exhausted, timeout | Terminal --- user must start new request | Error message rendered; or timeout with no output | Failed |
| **Ended** | Task completed (agent signals done); OR user explicitly stops/cancels | Terminal | Completion signal; user stop action; final output rendered | Stopped |

**Table 1.** State definitions for the Agent Session State Machine. Every state is defined by events observable at the client/framework boundary.

### 3.4 Transition Table

| From | To | Trigger | Observable Event |
|------|----|---------|-----------------|
| Starting | Working | First visible output | `first_token` event |
| Starting | Failed | Timeout, crash, auth error | `error` event with no prior output |
| Starting | Ended | User cancels before output | `user_cancel` event |
| Working | Stalled | Tool invocation; model pause >threshold; retry initiated | `tool_call_start` or output gap exceeding threshold |
| Working | Waiting | Agent asks user a question | `user_input_requested` event |
| Working | Ended | Task completion; user stops | `task_complete` or `user_stop` event |
| Working | Failed | Unrecoverable error during work | `error` event (fatal) |
| Stalled | Working | Tool returns result; retry succeeds | `tool_call_end` or `retry_success`; output tokens resume |
| Stalled | Failed | Retry budget exhausted; tool permanently fails | `error` event after max retries |
| Stalled | Ended | User cancels during stall | `user_cancel` event |
| Waiting | Working | User provides input | `user_input_received` event; output resumes |
| Waiting | Ended | User abandons or cancels | `user_cancel` or session timeout |

**Table 2.** State transitions with triggers and observable events. Note: the Starting -> Ended transition (user cancel before output) is included in the table for completeness; in Figure 1 it is subsumed by the Starting -> Failed/Ended exit paths shown on the left side of the diagram.

### 3.5 Key Design Decisions

**Why "Stalled" instead of separate "Tool-Calling" and "Retrying" states.** From the user's perspective, both tool calls and retries manifest identically: the output stream stops and the user waits. Splitting them would add states without adding measurably different user experience. We record a `stall_reason` attribute (enum: `tool_call`, `retry`, `rate_limit`, `model_latency`) on every Stalled entry event so that diagnostic analysis can distinguish causes without inflating the state machine.

**Why "Waiting" is a first-class state, not a substate of Stalled.** Stalled and Waiting are both pauses, but the locus of control differs --- and this is the critical distinction. In Stalled, the *agent* controls when progress resumes. In Waiting, the *user* controls it. This difference is observable (the agent framework knows whether it emitted a question versus made a tool call) and has different quality implications: Stall Duration reflects system performance; Wait Duration reflects interaction design. Conflating them would make it impossible to distinguish "the agent is slow" from "the agent asked a question."

**Why "Failed" is terminal.** If an agent encounters an error and recovers, it never entered Failed; it was in Stalled (retrying) and transitioned back to Working. Failed means no recovery occurred. This keeps the state machine acyclic from Failed (no outgoing transitions), which simplifies reliability metrics and mirrors Zhang's treatment of join failure as terminal.

**Observability constraint.** Every state and transition is defined by events observable at the client/framework boundary: token emission, tool call lifecycle events, user input events, error events, and timeout thresholds. No state requires inspecting model weights, attention patterns, or internal chain-of-thought. This constraint is deliberate: metrics must be instrumentable by any agent framework, not only by model providers.

### 3.6 Parallel to Zhang (Explicit Mapping)

| Zhang State | Agent State | Structural Correspondence |
|-------------|-------------|--------------------------|
| Joining | Starting | Latency before first useful output. Both are the "cold start" phase. |
| Playing | Working | The "value delivery" state. User perceives forward progress. |
| Buffering | Stalled | System-side pause. User waits involuntarily. The key metric territory. |
| *(none)* | Waiting | **New.** Interactive systems have a fundamentally new pause type: the system waiting on the user. |
| Failed | Failed | Terminal error. Zhang treats this as an exit from Joining; we make it explicit at any phase. |
| Stopped | Ended | Session complete --- either success or user-initiated stop. |

The agent state machine is a strict superset of Zhang's. This is the right relationship: agents are interactive video.

---

## 4. Agent Experience Metrics

We define 29 metrics organized across five experience phases. Each phase corresponds to a question the user implicitly asks during an agent interaction. The five phases are:

- **Initiation:** "I asked --- did it start?"
- **Progress:** "It is working --- do I feel forward motion?"
- **Interaction:** "It needs me --- is this smooth or disruptive?"
- **Delivery:** "It produced output --- is it what I needed?"
- **Resolution:** "Was it worth it?"

For each metric, we specify the name, type, unit, formal definition, state/transition mapping, observability level, and Zhang analogue. The observability classification (Section 4.7) determines what instrumentation is required to capture each metric.

### 4.1 Phase 1: Initiation

| # | Metric | Type | Unit | Definition | State Mapping | Zhang Analogue |
|---|--------|------|------|------------|---------------|----------------|
| 1.1 | **Time to First Response (TTFR)** | histogram | seconds | Wall-clock time from user prompt submission to first visible output token rendered to the user. | Duration of Starting state | Join Time |
| 1.2 | **Start Failure Rate** | rate | % | Fraction of initiated sessions where the agent fails to produce any output (error, timeout, or crash before first token). | Starting -> Failed | Join Failure Rate |
| 1.3 | **Pre-Response Abandonment Rate** | rate | % | Fraction of sessions where the user cancels or navigates away before the first output token. | Starting -> Ended (user cancel) | Abandonment Before Video Start |
| 1.4 | **Start Retry Rate** | rate | % | Fraction of sessions where the framework auto-retried the initial request before first output (e.g., retry after 429 or model overload). | Internal to Starting state | *(new)* |

### 4.2 Phase 2: Progress

| # | Metric | Type | Unit | Definition | State Mapping | Zhang Analogue |
|---|--------|------|------|------------|---------------|----------------|
| 2.1 | **Stall Ratio** | gauge | % | Fraction of active session time spent in the Stalled state: time_stalled / (time_working + time_stalled). The single most important progress metric. | Time in Stalled / (Working + Stalled) | Buffering Ratio |
| 2.2 | **Stall Frequency** | counter | count/session | Number of Working -> Stalled transitions per session. | Working -> Stalled transitions | Rebuffering Frequency |
| 2.3 | **Stall Duration Distribution** | histogram | seconds | Distribution (p50, p90, p95) of individual stall event durations. | Duration of each Stalled episode | Rebuffering Duration |
| 2.4 | **Progress Cadence** | gauge | events/min | Rate of user-visible progress signals during Working state. | Within Working state | Bitrate |
| 2.5 | **Perceived Throughput** | gauge | tokens/s | Rate of meaningful user-facing output delivery during Working, excluding tool-call metadata and internal reasoning tokens. | Within Working state | Video Bitrate |
| 2.6 | **Output Fidelity Rate** | rate | % | Fraction of output chunks that are well-formed (valid syntax for code, valid markdown, no truncation artifacts). | Within Working state | Rendering Quality |

### 4.3 Phase 3: Interaction

| # | Metric | Type | Unit | Definition | State Mapping | Zhang Analogue |
|---|--------|------|------|------------|---------------|----------------|
| 3.1 | **Interaction Frequency** | counter | count/session | Number of Working -> Waiting transitions per session. | Working -> Waiting | *(new)* |
| 3.2 | **Wait Duration Distribution** | histogram | seconds | Distribution (p50, p90, p95) of time blocked in Waiting state per episode. | Duration of each Waiting episode | *(new)* |
| 3.3 | **Resumption Latency** | histogram | seconds | Wall-clock time from user providing input to agent producing next visible output token. The "cold restart" cost after a Waiting pause. | Waiting -> Working transition | *(analogous to rebuffer-exit latency)* |
| 3.4 | **Steering Event Count** | counter | count/session | Number of corrective signals from the user during Working (interrupt, redirect, "no, I meant..."). Does not cause a state transition. | Within Working state | *(new)* |
| 3.5 | **Steering Recovery Time** | histogram | seconds | Time from a steering event to the agent producing output aligned with the correction. | Within Working state | *(new)* |
| 3.6 | **Interaction Overhead Ratio** | gauge | % | Fraction of total session time consumed by interaction overhead: (Waiting time + Steering Recovery time) / Session Duration. | Cross-state | *(new)* |

### 4.4 Phase 4: Delivery

| # | Metric | Type | Unit | Definition | State Mapping | Zhang Analogue |
|---|--------|------|------|------------|---------------|----------------|
| 4.1 | **Task Completion Rate** | rate | % | Fraction of sessions where the agent signals task completion and the user does not dispute it within a configurable post-completion window. | Working -> Ended (task_complete) | *(new)* |
| 4.2 | **First-Attempt Success Rate** | rate | % | Fraction of completed sessions where the agent reached task completion without steering events or agent-initiated Waiting episodes. | Derived: Steering Count = 0 AND Interaction Freq = 0 AND task_complete | *(new)* |
| 4.3 | **Delivery Quality Score** | gauge | 0--1 | Composite score evaluating correctness, completeness, and instruction adherence of final output. Requires an evaluation judge (human or LLM-as-judge). | Post-Ended evaluation | Perceptual Quality (MOS) |
| 4.4 | **Rework Rate** | rate | % | Fraction of sessions followed by a closely related prompt within a configurable time window, indicating the output was insufficient. | Post-Ended: related re-submission | *(new)* |
| 4.5 | **Partial Delivery Rate** | rate | % | Fraction of sessions where the agent completes some but not all sub-goals. | Working -> Ended (partial) | *(new)* |
| 4.6 | **Token Efficiency Ratio** | gauge | ratio | Ratio of visible output tokens to total tokens consumed (input + output + tool-call overhead). | Cross-session | *(new --- no per-stream cost in video)* |

### 4.5 Phase 5: Resolution

| # | Metric | Type | Unit | Definition | State Mapping | Zhang Analogue |
|---|--------|------|------|------------|---------------|----------------|
| 5.1 | **Time to Task Completion (TTTC)** | histogram | seconds | Wall-clock time from prompt submission to task completion signal. Excludes post-completion idle time. | Starting entry -> Ended (task_complete) | Session Duration (tighter) |
| 5.2 | **Session Duration** | histogram | seconds | Total wall-clock time from prompt to session end, regardless of outcome. | Starting entry -> Ended entry | Session Duration |
| 5.3 | **User Attention Ratio** | gauge | % | Fraction of session time requiring active user engagement. Lower is better. | (Waiting + steering + user-input time) / Session Duration | *(new)* |
| 5.4 | **Leverage Ratio** | gauge | ratio | Ratio of agent productive time to user input time. The "multiplication factor" of agent work per unit of user input. | Working time / (Waiting + steering input time) | *(new)* |
| 5.5 | **Abandonment Rate** | rate | % | Fraction of sessions terminated by user action before task completion. | Any non-terminal -> Ended (user_cancel) | Abandonment Rate |
| 5.6 | **Abandonment Phase** | histogram | categorical | Distribution of which state the user was in when they abandoned. | State at user_cancel event | *(new)* |
| 5.7 | **Return Rate** | rate | % | Fraction of users who initiate a new session within a configurable time window (e.g., 24 hours). | Post-session | *(new)* |
| 5.8 | **Net Satisfaction** | gauge | -1 to +1 | Composite satisfaction signal combining explicit feedback (thumbs up/down) and implicit signals (return rate, rework rate, abandonment). Requires feedback collection. | Post-session | *(QoE survey equivalent)* |
| 5.9 | **Turn-over-Turn Coherence** | gauge | 0--1 | Whether output quality degrades as the session progresses through multiple turns. Ratio of Delivery Quality Score in the final third versus first third of turns. Requires evaluation judge. | Across Working episodes | *(analogous to bitrate degradation)* |

### 4.6 Metric-to-State Mapping Summary

Every metric maps to the state machine. The reverse index:

| State | Metrics Measured |
|-------|-----------------|
| **Starting** | TTFR (1.1), Start Failure Rate (1.2), Pre-Response Abandonment (1.3), Start Retry Rate (1.4) |
| **Working** | Stall Ratio (2.1, denominator), Progress Cadence (2.4), Perceived Throughput (2.5), Output Fidelity (2.6), Steering Events (3.4), Steering Recovery (3.5) |
| **Stalled** | Stall Ratio (2.1, numerator), Stall Frequency (2.2), Stall Duration (2.3) |
| **Waiting** | Interaction Frequency (3.1), Wait Duration (3.2), Resumption Latency (3.3), Interaction Overhead (3.6) |
| **Failed** | Start Failure Rate (1.2), Abandonment Phase (5.6) |
| **Ended** | Task Completion (4.1), First-Attempt Success (4.2), Delivery Quality (4.3), Rework Rate (4.4), Partial Delivery (4.5), Token Efficiency (4.6) |
| **Cross-state** | TTTC (5.1), Session Duration (5.2), User Attention Ratio (5.3), Leverage Ratio (5.4), Abandonment Rate (5.5), Return Rate (5.7), Net Satisfaction (5.8), Coherence (5.9) |

### 4.7 Observability Classification

A metric is only as useful as its measurability. We classify each metric by what instrumentation is required:

| Level | Requirement | Metrics |
|-------|-------------|---------|
| **L1: Client-side only** | Timestamps and event stream visible in the UI layer. No framework access needed. | TTFR, Pre-Response Abandonment, Stall Ratio*, Stall Duration, Progress Cadence, Perceived Throughput, Wait Duration, Resumption Latency, Session Duration, TTTC, Abandonment Rate, Abandonment Phase |
| **L2: Agent framework** | Access to framework-level events: tool call lifecycle, retry logic, error types, token counts. | Start Failure Rate, Start Retry Rate, Stall Frequency, Interaction Frequency, Task Completion Rate, Token Efficiency, Output Fidelity |
| **L3: Derived/composite** | Computed from L1 + L2 metrics. No new instrumentation. | Stall Ratio (precise), First-Attempt Success, User Attention Ratio, Leverage Ratio, Interaction Overhead, Rework Rate, Partial Delivery Rate |
| **L4: Evaluation judge** | Needs an external evaluator (human or LLM-as-judge). Cannot be automated from instrumentation alone. | Delivery Quality Score, Steering Recovery Time (full precision), Net Satisfaction, Turn-over-Turn Coherence |

*Stall Ratio at L1 uses a client-side heuristic (output gap > threshold). At L2 it uses explicit tool-call events. Both are valid; L2 is more precise.*

**Table 3.** Observability classification. L1 and L2 metrics are instrumentable today by any agent framework. L3 metrics require only aggregation. L4 metrics are candidates for phased adoption.

This classification has a practical implication: an organization can begin measuring agent experience quality using only L1 metrics (12 metrics, requiring nothing more than timestamp logging at the UI layer), then incrementally add L2 (7 more metrics, requiring framework instrumentation), L3 (5 more, requiring computation), and finally L4 (4 more, requiring evaluation infrastructure). The framework is designed for progressive adoption, not all-or-nothing deployment.

### 4.8 Metric Interactions and Tradeoffs

Several metrics exhibit inherent tensions that practitioners must understand:

1. **TTFR vs. Delivery Quality.** Streaming the first token instantly (low TTFR) may come at the cost of the agent "thinking aloud" with low-quality prefill. Optimizing TTFR naively degrades quality. We capture both and let the composite score balance them.

2. **Stall Frequency vs. Stall Duration.** An agent can make many short tool calls (high frequency, low duration) or batch them into fewer long calls (low frequency, high duration). Both produce the same Stall Ratio but feel different to the user. Many short stalls break attention more frequently; one long stall tests patience. This motivates reporting all three: ratio, frequency, and duration distribution.

3. **Interaction Frequency vs. First-Attempt Success Rate.** An agent that never asks questions may complete tasks on the first attempt more often but fail badly when its assumptions are wrong. An agent that asks clarifying questions may have a lower first-attempt rate but higher overall Task Completion Rate. Neither extreme is optimal; the framework captures both.

4. **Token Efficiency vs. Delivery Quality.** Chain-of-thought and internal reasoning consume tokens without producing visible output, reducing Token Efficiency. But they typically improve Delivery Quality. This tradeoff is fundamental and should be reported rather than optimized away.

### 4.9 Zhang Video Metrics to Agent Metrics Mapping

| Zhang et al. Metric | Agent Equivalent | Relationship |
|---------------------|-----------------|--------------|
| Join Time | TTFR (1.1) | Direct parallel |
| Join Failure Rate | Start Failure Rate (1.2) | Direct parallel |
| Buffering Ratio | Stall Ratio (2.1) | Direct parallel --- the "headline" metric |
| Buffering Frequency | Stall Frequency (2.2) | Direct parallel |
| Buffering Duration | Stall Duration Distribution (2.3) | Direct parallel |
| Average Bitrate | Perceived Throughput (2.5) | Conceptual parallel: sustained output rate |
| Rendering Quality | Output Fidelity Rate (2.6) | Conceptual parallel: quality of what is delivered |
| Abandonment Rate | Abandonment Rate (5.5) | Direct parallel |
| Session Duration | Session Duration (5.2) | Direct parallel |
| *(none)* | All Interaction metrics (3.1--3.6) | **Gap.** Video has no interaction dimension. |
| *(none)* | Delivery metrics (4.1--4.6) | **Gap.** Video has no task concept. |
| *(none)* | Token Efficiency (4.6) | **Gap.** Video has no per-stream cost. |

**Table 4.** Mapping between Zhang et al.'s video quality metrics and our agent experience metrics. Five direct parallels anchor the framework; seven new metrics address the structural novelties of agent interaction.

---

## 5. Diagnostic Dimensions

Metrics answer *how well*. Dimensions answer *why* and *where*. A diagnostic dimension is a categorical or ordinal attribute attached to every metric observation that enables slicing, filtering, and root-cause analysis. Without dimensions, a drop in start failure rate is an alarm; with dimensions, it becomes "start failure rate for Claude 3.5 Sonnet on multi-turn coding tasks via the VS Code extension rose 12% after the November 15 model update."

Zhang never formalized a dimension system --- his paper sliced by content type and CDN but did not systematize the concept. Conviva later operationalized dimensional slicing across hundreds of combinations as the core of their product. We adopt Conviva's spirit while defining a taxonomy specific to agents.

### 5.1 Dimension Catalog

We define 11 dimensions across three classes:

**Core Dimensions** (always present, require only standard request metadata):

| ID | Dimension | Sub-attributes | Example Slices |
|----|-----------|---------------|----------------|
| D1 | **Agent** | agent_name, agent_version, agent_framework | "Stall ratio by agent framework"; "AXS trend for Claude Code v1.2 vs v1.3" |
| D2 | **Model** | provider, model_id, fallback_position | "TTFR by model provider"; "Start failure rate when falling back from Opus to Sonnet" |
| D3 | **Interface** | interface_type (CLI, IDE, web_chat, API, mobile, voice) | "Abandonment rate on mobile vs web_chat" |
| D4 | **Task** | task_category, complexity_tier (trivial through heroic) | "Task completion rate for debugging vs code generation"; "Stall ratio by complexity tier" |
| D5 | **Session Type** | session_mode (single_turn, multi_turn_interactive, multi_turn_autonomous, background_batch) | "Stall freedom for autonomous vs interactive sessions" |

**Extended Dimensions** (require deeper instrumentation):

| ID | Dimension | Sub-attributes | Example Slices |
|----|-----------|---------------|----------------|
| D6 | **Tool** | tool_name, tool_provider, mcp_server, tool_category | "Stall duration distribution by tool_name"; "Tool success rate by MCP server" |
| D7 | **Context** | window_utilization_pct, compaction_event_count | "Delivery Quality when context > 75% utilized"; "Coherence after compaction events" |
| D8 | **User** | user_segment, geography, plan_tier | "TTFR by geography"; "AXS by user segment" |

**Derived Dimensions** (computed from raw dimensions or metric values):

| ID | Dimension | Sub-attributes | Example Slices |
|----|-----------|---------------|----------------|
| D9 | **Content Type** | content_type (quick_answer, guided_task, deep_session, autonomous_workflow) | "AXS by content type"; "Which metric dominates variance for deep_session" |
| D10 | **Quality Regime** | regime (nominal, degraded, failed) | "% sessions in degraded regime by model provider" |
| D11 | **Error Class** | error_class, error_source | "Start failure rate by error_class"; "Rate-limit stalls by model provider" |

### 5.2 Agent Content Types: The Moderating Variable

Zhang's critical insight was that video content type (Short VoD, Long VoD, Live) fundamentally changed user expectations and therefore changed which metrics mattered most. A 2-second rebuffer during live sports is a crisis; during a 2-hour movie, it is a minor irritant. Content type *moderated* the relationship between quality metrics and user engagement.

We define four agent content types that serve the same structural role:

**Quick Answer** (`quick_answer`). Single-turn or very short multi-turn interaction. The user expects a fast, direct response. Typically 0--2 tool calls, 1--2 turns, under 30 seconds total. Dominant quality factors: TTFR, start failure rate, and correctness of the single response. Zhang analogue: Short VoD. Example: "What does this error mean?" or "Convert this JSON to YAML."

**Guided Task** (`guided_task`). Multi-turn interactive session where user and agent collaborate toward a goal. Typically 3--15 turns, 3--20 tool calls, 1--15 minutes. The user stays engaged and provides feedback. Dominant quality factors: stall ratio, stall frequency, interaction overhead, task completion rate. Zhang analogue: Long VoD. Example: "Help me refactor this module to use dependency injection."

**Deep Session** (`deep_session`). Extended multi-turn session with high complexity. 15--50+ turns, 20--100+ tool calls, 15--60+ minutes. The user is deeply invested; abandonment cost is high. Dominant quality factors: stall freedom (mid-session failures are catastrophic), turn-over-turn coherence, resolution quality. Zhang analogue: Live content. Example: "Implement the authentication system across these 12 files."

**Autonomous Workflow** (`autonomous_workflow`). Agent operates with minimal or no user interaction after the initial instruction. May run for minutes to hours. The user checks back for results. Dominant quality factors: task completion rate, delivery quality, start failure rate, token efficiency. Zhang analogue: no direct parallel (closest is batch transcoding). Example: "Run the full test suite, fix all failures, and open a PR."

### 5.3 Content Type Weight Modifiers

| Metric Domain | quick_answer | guided_task | deep_session | autonomous_workflow |
|---------------|:---:|:---:|:---:|:---:|
| Initiation (TTFR, Start Failure) | High | Medium | Medium | High |
| Progress (Stall Ratio, Frequency) | Low | High | High | Low |
| Interaction (Flow, Overhead) | Low | High | Medium | Low |
| Delivery (Quality, Fidelity) | High | Medium | Medium | High |
| Resolution (Completion, Coherence) | Medium | Medium | High | High |

**Table 5.** Relative importance of metric domains by content type. These qualitative shifts formalize the intuition that different interaction patterns demand different quality priorities.

### 5.4 Dimension Interaction Patterns

Several dimension pairs interact in ways that affect analysis. Failing to account for these leads to Simpson's Paradox effects or misattributed root causes:

1. **Model x Task** (confounding): Model quality varies by task category. Always cross-slice before drawing conclusions.
2. **Interface x Session Type** (confounding): CLI users skew toward deep sessions; web chat users toward quick answers. Compare conditional distributions.
3. **Tool x Context** (causal chain): Heavy tool use fills the context window, triggering compaction, which may degrade coherence. Follow the causal chain in analysis.
4. **Content Type x everything** (stratification): Content type is the primary stratification variable. Report all metrics broken down by content type *before* any other slice.
5. **Model x Error Class** (diagnostic): When Start Failure Rate spikes, the first diagnostic slice is Model x Error Class --- rate limits from one provider, auth errors from another, context overflows from a specific model's token limit.
6. **User x Interface x Geography** (latency attribution): TTFR varies with geography (network latency to model provider) and interface (web chat adds rendering overhead versus CLI's direct stream). Slice all three together to separate infrastructure latency from agent latency. Without this cross-cut, a TTFR regression caused by a new geographic deployment may be misattributed to a model update.

### 5.5 Dimension Governance

To prevent dimension explosion, we propose governance rules:

1. Core dimensions (D1--D5) are mandatory on every metric observation.
2. Extended dimensions (D6--D8) are captured when instrumentation is available but do not gate metric computation.
3. Derived dimensions (D9--D11) are computed in the analysis layer, not at collection time.
4. Any dimension with cardinality exceeding 1,000 distinct values must be binned before dashboard use.
5. Adding a core dimension is a breaking schema change; extended dimensions can be added freely.

---

## 6. Agent Experience Score (AXS)

### 6.1 Philosophy

A composite score collapses a multi-dimensional quality space into a single number. This is inherently lossy. The question is not whether information is lost --- it always is --- but whether the compression is useful enough to justify the loss.

The gain is real. Organizations need a single indicator to answer: "Is agent experience getting better or worse?" Without it, teams drown in dashboards. Apdex [17] succeeded in web monitoring not because it was sophisticated --- it is crude --- but because it gave executives a number they could track weekly and set targets against. MOS [16] unified decades of telephony quality research into a 1--5 scale that every telecom engineer understands.

The loss is also real. VMAF [18] demonstrated that a single score can mask component failures: a video with perfect color but stuttering playback can score the same as one with smooth playback but washed-out color. Netflix addressed this by training VMAF on subjective quality data, but the masking problem persists for novel distortion types outside the training distribution.

Our position: AXS is an *executive metric*, not a diagnostic metric. It answers "how good?" and "is it trending up or down?" It does not answer "why?" --- that is what the dimension system (Section 5) and the individual phase metrics (Section 4) are for. AXS earns its place by being the single number printed at the top of every quality report, the number that triggers investigation when it drops.

We adopt six design principles:

| Principle | Implication |
|-----------|-------------|
| **P1: Interpretable scale** | A human should develop intuition for what "AXS 85" means without a reference card |
| **P2: Sensitive to real degradation** | A model update that increases stalls by 20% must visibly move AXS |
| **P3: Resistant to gaming** | Optimizing AXS should require genuinely improving the experience |
| **P4: Content-type-aware** | Weights shift by Agent Content Type |
| **P5: Decomposable** | You can always drill from AXS into component sub-scores |
| **P6: Open formula** | The formula, weights, and thresholds are published. No proprietary black box. |

### 6.2 Score Architecture: Gated Multiplicative-Additive Hybrid

**Why not a pure weighted sum?** A formula `AXS = w1*S1 + w2*S2 + ...` allows catastrophic failure in one component to be masked by excellence in others. An agent that never starts (S_start = 0) but has "excellent" delivery quality on the sessions that somehow work could still score 60+. This is nonsensical --- a user who cannot start the agent has zero experience quality. Weighted sums are compensatory by construction; agent quality has non-compensatory failure modes.

**Why not a pure multiplicative model?** A formula `AXS = S1 * S2 * S3 * S4 * S5` (each on 0--1) is too punitive. If any component is 0, AXS is 0 --- correct for start failure but too harsh for a minor interaction flow hiccup. It also compresses the scale: 0.8^5 = 0.33, which maps poorly to intuition on a 0--100 scale.

**Why a gated hybrid?** The agent experience has a clear hierarchical structure:

1. **Prerequisite layer** (must be non-zero): Can the agent start? Does it resolve the task? If either fails, quality is zero regardless of process quality.
2. **Quality layer** (continuous, compensatory): Given that the agent starts and resolves, how smooth, fast, and reliable was the journey?

This maps naturally to a gate (multiplicative, non-compensatory) on the prerequisites and a weighted sum (additive, compensatory) on the quality factors.

#### The Formula

```
AXS = G x Q x 100
```

Where:
- **G** (Gate Score, 0--1): Captures prerequisite quality requirements that can veto the entire experience.
- **Q** (Quality Score, 0--1): Captures continuous quality dimensions in a weighted sum.
- **100**: Scales to a 0--100 range for interpretability.

#### Gate Score (G)

```
G = S_start^alpha x S_res^beta
```

- **S_start** (Start Success Score, 0--1): At session level, binary (0 or 1). At cohort level, equals start success rate.
- **S_res** (Resolution Score, 0--1): A composite of resolution metrics (see below).
- **alpha = 1.0** (start gate exponent): Linear gate --- each 1% drop in start success causes ~1% drop in AXS.
- **beta = 0.8** (resolution gate exponent): Slightly softened --- partial resolution still delivers some value.

The bookends rationale: start and resolution are the entry and exit of the experience. If you cannot start, nothing else matters. If you do not resolve, the effort was wasted. This mirrors Zhang's finding that join failures and premature exits dominate quality impact. By making them gates rather than weighted-sum components, we ensure that no amount of smooth mid-session quality can compensate for an inability to start or finish.

#### Quality Score (Q)

```
Q = w1 * S_stall + w2 * S_del + w3 * S_flow
```

- **S_stall** (Stall Freedom Score): How free was the session from unexpected interruptions?
- **S_del** (Delivery Quality Score): How well did the agent's outputs perform?
- **S_flow** (Interaction Flow Score): How smooth was the turn-by-turn experience?

Default weights for `guided_task`:

| Component | Weight | Rationale |
|-----------|--------|-----------|
| w1: Stall Freedom | 0.40 | Stalls are the most salient negative experience. Zhang found buffering ratio was the #1 predictor of abandonment. |
| w2: Delivery Quality | 0.35 | Tool failures and incorrect outputs directly undermine trust and require rework. |
| w3: Interaction Flow | 0.25 | Latency and streaming smoothness matter but are less catastrophic than stalls or errors. |

Constraint: w1 + w2 + w3 = 1.0.

### 6.3 Sub-Score Definitions

**S_start (Start Success Score).**

Session level: S_start = 1 if Starting -> Working occurred; 0 otherwise.

Cohort level:
```
S_start = start_success_rate x (1 - lambda x fraction_slow_starts)
```
where `fraction_slow_starts` = successful starts with TTFR > 10s / successful starts, and lambda = 0.3. A cohort where every start succeeds but 50% are slow scores 0.85, not 1.0.

**S_stall (Stall Freedom Score).**
```
S_stall_base = 1 - clamp(stall_ratio / 0.20, 0, 1)
S_stall = S_stall_base x (1 - 0.3 x clamp(stall_count / 10, 0, 1))
```
A session that is 20%+ stalled scores 0 on the base component. The multiplicative stall-count penalty means many short stalls (same total ratio but high count) score worse than one long stall --- each stall breaks attention, and attention restoration has a fixed cost. This mirrors Zhang's finding that rebuffering frequency has an independent negative effect beyond rebuffering ratio.

**S_del (Delivery Quality Score).**
```
S_del = 0.40 x tool_success_rate
      + 0.35 x first_attempt_correctness
      + 0.25 x (1 - error_recovery_failure_rate)
```
At L4 observability (evaluation judge available), `first_attempt_correctness` can be replaced with the full Delivery Quality Score (metric 4.3). At L2, we use the proxy of zero-steering-events as an imperfect but instrumentable measure.

**S_flow (Interaction Flow Score).**
```
S_flow = 0.40 x latency_score
       + 0.25 x streaming_score
       + 0.35 x responsiveness_score
```
where:
- `latency_score` = 1 - clamp(median_TTFR / 15, 0, 1)
- `streaming_score` = 1 - clamp(token_gap_ratio, 0, 1), measuring fraction of output time with gaps >500ms between token chunks
- `responsiveness_score` = 1 - clamp(median_inter_turn_latency / 30, 0, 1)

**S_res (Resolution Score).**
```
S_res = 0.45 x task_completion_rate
      + 0.35 x resolution_quality
      + 0.20 x (1 - abandonment_rate)
```
At L2, `resolution_quality` is approximated by (1 - Partial Delivery Rate).

### 6.4 Content-Type Weight Adaptation

| Parameter | quick_answer | guided_task | deep_session | autonomous_workflow |
|-----------|:---:|:---:|:---:|:---:|
| alpha (start gate) | 1.0 | 1.0 | 1.0 | 1.0 |
| beta (resolution gate) | 1.0 | 0.8 | 0.9 | 1.0 |
| w1 (stall freedom) | 0.20 | 0.40 | 0.45 | 0.15 |
| w2 (delivery quality) | 0.30 | 0.35 | 0.35 | 0.50 |
| w3 (interaction flow) | 0.50 | 0.25 | 0.20 | 0.35 |

**Table 6.** AXS weight profiles by content type.

The rationale: **quick_answer** sessions are dominated by interaction flow (w3 = 0.50) because speed is everything for a simple question; the resolution gate is hard (beta = 1.0) because failing a trivial question is unacceptable. **guided_task** is the balanced default. **deep_session** has the highest stall freedom weight (w1 = 0.45) because a hang at turn 30 of a 40-turn session is devastating. **autonomous_workflow** is dominated by delivery quality (w2 = 0.50) because the agent is unsupervised and every decision must be correct.

When reporting AXS across a mixed workload, compute content-type-specific AXS for each session, then average:
```
AXS_aggregate = (1/N) x SUM_i AXS_i(content_type_i)
```

### 6.5 Worked Example

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

**Step 1: Compute sub-scores.**

```
S_start = 0.96 x (1 - 0.3 x 0.10) = 0.96 x 0.97 = 0.931

S_stall_base = 1 - (0.08 / 0.20) = 0.600
S_stall      = 0.600 x (1 - 0.3 x (3.2 / 10)) = 0.600 x 0.904 = 0.542

S_del = 0.40 x 0.89 + 0.35 x 0.72 + 0.25 x 0.85
      = 0.356 + 0.252 + 0.213 = 0.821

S_flow = 0.40 x (1 - 3.5/15) + 0.25 x (1 - 0.12) + 0.35 x (1 - 8/30)
       = 0.40 x 0.767 + 0.25 x 0.880 + 0.35 x 0.733
       = 0.307 + 0.220 + 0.257 = 0.784

S_res = 0.45 x 0.81 + 0.35 x 0.74 + 0.20 x 0.88
      = 0.365 + 0.259 + 0.176 = 0.800
```

**Step 2: Compute G and Q** (guided_task: alpha = 1.0, beta = 0.8).

```
G = 0.931^1.0 x 0.800^0.8 = 0.931 x 0.842 = 0.784

Q = 0.40 x 0.542 + 0.35 x 0.821 + 0.25 x 0.784
  = 0.217 + 0.287 + 0.196 = 0.700
```

**Step 3: Compute AXS.**

```
AXS = 0.784 x 0.700 x 100 = 54.9
```

**Interpretation.** AXS 54.9 falls in the "Fair" range. Decomposition reveals:

1. **Stall Freedom is the primary drag** (S_stall = 0.542). The 8% stall ratio with 3.2 stalls per session means users experience a stall roughly every 3 minutes of active work. Action: investigate stall causes via Model x Tool x Error Class dimensional slicing.

2. **The gate score caps the ceiling** (G = 0.784). Even with perfect quality (Q = 1.0), AXS could not exceed 78.4. The 4% start failure rate and 81% task completion rate jointly suppress the maximum. Action: improve start reliability and resolution rate.

3. **Interaction Flow is relatively healthy** (S_flow = 0.784). Median TTFR of 3.5s and inter-turn latency of 8s are adequate for guided tasks. This is not where to focus.

### 6.6 Sensitivity Analysis

To understand how AXS responds to changes, we compute partial sensitivities around the worked-example operating point (AXS 54.9, guided_task):

| Change | AXS Impact | Sensitivity |
|--------|------------|-------------|
| Start success rate 0.96 -> 0.98 (+2pp) | 54.9 -> 56.1 | +1.2 per 2pp improvement |
| Task completion rate 0.81 -> 0.90 (+9pp) | 54.9 -> 59.4 | +4.5 per 9pp improvement |
| Stall ratio 0.08 -> 0.04 (halved) | 54.9 -> 62.3 | +7.4 for halving stall ratio |
| Median TTFR 3.5s -> 1.5s (-2s) | 54.9 -> 56.0 | +1.1 for 2s TTFR reduction |
| All metrics at "good" level | ~82 | Target for "Good" range |

The largest lever is stall ratio --- halving it yields +7.4 points, confirming that the w1 = 0.40 weight for guided_task drives the right optimization incentive. TTFR improvements yield modest gains, consistent with interaction flow's lower weight (w3 = 0.25) for this content type. This analysis also demonstrates that AXS is not dominated by any single gate or quality component; meaningful improvement requires addressing multiple factors, which resists single-metric gaming.

### 6.7 Scale Interpretation

| AXS Range | Label | Interpretation | Action |
|-----------|-------|----------------|--------|
| 90--100 | **Excellent** | Reliable starts, consistent resolution, smooth interactions. Comparable to a senior engineer pair-programming with you. | Maintain. |
| 75--89 | **Good** | Occasional hiccups but clear value. Users are satisfied and return. | Monitor for trends. |
| 50--74 | **Fair** | Noticeable friction. Frequent stalls, partial resolutions, or inconsistent tool use. Users succeed but with effort. | Investigate. Drill into sub-scores and dimensions. |
| 25--49 | **Poor** | Significant problems. Many sessions fail, stalls are common, trust erodes. | Urgent. Identify root cause within 24 hours. |
| 0--24 | **Failing** | Not functional for intended purpose. Cascading failures, near-total inability to resolve. | Critical. Incident response. Consider rollback. |

**Calibration anchor.** An AXS of 75 should correspond approximately to "a user who tried the agent would use it again tomorrow." This is analogous to Apdex 0.85 ("satisfied"), MOS 3.5 ("fair-to-good" boundary), and VMAF 80 (Netflix's "good quality" encoding threshold). We propose validating this anchor empirically in Paper-1 by correlating AXS with Return Rate (metric 5.7) and Net Satisfaction (metric 5.8).

### 6.8 Comparison to Industry Composite Scores

| Score | Domain | What Worked | What Didn't Work | What We Learn |
|-------|--------|-------------|------------------|---------------|
| **Apdex** | Web apps | Dead simple. Universal APM adoption. | Too crude --- a 3s response and a 12s response are both "tolerating." No component decomposition. | Simplicity drives adoption. AXS must be explainable in one paragraph, but with more gradient than three buckets. |
| **MOS** | Voice | Grounded in subjective perception. ITU standardization. | Expensive to calibrate (requires human tests). Algorithmic proxies can diverge for novel codecs. Scale compression --- most scores fall in 3.0--4.5. | Ground AXS in user satisfaction data (Paper-1). Use the full 0--100 range, not a narrow band. |
| **VMAF** | Video | Best-in-class correlation with human perception. Content-adaptive. | Opaque --- hard to explain why the score changed. Training data biases; not decomposable into actionable sub-scores. | Transparency matters. AXS components must be individually interpretable. Avoid ML-learned weights until sufficient user data exists. |
| **Conviva Score** | Video ops | Real-time at-scale use. Dimensional slicing as core value. | Proprietary formula --- cannot reproduce, validate, or compare. Weights are opaque and tuned per-customer. Lock-in risk. | **Publish the formula. Open the weights.** Our strongest differentiator vs. proprietary scores. |

### 6.9 Pitfalls and Mitigations

**Goodhart's Law (Gaming).** Risk: teams optimize the score rather than the experience. Mitigation: the gated structure prevents inflating Q to compensate for low G. Rework Rate serves as a gaming detector --- high task completion with high rework indicates false completions. Sub-score decomposition is always published alongside AXS.

**Simpson's Paradox (Masking).** Risk: aggregate AXS is stable while specific cohorts degrade, hidden by improvements elsewhere. Mitigation: always report AXS broken down by content type and at least one core dimension. Operational rule: never report aggregate AXS without a dimensional slice alongside it.

**Apples to Oranges (Context-dependence).** Risk: comparing AXS across fundamentally different workloads. Mitigation: content-type-specific weights partially address this. For cross-organization comparison, we propose a normalized AXS adjusting for content-type mix, analogous to risk-adjusted returns in finance. Full specification deferred to Paper-1.

**Threshold Sensitivity.** Risk: clamp/max parameters are design choices that affect score distribution. Mitigation: calibrate thresholds empirically from observed distributions (Paper-1). Publish all thresholds as a named configuration profile (e.g., "AXS-v1-2026") so scores are reproducible. Changing thresholds produces a new version, never a retroactive rewrite.

**Temporal Aggregation.** Risk: averaging AXS over a week hides within-week variance. A Tuesday outage that cratered quality to AXS 20 for 4 hours may barely dent the weekly average. Mitigation: report AXS at multiple temporal granularities --- per-session, hourly, daily, weekly. Alert on hourly AXS drops exceeding a threshold (proposed: >15 points below trailing 24-hour average). The per-session AXS is always computable and stored; aggregation is a presentation choice, not a data-loss choice.

**Cold Start.** Risk: a cohort with 3 sessions has high AXS variance. Mitigation: require minimum sample size (proposed: N >= 30) before reporting AXS for any dimensional slice.

---

## 7. Illustrative Examples

We present three scenarios that exercise the framework across different content types, showing the state machine in action, computing metrics at each phase, and calculating AXS. These examples use realistic timings, tool calls, and failure modes drawn from common agent interactions.

### 7.1 Coding Agent: Guided Task

**Scenario.** A developer asks Claude Code to add input validation to a REST API endpoint. The session unfolds as follows:

```
t=0.0s    User: "Add input validation to the POST /users endpoint
           in api/users.py. Validate email format, require name
           length 2-100, and return 422 with error details."
           [State: Starting]

t=1.2s    Agent begins streaming response: "I'll add input validation..."
           [State: Working]

t=3.5s    Agent calls Read tool on api/users.py
           [State: Stalled (tool_call, 2.1s)]

t=5.6s    File contents returned. Agent resumes streaming analysis.
           [State: Working]

t=8.3s    Agent calls Read tool on api/models.py
           [State: Stalled (tool_call, 1.4s)]

t=9.7s    File returned. Agent streams proposed approach.
           [State: Working]

t=14.2s   Agent calls Edit tool to modify api/users.py
           [State: Stalled (tool_call, 3.8s)]

t=18.0s   Edit applied. Agent streams explanation of changes.
           [State: Working]

t=22.5s   Agent calls Bash to run pytest
           [State: Stalled (tool_call, 8.3s)]

t=30.8s   Tests pass. Agent streams summary.
           [State: Working]

t=35.1s   Agent: "Validation added. All 12 tests pass."
           [State: Ended (task_complete)]
```

**Metric computation:**

| Metric | Value | Notes |
|--------|-------|-------|
| TTFR | 1.2s | Starting duration |
| Stall Ratio | 15.6 / (18.3 + 15.6) = 0.460 | 15.6s stalled, 18.3s working (excl. 1.2s Starting) |
| Stall Frequency | 4 | Four tool-call stalls |
| Stall Duration p50 | 2.95s | Median of sorted [1.4, 2.1, 3.8, 8.3]: (2.1+3.8)/2 |
| Progress Cadence | ~3 events/min | Steady output between stalls |
| Interaction Frequency | 0 | No questions asked |
| Steering Events | 0 | No corrections needed |
| Task Completion | Yes | Agent signaled done, tests pass |
| First-Attempt Success | Yes | Zero steering, task complete |
| TTTC | 35.1s | Prompt to completion |

**AXS Computation** (session-level, guided_task weights):

```
S_start = 1.0 (successful start, TTFR 1.2s < 10s SLO)
S_stall = (1 - 0.460/0.20) -> clamped to 0 (ratio exceeds max)
        = 0 x ... = 0   [Note: stall ratio 46% far exceeds 20% max]
S_del   = 0.40 x 1.0 + 0.35 x 1.0 + 0.25 x 1.0 = 1.0
S_flow  = 0.40 x (1 - 1.2/15) + 0.25 x 0.85 + 0.35 x (1 - 0/30) = 0.940
S_res   = 0.45 x 1.0 + 0.35 x 1.0 + 0.20 x 1.0 = 1.0

G = 1.0 x 1.0^0.8 = 1.0
Q = 0.40 x 0.0 + 0.35 x 1.0 + 0.25 x 0.940 = 0.585
AXS = 1.0 x 0.585 x 100 = 58.5
```

**Analysis.** Despite a successful first-attempt completion, this session scores only 58.5 ("Fair"). The stall ratio of 46% --- nearly half the active session time spent waiting for tool calls --- crushes the Stall Freedom score. The 8.3-second test-run stall is the primary culprit. This is the framework revealing something real: from the user's perspective, waiting 15.6 seconds out of a 33.9-second active window for tool calls is not a great experience, even though the outcome was correct.

Now consider an improved version of the same agent with a faster test runner and parallel file reads:

```
t=0.0s    User submits same task.              [State: Starting]
t=0.8s    Agent begins streaming.              [State: Working]
t=2.5s    Agent reads both files in parallel.  [State: Stalled (tool_call, 1.0s)]
t=3.5s    Files returned. Agent streams plan.  [State: Working]
t=7.0s    Agent edits file + runs tests.       [State: Stalled (tool_call, 2.5s)]
t=9.5s    Tests pass. Agent streams summary.   [State: Working]
t=13.5s   Agent: "Validation added."           [State: Ended (task_complete)]
```

```
Starting: 0.8s, Stalled: 3.5s (1.0 + 2.5), Working: 13.5 - 0.8 - 3.5 = 9.2s
Stall Ratio: 3.5 / (9.2 + 3.5) = 3.5 / 12.7 = 0.276
TTTC: 13.5s (62% faster), Stall count: 2 (vs 4)
```

```
S_stall = (1 - 0.276/0.20) -> clamped to 0 still. Ratio exceeds 20% max.
```

Even the optimized version exceeds the stall ratio max. This surfaces a calibration question: for coding agents, where tool calls are inherent to the task, the 20% stall ratio threshold may need content-type-specific tuning --- an explicit open question for Paper-1 (see Section 8).

However, if we account for the fact that *expected* tool calls may be perceived differently from *unexpected* stalls, and adjust the threshold for coding tasks to 40%, the optimized agent scores:

```
S_stall = (1 - 0.276/0.40) x (1 - 0.3 x 2/10) = 0.310 x 0.94 = 0.291
Q = 0.40 x 0.291 + 0.35 x 1.0 + 0.25 x 0.96 = 0.706
AXS = 1.0 x 0.706 x 100 = 70.6
```

The difference between AXS 58.5 and 70.6 --- a jump from "Fair" to the upper end of "Fair," approaching "Good" --- captures the genuine improvement in user experience from faster tool execution and fewer interruptions.

### 7.2 Customer Support Agent: Quick Answer

**Scenario.** A customer asks a support agent: "What's your refund policy for annual subscriptions?"

```
t=0.0s    User: "What's your refund policy for annual subscriptions?"
           [State: Starting]

t=0.6s    Agent begins streaming: "For annual subscriptions..."
           [State: Working]

t=0.9s    Agent calls knowledge base retrieval tool
           [State: Stalled (tool_call, 1.2s)]

t=2.1s    KB results returned. Agent resumes streaming.
           [State: Working]

t=5.8s    Agent: "...prorated refund within the first 30 days,
           and a 50% credit after that. Would you like me to
           start a refund for you?"
           [State: Ended (task_complete)]
```

**Metric computation:**

| Metric | Value |
|--------|-------|
| TTFR | 0.6s |
| Stall Ratio | 1.2 / (4.6 + 1.2) = 0.207 |
| Stall Frequency | 1 |
| Interaction Frequency | 0 |
| Task Completion | Yes |
| TTTC | 5.8s |

**AXS Computation** (session-level, quick_answer weights: w1=0.20, w2=0.30, w3=0.50, beta=1.0):

```
S_start = 1.0
S_stall = (1 - 0.207/0.20) -> clamped: S_stall_base = 0, S_stall = 0
S_del   = 1.0 (correct answer, no steering)
S_flow  = 0.40 x (1 - 0.6/15) + 0.25 x 0.90 + 0.35 x 1.0 = 0.934
S_res   = 1.0

G = 1.0 x 1.0 = 1.0
Q = 0.20 x 0 + 0.30 x 1.0 + 0.50 x 0.934 = 0.767
AXS = 1.0 x 0.767 x 100 = 76.7
```

The quick_answer weights save this session: despite a marginal stall ratio, stall freedom carries only 20% weight for quick answers (versus 40% for guided tasks). The user got a fast, correct answer in 5.8 seconds. The framework scores this as "Good" --- which aligns with the intuition that a single brief tool call during a fast answer is barely noticeable.

Now consider a degraded version:

```
Same question, degraded agent:
t=0.0s    User submits question.               [State: Starting]
t=4.2s    Agent begins streaming (slow start).  [State: Working]
t=5.0s    Agent calls KB retrieval.             [State: Stalled (tool_call, 3.5s)]
t=8.5s    KB returns. Agent streams answer.     [State: Working]
t=12.8s   Agent gives a vague, partially correct answer.
          User: "That doesn't sound right, can you check again?"
          [Steering event — user corrects]
```

```
Starting: 4.2s, Stalled: 3.5s, Working: 12.8 - 4.2 - 3.5 = 5.1s
Stall Ratio: 3.5 / (5.1 + 3.5) = 3.5 / 8.6 = 0.407

S_start = 1.0 (still started, but TTFR 4.2s is costly at quick_answer weights)
S_stall_base = 1 - clamp(0.407 / 0.20, 0, 1) = 0   [ratio far exceeds 20% max]
S_stall = 0
S_del   = 0.40 x 1.0 + 0.35 x 0.0 + 0.25 x 1.0 = 0.650
         (zero first-attempt correctness due to steering)
S_flow  = 0.40 x (1 - 4.2/15) + 0.25 x 0.70 + 0.35 x (1 - 4/30) = 0.762
S_res   = 0.45 x 0.5 + 0.35 x 0.5 + 0.20 x 1.0 = 0.600

G = 1.0^1.0 x 0.600^1.0 = 0.600   [quick_answer: beta = 1.0, hard gate]
Q = 0.20 x 0.0 + 0.30 x 0.650 + 0.50 x 0.762 = 0.576
AXS = 0.600 x 0.576 x 100 = 34.6
```

AXS 34.6 --- "Poor." For a simple refund policy question, making the user wait 4.2 seconds, giving a wrong answer, and requiring a follow-up is a genuinely poor experience. The hard resolution gate (beta = 1.0 for quick_answer) penalizes heavily because there is no partial credit for failing to answer a simple question correctly.

### 7.3 Autonomous Workflow: CI/CD Agent

**Scenario.** A developer instructs an agent: "Run the test suite, fix any failures, and open a PR." The agent operates autonomously for 12 minutes.

```
t=0.0s     User: "Run the full test suite, fix any failures,
            and open a PR with the fixes."
            [State: Starting]

t=2.8s     Agent: "Starting test suite..."
            [State: Working]

t=3.1s     Agent calls Bash: pytest --tb=short
            [State: Stalled (tool_call)]

t=45.2s    Tests complete: 3 failures out of 247.
            [State: Working] Agent analyzes failures.

t=48.0s    Agent calls Read on test_auth.py
            [State: Stalled (tool_call, 1.5s)]

t=49.5s    [State: Working] Agent reasons about fix.

t=55.0s    Agent calls Edit on auth/handler.py
            [State: Stalled (tool_call, 2.2s)]

t=57.2s    [State: Working]

t=62.0s    Agent calls Edit on auth/middleware.py
            [State: Stalled (tool_call, 1.8s)]

t=63.8s    [State: Working]

t=68.0s    Agent calls Bash: pytest test_auth.py
            [State: Stalled (tool_call, 12.5s)]

t=80.5s    Tests pass. Agent moves to next failure.
            [State: Working]

            ...similar pattern for 2 more failures...

t=680.0s   All 3 failures fixed. Agent runs full suite.
            [State: Stalled (tool_call, 42.1s)]

t=722.1s   247/247 tests pass.
            [State: Working]

t=725.0s   Agent calls git commands to create branch and PR.
            [State: Stalled (tool_call, 8.3s)]

t=733.3s   Agent: "PR #142 opened. All 247 tests pass.
            Fixed 3 issues: auth token expiry, middleware
            ordering, and test fixture teardown."
            [State: Ended (task_complete)]
```

**Metric computation:**

| Metric | Value | Notes |
|--------|-------|-------|
| TTFR | 2.8s | |
| Stall Ratio | ~0.65 | Heavy tool use is expected for autonomous work |
| Stall Frequency | ~15 | Many tool calls across 12 minutes |
| Interaction Frequency | 0 | Fully autonomous |
| Steering Events | 0 | No human in the loop |
| Task Completion | Yes | PR opened, all tests pass |
| TTTC | 733.3s (~12.2 minutes) | |
| Token Efficiency | Low | Many reasoning tokens for 3 edits |

**AXS Computation** (autonomous_workflow weights: w1=0.15, w2=0.50, w3=0.35, beta=1.0):

```
S_start = 1.0
S_stall = ~0 (ratio far exceeds 20% threshold)
S_del   = 0.40 x 0.95 + 0.35 x 1.0 + 0.25 x 0.90 = 0.955
S_flow  = 0.40 x (1 - 2.8/15) + 0.25 x 0.60 + 0.35 x 1.0 = 0.875
S_res   = 0.45 x 1.0 + 0.35 x 0.95 + 0.20 x 1.0 = 0.983

G = 1.0 x 0.983^1.0 = 0.983
Q = 0.15 x 0.0 + 0.50 x 0.955 + 0.35 x 0.875 = 0.784
AXS = 0.983 x 0.784 x 100 = 77.1
```

Despite an extremely high stall ratio (65%), this session scores 77.1 ("Good"). The autonomous_workflow weights assign only 15% to stall freedom --- the user is not watching in real-time, so stalls only matter insofar as they extend total runtime. What matters is whether the agent *delivered*: all tests fixed, PR opened, correct results. The framework correctly captures that for autonomous workflows, outcome quality dominates process quality.

This example highlights why content-type weighting is essential. Under guided_task weights, the same session would score much lower (the 65% stall ratio would devastate the score), which would be misleading --- the user explicitly delegated this work and is not sitting through the stalls.

**Contrast with a failed autonomous workflow:**

Same task, but the agent fails to fix the third test failure after 5 retries, opens a PR with one test still failing, and does not mention it:

```
S_del = 0.40 x 0.80 + 0.35 x 0.0 + 0.25 x 0.60 = 0.470
       (first_attempt = 0 because result is wrong; recovery failures)
S_res = 0.45 x 0.0 + 0.35 x 0.50 + 0.20 x 1.0 = 0.375
       (task not completed: 1 test still failing)

G = 1.0 x 0.375^1.0 = 0.375
Q = 0.15 x 0.0 + 0.50 x 0.470 + 0.35 x 0.875 = 0.541
AXS = 0.375 x 0.541 x 100 = 20.3
```

AXS 20.3 --- "Failing." The hard resolution gate (beta = 1.0 for autonomous workflows) correctly flags this as a critical failure. An autonomous agent that silently opens a PR with failing tests has betrayed the user's trust. The score reflects that severity.

---

## 8. Discussion and Future Work

### 8.1 Analogical "Money Numbers"

Zhang et al.'s most-cited findings follow a formula: a human-readable quality change leads to a business-readable impact. "1% increase in buffering ratio leads to 3 minutes less viewing." "Join time exceeding 2 seconds costs 5.8% of viewers per additional second." These numbers get cited in investor decks because they translate technical metrics to business outcomes.

We cannot produce empirical money numbers without data, but we can frame analogical predictions grounded in related research:

*Back-of-envelope calculation.* If the average knowledge worker uses an AI agent 20 times per day, and average TTFR is 5 seconds versus an achievable 1.5 seconds, that is 70 seconds per day or over 6 hours per year of waiting --- per person. At an average loaded cost of $80/hour for a knowledge worker, that is approximately $500/year/person in productivity lost to start-up latency alone. For a 10,000-person enterprise, that is $5 million annually in a single metric.

*Stall impact projection.* In video, one buffering event reduces viewing time by approximately 39% compared to zero-buffering sessions [3]. Agent stalls are structurally similar: each stall breaks the user's problem-solving flow state, and flow state restoration has a fixed cognitive cost. We predict that sessions with zero stalls will have substantially higher task completion rates and lower abandonment than sessions with even one stall, and that the relationship will be concave (the first stall hurts the most).

### 8.2 Testable Predictions

We frame the following hypotheses for empirical validation in Paper-1:

**H1 (Start threshold).** TTFR exceeding 5 seconds increases Pre-Response Abandonment Rate by more than 20%, consistent with web response time research showing user attention breaks at 5--10 seconds [19, 20].

**H2 (Stall dominance).** Stall Ratio will be the single strongest predictor of Abandonment Rate, ahead of all other individual metrics --- paralleling Zhang's finding that buffering ratio was the #1 predictor of viewer disengagement.

**H3 (Frequency independence).** Stall Frequency will have an independent negative effect on task completion even after controlling for Stall Ratio, because each stall imposes a fixed attention-restoration cost --- paralleling Zhang's finding that rebuffering frequency independently predicts engagement loss.

**H4 (Content type moderation).** The strength and direction of metric-to-outcome relationships will vary significantly by Agent Content Type. Specifically, TTFR will have the strongest effect for quick_answer sessions, Stall Ratio for guided_task and deep_session, and Task Completion Rate for autonomous_workflow.

**H5 (First-attempt leverage).** First-Attempt Success Rate will be the strongest predictor of Return Rate (re-adoption), ahead of speed-related metrics. Users tolerate slowness more than they tolerate incorrectness.

**H6 (Coherence decay).** Turn-over-Turn Coherence will be negatively correlated with session length and positively correlated with context compaction events, indicating that context management is a key determinant of deep_session quality.

### 8.3 Paper-1 Preview

Paper-1 (empirical validation) will instrument real agent sessions at scale and test the predictions above. The research agenda includes:

1. **Weight calibration.** Derive AXS weights empirically via regression against user satisfaction signals (Return Rate, Net Satisfaction, retention).
2. **Gate exponent tuning.** Determine whether alpha = 1.0 and beta = 0.8 are the right gate sensitivities. Specifically: does a 1% start failure rate feel twice as bad as a 1% non-resolution rate, or is the relationship non-linear?
3. **Threshold discovery.** Replace proposed defaults (stall_ratio_max = 0.20, TTFR_max = 15s, etc.) with empirically grounded thresholds based on observed distributions and user satisfaction correlation.
4. **Content type validation.** Verify the four content types via cluster analysis on real session telemetry, and determine whether the classification rules need refinement.
5. **Money numbers.** Produce agent-specific versions of Zhang's headline findings: "Each additional stall event costs X% task completion probability."
6. **Subjective validation.** Correlate AXS with human-rated experience quality. Target: Pearson r >= 0.7 (comparable to early VMAF validation).

### 8.4 Limitations

We acknowledge several limitations of this work:

**No empirical validation.** This paper defines a measurement framework; it does not validate it with data. The metrics are grounded in analogical reasoning from video QoE and first principles about user experience, but the specific thresholds, weights, and predictions are hypotheses, not findings. Paper-1 is designed to address this gap.

**Threshold arbitrariness.** Parameters such as stall_ratio_max = 0.20, TTFR_SLO = 10s, and stall_count_max = 10 are educated guesses informed by web UX research and domain intuition. They may prove too lenient or too strict for specific agent types. We explicitly mark these as configurable and version-controlled.

**L4 metric dependency.** Four metrics (Delivery Quality Score, Steering Recovery Time, Net Satisfaction, Turn-over-Turn Coherence) require an evaluation judge --- a significant instrumentation burden. The framework is designed to function without L4 metrics (using L2 proxies), but full precision requires evaluation infrastructure that many organizations do not yet have.

**Single-agent scope.** The framework models single-agent sessions. Multi-agent orchestration (Agent A delegates to Agent B) introduces composability questions: is the sub-agent call a Stalled episode or a nested session? We define the boundary --- if the sub-agent's output is not streamed to the user, it is a tool call; if it is, it is a nested session --- but a full treatment of multi-agent composability is deferred to future work.

### 8.5 Open Questions

**Stall threshold calibration.** For L1 (client-only) observation, how long must the output stream pause before we declare a Stalled state? Too short (200ms) triggers false stalls during normal generation. Too long (5s) undercounts real stalls. This likely needs empirical calibration with user perception studies.

**Gate exponent tuning.** Are alpha = 1.0 and beta = 0.8 the right gate sensitivities? Empirical data on how start failures and non-resolution affect overall perceived quality will determine this. Specifically: does a 1% start failure rate feel twice as bad as a 1% non-resolution rate, or is the relationship non-linear? The current exponents are principled defaults, but the sensitivity analysis (Section 6.6) shows that the gate significantly shapes AXS behavior, making calibration a priority for Paper-1.

**Steering detection.** Identifying when a user message is a correction versus a continuation is non-trivial without semantic analysis. Simple heuristics ("no", "actually", "I meant") may suffice for L1 instrumentation; framework-level signals (`user_interrupt` vs. `user_continue`) would improve precision at L2.

**Multi-agent composability.** As agent-to-agent delegation becomes common, the framework needs a formal composition model. We hypothesize that the state machine composes recursively: each sub-agent instantiates its own state machine, and the parent agent treats the sub-session as either a tool call (Stalled, if not user-visible) or a nested session (if user-visible).

**Domain-specific weight profiles.** The four content types may not capture all relevant variation. A coding agent and a customer support agent have structurally different task profiles even within the same content type. Domain-specific weight profiles may be needed, and the dimension system (D4: Task) provides the slicing infrastructure to develop them.

### 8.6 Vision

Just as Zhang et al.'s player state machine and quality metrics became the shared vocabulary for how the streaming industry measures video quality, we intend this framework to become the shared vocabulary for agent experience quality. The transformation we envision:

- **Before:** "The agent responded in 2.3 seconds with 95% eval accuracy."
- **After:** "The user received a first response in 0.8s, perceived continuous progress throughout, completed their task on the first attempt without steering corrections, and the interaction required 40% less effort than the manual alternative. AXS: 87."

The first statement describes what the system did. The second describes what the user experienced. The difference is the measurement standard this paper proposes.

---

## 9. Conclusion

We have presented the Agent Experience (AX) framework, a formal metrics standard for measuring the quality of AI agent interactions. Our contributions are:

1. An **agent session state machine** with six states that captures the full lifecycle of an agent interaction, extending Zhang et al.'s player state machine with a Waiting state for bidirectional interaction and enriched Stalled semantics for tool use and error recovery.

2. A **metrics taxonomy** of 29 quality metrics across five experience phases, each formally derived from observable states and transitions, classified by observability level for progressive adoption.

3. A **diagnostic dimension system** of 11 dimensions enabling fault isolation, cohort comparison, and content-type-aware analysis.

4. The **Agent Experience Score (AXS)**, a gated multiplicative-additive composite with an open, published formula, content-type weight adaptation, and principled resistance to gaming and masking.

The framework is grounded in three forms of rigor: formal (every metric derived from the state machine), analogical (structural parallels to the video QoE framework that transformed streaming), and practical (every metric tied to observable events and classified by instrumentation requirement). We have demonstrated the framework through three worked examples spanning coding agents, customer support agents, and autonomous workflows.

AI agents are at the inflection point that video streaming reached in 2010: enormous and growing, but measured in fragmented, implementation-centric ways that miss what matters most --- the user's experience. We release this framework as an open specification and invite the community to validate, calibrate, and adopt it. The metrics are defined. The state machine is running. What remains is to measure.

---

## Appendix A: Event Schema

The state machine assumes the following minimal event stream. This is a reference for evaluating whether a given agent framework can support L1/L2 metrics, not a formal specification (that belongs in the SDK phase).

```
event: prompt_submit        { session_id, timestamp, prompt_hash }
event: first_token          { session_id, timestamp }
event: output_chunk         { session_id, timestamp, token_count, chunk_type }
event: tool_call_start      { session_id, timestamp, tool_name }
event: tool_call_end        { session_id, timestamp, tool_name, status,
                              duration_ms }
event: retry_start          { session_id, timestamp, retry_reason,
                              attempt_number }
event: retry_end            { session_id, timestamp, status }
event: user_input_requested { session_id, timestamp, input_type }
event: user_input_received  { session_id, timestamp }
event: steering_event       { session_id, timestamp }
event: error                { session_id, timestamp, error_type, is_fatal }
event: task_complete        { session_id, timestamp, completion_type }
event: user_cancel          { session_id, timestamp, current_state }
event: session_end          { session_id, timestamp, end_reason }
```

Each event carries session-level dimension attributes (D1--D5) as labels. Extended dimension attributes (D6--D8) are attached when available.

---

## Appendix B: Full Metric Reference Table

| # | Metric | Phase | Type | Unit | Observability | Zhang Analogue |
|---|--------|-------|------|------|---------------|----------------|
| 1.1 | Time to First Response (TTFR) | Initiation | histogram | seconds | L1 | Join Time |
| 1.2 | Start Failure Rate | Initiation | rate | % | L2 | Join Failure Rate |
| 1.3 | Pre-Response Abandonment Rate | Initiation | rate | % | L1 | Abandonment Before Start |
| 1.4 | Start Retry Rate | Initiation | rate | % | L2 | *(new)* |
| 2.1 | Stall Ratio | Progress | gauge | % | L1*/L2 | Buffering Ratio |
| 2.2 | Stall Frequency | Progress | counter | count/session | L2 | Rebuffering Frequency |
| 2.3 | Stall Duration Distribution | Progress | histogram | seconds | L1 | Rebuffering Duration |
| 2.4 | Progress Cadence | Progress | gauge | events/min | L1 | Bitrate |
| 2.5 | Perceived Throughput | Progress | gauge | tokens/s | L1 | Video Bitrate |
| 2.6 | Output Fidelity Rate | Progress | rate | % | L2 | Rendering Quality |
| 3.1 | Interaction Frequency | Interaction | counter | count/session | L2 | *(new)* |
| 3.2 | Wait Duration Distribution | Interaction | histogram | seconds | L1 | *(new)* |
| 3.3 | Resumption Latency | Interaction | histogram | seconds | L1 | *(rebuffer-exit)* |
| 3.4 | Steering Event Count | Interaction | counter | count/session | L1 | *(new)* |
| 3.5 | Steering Recovery Time | Interaction | histogram | seconds | L4 | *(new)* |
| 3.6 | Interaction Overhead Ratio | Interaction | gauge | % | L3 | *(new)* |
| 4.1 | Task Completion Rate | Delivery | rate | % | L2 | *(new)* |
| 4.2 | First-Attempt Success Rate | Delivery | rate | % | L3 | *(new)* |
| 4.3 | Delivery Quality Score | Delivery | gauge | 0--1 | L4 | Perceptual Quality |
| 4.4 | Rework Rate | Delivery | rate | % | L3 | *(new)* |
| 4.5 | Partial Delivery Rate | Delivery | rate | % | L3 | *(new)* |
| 4.6 | Token Efficiency Ratio | Delivery | gauge | ratio | L2 | *(new)* |
| 5.1 | Time to Task Completion | Resolution | histogram | seconds | L1 | Session Duration |
| 5.2 | Session Duration | Resolution | histogram | seconds | L1 | Session Duration |
| 5.3 | User Attention Ratio | Resolution | gauge | % | L3 | *(new)* |
| 5.4 | Leverage Ratio | Resolution | gauge | ratio | L3 | *(new)* |
| 5.5 | Abandonment Rate | Resolution | rate | % | L1 | Abandonment Rate |
| 5.6 | Abandonment Phase | Resolution | histogram | categorical | L1 | *(new)* |
| 5.7 | Return Rate | Resolution | rate | % | L1 | *(new)* |
| 5.8 | Net Satisfaction | Resolution | gauge | -1 to +1 | L4 | *(QoE equivalent)* |
| 5.9 | Turn-over-Turn Coherence | Resolution | gauge | 0--1 | L4 | *(bitrate decay)* |

*Stall Ratio at L1 uses a client-side heuristic (output gap > threshold). At L2 it uses explicit tool-call events. Both are valid; L2 is more precise.*

---

## References

[1] Markets and Markets. "AI Agent Market Size and Growth Projections." 2025. *Note: Market projection cited as illustrative; exact figures should be verified against the published report at time of submission.*

[2] McKinsey & Company. "The State of AI in 2025: Enterprise Adoption Survey." 2025. *Note: Adoption figure cited as illustrative; exact figures should be verified against the published report at time of submission.*

[3] F. Dobrian, V. Sekar, A. Zia, M. Zimmer, J. Jiang, I. Stoica, H. Zhang. "Understanding the Impact of Video Quality on User Engagement." Proc. ACM SIGCOMM, 2011.

[4] LangSmith. https://smith.langchain.com/

[5] Langfuse. https://langfuse.com/

[6] Datadog LLM Observability. https://www.datadoghq.com/product/llm-observability/

[7] New Relic AI Monitoring. https://newrelic.com/platform/ai-monitoring

[8] Helicone. https://helicone.ai/

[9] Portkey. https://portkey.ai/

[10] AgentOps. https://agentops.ai/

[11] C. E. Jimenez et al. "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" Proc. ICLR, 2024.

[12] S. Zhou et al. "WebArena: A Realistic Web Environment for Building Autonomous Agents." Proc. ICLR, 2024.

[13] Arize AI / Phoenix. https://arize.com/

[14] Google. "Web Vitals." https://web.dev/vitals/

[15] Google. "RAIL Performance Model." https://web.dev/rail/

[16] ITU-T Recommendation P.800. "Methods for Subjective Determination of Transmission Quality."

[17] Apdex Alliance. "Application Performance Index." https://www.apdex.org/

[18] Z. Li et al. "Toward A Practical Perceptual Video Quality Metric." Netflix Technology Blog, 2016.

[19] J. Nielsen. "Response Times: The 3 Important Limits." Nielsen Norman Group, 1993.

[20] W. J. Doherty and R. P. Kelisky. "Managing VM/CMS Systems for User Effectiveness." IBM Systems Journal, 1979.
