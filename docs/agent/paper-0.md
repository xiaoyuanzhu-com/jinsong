# Measuring Agent Experience: A Quality Metrics Framework for AI Agents

**Abstract.** AI agents --- software systems that use large language models to reason, plan, and act on behalf of users --- are rapidly becoming the primary interface through which knowledge workers interact with AI. Yet the relationship between agent experience quality and user adoption remains unquantified. There is no shared vocabulary for what "quality" even means when a human collaborates with an AI agent across a multi-turn, tool-using session. We propose the Agent Experience (AX) framework, a two-layer metrics standard for measuring the quality of AI agent interactions. The framework comprises three contributions: (1) an agent session state machine with six states that captures the full lifecycle of an agent interaction, directly paralleling the player state machine that enabled video quality measurement; (2) a two-layer metrics architecture that separates *operational metrics* (objective, per-event and per-session measurements for engineering teams) from *experience metrics* organized into five orthogonal quality pillars --- Responsiveness, Reliability, Autonomy, Correctness, and Completion --- each answering a distinct user question; and (3) a content-type system that modulates which pillars matter most for different interaction patterns. We ground every metric in observable events at the agent-framework boundary, classify each by observability level, and demonstrate the framework through three illustrative scenarios. Cross-domain analysis of seven established quality frameworks --- from video streaming to web performance to voice telephony --- validates both the pillar structure and the two-layer approach. To the best of our knowledge, this is the first experience-centric metrics standard for AI agents. We release the framework as an open specification to serve as a foundation for empirical validation.

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

The core insight of this paper is a two-layer metrics architecture. *Operational metrics* tell you what changed: tokens per session went up 40%, tool call duration spiked, error rate doubled. *Experience metrics* tell you whether users care: responsiveness degraded, reliability dropped, task completion fell. The first layer serves engineers detecting regressions. The second layer serves product teams and executives assessing quality. The bridge between them --- deriving experience assessments from operational measurements --- is what transforms raw telemetry into actionable quality intelligence.

In this paper, we present the Agent Experience (AX) framework. Our contributions are:

1. **An agent session state machine** with six states (Starting, Working, Stalled, Waiting, Failed, Ended) that captures the full lifecycle of an agent interaction. The state machine is a strict superset of Zhang et al.'s player state machine, extended with a Waiting state to model the bidirectional interaction that distinguishes agents from passive media.

2. **A two-layer metrics architecture** that separates operational metrics (session-level and per-event measurements instrumentable by any agent framework) from experience metrics organized into five orthogonal quality pillars --- Responsiveness, Reliability, Autonomy, Correctness, and Completion --- each answering a distinct user question and grounded in cross-domain research across seven QoE domains.

3. **A content-type system** with four agent interaction patterns (Quick Answer, Guided Task, Deep Session, Autonomous Workflow) that modulates which experience pillars matter most, following Zhang's finding that content type moderates the quality-engagement relationship.

The rest of this paper is organized as follows. Section 2 surveys related work across seven quality domains and identifies the measurement gap. Section 3 presents the agent session state machine. Section 4 defines the operational metrics layer. Section 5 introduces the five experience pillars. Section 6 describes the content-type system. Section 7 covers diagnostic dimensions. Section 8 walks through three illustrative examples. Section 9 discusses predictions, limitations, and future work. Section 10 concludes.

---

## 2. Related Work

The landscape of AI agent monitoring is active but fragmented. We organize prior work into five categories, survey six adjacent quality domains for structural precedent, and identify the gap that motivates our framework.

### 2.1 Video QoE: The Model We Adapt

The work most directly relevant to ours comes from video streaming. Zhang et al.'s SIGCOMM 2011 study [3] used data from Conviva's measurement platform (~40 million video views across 200+ content providers) to establish that specific, formally defined quality metrics --- join time, buffering ratio, average bitrate, rebuffering frequency --- causally impact viewer engagement. The study's power derived from three elements: (a) a player state machine that made "quality" concrete and measurable, (b) metrics derived from observable states rather than ad hoc intuitions, and (c) "money numbers" that translated quality changes to business outcomes ("1% more buffering costs 3 minutes of viewing time"). The work won the SIGCOMM Test of Time Award in 2022.

Conviva subsequently operationalized these metrics at scale, developing the Streaming Performance Index (SPI) --- a composite score aggregating multiple QoE metrics into a single assessment. The SPI demonstrated that even the strongest individual-metric framework eventually needs a composite for executive communication. ITU-T P.1203 extended the approach to standardized, multi-mode quality estimation with formal subjective validation, using modular sub-recommendations for video, audio, and session-integrated quality scores. Netflix developed VMAF to address the gap between bitrate-as-proxy and actual perceptual quality, winning a Technology and Engineering Emmy Award. Mux distilled video QoE into four categories (playback failures, startup time, rebuffering, video quality) that map to a temporal lifecycle: Can it start? How fast? Does it interrupt? Is the output good?

We adapt Zhang's framework to the agent domain. The adaptation is non-trivial. Agent sessions are bidirectional (requiring a new Waiting state), involve tool use as observable substates (enriching the Stalled state), include error recovery loops (demanding careful terminal-state design), and produce task outcomes rather than continuous streams (motivating entirely new quality dimensions around autonomy, correctness, and completion).

### 2.2 Web Performance: The Adoption Model We Follow

Google's Core Web Vitals [14] organize web performance around three user-centric pillars: Loading (Largest Contentful Paint), Interactivity (Interaction to Next Paint), and Visual Stability (Cumulative Layout Shift). Each pillar answers a user question: "Is it loading?" "Can I use it?" "Is it stable?"

Core Web Vitals succeeded for five reasons that inform our design: (1) a small number of core metrics (three) that are easy to remember and communicate; (2) user-centric framing with plain-language questions; (3) a tie to business outcomes via Google search ranking; (4) field measurement from real users rather than lab simulations; and (5) a two-tier structure separating core experiential metrics (LCP, INP, CLS) from diagnostic supporting metrics (TTFB, FCP, TBT). The diagnostic metrics explain *why* a core metric is bad; the core metrics capture *what the user feels*. This two-tier separation is a powerful organizing principle that we adopt as our two-layer architecture.

The evolution of Core Web Vitals also provides a cautionary lesson: First Input Delay (FID) was replaced by Interaction to Next Paint (INP) in March 2024 because FID only measured the *first* interaction and only the *input delay* phase. Frameworks must be designed to evolve.

### 2.3 Other QoE Domains: Cross-Domain Validation

We surveyed five additional quality domains to validate our framework structure.

