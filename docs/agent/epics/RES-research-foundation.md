# RES — Research Foundation

## Meta
- Status: in-progress
- Parent roadmap: RM-1

## Goal
Establish research foundation for Paper-0 by analyzing the Zhang SIGCOMM 2011 template and surveying the agent monitoring landscape.

---

## RES-1: Zhang Paper Argumentation Template

**Source:** Florin Dobrian, Vyas Sekar, Asad Zia, Michael Zimmer, Junchen Jiang, Ion Stoica, Hui Zhang. "Understanding the Impact of Video Quality on User Engagement." *Proc. ACM SIGCOMM 2011.*

This paper uses data from Conviva's measurement platform (~40M video views across 200+ content providers) to establish causal relationships between video quality metrics and viewer engagement. It is the structural model for Paper-0.

---

### 1. Section-by-Section Blueprint

#### Abstract — The Promise in 150 Words

**Rhetorical function:** Establish that a massive dataset proves something practitioners care about but have never quantified rigorously.

**Moves:**
1. State the domain and its economic importance (online video, billions of views)
2. Identify the gap: quality-engagement relationship is assumed but unquantified
3. Announce the dataset scale (millions of views from a real measurement platform)
4. Preview the headline findings (specific quality metrics causally impact engagement)
5. Signal practical value: findings inform CDN design, content provider decisions

**Template for Paper-0:**
> AI agents are becoming the primary interface for knowledge worker interactions. Yet the relationship between agent experience quality and user adoption remains unquantified — there is no shared vocabulary for what "quality" even means. We propose [framework name], a metrics standard that defines five experience phases and [N] measurable quality indicators, modeled on the quality-engagement frameworks that transformed video streaming.

---

#### Section 1: Introduction (~1.5 pages)

**Rhetorical function:** Build urgency by showing the gap between industry importance and measurement maturity.

**Argumentation moves (in order):**

1. **The "enormous and growing" opener** — Establish the domain's economic scale with concrete numbers. Video streaming is huge. Everyone knows it. But do they *measure* it properly? This creates the "important domain, immature measurement" tension.

2. **The definitional problem** — Quality means different things to different people. Without precise definitions, you can't optimize. This is the "vocabulary gap" — the field lacks shared language.

3. **The stakeholder inventory** — List who cares and why: content providers (revenue), CDNs (SLAs), advertisers (ROI), end users (satisfaction). Each stakeholder has a different quality concern. This multiplies the urgency.

4. **The "what we do" paragraph** — Transition from problem to contribution. "In this paper, we present..." followed by a crisp summary of the dataset, methodology, and key findings.

5. **The contribution list** — Explicitly numbered contributions (typically 3-4). Each contribution is one sentence, action-oriented. This is the reader's contract: here's what you'll get.

6. **The roadmap paragraph** — "The rest of the paper is organized as follows..." — a brief guide to sections.

**Key phrases and patterns:**
- "Despite [X], there is no systematic study of..."
- "We present the first large-scale measurement study..."
- "Our key findings include..."
- Confidence calibration: strong claims backed by scale ("40 million views," "200+ content providers")

**Template for Paper-0:**
- Open with economic scale of AI agents (market size, adoption curves, enterprise spending)
- Identify the vocabulary gap: "no shared language for agent experience quality"
- Stakeholder inventory: agent vendors, model providers, enterprises, users
- Contribution list: (1) formal agent state machine, (2) metrics taxonomy across five phases, (3) composite score framework, (4) diagnostic dimension system
- Adaptation note: Replace "we measured" with "we formalize" — this is a design paper, not an empirical one

---

#### Section 2: Background and Related Work (~1 page)

**Rhetorical function:** Position the work relative to prior art, showing what exists and what's missing.

**Argumentation moves:**

1. **Acknowledge prior work generously** — Cite related measurement studies, QoE research, user behavior studies. Show you know the literature.

2. **The "but none of them" pivot** — After citing 5-10 papers, reveal the gap: prior work either (a) uses small/synthetic datasets, (b) measures only one quality dimension, (c) doesn't establish causal relationships, or (d) doesn't connect quality to business outcomes.

3. **Categorize the gap** — Prior work falls into buckets (lab studies, small-scale, single-metric). Your work spans all the buckets simultaneously.

4. **Positioning statement** — "To the best of our knowledge, this is the first work that..." — a strong but hedged claim of novelty.

**Template for Paper-0:**
- Bucket 1: LLM observability tools (LangSmith, LangFuse, Helicone) — trace-level, developer-facing, no experience model
- Bucket 2: Traditional APM extended to AI (Datadog, New Relic) — infrastructure metrics bolted onto LLM calls
- Bucket 3: Academic agent evaluation (benchmarks like SWE-bench) — task-specific, not experience-oriented
- Bucket 4: Video QoE literature (Zhang, Conviva) — the model we adapt
- The gap: nobody has defined an experience-centric metrics standard for AI agents
- Adaptation note: This section is *stronger* for a design paper — you're not just saying "nobody measured this," you're saying "nobody even defined what to measure"

---

#### Section 3: Quality Metrics Definition (~1.5 pages)

**Rhetorical function:** Establish formal definitions before any analysis. This is the paper's conceptual foundation.

**Argumentation moves:**

1. **The state machine** — Introduce a formal model of the video viewing experience as a state machine (Figure 1). States: loading, playing, buffering, paused, ended. Transitions are measurable events. This is the single most important conceptual contribution — it makes the abstract ("quality") concrete and measurable.

2. **Metric derivation from states** — Each metric is derived from states or transitions in the state machine. This is not arbitrary — it's principled. Join time = time in "loading" state. Buffering ratio = time in "buffering" / total time. This grounds every metric in an observable, formal model.

