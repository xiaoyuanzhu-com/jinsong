# Jinsong — Agent Experience Intelligence

> The Conviva for AI Agents.

## Problem

AI agents are becoming the primary interface between users and AI models — the equivalent of the video player in streaming. Yet there is no standard way to measure, monitor, or benchmark the **user experience** of AI agents.

Current tools (LangSmith, LangFuse, Datadog) focus on **developer debugging** — traces, token counts, individual runs. Nobody provides:

- A universal **experience metrics standard** for AI agents
- **Real-time operational dashboards** across agent fleets
- **Cross-vendor, cross-model** quality benchmarking
- **Evolution and regression** insights over time

This is where video analytics was in ~2010 — fragmented, implementation-focused, no shared language for quality.

## Insight

The AI agent is the **player**. The model is the **CDN**. The tools are the **APIs**. Just as Conviva built the quality intelligence layer for the entire video streaming stack, we build it for the entire AI agent stack.

**Metrics should describe the experience, not the implementation.**

"Stall rate increased 3x" is an experience metric.
"Token count went up" is an implementation metric.
The first tells you something is wrong. The second tells you nothing.

## Core Value Proposition

**We provide insights about how agents and models evolve or regress.**

- Did last week's model update help or hurt?
- Is agent v2.1 better than v2.0 for real users?
- Are coding tasks degrading while chat tasks improve?
- What changed, when, and why?

## Key Differentiator

**Cross-vendor, cross-model comparison insights.**

Published monthly benchmarks: "Here's how AI agents performed this month across models, frameworks, and task types — based on real user experience data."

This makes us the **authority** on agent quality, the way Conviva became the authority on streaming quality.

---

## Experience Metrics Standard

### The AI Experience Stack

```
Intent       (user's goal)
Model        (reasoning engine)
Tools/APIs   (external capabilities)
Agent        (orchestrate & deliver)
Interface    (present)
─────────────────────────
     USER EXPERIENCE
```

Metrics describe the experience. Stack layers are dimensions for diagnosis.

### Phase 1: Initiation

*"I asked — did it start?"*

| Metric | Definition |
|--------|-----------|
| **Time to First Response (TTFR)** | User prompt → first visible agent output |
| **Start Success Rate** | % of requests that produce a response |
| **Start Failure Rate** | % of requests with no response (error, timeout, crash) |
| **Abandon Before Response** | % of sessions user leaves before any output |

### Phase 2: Progress

*"It's working — do I feel forward motion?"*

| Metric | Definition |
|--------|-----------|
| **Stall Rate** | % of session time with no visible progress |
| **Stall Count** | Number of stall events per session |
| **Stall Duration (p50/p95)** | How long each stall lasts |
| **Progress Cadence** | Frequency of visible progress signals |
| **Perceived Throughput** | Rate of meaningful user-facing output delivery |

### Phase 3: Interaction

*"It needs me — is it smooth or disruptive?"*

| Metric | Definition |
|--------|-----------|
| **Interruption Rate** | Pauses for user input per unit of work |
| **Interruption Resolution Time** | How long agent is blocked waiting for user |
| **Resumption Latency** | User responds → agent resumes visible work |
| **Steering Events** | Times user corrected agent mid-task |
| **Steering Recovery Time** | Correction → aligned output |

### Phase 4: Delivery

*"It produced output — is it what I needed?"*

| Metric | Definition |
|--------|-----------|
| **Task Completion Rate** | % of sessions where user's goal was achieved |
| **First-Attempt Success Rate** | % completed without correction or retry |
| **Delivery Quality Score** | Composite of correctness, completeness, adherence |
| **Rework Rate** | % of sessions requiring redo or fix |
| **Partial Delivery Rate** | % where agent completed some but not all |

### Phase 5: Resolution

*"Was it worth it?"*

| Metric | Definition |
|--------|-----------|
| **Session Duration** | Wall-clock time, prompt to resolution |
| **Effort Ratio** | User active time vs agent active time |
| **Abandonment Rate** | % terminated without completing task |
| **Abandonment Point** | Which phase the user gave up |
| **Return Rate** | Does user come back? |
| **Net Satisfaction** | Explicit + implicit signals |

### Composite: Agent Experience Score (AXS)

Single number. Weighted composite of all phases.

```
AXS = f(Start Success, Stall Freedom, Delivery Quality, Interaction Flow, Resolution)
```

"Agent experience was 87 this week, down from 91 — stalls increased during Tuesday's model update."

### Diagnostic Dimensions

Every metric sliceable by:

| Dimension | Examples |
|-----------|---------|
| Agent | Type, version, framework |
| Model | Provider, model name, fallback chain |
| Tools | Which tool, provider, MCP server |
| Context | Window utilization, compaction events |
| Interface | CLI, IDE, web, API |
| Task | Category, complexity tier |
| User | Segment, geography |
| Session | Single-turn, multi-turn, autonomous |