**Voice and Telephony (MOS, E-model).** ITU-T P.800 defines the Mean Opinion Score (MOS), a 5-point subjective scale that became the universal quality metric for voice. The E-model (ITU-T G.107) bridges objective and subjective measurement by predicting MOS from measurable network parameters using a subtractive decomposition: R = Ro - Is - Id - Ie + A. The E-model's MECE impairment categories (noise, simultaneous distortion, delay, equipment, advantage) demonstrate that a small number of orthogonal dimensions can capture a complex quality space. Its objective-input, subjective-output bridge --- computing user-perceivable quality from measurable system parameters --- is precisely the relationship between our operational and experience layers.

**Application Performance (Apdex, SRE Golden Signals, RAIL).** Apdex classifies every transaction into Satisfied, Tolerating, or Frustrated zones based on response time. Its strength is simplicity; its weakness is single-dimension reductionism. The SRE Golden Signals (latency, traffic, errors, saturation) represent the *operational* side of quality --- system health, not user experience. Google's RAIL model organizes web performance around user activities (Response, Animation, Idle, Load) with thresholds grounded in perception research. The Golden Signals measure system health; experience metrics measure user perception. Operational metrics bridge the two --- and this is exactly the role of our Layer 1.

**Conversational AI and Chatbot Quality.** The chatbot industry has converged on operational metrics (containment rate, CSAT, resolution rate, first contact resolution) without a formal QoE framework. Coppola et al.'s multivocal literature review [21] identified 123 quality attributes across four macro-categories (Relational, Conversational, User-Centered, Quantitative) from 118 sources. The fragmentation mirrors agent monitoring today: each vendor measures slightly different things, no state machine ties them together, and there is no composite score. This is the same pre-Zhang state that video streaming occupied.