3. **Exhaustive enumeration** — List every metric with a precise definition, unit, and measurement method:
   - **Join time** — time from "play" click to first frame rendered
   - **Buffering ratio** — fraction of session spent re-buffering
   - **Average bitrate** — mean encoded bitrate during playback
   - **Rate of buffering events** — buffering events per unit time
   - **Start failure** — binary: did playback ever begin?
   - **Rendering quality** — frame rate, resolution changes

4. **The "why these metrics" justification** — Argue that these metrics are (a) user-perceptible, (b) measurable at scale without instrumentation burden, (c) actionable by different stakeholders, (d) collectively exhaustive of the experience.

**Figure strategy:**
- **Figure 1: State machine diagram** — The single most referenced figure. Simple boxes and arrows. Every reader can understand it in 10 seconds. It becomes the shared vocabulary for the rest of the paper.
- **Table 1: Metric definitions** — Compact table with metric name, formal definition, unit. Reference artifact for the rest of the paper.

**Template for Paper-0:**
- This section maps directly: define the Agent Session State Machine (METRICS-1)
- States: Idle, Initiating, Streaming, Stalled, Waiting-for-User, Delivering, Completed, Abandoned, Failed
- Derive every metric from state durations and transitions
- Table format: Phase | Metric | Definition | Unit | Derived From (state/transition)
- Adaptation note: This is where Paper-0 is *strongest* — formal definitions are exactly what a design paper produces. Zhang's Section 3 is your primary structural model.

---

#### Section 4: Dataset and Methodology (~1 page)

**Rhetorical function:** Establish credibility of the empirical foundation. Make the reader trust the numbers that follow.

**Argumentation moves:**

1. **Scale as credibility** — "We collected data from [massive number] of video views across [huge number] of content providers over [long time period] using [platform name]." The sheer scale pre-empts the "is this generalizable?" objection.

2. **Measurement infrastructure** — Describe how data is collected (client-side instrumentation, Conviva platform). This signals engineering maturity and real-world relevance — not a lab study.

3. **Engagement metric definition** — Define what "engagement" means operationally: play time, completion rate, return visits. This is the dependent variable. Define it precisely before using it.

4. **Confounding variables acknowledgment** — Acknowledge that quality and engagement are confounded by content type, time of day, user demographics, etc. Signal methodological sophistication.

5. **Quasi-experimental design** — Explain the causal inference approach. Natural experiments where quality varies due to infrastructure differences (different CDNs, different ISPs) while content is held constant.

**Template for Paper-0:**
- Paper-0 has no empirical section — this is the biggest structural difference
- **Replace with:** "Measurement Approach" or "Operationalization" section
  - How each metric *would* be measured (instrumentation points)
  - What telemetry signals map to each state transition
  - Feasibility argument: these metrics are observable via OTEL/ACP telemetry
  - Illustrative examples with synthetic or hand-traced scenarios
- Adaptation note: The credibility that Zhang gets from "40 million views" you must get from (a) formalism rigor, (b) grounding in real instrumentation standards, (c) worked examples that feel real

---

#### Section 5: Results (~3-4 pages, the bulk)

**Rhetorical function:** Deliver the "money numbers" — specific, quotable findings that translate quality metrics to business outcomes.

**Argumentation moves:**

1. **One metric, one finding, one visual** — Each subsection isolates a single quality metric and shows its impact on engagement. This disciplined structure makes findings quotable and memorable.

2. **The "money number" technique** — Each finding produces a headline number that a business person can act on:
   - "A 1% increase in buffering ratio leads to a 3-minute decrease in viewing time"
   - "If join time exceeds 2 seconds, each additional second costs 5.8% of viewers"
   - "Videos that experience a start failure have [X]% lower return rate"
   These are the numbers that get cited in investor decks and product reviews. They translate technical metrics to business impact.

3. **Visual evidence pattern** — For each metric:
   - CDF plot showing the metric's distribution (establishes "what's normal")
   - Scatter plot or binned plot showing metric vs. engagement (establishes the relationship)
   - Controlled comparison (quasi-experimental) showing the causal effect

4. **Monotonic relationships** — Show that relationships are monotonic (more buffering = always worse, never better). This pre-empts the "it depends" objection and makes the findings actionable.

5. **Interaction effects** — After individual metrics, show how they interact. Buffering matters more for long-form content. Join time matters more for live content. This adds nuance without undermining the headline findings.

6. **Threshold effects** — Identify critical thresholds where behavior changes discontinuously. "Below 2 seconds join time, engagement is stable. Above 2 seconds, it drops sharply." Thresholds are more actionable than continuous relationships.