---

## Target Customers

### Segment 1: End Users (Individuals & Teams)

**Install our tool → see your agent experience.**

- Local OTLP receiver that captures telemetry from any ACP-compatible agent
- Personal dashboard: "your agent quality this week"
- Regression alerts: "your coding agent got 15% slower after yesterday's model update"

### Segment 2: Agent Vendors (Frameworks & Platforms)

**Embed our SDK → give your users experience visibility.**

- Lightweight SDK that instruments any agent framework
- Out-of-the-box dashboards for their customers
- Benchmark: "how your agent compares to the ecosystem"

### Segment 3: Model Providers

**Understand how your model performs in real agent workloads.**

- Real-world experience data (not synthetic benchmarks)
- Regression detection: "your latest release increased stall rate 2x in coding agents"
- Competitive positioning: "your model delivers 12% better first-attempt success"

### Segment 4: Enterprises

**Fleet-wide agent quality monitoring.**

- Real-time operational dashboards across all agents in the org
- SLA monitoring: "95% of tasks complete within 30s"
- Vendor comparison: "which model/agent performs best for our workloads?"
- Cost-quality optimization: "same quality, 40% cheaper with model X for simple tasks"

---

## Distribution Strategy

### Phase 1: Define the Standard

- Publish the Agent Experience Metrics Specification
- Open source the metric definitions
- Build credibility through content and industry reports

### Phase 2: End-User Tool

- Local OTLP receiver (leveraging ACP telemetry spec)
- CLI install: `brew install agentqoe` or IDE extension
- Captures experience metrics from any ACP-compatible agent
- Personal dashboard + regression alerts
- Gets 70-80% of experience metrics without vendor cooperation

### Phase 3: Agent SDK

- Thin instrumentation layer for agent frameworks
- Captures the remaining 20-30% (delivery quality, reasoning efficiency, context management)
- Target framework authors: LangChain, CrewAI, Claude Agent SDK
- Open source, OTEL-native

### Phase 4: Cloud Platform & Benchmarks

- Anonymized data aggregation (opt-in)
- Cross-vendor benchmarking
- Monthly "State of Agent Quality" reports
- Enterprise dashboards with fleet-level analytics

---

## Competitive Landscape

| Player | What They Do | Our Differentiation |
|--------|-------------|---------------------|
| LangSmith / LangFuse | Dev debugging (traces, evals) | We measure experience, not implementation |
| Datadog / New Relic | Generic infra + LLM bolt-on | We're purpose-built for agent experience |
| Helicone / PortKey | LLM proxy (cost, routing) | We measure the full stack, not just the model call |
| AgentOps | Closest — agent session tracking | We define the standard + cross-vendor benchmarking |
| Conviva (analogue) | Video QoE intelligence | We are this, for AI agents |

**Whitespace: Nobody owns experience-centric, cross-vendor, real-time agent quality intelligence.**

---

## Moats

1. **The Standard** — If we define how agent quality is measured, everyone uses our language
2. **The Data** — Every install = more benchmark data. Network effect
3. **The Authority** — Monthly reports make us the trusted source for agent quality
4. **Cross-vendor** — No single vendor can do this; only an independent player can benchmark fairly

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| "Quality is subjective" — hard to measure task success | Start with observable metrics (TTFR, stalls, abandonment); add eval-based metrics incrementally |
| Vendor resistance to instrumentation | Start with end-user tool (no vendor needed); SDK is open-source, non-threatening |
| Market too early — agents not mature enough | The earlier we define the standard, the stronger the moat. Conviva started before OTT was mainstream |
| OTEL / ACP spec changes | Stay close to the spec process; contribute to ACP telemetry RFD |
| Privacy concerns with aggregated data | Anonymization by default; user controls what's shared; local-first architecture |

---

## Success Metrics (for us)

| Milestone | Target |
|-----------|--------|
| Metrics spec published | Month 2 |
| End-user tool in beta | Month 4 |
| 1K active installs | Month 6 |
| First monthly benchmark report | Month 6 |
| Agent SDK adopted by 1 major framework | Month 9 |
| 10K active installs | Month 12 |
| First enterprise customer | Month 12 |
| Industry standard recognition | Month 18 |

---

## Open Questions

1. Should the metrics spec be an open standard (submit to a body like IETF/W3C) or proprietary?
2. How to measure Delivery Quality without eval infrastructure? Can implicit signals (rework, abandonment, acceptance) be sufficient?
3. Pricing model: freemium (personal free, team/enterprise paid)? Usage-based?
4. Should we contribute directly to the ACP telemetry RFD to shape the spec in our favor?
5. Build vs partner for the eval/quality scoring layer?