**HCI (ISO 9241-11, Nielsen's heuristics, NASA-TLX).** ISO 9241-11 defines usability through three pillars: effectiveness, efficiency, and satisfaction. Nielsen's ten usability heuristics include "visibility of system status" (our Responsiveness pillar), "user control and freedom" (our Autonomy pillar), and "help users recover from errors" (our Reliability pillar). NASA-TLX [22] separates task demands (mental, physical, temporal) from interaction experience (effort, performance, frustration) --- a demand/interaction split that parallels our operational/experience separation.

**Gaming QoE.** Gaming research distinguishes KPIs (network-level: bandwidth, latency, packet loss) from KQIs (service-level: input lag, freezes, perceived frame rate). This KPI-to-KQI mapping is exactly the operational-to-experiential bridge our framework provides. A CHI 2023 study established that frame time *consistency* matters more than average frame rate --- a steady 45fps feels better than a fluctuating 30-60fps with the same average. This validates our emphasis on stall predictability and progress consistency over raw throughput.

### 2.4 Agent Monitoring Tools

Current agent monitoring tools fall into four categories, each with a specific blind spot:

**LLM Observability (LangSmith, Langfuse).** These platforms provide trace-level observability: trace trees, per-step latency, token counts, cost estimates, and evaluation scores. They are implementation-focused --- they know what the *system* did but not what the *user experienced*. Neither tool tracks time to first response as a user-experience metric, stall perception, or any measure of user effort.

**APM with AI Extensions (Datadog, New Relic).** Traditional Application Performance Monitoring extended to cover LLM calls. The mental model remains "service health," not "user health." Datadog can report the p99 latency of LLM API calls, but not whether users perceived that latency as acceptable.

**AI Gateway and Proxy Tools (Helicone, Portkey).** LLM proxies providing request/response logging, latency, token and cost tracking. These tools operate below the application layer entirely --- they see individual LLM API calls in isolation and cannot correlate them into sessions or user outcomes.

**Agent-Specific Monitoring (AgentOps).** AgentOps records entire agent sessions as replayable timelines --- the closest existing tool to experience-level thinking. However, it remains agent-centric rather than user-centric. Its metrics describe what the agent *did*, not what the user *felt*.

### 2.5 The Gap

The linguistic pattern across the landscape is telling: every tool uses developer/engineering verbs (debug, monitor, evaluate, troubleshoot) with the *application* or *agent* as the object. Not a single tool positions itself around the *user's experience* of interacting with an AI agent. The gap is structural:

1. **Heritage bias.** Most tools evolved from APM, ML model monitoring, or developer tooling. Their mental models are "service health" or "model quality," not "user experience."
2. **Instrumentation boundary.** Current tools instrument at the LLM API call level. Experience metrics require instrumentation at the *interaction boundary* --- where the human and the AI meet.
3. **No established vocabulary.** Unlike web performance (Core Web Vitals), voice quality (MOS), or video streaming (buffering ratio, join time), there is no established vocabulary for AI agent experience quality.

### 2.6 Cross-Domain Comparison

Table 1 maps our five experience pillars to equivalent concepts across all seven domains, demonstrating that the pillar structure is not arbitrary but reflects recurring patterns in how quality is measured across interactive systems.

| Pillar | Video QoE | Web (CWV) | Voice (E-model) | App Perf | Chatbot | HCI | Gaming |
|--------|-----------|-----------|-----------------|----------|---------|-----|--------|
| **Responsiveness** | Join Time | LCP, INP | Delay (Id) | Apdex T, RAIL Response | First response time | Nielsen #1: Visibility | Input latency |
| **Reliability** | Buffering Ratio, VSF | (Load failure) | Ie (equipment) | Error rate, Golden Signal: Errors | Escalation rate | Nielsen #9: Error recovery | Freeze rate, frame drops |
| **Autonomy** | *(N/A --- passive)* | *(N/A)* | *(N/A)* | *(N/A)* | Containment rate | ISO Efficiency, NASA-TLX Effort | *(N/A)* |
| **Correctness** | Bitrate, VMAF | (Correct rendering) | R-factor | *(Implicit)* | Resolution quality | ISO Effectiveness | Visual quality |
| **Completion** | Session duration | Bounce rate | Call completion | *(Implicit)* | Resolution rate, FCR | Task completion rate | Session retention |

**Table 1.** Cross-domain mapping of the five experience pillars. Autonomy is the pillar unique to agent interactions --- it has no parallel in passive media or non-interactive systems. This is the structural addition that adapts the Zhang model to interactive AI.

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
                          +---------------------------------------------------+
                          |                                                     |
                          |          +-------------------------------+          |
                          |          |                               |          |
                          v          v                               |          |
+-----------+  first    +----------+  resume   +-------------+      |          |
|           |  output   |          | <-------- |  Waiting     |      |          |
| Starting  | --------> | Working  | --------> |  (on user)   |      |          |
|           |           |          |  ask user  +-------------+      |          |
+-----------+           +----------+                                 |          |
     |                    |  |  ^  |                                 |          |
     |                    |  |  |  |  tool call returns /            |          |
     | fail /             |  |  |  |  retry succeeds                |          |
     | timeout /          |  |  |  +----------------------+         |          |
     | abandon            |  |  |                         |         |          |
     v                    |  |  |  tool call  +------------------+  |          |
+-----------+             |  |  +------------ |  Stalled         |  |          |
|           |             |  |                |  (tool/retry)    |--+          |
| Failed    |             |  |  error/retry   +------------------+  error      |
|           |             |  +--------------->        ^             exceeds    |
+-----------+             |                           |             retry      |
     ^                    |       retry loop          |             budget     |
     |                    |       (same error)  ------+                        |
     | unrecoverable      |                                                    |
     | error              |  task done /                                       |
     +--------------------+  user stops                                        |
                          v                                                    |
                   +----------+                                                |
                   |          | <----------------------------------------------+
                   | Ended    |
                   |          |
                   +----------+
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

**Table 2.** State definitions for the Agent Session State Machine. Every state is defined by events observable at the client/framework boundary.

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

**Table 3.** State transitions with triggers and observable events.

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

## 4. Operational Metrics

Operational metrics are the raw, objective measurements that agent vendors and engineering teams instrument, monitor, and put on dashboards. They answer "what happened?" --- not "did the user care?" They are the SRE Golden Signals of agent quality: latency, traffic, errors, and saturation measured at the agent interaction level.

The analogy to other domains is precise. SRE Golden Signals measure system health. Experience metrics measure user perception. Operational metrics bridge the two --- they are the objective inputs from which experience assessments are derived, just as the E-model computes subjective MOS from measurable network parameters, and Core Web Vitals derive user-centric scores from browser timing data.

### 4.1 Session-Level Metrics

These metrics summarize an entire agent session. They are what vendors put on dashboards to detect regressions: "After v2.1, tokens per session went up 40%."

| Metric | Unit | Definition | State Mapping |
|--------|------|------------|---------------|
| **Tokens per Session** | count | Total tokens consumed (input + output + reasoning) across all turns | Cross-session |
| **Turns per Session** | count | Number of user-agent exchange cycles | Working episodes |
| **Tool Calls per Session** | count | Number of external tool invocations | Working -> Stalled transitions (tool_call) |
| **Duration per Session** | seconds | Wall-clock time from prompt submission to session end | Starting entry -> Ended/Failed entry |
| **Errors per Session** | count | Number of error events (recoverable and fatal) | Error events across all states |

**Table 4.** Session-level operational metrics.

### 4.2 Per-Event Metrics

These metrics capture individual events within a session. They provide the granularity needed to diagnose *where* in a session quality breaks down.

| Metric | Unit | Definition | State Mapping |
|--------|------|------------|---------------|
| **Time to First Token** | seconds | Wall-clock time from prompt submission to first visible output token | Duration of Starting state |
| **Tokens per Turn** | count | Tokens consumed in a single user-agent exchange | Within Working episode |
| **Tool Call Duration** | seconds | Wall-clock time from tool invocation to result return | Duration of individual Stalled (tool_call) episode |
| **Tool Success Rate** | % | Fraction of tool calls that return successfully | Stalled -> Working vs. Stalled -> Failed |
| **Retry Count** | count | Number of automatic retries per error event | Within Stalled (retry) episodes |
| **Stall Duration** | seconds | Duration of each individual stall event | Duration of each Stalled episode |
| **Output Speed** | tokens/s | Rate of visible output token delivery during active generation | Within Working state |
| **Resume Speed** | seconds | Time from user input to next visible output token after a Waiting pause | Waiting -> Working transition |

**Table 5.** Per-event operational metrics.

These operational metrics are what every agent framework can instrument today. They require no subjective judgment, no evaluation infrastructure, and no user feedback. They are the foundation from which experience metrics are derived.

---

## 5. Experience Metrics: Five Pillars

Experience metrics answer "does the user care?" They are derived from operational metrics but organized around user perception rather than system behavior. Where operational metrics tell you that tool call duration spiked, experience metrics tell you that reliability degraded --- and *that* is what drives adoption, retention, and trust.

### 5.1 Why Five Pillars?

Cross-domain evidence suggests that 3-5 top-level categories is optimal for a quality framework. Core Web Vitals uses 3. SRE Golden Signals and RAIL use 4. Zhang's video metrics and the E-model use 5. NASA-TLX uses 6 but is frequently simplified. The mean across ten frameworks we surveyed is 4.1; the mode is 4; the range is 3-6.

We choose five pillars because the agent domain is structurally richer than any single prior domain --- it combines real-time streaming (like video), interactivity (like web), task completion (like chatbots), and autonomous operation (like no prior domain). Five pillars are the minimum needed to cover this space without redundancy.

Each pillar is defined by a user question. If a user would ask it, we measure it. If two questions are really the same question, we merge the pillars. If a pillar cannot be asked as a simple question, it is too abstract.

The five pillars are also designed to be orthogonal --- improving one does not automatically improve or degrade another. A session can be fast but unreliable (high Responsiveness, low Reliability). A session can be autonomous but incorrect (high Autonomy, low Correctness). This independence is what makes the pillars useful for diagnosis: when quality drops, you can identify *which* dimension degraded.

For executive communication, the five pillars collapse into a three-tier view:

| Tier | Pillars | Executive Question |
|------|---------|-------------------|
| **Process** | Responsiveness + Reliability | "Is the system working smoothly?" |
| **Experience** | Autonomy | "Is the agent handling it, or is the user doing the work?" |
| **Outcome** | Correctness + Completion | "Did we get the right result?" |

### 5.2 Pillar 1: Responsiveness --- "Is it fast?"

Responsiveness captures whether the agent feels fast and fluid. It maps to the most universal dimension in QoE --- every domain we surveyed measures "how fast did the system respond?" Video has join time. Web has LCP and INP. RAIL targets 100ms response. Telephony penalizes delay. Gaming measures input latency. Responsiveness is the table stakes of experience quality.

| Metric | What It Measures | How It Is Measured | Observability |
|--------|-----------------|-------------------|---------------|
| **Time to First Token** | How long until the agent starts responding | Prompt submission to first visible output token | L1 |
| **Output Speed** | How fast visible output arrives during generation | Visible output tokens per second during Working state | L1 |
| **Resume Speed** | How fast the agent picks back up after user input | User input received to next visible output token | L1 |
| **Time per Turn** | How long each exchange cycle takes | Wall-clock time per user-agent turn | L1 |

**State machine mapping.** Responsiveness measures the *duration* of Starting (Time to First Token), the *throughput* within Working (Output Speed), and the *transition latency* from Waiting to Working (Resume Speed).

**Cross-domain parallel.** Time to First Token parallels Zhang's Join Time --- the most frequently cited video QoE metric. Output Speed parallels video bitrate (sustained throughput of useful content). Resume Speed parallels the rebuffer-exit latency that gaming QoE research identifies as critical for perceived smoothness.

**Independence.** A session can be fast but unreliable (responsive but error-prone), or fast but incorrect (responsive but wrong). Speed does not imply quality.

### 5.3 Pillar 2: Reliability --- "Does it work without breaking?"

Reliability captures whether the agent runs smoothly or is plagued by failures, stalls, and hidden retries. It maps to the interruption/stall dimension present in video (buffering ratio), gaming (freeze rate), and web (load failures). Zhang's single most important finding was that buffering ratio dominates engagement --- reliability is the pillar that separates usable agents from frustrating ones.

| Metric | What It Measures | How It Is Measured | Observability |
|--------|-----------------|-------------------|---------------|
| **Start Failure Rate** | How often the agent fails to start at all | Sessions with Starting -> Failed / total sessions | L2 |
| **Stall Ratio** | What fraction of active time is spent stalled | Time in Stalled / (Time in Working + Stalled) | L1/L2 |
| **Stall Count** | How many times progress is interrupted | Working -> Stalled transitions per session | L2 |
| **Average Stall Duration** | How long each interruption lasts | Mean duration of Stalled episodes | L1 |
| **Error Rate** | How often errors occur during work | Error events per session | L2 |
| **Hidden Retries** | How often the agent silently retries failed operations | Retry events not visible to user per session | L2 |

**State machine mapping.** Reliability measures the Stalled state comprehensively --- its ratio to Working, its frequency, and its duration --- plus the Starting -> Failed transition (start failures) and error events across all states.

**Cross-domain parallel.** Stall Ratio is the direct parallel to Zhang's Buffering Ratio --- the single most predictive metric of viewer disengagement. Start Failure Rate parallels Video Start Failure (VSF), which Conviva includes in the SPI as a gate metric. Hidden Retries have no video parallel but map to the E-model's equipment impairment factor (Ie) --- degradation that the user does not directly see but that affects quality through extended latency.

**Independence.** A session can be reliable but slow (no stalls, but high latency), or reliable but incorrect (smooth operation, wrong output).

### 5.4 Pillar 3: Autonomy --- "Can it handle it on its own?"

Autonomy captures whether the agent operates independently or requires constant user supervision. This is the pillar unique to agent interactions --- it has no parallel in passive media (video, voice), minimal parallel in web performance, and only partial parallel in chatbot metrics (containment rate). It is the structural addition that adapts the Zhang model to interactive AI systems.

Autonomy matters because the entire value proposition of an AI agent is leverage: the agent does the work so the user does not have to. An agent that constantly asks questions, requires corrections, or needs hand-holding is not delivering on this promise.

| Metric | What It Measures | How It Is Measured | Observability |
|--------|-----------------|-------------------|---------------|
| **Questions Asked** | How often the agent interrupts for clarification | Working -> Waiting transitions per session | L2 |
| **User Corrections** | How often the user must redirect the agent | Corrective user messages during Working state | L1 |
| **First-Try Success Rate** | How often the agent gets it right without help | Sessions with zero corrections and task completion / completed sessions | L3 |
| **User Active Time %** | What fraction of session time requires user engagement | (Waiting + correction + user-input time) / session duration | L3 |
| **Work Multiplier** | How much agent work each unit of user input generates | Working time / (Waiting + user input time) | L3 |

**State machine mapping.** Autonomy measures the Waiting state (Questions Asked, User Active Time %), the Working state during corrections (User Corrections), and derived ratios across states (Work Multiplier, First-Try Success Rate).

**Cross-domain parallel.** Chatbot containment rate (fraction of conversations resolved without human escalation) is the closest parallel. ISO 9241-11 efficiency (resources used relative to results achieved) captures a similar concept. NASA-TLX effort dimension measures how hard the user had to work. Nielsen's heuristic #7 (flexibility and efficiency of use) relates to whether the system adapts to expert users.

**Independence.** A session can be autonomous but slow (the agent works independently but takes forever), or autonomous but incorrect (the agent does not ask questions but produces wrong output). High autonomy does not imply high quality --- it means low user effort.

### 5.5 Pillar 4: Correctness --- "Is the output right?"

Correctness captures the quality of the agent's output --- whether it is accurate, well-formed, and useful. It maps to the output quality dimension present in every QoE framework: video has bitrate and VMAF, telephony has the R-factor, chatbots have resolution quality, and HCI has ISO 9241-11 effectiveness.

| Metric | What It Measures | How It Is Measured | Observability |
|--------|-----------------|-------------------|---------------|
| **Output Quality Score** | Overall correctness of the final output | Evaluation judge (human or LLM-as-judge) assessing correctness, completeness, adherence | L4 |
| **Clean Output Rate** | Fraction of output that is well-formed | Parse/validate each output chunk (valid syntax, valid markdown, no truncation) | L2 |
| **Quality Decay** | Whether output quality degrades over long sessions | Quality score in final third of turns vs. first third | L4 |
| **Useful Token %** | How much of the compute budget produced user-facing value | Visible output tokens / total tokens consumed | L2 |

**State machine mapping.** Correctness primarily measures the output produced during Working episodes and evaluated at the Ended state. Quality Decay measures change across successive Working episodes. Clean Output Rate is assessed in real-time during Working.

**Cross-domain parallel.** Output Quality Score parallels video's perceptual quality (MOS, VMAF) --- the hardest metric to measure but often the most important. Clean Output Rate parallels video rendering quality (frame rate, resolution fidelity). Quality Decay parallels bitrate degradation over long video sessions. Useful Token % has no direct video parallel but maps to the agent-specific concern of compute efficiency.

**Independence.** A session can be correct but slow (right answer, long wait), or correct but unreliable (good output despite multiple stalls and retries). Correctness measures the *what*; other pillars measure the *how*.

### 5.6 Pillar 5: Completion --- "Did it finish the job?"

Completion captures whether the agent achieved the user's goal. It is the ultimate outcome metric --- everything else is process. Task completion maps to chatbot resolution rate, HCI task completion rate, and (loosely) video session duration as a proxy for engagement.

| Metric | What It Measures | How It Is Measured | Observability |
|--------|-----------------|-------------------|---------------|
| **Task Completion Rate** | How often the agent finishes the job | Sessions with task_complete signal and no immediate dispute / total sessions | L2 |
| **Redo Rate** | How often users must redo the task | Sessions followed by a closely related prompt within a time window | L3 |
| **Gave-Up Rate** | How often users abandon mid-task | Sessions terminated by user before task completion | L1 |
| **Where They Gave Up** | At what point users abandon | State at the time of user_cancel event | L1 |
| **Time to Done** | How long until the task is complete | Prompt submission to task_complete signal | L1 |
| **Came Back Rate** | Whether users return for more sessions | Users who initiate a new session within 24 hours | L1 |

**State machine mapping.** Completion measures the terminal transitions: Working -> Ended (task_complete) for success, any-state -> Ended (user_cancel) for abandonment, and post-session behavior (Redo Rate, Came Back Rate). Where They Gave Up maps the state at abandonment, revealing whether users give up during Starting (too slow to start), Stalled (too many interruptions), or Working (wrong direction).

**Cross-domain parallel.** Task Completion Rate parallels chatbot resolution rate and first contact resolution. Gave-Up Rate parallels Zhang's abandonment rate --- the fraction of sessions terminated before completion. Where They Gave Up parallels the concept of "abandonment point" that Conviva tracks for video (did users leave during startup, during buffering, or during playback?). Came Back Rate is a standard engagement metric across all domains.

**Independence.** A session can complete but be incorrect (the agent "finishes" but the output is wrong --- captured by low Correctness), or complete but with high user effort (the agent finishes but only after extensive corrections --- captured by low Autonomy).

### 5.7 MECE Validation

The five pillars are collectively exhaustive and mutually exclusive across the dimensions of user experience:

| Dimension | Responsible Pillar | Why Not Others |
|-----------|-------------------|---------------|
| Speed / latency | Responsiveness | Reliability measures interruptions, not speed |
| Failures / interruptions | Reliability | Responsiveness measures latency, not failure |
| User effort / independence | Autonomy | Reliability measures system failures, not user burden |
| Output quality / accuracy | Correctness | Completion measures whether it finished, not whether it is right |
| Goal achievement / retention | Completion | Correctness measures output quality, not goal achievement |

Every aspect of agent experience quality maps to exactly one pillar. No quality concern falls through the cracks. No concern is counted twice.

---

## 6. Agent Content Types

Zhang's critical insight was that video content type (Short VoD, Long VoD, Live) fundamentally changed user expectations and therefore changed which metrics mattered most. A 2-second rebuffer during live sports is a crisis; during a 2-hour movie, it is a minor irritant. Content type *moderated* the relationship between quality metrics and user engagement.

We define four agent content types that serve the same structural role.

### 6.1 The Four Types

**Quick Answer** (`quick_answer`). Single-turn or very short multi-turn interaction. The user expects a fast, direct response. Typically 0-2 tool calls, 1-2 turns, under 30 seconds total. Zhang analogue: Short VoD.
*Example:* "What does this error mean?" or "Convert this JSON to YAML."

**Guided Task** (`guided_task`). Multi-turn interactive session where user and agent collaborate toward a goal. Typically 3-15 turns, 3-20 tool calls, 1-15 minutes. The user stays engaged and provides feedback. Zhang analogue: Long VoD.
*Example:* "Help me refactor this module to use dependency injection."

**Deep Session** (`deep_session`). Extended multi-turn session with high complexity. 15-50+ turns, 20-100+ tool calls, 15-60+ minutes. The user is deeply invested; abandonment cost is high. Zhang analogue: Live content.
*Example:* "Implement the authentication system across these 12 files."

**Autonomous Workflow** (`autonomous_workflow`). Agent operates with minimal or no user interaction after the initial instruction. May run for minutes to hours. The user checks back for results. Zhang analogue: no direct parallel (closest is batch transcoding).
*Example:* "Run the full test suite, fix all failures, and open a PR."

### 6.2 Pillar Importance by Content Type

Different content types shift which pillars matter most. The user watching a quick answer cares about speed above all. The user waiting for an autonomous workflow cares about correctness and completion --- they are not watching in real-time, so stalls only matter insofar as they extend total runtime.

| Pillar | Quick Answer | Guided Task | Deep Session | Autonomous Workflow |
|--------|:-----------:|:-----------:|:------------:|:-------------------:|
| **Responsiveness** | **Critical** | High | Medium | Low |
| **Reliability** | Medium | **Critical** | **Critical** | Medium |
| **Autonomy** | Low | High | Medium | Low |
| **Correctness** | **Critical** | Medium | Medium | **Critical** |
| **Completion** | High | Medium | High | **Critical** |

**Table 6.** Qualitative importance of experience pillars by content type.

The rationale: **Quick Answer** sessions are dominated by Responsiveness and Correctness because speed and accuracy are everything for a simple question; failing a trivial question is unacceptable. **Guided Task** is the balanced default, with Reliability and Autonomy elevated because the user is actively collaborating. **Deep Session** has the highest Reliability requirement because a hang at turn 30 of a 40-turn session is devastating. **Autonomous Workflow** is dominated by Correctness and Completion because the agent is unsupervised and every decision must be right.

When reporting across a mixed workload, content-type-specific assessments should be computed for each session before aggregation. Aggregating without content-type stratification is like averaging video quality across live sports and background music videos --- the number is meaningless.

---

## 7. Diagnostic Dimensions

Metrics answer *how well*. Dimensions answer *why* and *where*. A diagnostic dimension is a categorical or ordinal attribute attached to every metric observation that enables slicing, filtering, and root-cause analysis. Without dimensions, a drop in start failure rate is an alarm; with dimensions, it becomes "start failure rate for Claude 3.5 Sonnet on multi-turn coding tasks via the VS Code extension rose 12% after the November 15 model update."

Zhang never formalized a dimension system --- his paper sliced by content type and CDN but did not systematize the concept. Conviva later operationalized dimensional slicing across hundreds of combinations as the core of their product. We adopt Conviva's spirit while defining a taxonomy specific to agents.

We define eight dimensions across two classes:

**Core Dimensions** (always present):

| Dimension | Sub-Attributes | Example Slices |
|-----------|---------------|----------------|
| **Agent** | agent_name, agent_version, agent_framework | "Stall ratio by agent framework" |
| **Model** | provider, model_id, fallback_position | "Time to First Token by model provider" |
| **Interface** | interface_type (CLI, IDE, web, API, mobile) | "Gave-Up Rate on mobile vs CLI" |
| **Task** | task_category, complexity_tier | "Task Completion Rate for debugging vs code generation" |
| **Session Type** | session_mode (single_turn, multi_turn, autonomous, batch) | "Stall Ratio for autonomous vs interactive sessions" |

**Extended Dimensions** (require deeper instrumentation):

| Dimension | Sub-Attributes | Example Slices |
|-----------|---------------|----------------|
| **Tool** | tool_name, tool_provider, mcp_server | "Stall Duration by tool_name" |
| **Context** | window_utilization_pct, compaction_events | "Quality Decay when context > 75% utilized" |
| **User** | user_segment, geography, plan_tier | "Time to First Token by geography" |

**Table 7.** Diagnostic dimensions. Core dimensions are mandatory on every metric observation. Extended dimensions are captured when instrumentation is available.

Several dimension pairs interact in ways that affect analysis: Model x Task (model quality varies by task category), Interface x Session Type (CLI users skew toward deep sessions), and Tool x Context (heavy tool use fills the context window, triggering compaction). Content type is the primary stratification variable --- report all metrics broken down by content type before any other slice.

---

## 8. Illustrative Examples

We present three scenarios that exercise the full framework, showing operational metrics captured during a session, experience pillar assessments derived from them, and diagnostic insights. These examples use realistic timings drawn from common agent interactions.

### 8.1 Coding Agent: Guided Task

**Scenario.** A developer asks Claude Code to add input validation to a REST API endpoint.

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

**Operational metrics:**

| Metric | Value |
|--------|-------|
| Time to First Token | 1.2s |
| Tokens per Session | ~2,400 |
| Turns per Session | 1 |
| Tool Calls per Session | 4 |
| Duration per Session | 35.1s |
| Errors per Session | 0 |
| Tool Call Duration (median) | 2.95s |
| Tool Success Rate | 100% |
| Output Speed | ~45 tok/s (during Working) |

**Experience pillar assessment:**

| Pillar | Assessment | Key Signals |
|--------|-----------|-------------|
| **Responsiveness** | Good | Time to First Token 1.2s is fast. Output Speed 45 tok/s is fluid. |
| **Reliability** | Fair | Stall Ratio 46% (15.6s stalled / 33.9s active). Four stalls, one lasting 8.3s. The 8.3-second test-run stall is the primary concern. |
| **Autonomy** | Excellent | Zero questions asked, zero corrections needed. Agent operated independently. |
| **Correctness** | Excellent | Tests pass, output is well-formed, first-try success. |
| **Completion** | Excellent | Task completed in 35.1s with no rework needed. |

**Diagnosis.** Despite a successful first-attempt completion, the Reliability assessment reveals friction: the user spent nearly half the active session time waiting for tool calls. The 8.3-second pytest execution is the primary culprit. Slicing by Tool dimension reveals that Bash tool calls average 8.3s while Read tool calls average 1.75s. Action: optimize test execution (parallel tests, incremental testing) to reduce the longest stall.

**Contrast: optimized version.** The same task with parallel file reads and a faster test runner:

```
t=0.0s    User submits same task.              [State: Starting]
t=0.8s    Agent begins streaming.              [State: Working]
t=2.5s    Agent reads both files in parallel.  [State: Stalled (1.0s)]
t=3.5s    Files returned. Agent streams plan.  [State: Working]
t=7.0s    Agent edits file + runs tests.       [State: Stalled (2.5s)]
t=9.5s    Tests pass. Agent streams summary.   [State: Working]
t=13.5s   Agent: "Validation added."           [State: Ended (task_complete)]
```

The operational metrics shift dramatically: Stall Ratio drops from 46% to 28% (3.5s stalled / 12.7s active), Stall Count drops from 4 to 2, and Duration per Session drops from 35.1s to 13.5s (62% faster). The Reliability assessment improves from Fair to Good. The improvement is real and the framework captures it.

### 8.2 Customer Support Bot: Quick Answer

**Scenario.** A customer asks: "What's your refund policy for annual subscriptions?"

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

**Operational metrics:**

| Metric | Value |
|--------|-------|
| Time to First Token | 0.6s |
| Duration per Session | 5.8s |
| Tool Calls per Session | 1 |
| Tool Call Duration | 1.2s |
| Stall Ratio | 21% (1.2s / 5.8s) |
| Errors | 0 |

**Experience pillar assessment:**

| Pillar | Assessment | Key Signals |
|--------|-----------|-------------|
| **Responsiveness** | Excellent | Time to First Token 0.6s. Total session 5.8s. For a quick answer, this is fast. |
| **Reliability** | Good | One brief stall for KB retrieval. Acceptable for the interaction pattern. |
| **Autonomy** | Excellent | No questions, no corrections. Answered directly. |
| **Correctness** | Good | Accurate policy information. Well-structured response. |
| **Completion** | Excellent | Task complete in 5.8s. Proactively offered next step. |

**Diagnosis.** This is a healthy quick_answer session. The single KB retrieval stall (1.2s) is barely noticeable in context. For this content type, Responsiveness and Correctness dominate the assessment, and both are strong.

**Contrast: degraded version.** Same question, but the agent is slow to start (4.2s Time to First Token), gives a vague answer, and the user must correct it:

```
t=0.0s    User submits question.               [State: Starting]
t=4.2s    Agent begins streaming (slow start).  [State: Working]
t=5.0s    Agent calls KB retrieval.             [State: Stalled (3.5s)]
t=8.5s    KB returns. Agent streams answer.     [State: Working]
t=12.8s   Agent gives a vague, partially correct answer.
          User: "That doesn't sound right, can you check again?"
          [Steering event]
```

Operational metrics: Time to First Token 4.2s, Stall Duration 3.5s, User Corrections 1, First-Try Success Rate 0%. Experience assessment: Responsiveness degrades from Excellent to Fair (4.2s startup for a simple question is too slow). Correctness drops to Poor (wrong answer requiring correction). Autonomy drops to Fair (user had to correct). For a quick_answer content type, this is a poor experience --- the user could have found the policy page faster than waiting for this interaction.

### 8.3 Autonomous CI/CD Agent: Autonomous Workflow

**Scenario.** A developer instructs an agent: "Run the test suite, fix any failures, and open a PR." The agent operates autonomously for 12 minutes.

```
t=0.0s     User: "Run the full test suite, fix any failures,
            and open a PR with the fixes."
            [State: Starting]

t=2.8s     Agent: "Starting test suite..."
            [State: Working]

t=3.1s     Agent calls Bash: pytest --tb=short
            [State: Stalled (tool_call, 42.1s)]

t=45.2s    Tests complete: 3 failures out of 247.
            [State: Working] Agent analyzes failures.

t=48.0s    Agent calls Read on test_auth.py
            [State: Stalled (tool_call, 1.5s)]

           ...agent reads files, edits code, reruns tests
           for each of the 3 failures...

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

**Operational metrics:**

| Metric | Value |
|--------|-------|
| Time to First Token | 2.8s |
| Duration per Session | 733.3s (~12.2 min) |
| Tool Calls per Session | ~15 |
| Stall Ratio | ~65% |
| Errors | 0 (all retries succeeded) |
| Turns | 1 (fully autonomous) |

**Experience pillar assessment:**

| Pillar | Assessment | Key Signals |
|--------|-----------|-------------|
| **Responsiveness** | N/A (autonomous) | The user is not watching in real-time. Responsiveness is deprioritized for autonomous workflows. |
| **Reliability** | Good | Despite high stall ratio (65%), all tool calls succeeded, no errors, no retries failed. The high stall ratio reflects inherent tool-heaviness, not unreliability. |
| **Autonomy** | Excellent | Zero questions, zero corrections. Fully autonomous operation. |
| **Correctness** | Excellent | All 3 failures correctly diagnosed and fixed. All 247 tests pass. PR includes clear summary. |
| **Completion** | Excellent | Task fully completed. PR opened. Clear deliverable. |

**Diagnosis.** The 65% stall ratio would be alarming for a guided_task, but for an autonomous_workflow it is expected and acceptable --- the agent is inherently tool-heavy (running tests, reading files, editing code). The content-type system correctly deprioritizes Responsiveness and elevates Correctness and Completion for this interaction pattern. What matters is the outcome: all tests fixed, PR opened, 12 minutes of autonomous work that saved the developer 30-60 minutes of manual debugging.

**Contrast: failed autonomous workflow.** Same task, but the agent fails to fix the third test failure after 5 retries, opens a PR with one test still failing, and does not mention it:

Operational metrics: Errors 5, Tool Success Rate drops, task_complete signal issued but one test still fails. Experience assessment: Correctness drops to Poor (silent failure --- the worst kind). Completion drops to Poor (task not actually complete despite the signal). Reliability drops to Fair (5 failed retries indicate a systematic problem). For an autonomous_workflow where Correctness and Completion are critical, this is a severe failure. The agent betrayed the user's trust by silently submitting broken code.

---

## 9. Discussion and Future Work

### 9.1 Analogical "Money Numbers"

Zhang et al.'s most-cited findings translate quality changes to business outcomes: "1% increase in buffering ratio leads to 3 minutes less viewing." "Join time exceeding 2 seconds costs 5.8% of viewers per additional second." These numbers get cited in investor decks because they bridge the gap between what engineers measure and what executives care about.

We cannot produce empirical money numbers without data, but we can frame analogical predictions:

*Back-of-envelope calculation.* If the average knowledge worker uses an AI agent 20 times per day, and average Time to First Token is 5 seconds versus an achievable 1.5 seconds, that is 70 seconds per day or over 6 hours per year of waiting --- per person. At a loaded cost of $80/hour for a knowledge worker, that is approximately $500/year/person in productivity lost to startup latency alone. For a 10,000-person enterprise, that is $5 million annually in a single Responsiveness metric.

*Stall impact projection.* In video, one buffering event reduces viewing time by approximately 39% compared to zero-buffering sessions [3]. Agent stalls are structurally similar: each stall breaks the user's problem-solving flow state, and flow state restoration has a fixed cognitive cost (estimated at 15-25 minutes for deep work by Mark et al. [23]). We predict that sessions with zero stalls will have substantially higher task completion rates than sessions with even one stall, and that the relationship will be concave (the first stall hurts the most).

### 9.2 Testable Hypotheses

We frame the following hypotheses for empirical validation:

**H1 (Start threshold).** Time to First Token exceeding 5 seconds increases Gave-Up Rate by more than 20%, consistent with web response time research showing user attention breaks at 5-10 seconds [19, 20].

**H2 (Stall dominance).** Stall Ratio will be the single strongest predictor of Gave-Up Rate, ahead of all other individual metrics --- paralleling Zhang's finding that buffering ratio was the #1 predictor of viewer disengagement.

**H3 (Frequency independence).** Stall Count will have an independent negative effect on Task Completion Rate even after controlling for Stall Ratio, because each stall imposes a fixed attention-restoration cost --- paralleling Zhang's finding that rebuffering frequency independently predicts engagement loss.

**H4 (Content type moderation).** The strength of metric-to-outcome relationships will vary significantly by content type. Specifically, Time to First Token will have the strongest effect for Quick Answer sessions, Stall Ratio for Guided Task and Deep Session, and Task Completion Rate for Autonomous Workflow.

**H5 (Correctness over speed).** First-Try Success Rate will be the strongest predictor of Came Back Rate (re-adoption), ahead of speed-related metrics. Users tolerate slowness more than they tolerate incorrectness.

**H6 (Coherence decay).** Quality Decay will be negatively correlated with session length and positively correlated with context compaction events, indicating that context management is a key determinant of Deep Session quality.

### 9.3 Composite Score: Future Work

Following the trajectory from Zhang (2011) to Conviva SPI to ITU-T P.1203, a natural next step is a composite Agent Experience Score (AXS) that compresses the five-pillar assessment into a single 0-100 number. The composite would serve as an executive metric --- answering "how good?" and "is it trending up or down?" --- while the individual pillars provide diagnostic depth.

We propose AXS as future work for three reasons. First, a composite score requires empirical weight calibration: how much does each pillar contribute to overall perceived quality? Zhang derived his engagement weights from 40 million video views; we need comparable data from real agent sessions. Second, the content-type weight adaptation (which pillars matter most for which interaction patterns) must be validated through cluster analysis on real telemetry. Third, composite scores carry known risks (Goodhart's Law, Simpson's Paradox, threshold sensitivity) that are better addressed with empirical grounding than a priori design.

The trajectory is clear: define the state machine and metrics (this paper), validate with real data (Paper-1), then derive the composite (Paper-2). Conviva took this path: Zhang's metrics came first, the SPI composite came years later, after the individual metrics were proven.

### 9.4 Paper-1 Preview

Paper-1 (empirical validation) will instrument real agent sessions at scale and test the hypotheses above. The research agenda includes:

1. **Weight discovery.** Determine the empirical relationship between each experience pillar and user satisfaction signals (Came Back Rate, explicit feedback, task success).
2. **Threshold discovery.** Replace proposed defaults with empirically grounded thresholds based on observed distributions and user perception studies.
3. **Content type validation.** Verify the four content types via cluster analysis on real session telemetry.
4. **Money numbers.** Produce agent-specific versions of Zhang's headline findings.
5. **Subjective validation.** Correlate framework assessments with human-rated experience quality. Target: Pearson r >= 0.7 (comparable to early VMAF validation).

### 9.5 Limitations

**No empirical validation.** This paper defines a measurement framework; it does not validate it with data. The metrics are grounded in analogical reasoning from video QoE and cross-domain research, but the specific predictions are hypotheses, not findings.

**L4 metric dependency.** Three metrics (Output Quality Score, Quality Decay, and some aspects of User Corrections detection) require an evaluation judge --- a significant instrumentation burden. The framework is designed to function without L4 metrics using L2 proxies, but full precision requires evaluation infrastructure.

**Single-agent scope.** The framework models single-agent sessions. Multi-agent orchestration introduces composability questions: is the sub-agent call a Stalled episode or a nested session? We define the boundary --- if the sub-agent's output is not streamed to the user, it is a tool call; if it is, it is a nested session --- but a full treatment of multi-agent composability is deferred.

**Stall threshold calibration.** For client-only observation, how long must the output stream pause before we declare a Stalled state? Too short (200ms) triggers false stalls during normal generation. Too long (5s) undercounts real stalls. Empirical calibration is needed.

**Steering detection.** Identifying when a user message is a correction versus a continuation is non-trivial without semantic analysis. Simple heuristics may suffice for initial instrumentation; framework-level signals would improve precision.

### 9.6 Open Questions

1. **Domain-specific pillar weights.** The four content types may not capture all relevant variation. A coding agent and a customer support agent have structurally different profiles even within the same content type.
2. **Multi-agent composability.** As agent-to-agent delegation becomes common, the framework needs a formal composition model.
3. **Temporal aggregation.** Averaging metrics over a week hides within-week variance. A Tuesday outage that cratered quality for 4 hours may barely dent the weekly average. Multi-granularity reporting (per-session, hourly, daily) is needed.
4. **The "expected stall" problem.** Coding agents inherently make many tool calls. Should expected stalls (the agent chose to read a file) be weighted differently from unexpected stalls (the model hung for 30 seconds)?

---

## 10. Conclusion

We have presented the Agent Experience (AX) framework, a two-layer metrics standard for measuring the quality of AI agent interactions. Our contributions are:

1. An **agent session state machine** with six states that captures the full lifecycle of an agent interaction, extending Zhang et al.'s player state machine with a Waiting state for bidirectional interaction and enriched Stalled semantics for tool use and error recovery.

2. A **two-layer metrics architecture** separating operational metrics (objective, per-event and per-session measurements for engineering teams) from experience metrics organized into five orthogonal quality pillars --- Responsiveness, Reliability, Autonomy, Correctness, and Completion --- each answering a distinct user question and grounded in cross-domain research.

3. A **content-type system** with four agent interaction patterns that modulates which experience pillars matter most, following Zhang's finding that content type moderates quality-engagement relationships.

The core insight is the two-layer separation. Operational metrics tell you what changed. Experience metrics tell you whether users care. The bridge between them --- deriving experience assessments from operational measurements --- transforms raw telemetry into actionable quality intelligence.

The framework is grounded in three forms of rigor: formal (every metric derived from the state machine), analogical (structural parallels to the video QoE framework that transformed streaming, validated across seven QoE domains), and practical (every metric tied to observable events and classified by instrumentation requirement).

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

Each event carries session-level dimension attributes (Agent, Model, Interface, Task, Session Type) as labels. Extended dimension attributes (Tool, Context, User) are attached when available.

---

## Appendix B: Full Metric Reference

### B.1 Operational Metrics

| # | Metric | Scope | Unit | State Mapping |
|---|--------|-------|------|---------------|
| O1 | Tokens per Session | session | count | Cross-session |
| O2 | Turns per Session | session | count | Working episodes |
| O3 | Tool Calls per Session | session | count | Working -> Stalled (tool_call) |
| O4 | Duration per Session | session | seconds | Starting -> Ended/Failed |
| O5 | Errors per Session | session | count | Error events |
| O6 | Time to First Token | event | seconds | Duration of Starting |
| O7 | Tokens per Turn | event | count | Within Working |
| O8 | Tool Call Duration | event | seconds | Duration of Stalled (tool_call) |
| O9 | Tool Success Rate | event | % | Stalled -> Working vs. Failed |
| O10 | Retry Count | event | count | Within Stalled (retry) |
| O11 | Stall Duration | event | seconds | Duration of Stalled |
| O12 | Output Speed | event | tokens/s | Within Working |
| O13 | Resume Speed | event | seconds | Waiting -> Working |

### B.2 Experience Metrics

| # | Metric | Pillar | Unit | Observability |
|---|--------|--------|------|---------------|
| R1 | Time to First Token | Responsiveness | seconds | L1 |
| R2 | Output Speed | Responsiveness | tokens/s | L1 |
| R3 | Resume Speed | Responsiveness | seconds | L1 |
| R4 | Time per Turn | Responsiveness | seconds | L1 |
| Re1 | Start Failure Rate | Reliability | % | L2 |
| Re2 | Stall Ratio | Reliability | % | L1/L2 |
| Re3 | Stall Count | Reliability | count | L2 |
| Re4 | Average Stall Duration | Reliability | seconds | L1 |
| Re5 | Error Rate | Reliability | count | L2 |
| Re6 | Hidden Retries | Reliability | count | L2 |
| A1 | Questions Asked | Autonomy | count | L2 |
| A2 | User Corrections | Autonomy | count | L1 |
| A3 | First-Try Success Rate | Autonomy | % | L3 |
| A4 | User Active Time % | Autonomy | % | L3 |
| A5 | Work Multiplier | Autonomy | ratio | L3 |
| Co1 | Output Quality Score | Correctness | 0-1 | L4 |
| Co2 | Clean Output Rate | Correctness | % | L2 |
| Co3 | Quality Decay | Correctness | 0-1 | L4 |
| Co4 | Useful Token % | Correctness | % | L2 |
| Cm1 | Task Completion Rate | Completion | % | L2 |
| Cm2 | Redo Rate | Completion | % | L3 |
| Cm3 | Gave-Up Rate | Completion | % | L1 |
| Cm4 | Where They Gave Up | Completion | categorical | L1 |
| Cm5 | Time to Done | Completion | seconds | L1 |
| Cm6 | Came Back Rate | Completion | % | L1 |

**Observability levels:** L1 = client-side timestamps only. L2 = agent framework events. L3 = derived from L1+L2. L4 = requires evaluation judge.

---