**Figure strategy:**
- **CDFs** — Show that metrics vary widely in the wild (motivation: there's a real quality problem)
- **Scatter/hex plots** — Show the quality-engagement relationship (the core finding)
- **Controlled comparisons** — Show the causal claim holds after controlling for confounds
- **Tables** — Correlation matrices, regression coefficients (for the quantitatively minded reader)

**Template for Paper-0:**
- Paper-0 cannot produce empirical "money numbers" — this is the core limitation
- **Replace with:**
  - **Illustrative scenarios** — "Consider a coding agent with TTFR of 8s vs 2s. Based on analogous web/video research, we predict..."
  - **Analogical money numbers** — Borrow from Zhang: "In video, 1% more buffering costs 3 min of viewing. We hypothesize that in agents, each additional stall event costs [X]% completion probability."
  - **Testable predictions** — Frame findings as hypotheses: "H1: TTFR > 5s increases abandonment rate by >20%. H2: Stall ratio > 15% halves task completion rate." This turns the absence of data into a feature: you're generating the research agenda.
  - **Worked examples** — Walk through a complete agent session, annotate every metric, show how AXS would be computed. This gives the reader a concrete experience even without population-level data.

---

#### Section 6: Implications and Discussion (~1 page)

**Rhetorical function:** Translate findings into actionable guidance for practitioners.

**Argumentation moves:**

1. **Stakeholder-specific recommendations** — For each stakeholder identified in the introduction, give specific guidance based on the findings. CDN operators should prioritize join time. Content providers should monitor buffering for long-form content. This closes the loop opened in the introduction.

2. **Design principles** — Distill findings into general principles. "Optimize for start-up experience first, then sustained quality." "Monitor threshold crossings, not averages." These become quotable design heuristics.

3. **Limitations acknowledgment** — Honestly state what the study cannot claim. This paradoxically increases credibility. "Our study measures engagement, not satisfaction. Engagement is a proxy."

4. **Future work framing** — Position limitations as opportunities. "A natural next step is..." This signals the work is part of a larger research program, not a one-off study.

**Template for Paper-0:**
- Stakeholder recommendations map directly from the PRD (agent vendors, model providers, enterprises, end users)
- Design principles: "Measure experience, not implementation," "Observable metrics first, evaluation metrics later," "Composite scores for executives, decomposed metrics for engineers"
- Limitations: "This paper defines metrics; validation requires large-scale instrumentation (Paper-1)"
- Future work: empirical validation, AXS weight calibration, cross-platform benchmarking

---

#### Section 7: Conclusion (~0.5 page)

**Rhetorical function:** Restate contributions crisply. End with the strongest finding.

**Moves:**
1. One-sentence restatement of what was done
2. Numbered re-listing of key findings/contributions (echo the introduction's list)
3. Forward-looking final sentence

---

### 2. Argumentation Moves — Cross-Cutting Patterns

#### The "Gap" Argument (Introduction Pattern)

```
[Domain] is [enormous/critical/growing].
[Stakeholders] depend on [quality/performance].
Yet [precise gap]: no systematic [study/framework/standard] for [specific thing].
We present [contribution] using [method/scale/approach].
Our key findings: [numbered list of 3-4 items].
```

This is the paper's skeleton. Every section reinforces the gap-to-fill-to-impact arc.

#### The "Why Should I Care" Escalation

The paper answers this at three levels:
1. **Academic level** — "First large-scale study of X" (novelty)
2. **Engineering level** — "These metrics are measurable and actionable" (utility)
3. **Business level** — "1% quality change = Y% engagement change" (money)

Each level recruits a different audience. The business level is the one that gets the paper cited 1000+ times rather than 50 times.

**For Paper-0:** Without empirical data, lean heavily on levels 1 and 2. Level 3 comes from analogical reasoning (borrowing from video QoE literature) and testable predictions.

#### The Definitions-to-Implications Bridge

Zhang's argumentative chain:

```
Definitions (Sec 3)    — "Here is what quality means"
     | measured via
Dataset (Sec 4)        — "Here is how we observed it at scale"
     | reveals
Results (Sec 5)        — "Here is what we found"
     | implies
Implications (Sec 6)   — "Here is what you should do"
```

Each arrow is a logical step. The reader is never asked to make a leap. For Paper-0, the adapted chain:

```
Definitions (Sec 3)        — "Here is what agent quality means"
     | operationalized via
Instrumentation (Sec 4)    — "Here is how you would measure it"
     | predicts
Hypotheses (Sec 5)         — "Here is what we expect to find"
     | implies
Design Guidance (Sec 6)    — "Here is how to build for quality"
```

---

### 3. Figure and Visual Strategy

| Zhang Figure Type | Purpose | Paper-0 Equivalent |
|---|---|---|
| **State machine diagram** (Fig 1) | Make the abstract concrete; shared vocabulary | Agent Session State Machine — the anchor visual |
| **CDFs of metric distributions** | Show metrics vary widely (the problem is real) | Metric definition diagrams showing measurement points on a session timeline |
| **Quality vs. engagement scatter plots** | Show the relationship (the core finding) | Worked example timelines showing good vs. bad agent sessions side by side |
| **Controlled comparison plots** | Establish causality | Hypothesized relationship curves (clearly labeled as predictions) |
| **Correlation/regression tables** | Quantitative precision | Metric taxonomy table (the equivalent precision artifact) |
| **Threshold identification plots** | Actionable breakpoints | Proposed SLA thresholds with rationale from analogous domains |

**Visual design principles from Zhang:**
- Every figure earns its space by making one point unmistakably clear
- Figures are self-contained — caption + axes tell the story without reading the text
- The state machine diagram is referenced throughout the paper (high ROI for one figure)
- CDFs and scatter plots are the workhorses — simple, familiar, information-dense

**For Paper-0:** The state machine diagram and the metrics taxonomy table are the two highest-ROI visuals. They will be referenced by every subsequent section. Invest heavily in making them clear, complete, and visually polished.

---

### 4. The "Money Number" Technique

Zhang's most-cited findings follow a formula:

```
[Human-readable quality change] --> [Business-readable impact]
```

Examples from the paper:
- "1% increase in buffering ratio leads to 3 minutes less viewing"
- "Join time > 2s costs 5.8% of viewers per additional second"
- "One buffering event reduces viewing time by ~39% vs. zero-buffering sessions"

**Why this works:**
1. The left side is something an engineer can measure and control
2. The right side is something a business person cares about
3. The arrow implies causality (established by methodology)
4. The specific number creates a mental anchor

**For Paper-0 — adapted "money number" substitutes:**

Since Paper-0 has no empirical data, use these alternative techniques:

1. **Analogical money numbers** — "In video streaming, 1% more buffering costs 3 min of viewing (Zhang 2011). Agent stalls are the buffering of AI interactions. We define stall ratio to capture this."

2. **Back-of-envelope calculations** — "If the average knowledge worker uses an AI agent 20 times/day, and average TTFR is 5s vs. an achievable 1.5s, that's 70 seconds/day or 6+ hours/year of waiting — per person."

3. **Threshold proposals** — "We propose that TTFR > 5s should be classified as 'degraded' based on web response time research (Nielsen 1993, Doherty and Kelisky 1979) showing user attention breaks at 5-10s."

4. **Testable prediction format** — "Prediction: Agents with stall ratio < 5% will show >2x task completion rate vs. agents with stall ratio > 20%. This is directly testable with instrumentation we describe in Section 4."

---

### 5. Tone and Voice Patterns

#### Confidence Calibration

Zhang uses a calibrated confidence scale:

| Confidence Level | Language Pattern | When Used |
|---|---|---|
| **High** | "We show that..." / "Our results demonstrate..." | Core findings with strong statistical support |
| **Medium** | "We observe that..." / "Our data suggests..." | Findings with caveats or confounds |
| **Hedged** | "This is consistent with..." / "One possible explanation..." | Interpretations of findings |
| **Speculative** | "We hypothesize that..." / "A natural extension would be..." | Future work, implications |

**For Paper-0:** Since all claims are definitional or predictive (not empirical), use primarily:
- "We define..." / "We formalize..." (for metrics — highest confidence, these are stipulative)
- "We argue that..." / "We propose..." (for the framework — medium confidence, claiming utility)
- "We predict that..." / "We hypothesize..." (for empirical claims — explicitly speculative)
- Avoid: "We show..." / "We demonstrate..." (nothing to show empirically yet)

#### Hedging Strategies

- **"To the best of our knowledge"** — Used before novelty claims. Protects against unknown prior art.
- **"In our dataset"** — Scopes findings to avoid overgeneralization. Paper-0 equivalent: "In the agent interaction model we propose..."
- **"This suggests"** — Weaker than "this proves" but still directional.
- **"We note that"** — Introduces a secondary observation without claiming it as a core finding.

#### Active Voice Dominance

The paper predominantly uses active voice with "we" as subject:
- "We collected..." not "Data was collected..."
- "We define..." not "The metric is defined as..."
- "We observe..." not "It can be observed that..."

This creates a sense of the authors as active investigators, not passive reporters. It also makes the writing more concise and direct.

#### Precision Over Adjectives

Zhang avoids vague qualifiers. Instead of "significantly impacts," the paper says "reduces viewing time by 3 minutes." Instead of "dramatically increases," it says "5.8% per second." The numbers do the persuading.

**For Paper-0:** Where you don't have numbers, use precision in definitions. Instead of "agents should respond quickly," write "TTFR measures the interval from prompt submission to first visible output token, in milliseconds."

---

### 6. What to Adapt vs. Replace for Paper-0

#### Direct Reuse (Zhang to Paper-0)

| Zhang Element | Paper-0 Application | Confidence |
|---|---|---|
| State machine as conceptual foundation | Agent Session State Machine | Direct transfer — the core move |
| Metric derivation from states | Every metric tied to a state or transition | Direct transfer |
| Stakeholder-specific framing | Agent vendors, model providers, enterprises, users | Direct transfer |
| Section 3 structure (definitions) | Metrics taxonomy section | Direct transfer — strongest section |
| Contribution list format | Numbered contributions in introduction | Direct transfer |
| Table-based metric definitions | Metric taxonomy tables | Direct transfer |
| "Gap" argument in introduction | "No standard for agent quality" | Direct transfer, arguably stronger |

#### Must Replace (Zhang has, Paper-0 doesn't)

| Zhang Element | Paper-0 Replacement | Risk and Mitigation |
|---|---|---|
| 40M-view dataset | Formal definitions + worked examples | Credibility gap — mitigate with formalism rigor |
| Empirical "money numbers" | Analogical numbers + testable predictions | Less quotable — mitigate with concrete back-of-envelope calculations |
| CDF / scatter plot figures | State diagrams + timeline visuals + taxonomy tables | Less visually dramatic — mitigate with information design quality |
| Quasi-experimental causal claims | First-principles arguments + analogies to QoE literature | Weaker claims — mitigate by framing as hypotheses, not findings |
| Statistical significance tables | Metric coverage analysis | Less quantitative — mitigate with completeness arguments |

#### New Elements (Paper-0 has, Zhang doesn't)

| Paper-0 Element | Why It's New | Advantage |
|---|---|---|
| Composite score formula (AXS) | Zhang measures individual metrics, doesn't propose a composite | Gives Paper-0 a "product" — a single number people can adopt |
| Diagnostic dimensions | Zhang doesn't formalize slicing dimensions | Shows operational utility beyond raw metrics |
| Instrumentation architecture | Zhang has Conviva but doesn't describe it as a contribution | Bridges "what to measure" and "how to measure it" |
| Explicit research agenda / predictions | Zhang presents findings, not predictions | Turns lack of data into a feature — you're setting the agenda |

---

### 7. Recommended Paper-0 Outline (Based on Zhang Template)

```
1. Introduction                           (~2 pages)
   - Economic scale of AI agents
   - The vocabulary gap
   - Stakeholder inventory
   - Contribution list (4 items)
   - Paper roadmap

2. Background and Related Work            (~1.5 pages)
   - LLM observability tools
   - Traditional APM extensions
   - Academic agent evaluation
   - Video QoE literature (Zhang as inspiration)
   - The gap statement

3. Agent Experience Model                 (~2.5 pages)
   - 3.1 Agent Session State Machine (Figure 1 — the anchor)
   - 3.2 Experience Phases (Initiation, Progress, Interaction, Delivery, Resolution)
   - 3.3 Metrics Taxonomy (Table 1 — the reference artifact)
   - 3.4 Formal Definitions (each metric: name, definition, unit, derived-from)

4. Composite Score and Diagnostics        (~1.5 pages)
   - 4.1 Agent Experience Score (AXS) formulation
   - 4.2 Diagnostic Dimensions
   - 4.3 Threshold Proposals

5. Operationalization                     (~1.5 pages)
   - 5.1 Instrumentation approach (OTEL/ACP mapping)
   - 5.2 Worked example: annotated agent session
   - 5.3 Feasibility argument

6. Predictions and Research Agenda        (~1 page)
   - Testable hypotheses (H1-H5)
   - Analogical reasoning from video QoE
   - Back-of-envelope impact calculations

7. Discussion                             (~1 page)
   - Stakeholder-specific guidance
   - Design principles
   - Limitations
   - Future work (Paper-1: empirical validation)

8. Conclusion                             (~0.5 page)
```

**Total: ~11-12 pages** (comparable to Zhang's ~12 pages excluding references)

---

### 8. Key Rhetorical Risks for Paper-0

| Risk | Mitigation Strategy |
|---|---|
| "This is just definitions — where's the data?" | Frame as the necessary precursor. Zhang couldn't have measured quality without first defining it. You're doing that step explicitly. |
| "Why should I trust your metric choices?" | Ground every metric in the state machine (formal rigor) + cite analogous video QoE metrics (empirical precedent) |
| "AXS weights are arbitrary" | Present as proposals with explicit rationale. Invite the community to calibrate empirically. Frame openness as a feature. |
| "This isn't novel — it's just applying video QoE to agents" | Argue that the translation is non-trivial. Agent sessions have interaction, branching, tool use — fundamentally different from passive video viewing. The state machine must be redesigned, not copied. |
| "Too many metrics — which ones matter?" | The phase structure (5 phases) provides hierarchy. The composite score (AXS) provides a summary. Both manage complexity. |

---

## RES-2: Agent Monitoring Landscape Survey

> **Methodology note:** This survey is based on publicly available documentation, product pages, and technical content for each tool as of early-to-mid 2025. Pricing and feature sets evolve rapidly; specific figures should be verified against current product pages before publication. Web search was unavailable during compilation -- a follow-up pass with live web access is recommended to capture any 2026 updates.

---

### 1. Tool-by-Tool Summary

#### 1.1 LangSmith (by LangChain)

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Trace trees (parent/child spans for chains, agents, tools, retrievers), per-step latency, token counts (prompt/completion), cost estimates, LLM call metadata (model, temperature, etc.), evaluation scores (custom and built-in), feedback scores (human + automated), dataset/example management for regression testing |
| **UX vs. implementation** | **Overwhelmingly implementation-focused.** Traces are developer debugging artifacts. No concept of "user wait time," perceived throughput, or task-level success from the user's perspective. Evaluation scores can proxy quality but are model-graded, not user-experience-graded. |
| **Primary audience** | LLM application developers, especially those using LangChain/LangGraph |
| **Pricing** | Free tier (limited traces), Plus (~$39/seat/mo), Enterprise (custom). Pay per traced event at scale. |
| **Key marketing quote** | "Debug, test, evaluate, and monitor LLM applications" -- positions itself as the full dev lifecycle tool |
| **Key limitation (our lens)** | No user-facing metrics whatsoever. Cannot tell you if a user abandoned a session, how long they waited before their first response, or whether a task was completed from the user's perspective. It knows what the *system* did, not what the *user experienced*. |

#### 1.2 Langfuse (Open Source)

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Traces with nested spans/generations/events, token usage, cost tracking, latency per generation, model parameters, prompt management/versioning, evaluation scores (manual, model-based, and via SDK), user-level session grouping, custom metadata tags |
| **UX vs. implementation** | **Primarily implementation-focused**, but with a nod toward user-level grouping. Sessions can be tagged by user ID, which enables per-user cost and latency analysis. However, no built-in UX metrics -- no TTFR, no perceived throughput, no satisfaction signals. |
| **Primary audience** | Developers and small-to-mid teams who want self-hosted or open-source observability |
| **Pricing** | Open-source self-hosted (free), Langfuse Cloud free tier, Pro (~$59/mo), Team/Enterprise tiers |
| **Key marketing quote** | "Open-source LLM engineering platform. Traces, evals, prompt management, and metrics to debug and improve your LLM application." |
| **Key limitation (our lens)** | Session grouping is the closest thing to user-journey tracking, but it has no concept of task completion, user effort, or experiential quality. It measures what the LLM *produced*, not whether the user *succeeded*. |

#### 1.3 AgentOps

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Agent session recordings (full replay of agent actions), tool call sequences, LLM calls with token/cost, error rates, session duration, agent "event" timelines, multi-agent coordination tracking, compliance/safety event logging |
| **UX vs. implementation** | **Implementation-focused with session-level awareness.** AgentOps is the closest to "user session" thinking because it records entire agent sessions as replayable timelines. However, metrics are still about what the agent *did* (tools called, errors hit), not what the user *felt*. |
| **Primary audience** | AI agent developers, particularly those building autonomous or semi-autonomous agents |
| **Pricing** | Free tier, Pro tier (usage-based), Enterprise |
| **Key marketing quote** | "Build compliant AI agents. Track every agent action." / "Session replays for AI agents" |
| **Key limitation (our lens)** | Despite session-level thinking, AgentOps has no concept of user satisfaction, task success from the user's POV, or experiential metrics like wait frustration or steering effort. It's an "agent flight recorder," not a user experience monitor. |

#### 1.4 Helicone

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Request/response logs for every LLM call, latency (p50/p95/p99), token counts, cost per request and aggregate, error rates, rate limiting events, model usage distribution, user-level cost attribution, caching hit rates, custom properties for filtering |
| **UX vs. implementation** | **Purely implementation/operational.** Helicone is an LLM proxy -- it sees API calls, not user interactions. It knows cost and latency at the API level, which is one step removed from what users experience. |
| **Primary audience** | Engineering/ops teams managing LLM API spend and performance |
| **Pricing** | Free tier (up to 100k requests/mo), Pro ($25/mo + usage), Enterprise |
| **Key marketing quote** | "The easiest way to monitor, debug, and improve your LLM app in production" / "One line of code" integration |
| **Key limitation (our lens)** | No trace/span hierarchy, no agent-level concepts, no user journey tracking. Helicone sees individual LLM API calls in isolation. It cannot correlate calls into tasks, sessions, or user outcomes. Excellent for "how much did we spend?" but blind to "did the user succeed?" |

#### 1.5 Portkey

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Request logs, latency, token usage, cost, error rates, model routing decisions (fallbacks, load balancing), cache performance, rate limits, guardrail triggers, multi-provider comparison metrics, reliability scores |
| **UX vs. implementation** | **Implementation/infrastructure-focused.** Portkey is an AI gateway -- it optimizes reliability and cost at the infrastructure layer. It knows about routing decisions and provider failovers, not about user experience. |
| **Primary audience** | Platform engineers managing multi-model, multi-provider AI infrastructure |
| **Pricing** | Free tier, Growth tier, Enterprise (custom). Usage-based on requests. |
| **Key marketing quote** | "The AI gateway for reliable, fast, and observable generative AI" / "Ship reliable AI apps" |
| **Key limitation (our lens)** | Portkey operates below the application layer entirely. It has no concept of what a "user" is, let alone what they experience. It's plumbing observability -- essential, but orthogonal to UX measurement. |

#### 1.6 Datadog LLM Observability

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | LLM call traces integrated into Datadog APM, token usage, latency, error rates, cost estimation, prompt/response logging, integration with existing Datadog metrics (CPU, memory, network), custom evaluations, topical clustering of prompts, PII detection |
| **UX vs. implementation** | **Implementation-focused, enterprise-grade.** Datadog bolts LLM monitoring onto its existing APM paradigm. This means it correlates LLM calls with infrastructure metrics (CPU during inference, etc.) but does not introduce user-experience concepts. The APM mental model is "service health," not "user health." |
| **Primary audience** | Enterprise DevOps/SRE teams already using Datadog |
| **Pricing** | LLM Observability add-on, priced per million LLM spans (~$15/million spans on top of existing Datadog subscription). Expensive at scale. |
| **Key marketing quote** | "Monitor, troubleshoot, and evaluate your LLM-powered applications" -- standard APM language applied to LLMs |
| **Key limitation (our lens)** | Datadog's strength (correlating LLM with infra) is irrelevant to user experience. It can tell you the p99 latency of your LLM calls, but not whether users perceived that latency as acceptable. No task completion, no session-level UX, no user effort metrics. |

#### 1.7 New Relic AI Monitoring

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | LLM transaction traces, token usage, cost, latency, error rates, response quality signals (hallucination detection), model comparison metrics, integration with New Relic distributed tracing, custom instrumentation via SDK |
| **UX vs. implementation** | **Implementation-focused, APM heritage.** Similar to Datadog -- New Relic extends its existing APM framework to cover LLM calls as "transactions." The mental model remains request/response, not user journey. |
| **Primary audience** | Enterprise engineering teams already using New Relic |
| **Pricing** | Included in New Relic's usage-based pricing (per GB ingested + per user). LLM monitoring consumes data ingest quota. |
| **Key marketing quote** | "Monitor AI from end to end" / "Ensure AI quality, reliability, and compliance" |
| **Key limitation (our lens)** | "End to end" means from API call to infrastructure, not from user intent to user satisfaction. No user-facing metrics. The compliance angle (PII, hallucination) is valuable but orthogonal to UX measurement. |

#### 1.8 Arize / Phoenix

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Embedding drift detection, LLM trace spans, retrieval metrics (relevance, precision for RAG), evaluation metrics (hallucination, toxicity, QA correctness), latency, token counts, cost, prompt/response clustering, A/B comparison of model versions, dataset management |
| **UX vs. implementation** | **Quality-focused implementation metrics.** Arize is closer to "output quality" than most tools because it evaluates *what* the LLM said (hallucination detection, retrieval relevance). But this is still model-output quality, not user-perceived quality. A response can be factually correct yet useless to the user. |
| **Primary audience** | ML engineers, data scientists, and LLM developers focused on model quality |
| **Pricing** | Phoenix is open-source. Arize cloud has free tier, Pro, and Enterprise tiers. |
| **Key marketing quote** | "AI observability and evaluation platform" / "Debug, evaluate, and monitor your LLM, CV, NLP, and tabular models" |
| **Key limitation (our lens)** | Arize/Phoenix comes closest to "quality" but conflates model output quality with user value. A retrieval that scores 0.95 relevance might still leave the user frustrated if the response is too verbose, too slow, or requires three follow-ups to get what they need. No session-level or effort-level metrics. |

#### 1.9 OpenTelemetry for LLMs (Semantic Conventions)

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | Emerging semantic conventions for: `gen_ai.usage.prompt_tokens`, `gen_ai.usage.completion_tokens`, `gen_ai.response.model`, `gen_ai.request.temperature`, span-level latency. The GenAI SIG (Special Interest Group) is defining standardized attribute names. Projects like OpenLLMetry (by Traceloop) implement these conventions. |
| **UX vs. implementation** | **Purely implementation-level standardization.** OTel's goal is interoperable telemetry data, not UX insight. The semantic conventions being defined are exclusively about LLM API call attributes -- there is no working group or proposal for user-experience-level semantic conventions. |
| **Primary audience** | Platform engineers and tool builders who want vendor-neutral telemetry |
| **Pricing** | Open-source standard. Free. |
| **Key marketing quote** | "Vendor-neutral observability for AI" (from OpenLLMetry/Traceloop) |
| **Key limitation (our lens)** | OTel GenAI conventions are the *lingua franca* of LLM telemetry -- and they have zero user-experience vocabulary. This is actually a strategic opportunity: proposing UX-level semantic conventions for OTel could be a concrete contribution from our paper. |

#### 1.10 Agent Communication Protocol (ACP)

| Dimension | Detail |
|-----------|--------|
| **Metrics tracked** | ACP (by IBM/BeeAI and others) focuses on agent-to-agent communication standardization, not telemetry per se. It defines message formats, capability discovery, and coordination patterns for multi-agent systems. Telemetry specs are nascent -- primarily focused on message delivery confirmation and agent availability. |
| **UX vs. implementation** | **Protocol-level, no UX dimension.** ACP is about agent interoperability, not observability. Any telemetry is about whether messages were delivered between agents, not about user outcomes. |
| **Primary audience** | Multi-agent system architects and framework developers |
| **Pricing** | Open protocol/specification. Free. |
| **Key marketing quote** | "An open protocol for agent-to-agent communication" |
| **Key limitation (our lens)** | ACP is solving a different problem (agent interop), but its lack of any user-experience telemetry specs reinforces the gap. Even at the protocol level, nobody is standardizing how to measure what the *human in the loop* experiences. |

---

### 2. Gap Analysis Matrix: Tools vs. Our 5-Phase Metrics Framework

The table below rates each tool's coverage of our five phases:
- **--** = No coverage (the tool has no concept of this)
- **Partial** = Some raw data exists that could be derived into this metric with significant effort
- **Yes** = Directly measured or closely approximated

| Tool | Phase 1: Initiation | Phase 2: Progress | Phase 3: Interaction | Phase 4: Delivery | Phase 5: Resolution |
|------|---------------------|-------------------|----------------------|-------------------|---------------------|
| | *TTFR, start success, abandon before response* | *Stall rate, progress cadence, perceived throughput* | *Interruption rate, steering events, resumption latency* | *Task completion, first-attempt success, rework rate* | *Session duration, effort ratio, abandonment, return rate* |
| **LangSmith** | Partial (latency of first span exists, but not framed as TTFR; no abandon tracking) | -- (no progress/streaming metrics) | -- (no user interaction model) | Partial (eval scores proxy quality, not task completion) | -- |
| **Langfuse** | Partial (first-generation latency derivable from traces) | -- | -- | Partial (eval scores) | Partial (session grouping exists, but no effort/abandon metrics) |
| **AgentOps** | Partial (session start timestamp exists) | Partial (event timeline shows agent activity gaps) | -- (no user-side interaction tracking) | -- (no task-success concept) | Partial (session duration tracked, but no effort ratio or return rate) |
| **Helicone** | Partial (first-request latency) | -- | -- | -- | -- |
| **Portkey** | Partial (request latency) | -- | -- | -- | -- |
| **Datadog LLM** | Partial (span latency in APM) | -- | -- | -- | Partial (can correlate with RUM if separately configured, but not built-in for LLM features) |
| **New Relic AI** | Partial (transaction latency) | -- | -- | -- | Partial (similar RUM possibility as Datadog) |
| **Arize/Phoenix** | -- | -- | -- | Partial (response quality evals) | -- |
| **OTel GenAI** | Partial (span duration conventions) | -- | -- | -- | -- |
| **ACP** | -- | -- | -- | -- | -- |

**Phase-by-phase summary:**

- **Phase 1 (Initiation):** Most tools capture raw latency that *could* approximate TTFR, but none frame it as a user-experience metric. No tool tracks "abandon before first response" or "start success rate" from the user's perspective.

- **Phase 2 (Progress):** This is the biggest blind spot. No tool measures perceived throughput, progress cadence, or stall rate. Streaming is the dominant delivery mechanism for LLM responses, yet no observability tool measures the *experiential quality* of that stream. AgentOps' event timelines are the closest, but they track agent actions, not user perception of progress.

- **Phase 3 (Interaction):** Complete gap across all tools. No tool models the human-agent interaction loop. Concepts like "user interrupted the agent," "user steered the agent in a new direction," or "user had to re-engage after a stall" are absent from every platform surveyed. This is arguably the most novel contribution area.

- **Phase 4 (Delivery):** Partial coverage via eval scores (LangSmith, Langfuse, Arize), but these measure *response quality*, not *task completion from the user's perspective*. A high eval score does not mean the user's task is done. First-attempt success rate and rework rate are unmeasured everywhere.

- **Phase 5 (Resolution):** AgentOps and Langfuse track session duration. Datadog/New Relic could theoretically combine LLM data with their RUM (Real User Monitoring) products, but this integration is not built-in for LLM-specific workflows. Effort ratio, meaningful abandonment detection, and return rate are completely absent.

---

### 3. Key Quotes and Positioning from Each Tool

| Tool | Positioning Quote | What This Reveals |
|------|-------------------|-------------------|
| **LangSmith** | "Debug, test, evaluate, and monitor LLM applications" | Developer lifecycle tool -- the verbs are all developer actions, not user outcomes |
| **Langfuse** | "Open-source LLM engineering platform" | "Engineering" -- explicitly technical, not experiential |
| **AgentOps** | "Build compliant AI agents. Track every agent action." | Agent-centric, compliance-motivated. The subject is the agent, not the user. |
| **Helicone** | "The easiest way to monitor your LLM app in production" | Ease of setup for developers. "Monitor" means API-level health. |
| **Portkey** | "The AI gateway for reliable, fast, and observable generative AI" | Infrastructure reliability. "Observable" means the system, not the experience. |
| **Datadog** | "Monitor, troubleshoot, and evaluate your LLM-powered applications" | Classic APM verbs transplanted to LLMs. |
| **New Relic** | "Monitor AI from end to end" | "End to end" means system span, not user journey span. |
| **Arize** | "AI observability and evaluation platform" | Closest to quality, but "evaluation" is model evaluation, not UX evaluation. |
| **OTel GenAI** | "Vendor-neutral observability for AI" (OpenLLMetry) | Standardization of the *wrong layer* -- essential but insufficient. |
| **ACP** | "An open protocol for agent-to-agent communication" | Agent interop, user not in scope. |

**The linguistic pattern is telling:** Every tool uses developer/engineering verbs (debug, monitor, evaluate, troubleshoot) with the *application* or *agent* as the object. Not a single tool positions itself around the *user's experience* of interacting with an AI agent.

---

### 4. The Whitespace: What Our Paper Addresses

#### 4.1 The Fundamental Orientation Gap

The entire current landscape is oriented around **"How is my AI system performing?"** -- a question asked by developers and operators about their infrastructure. Our framework asks a fundamentally different question: **"How is the human experiencing this AI interaction?"**

This is not a minor reframing. It produces entirely different metrics:

| Current landscape asks | Our framework asks |
|------------------------|--------------------|
| What was the API latency? | How long did the user wait before seeing any response? |
| How many tokens were generated? | Did the user perceive continuous progress or frustrating stalls? |
| Did the LLM call succeed (HTTP 200)? | Did the user accomplish their task? |
| What was the eval score? | Did the user have to retry, rephrase, or give up? |
| How much did this cost? | Was the user's effort proportional to the value received? |
| Was the agent compliant? | Did the user feel in control of the interaction? |

#### 4.2 Specific Unmeasured Dimensions

The following metrics from our 5-phase framework have **zero coverage** across all 10 tools surveyed:

1. **Time to First Response (TTFR) as a UX metric** -- raw latency exists everywhere, but no tool frames it as a user-experience signal with UX-relevant thresholds (e.g., the 1s/5s/10s perceptual breakpoints from Nielsen/Doherty research).

2. **Abandon before first response** -- no tool detects when a user gives up before the AI even responds. This is a critical loss metric.

3. **Perceived throughput / progress cadence** -- with streaming being universal, no tool measures whether the *rate* of content delivery feels satisfying or frustratingly slow.

4. **Stall detection** -- no tool identifies mid-response pauses that break the user's attention flow.

5. **Steering events** -- no tool captures when a user redirects, corrects, or overrides the agent mid-task.

6. **Interruption rate** -- no tool measures how often users stop the agent before it finishes.

7. **Resumption latency** -- after an interruption or context switch, how quickly does the interaction recover? Unmeasured.

8. **First-attempt success rate** -- did the agent get it right the first time, from the user's perspective? Eval scores approximate model quality, not user-judged success.

9. **Rework rate** -- how often does a user have to ask for the same thing again in different words? Completely unmeasured.

10. **Effort ratio** -- the relationship between user input effort and value received. No tool even conceptualizes this.

11. **Meaningful abandonment** -- distinguishing "user left because they got what they needed" from "user left because they gave up." No tool attempts this.

12. **Return rate** -- does the user come back? A longitudinal metric that no session-scoped tool captures.

#### 4.3 Why the Gap Exists

Three structural reasons explain why no tool covers this space:

1. **Heritage bias.** Most tools evolved from either APM (Datadog, New Relic), ML model monitoring (Arize), or developer tooling (LangSmith, Langfuse). Their mental models are "service health" or "model quality," not "user experience." Adding UX metrics would require rethinking their core abstractions.

2. **Instrumentation boundary.** Current tools instrument at the LLM API call level or agent framework level. User experience metrics require instrumenting at the *interaction boundary* -- where the human and the AI meet. This is a different instrumentation point that existing tools don't reach.

3. **No established vocabulary.** Unlike web UX (which has Core Web Vitals, RAIL, etc.), there is no established vocabulary for AI agent UX metrics. Our 5-phase framework aims to provide this vocabulary.

#### 4.4 Strategic Positioning for Our Paper

Our paper occupies whitespace analogous to what Google's Core Web Vitals occupied for web performance: **a user-centric metrics framework that reorients an entire observability ecosystem.** Before Core Web Vitals, web performance was measured in server response times and page load events. After Core Web Vitals, it was measured in Largest Contentful Paint, First Input Delay, and Cumulative Layout Shift -- metrics that captured what users *experienced*, not what servers *did*.

We are proposing the equivalent transformation for AI agent interactions:
- **Before our framework:** "The agent responded in 2.3 seconds with 95% eval accuracy"
- **After our framework:** "The user received a first response in 0.8s, perceived continuous progress throughout, completed their task on the first attempt without steering corrections, and the interaction required 40% less effort than the manual alternative"

The opportunity is significant because:
- Every tool surveyed would benefit from incorporating our metrics (potential standards adoption)
- OpenTelemetry's GenAI semantic conventions are still being defined (window for contribution)
- The market is rapidly growing but metrics are converging on the same implementation-centric set (first-mover advantage on UX framing)
- Enterprise buyers increasingly care about user adoption/satisfaction of AI tools, not just cost/latency (business demand exists)

---

*Survey compiled April 2026. Based on publicly available product documentation and technical content through May 2025 training data. A follow-up verification pass with live web access is recommended to capture any product updates released between May 2025 and April 2026.*
