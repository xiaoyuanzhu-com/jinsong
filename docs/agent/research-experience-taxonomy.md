# Research: Experience/Quality Metrics Taxonomies Across Domains

**Purpose:** Deep dive into how other domains define and organize quality-of-experience metrics, to inform a rigorous taxonomy for AI agent experience metrics.

**Date:** 2026-04-15

---

## Table of Contents

1. [Video QoE (Conviva / Zhang model)](#1-video-qoe)
2. [Web Performance (Core Web Vitals)](#2-web-performance)
3. [Voice/Telephony QoE (MOS / E-model)](#3-voicetelephony-qoe)
4. [Application Performance (Apdex, RAIL, SRE Golden Signals)](#4-application-performance)
5. [Conversational AI / Chatbot Quality](#5-conversational-ai--chatbot-quality)
6. [Human-Computer Interaction (HCI)](#6-human-computer-interaction)
7. [Gaming QoE](#7-gaming-qoe)
8. [Cross-Domain Synthesis](#8-cross-domain-synthesis)
9. [Implications for Agent Experience Taxonomy](#9-implications-for-agent-experience-taxonomy)

---

## 1. Video QoE

### 1.1 The Zhang/Conviva Model (SIGCOMM 2011)

**Source:** Dobrian, Sekar, Awan, Stoica, Joseph, Ganjam, Zhan, Zhang. "Understanding the Impact of Video Quality on User Engagement." ACM SIGCOMM 2011. Won the SIGCOMM Test of Time Award in 2022.

#### Taxonomy Structure

The framework is anchored by a **player state machine** with four states:

| State | Description |
|-------|-------------|
| **Joining** | Player loading, user waiting for first frame |
| **Playing** | Video rendering, user watching |
| **Buffering** | Playback stalled, buffer depleted |
| **Stopped** | Session ended (user exit or video complete) |

Every metric is derived from states or transitions in this machine:

| Metric | Derivation | What It Captures |
|--------|-----------|-----------------|
| **Join Time** | Duration of Joining state | Startup experience |
| **Buffering Ratio** | Time in Buffering / Total session time | Mid-stream interruption severity |
| **Rebuffering Frequency** | Transitions into Buffering | Interruption frequency |
| **Average Bitrate** | Mean bitrate during Playing | Visual quality |
| **Rendering Quality** | % of frames rendered at intended resolution | Encoding/decoding fidelity |

#### Key Findings (Causal Impact on Engagement)

- Buffering ratio has the **largest impact** across all content types.
- 1% increase in buffering ratio reduces engagement by **>3 minutes** for a 90-minute live event.
- 7% of views experience buffering ratio >10%; 5% have join time >10 seconds.
- Live content is more sensitive to quality degradation than VOD.

#### Design Principles

1. **State machine as conceptual anchor.** Quality is not a list of metrics -- it is a set of measurements derived from a formal model of user-visible system behavior. This makes the framework principled rather than ad hoc.
2. **Metrics from observable events.** Every metric can be computed from client-side instrumentation. No inference, no surveys, no server-side proxies.
3. **Causal, not correlational.** The study used quasi-experimental methods across ~40 million views to establish that quality metrics causally impact engagement.
4. **"Money numbers."** Quality changes are translated to business outcomes (minutes of viewing time), making the framework actionable for product teams.
5. **Dimensional slicing.** Conviva's operationalization adds dimensions: ISP, device, geography, CDN, content type -- enabling fault isolation.

#### What Succeeded

- The state machine became the intellectual foundation for the entire streaming quality industry.
- Conviva operationalized it at massive scale (billions of streams, 200+ content providers).
- The vocabulary (join time, buffering ratio) became industry standard.
- Won SIGCOMM Test of Time Award (2022) -- rare for industry-academic work.

#### What Failed / Limitations

- **No perceptual quality metric.** Bitrate is a proxy for visual quality, not a direct measure. Netflix later developed VMAF to address this gap.
- **Unidirectional model.** The state machine assumes passive consumption -- no interactivity, no user input during playback.
- **No composite score initially.** Individual metrics are powerful but teams want a single number. Conviva later created the Streaming Performance Index (SPI) to fill this gap.

### 1.2 Conviva Streaming Performance Index (SPI)

Conviva's SPI is a composite score that aggregates multiple QoE metrics into a single assessment:

**Input metrics:** Video Start Failure (VSF), Exits Before Video Start (EBVS), Rebuffering ratio, Video Playback Failures (VPF), Video Startup Time (VST), Picture Quality (bitrate thresholds by screen type).

**Structure:** Percentage of streams that pass all quality thresholds. Color-coded: >80% green, 60-80% yellow, <60% red. Allows "Good" vs "Best" threshold settings per metric.

**Lesson:** Even the strongest individual-metric framework eventually needs a composite score for executive communication.

### 1.3 ITU-T P.1203 (Parametric Bitstream-Based QoE)

**Structure:** Modular, with four sub-recommendations:

| Module | Purpose |
|--------|---------|
| P.1203 (main) | Overall parametric bitstream-based quality assessment |
| P.1203.1 | Video quality estimation |
| P.1203.2 | Audio quality estimation |
| P.1203.3 | Audiovisual integration + session quality score |

**Output:** MOS scores (1-5 scale) at three levels of granularity:
1. Per-1-second audiovisual quality score
2. Integral audiovisual quality score for complete session
3. Integral session quality score (includes adaptive-streaming factors: quality switches, initial loading delay, stalling)

**Input modes** (accuracy vs. data requirements tradeoff):
- Mode 0: Metadata only (bitrate, framerate, resolution)
- Mode 1: Frame header data (adds frame types and sizes)
- Mode 2: Bitstream (2% of QP values)
- Mode 3: Full bitstream (100% of QP values)

**Correlation:** Up to 0.9 with subjective data, validated against 1,000+ video sequences and 25,000+ individual ratings.

**Lesson for agent QoE:** The multi-level granularity (per-second, per-session, session-integrated) is directly relevant -- agent metrics need per-event, per-session, and aggregate views. The accuracy/observability tradeoff (modes 0-3) parallels our L1/L2/L3 observability classification.

### 1.4 Netflix VMAF

Netflix developed Video Multimethod Assessment Fusion (VMAF) to address the gap between bitrate-as-proxy and actual perceptual quality.

**Elementary metrics fused:** Visual Information Fidelity (VIF), Additive Distortion Measurement (ADM), and Motion features -- combined via SVM regression to predict human perception.

**Achievement:** Won a Technology and Engineering Emmy Award (2021). Open-sourced. Correlation with subjective data significantly exceeds PSNR and SSIM.

**Lesson for agent QoE:** Even well-established proxy metrics (bitrate) eventually need to be replaced by direct perceptual measures. Our current metrics are largely objective; eventually we may need subjective validation similar to VMAF's approach.

### 1.5 Mux's Four Elements of Video Performance

Mux distills video QoE into four categories:

| Category | What It Measures |
|----------|-----------------|
| **Playback Failures** | Did the video fail to play? (binary) |
| **Startup Time** | How long until first frame? |
| **Rebuffering** | Mid-stream stalling (ratio and frequency) |
| **Video Quality** | Perceptual quality (bitrate, resolution, upscaling) |

**Lesson:** Four categories map to a temporal lifecycle: Can it start? -> How fast does it start? -> Does it interrupt? -> Is the output good? This is strikingly similar to our Initiation -> Progress -> Delivery structure.

---

## 2. Web Performance (Core Web Vitals)

### 2.1 The Three Pillars

Google's Core Web Vitals (launched May 2020, integrated into search ranking June 2021) organize web performance around **three user-centric dimensions**:

| Pillar | Metric | What It Measures | Threshold (Good) |
|--------|--------|-----------------|------------------|
| **Loading** | Largest Contentful Paint (LCP) | When is the main content visible? | <= 2.5s |
| **Interactivity** | Interaction to Next Paint (INP) | How fast does the page respond to input? | <= 200ms |
| **Visual Stability** | Cumulative Layout Shift (CLS) | Do elements move unexpectedly? | <= 0.1 |

### 2.2 Why These Three Pillars?

The taxonomy reflects the **user's mental model of page loading**:

1. **"Is it loading?"** (Loading / LCP) -- perceived completeness
2. **"Can I use it?"** (Interactivity / INP) -- responsiveness to input
3. **"Is it stable?"** (Visual Stability / CLS) -- absence of disruptive change

This is a lifecycle-phase taxonomy: first the content appears, then the user interacts, and throughout they expect visual stability. The three categories are MECE across the user's primary experience dimensions.

### 2.3 How They Evolved (What Was Tried and Discarded)

**Metrics that were replaced or deprecated:**

| Metric | Status | Why Discarded |
|--------|--------|--------------|
| **First Meaningful Paint (FMP)** | Deprecated | Unreliable -- hard to standardize what "meaningful" means across sites. Replaced by LCP. |
| **First Input Delay (FID)** | Replaced March 2024 | Only measured the *first* interaction. Only measured *input delay*, not processing time or presentation delay. A page could pass FID while feeling sluggish on subsequent interactions. INP captures all interactions and all three phases (delay + processing + presentation). |
| **Time to Interactive (TTI)** | Deprecated as core metric | Too sensitive to outlier long tasks; hard to measure reliably in the field. |

**Broader Web Vitals (non-core, diagnostic):**

| Metric | Role |
|--------|------|
| **TTFB** (Time to First Byte) | Server-side diagnostic; precondition for good LCP |
| **FCP** (First Contentful Paint) | Early visual feedback; precondition for good LCP |
| **TBT** (Total Blocking Time) | Lab proxy for INP; sum of long-task blocking time between FCP and TTI |

**Key insight:** The broader metrics are *diagnostic* -- they explain *why* a core metric is bad. The core metrics are *experiential* -- they capture *what the user feels*. This two-tier structure (core experiential + diagnostic supporting) is a powerful organizing principle.

### 2.4 Threshold Design Methodology

Google documented their threshold-setting methodology explicitly:

1. **75th percentile rule:** A site passes if >= 75% of page views meet the "good" threshold. This balances majority-good experience against outlier tolerance.
2. **Three categories per metric:** Good / Needs Improvement / Poor -- a simplified version of Apdex's Satisfied / Tolerating / Frustrated.
3. **Threshold selection criteria:** (a) Consistently achievable by well-built sites; (b) Grounded in perception research (e.g., 100ms responsiveness threshold from HCI research); (c) No single "correct" threshold -- choose the candidate that best meets criteria.

### 2.5 What Made Core Web Vitals Successful

1. **Small number of metrics (3).** Easy to remember, communicate, and act on.
2. **User-centric framing.** "Is it loading? Can I use it? Is it stable?" -- not technical jargon.
3. **Tied to business outcome.** Integrated into Google search ranking, creating immediate incentive.
4. **Field measurement.** Measured from real users (Chrome User Experience Report), not lab simulations.
5. **Continuous evolution.** FID -> INP shows willingness to replace metrics that don't work.
6. **Two-tier structure.** Core metrics for communication, diagnostic metrics for debugging.

### 2.6 Lessons for Agent QoE

- **Three is the ideal number of top-level categories for adoption.** Five is intellectually richer but harder to evangelize.
- **Name metrics after user perceptions, not system events.** "Largest Contentful Paint" describes what the user sees. "p99 API latency" describes what the server does.
- **Field measurement matters more than lab measurement.** Real-user data beats synthetic benchmarks.
- **Build in evolution mechanisms.** FID->INP transition shows frameworks must be able to swap out metrics without breaking the taxonomy.
- **The diagnostic/experiential split is powerful.** Don't try to make every metric user-facing. Have a small set of "core" metrics and a larger set of "supporting" metrics.

---

## 3. Voice/Telephony QoE

### 3.1 Mean Opinion Score (MOS)

**Source:** ITU-T P.800 (Recommendation for methods of subjective determination of transmission quality)

**Scale:** 5-point Absolute Category Rating (ACR):

| Score | Label | Interpretation |
|-------|-------|---------------|
| 5 | Excellent | Imperceptible impairment |
| 4 | Good | Perceptible but not annoying |
| 3 | Fair | Slightly annoying |
| 2 | Poor | Annoying |
| 1 | Bad | Very annoying |

**Methodology:** Subjective testing -- listeners sit in controlled conditions and rate call quality. Scores are averaged to produce the Mean Opinion Score.

**Quality thresholds:**
- MOS >= 4.0: "Toll quality" (acceptable for commercial telephony)
- MOS >= 3.5: Minimum acceptable quality
- MOS < 3.5: Generally unacceptable

**Strengths:**
- Universal, domain-agnostic scale (has been adapted to video, web, gaming)
- Directly captures subjective perception
- Simple to communicate (single number, 1-5)

**Weaknesses:**
- Expensive to collect (requires human subjects testing)
- Not real-time (can't use for live monitoring)
- Averaging hides distribution (a MOS of 3.5 could be "everyone says 3-4" or "half say 5, half say 2")

### 3.2 ITU-T G.107 E-Model

The E-model is a **computational model** that predicts MOS from measurable network parameters, eliminating the need for subjective testing. It was designed as a transmission planning tool.

**Core formula:**

```
R = Ro - Is - Id - Ie-eff + A
```

| Component | What It Represents |
|-----------|--------------------|
| **Ro** | Basic signal-to-noise ratio (circuit noise, room noise) |
| **Is** | Simultaneous impairments (sidetone, quantizing distortion, loudness) |
| **Id** | Delay impairments (Idte: talker echo, Idle: listener echo, Idd: pure delay) |
| **Ie-eff** | Equipment impairment (codec quality, packet loss effects) |
| **A** | Advantage factor (user's tolerance for quality loss in exchange for mobility, e.g., cellular) |

**R-factor to MOS mapping:**

| R-value | User Satisfaction | MOS |
|---------|-------------------|-----|
| 90-100 | Very satisfied | 4.3-4.5 |
| 80-90 | Satisfied | 4.0-4.3 |
| 70-80 | Some dissatisfied | 3.6-4.0 |
| 60-70 | Many dissatisfied | 3.1-3.6 |
| <50 | Nearly all dissatisfied | <2.6 |

**Practical range:** 50-94 (below 50 is unacceptable; above 94 is physically impossible due to inherent noise).

#### Design Principles

1. **Subtractive decomposition.** Start with the theoretical maximum (Ro) and subtract impairments. This is psychoacoustically grounded -- impairments are additive in their degrading effect.
2. **MECE impairment categories.** Each type of degradation maps to exactly one component: noise (Ro), simultaneous distortion (Is), delay (Id), equipment (Ie), advantage (A). No overlaps.
3. **Objective inputs, subjective output.** All inputs are measurable network parameters; the output predicts subjective perception. This bridges the objective/subjective divide.
4. **Additive composition is interpretable.** You can identify which component contributes most to degradation. If R is low because Id is high, you know it's a delay problem.

#### What Succeeded

- Became the **standard for VoIP quality planning** worldwide.
- Every VoIP system vendor implements R-factor monitoring.
- The subtractive decomposition model is elegant and has been adapted to other domains.

#### What Failed / Limitations

- The advantage factor (A) is subjective and somewhat arbitrary.
- Doesn't capture temporal variation well (a call with one 5-second dropout and otherwise perfect quality gets the same R as a call with continuous mild degradation).
- Limited to narrow-band voice initially (extended by G.107.1 for wideband).

### 3.3 Lessons for Agent QoE

- **The subtractive model (start from perfect, subtract impairments) is elegant** but may not suit agent experience, where there's no well-defined "perfect" baseline. Our gated multiplicative-additive model (AXS) is arguably a better fit.
- **The objective-input, subjective-output bridge is essential.** Agent metrics should be computable from logs but should predict user satisfaction.
- **The R-factor's decomposability is its greatest strength.** Our AXS should similarly allow "which component is dragging the score down?" analysis.
- **Temporal aggregation is a known problem** in telephony QoE too -- validates our need for multi-granularity reporting.

---

## 4. Application Performance

### 4.1 Apdex (Application Performance Index)

**Source:** Open standard, managed by Apdex Alliance.

#### Structure

Apdex categorizes every transaction into one of three satisfaction zones based on response time relative to a single threshold T:

| Zone | Condition | Weight |
|------|-----------|--------|
| **Satisfied** | Response time <= T | 1.0 |
| **Tolerating** | T < Response time <= 4T | 0.5 |
| **Frustrated** | Response time > 4T, or server error | 0.0 |

**Formula:** `Apdex = (Satisfied + 0.5 * Tolerating) / Total`

**Score range:** 0.0 (all frustrated) to 1.0 (all satisfied)

**Interpretation benchmarks:**
- 0.94-1.00: Excellent
- 0.85-0.93: Good
- 0.70-0.84: Fair
- 0.50-0.69: Poor
- 0.00-0.49: Unacceptable

#### Design Principles

1. **Single-parameter simplicity.** Only one threshold (T) to configure. The 4T "frustrated" boundary is derived automatically.
2. **Tri-zone model reflects perception research.** Users are either satisfied, tolerating, or frustrated -- there's no nuance needed beyond this.
3. **Weighted average preserves information.** Tolerating users count as "half satisfied" rather than being lost.
4. **Domain-agnostic.** Works for any system with measurable response times.

#### What Succeeded

- Widely adopted (New Relic, Dynatrace, Datadog all implement it).
- Simple enough for executives to understand.
- The Satisfied/Tolerating/Frustrated language became industry vocabulary.

#### What Failed / Limitations

- **Too crude.** Collapses all experience into one dimension (response time). Ignores errors, availability, correctness.
- **Threshold sensitivity.** Different T values give wildly different scores. No principled way to choose T.
- **No diagnostic power.** Tells you satisfaction is low but not why.
- **Single-metric reductionism.** A system with perfect response times but frequent errors gets Apdex 1.0 (unless errors are counted as frustrated, which is implementation-dependent).

### 4.2 Google RAIL Model

**Source:** Google Chrome team, 2015. "Focus on the user."

#### Taxonomy Structure

RAIL organizes web performance into four user-centric activities:

| Activity | Target | Rationale |
|----------|--------|-----------|
| **Response** | <100ms | User perceives immediate reaction |
| **Animation** | <16ms per frame (60fps) | Smooth motion perception |
| **Idle** | <50ms per task | Keep main thread available for user input |
| **Load** | <5000ms (later revised to <1000ms for mobile) | Content appears usable |

#### Design Principles

1. **User-activity-centric.** Not "what is the system doing?" but "what is the user doing?" Each category corresponds to a type of user interaction.
2. **Threshold grounded in perception research.** 100ms response threshold comes from Miller (1968) and Card, Moran & Newell (1983). 16ms comes from 60fps display refresh. These aren't arbitrary.
3. **MECE across interaction types.** Any user interaction is either a response to input, an animation, occurring during idle, or part of initial load. No gaps.
4. **Prescriptive.** Each category has a concrete time budget, not a vague guideline.

#### What Succeeded

- Created a shared vocabulary for web performance conversations.
- The 100ms response target became an industry norm.
- Influenced the design of Core Web Vitals (loading->LCP, response->INP).

#### What Failed / Limitations

- **Too developer-focused.** Users don't think about "idle" or "animation" as distinct categories.
- **No composite score.** Each category is measured independently; no way to say "overall, is this page fast?"
- **Superseded by Core Web Vitals** for external communication, though RAIL remains useful as a developer mental model.

### 4.3 SRE Golden Signals

**Source:** Google SRE Book (Beyer, Jones, Petoff, Murphy, 2016).

#### The Four Signals

| Signal | What It Measures |
|--------|-----------------|
| **Latency** | Time to service a request (distinguish successful vs. failed request latency) |
| **Traffic** | Demand volume (requests/sec, sessions, transactions) |
| **Errors** | Rate of failed requests (explicit errors + implicit: wrong content, slow response) |
| **Saturation** | How "full" the system is (CPU, memory, I/O, queue depth) |

**Design principle:** "If you can only measure four metrics of your user-facing system, focus on these four."

#### Why This Matters for Agent QoE

The Golden Signals represent the **operational** side of quality -- they measure system health, not user experience. The distinction is important:

| Aspect | Golden Signals | Experience Metrics |
|--------|---------------|-------------------|
| Unit of analysis | Service | User session |
| Perspective | Infrastructure | Human perception |
| Question answered | "Is the system healthy?" | "Is the user satisfied?" |
| Typical consumer | SRE/DevOps | Product/UX |

**Lesson:** Our framework explicitly bridges this gap. Agent metrics should be derivable from operational telemetry (like Golden Signals) but should represent user-perceived quality (like video QoE). The state machine is the bridge -- it translates system events into user-experience states.

---

## 5. Conversational AI / Chatbot Quality

### 5.1 Industry Practice (Intercom, Zendesk, Drift)

The chatbot/conversational AI industry has converged on a set of **operational metrics** without a formal QoE framework:

| Metric | Definition | Industry Benchmark |
|--------|-----------|-------------------|
| **Containment Rate** | % of conversations resolved without human escalation | ~50% average; 80%+ for top performers |
| **CSAT** | Post-interaction satisfaction rating | 70-80% initially; 90%+ for top performers. AI scores 5-10 points below human agents. |
| **Resolution Rate** | % of conversations where user's issue is actually resolved | Rising from 41% to 51% (Intercom's Fin, 2024-2025) |
| **First Contact Resolution (FCR)** | % resolved without user returning with same issue | Higher is better; no standard benchmark |
| **Escalation Quality** | Was the escalation appropriate? Did handoff preserve context? | Emerging metric, no standard |

**Intercom's CX Score:** A proprietary alternative to surveyed CSAT that scores every interaction automatically, addressing the low response rate problem of post-chat surveys.

**Gap:** No formal framework ties these metrics together. No state machine. No lifecycle model. No composite score. Each vendor measures slightly different things. This is the same fragmentation that video streaming had pre-Zhang.

### 5.2 Academic Evaluation Frameworks

#### Dialogue System Evaluation Taxonomy (Deriu et al., 2021)

Academic evaluation distinguishes three classes of dialogue systems:
- **Task-oriented** (e.g., booking a flight)
- **Conversational/chitchat** (e.g., open-ended chat)
- **Question-answering** (e.g., factual lookup)

**Evaluation methods taxonomy:**
1. **Automatic corpus-based** (BLEU, METEOR, ROUGE -- word overlap with reference)
2. **Human-involved** (Likert ratings of fluency, relevance, coherence)
3. **User simulator-based** (simulated dialogues + task success measurement)

**Key insight:** Automatic metrics (BLEU etc.) correlate poorly with human judgments for open-ended dialogue. This is why the field still relies heavily on human evaluation.

#### Coppola et al. (2021) -- Chatbot Quality Attributes Taxonomy

A multivocal literature review (118 sources, both academic and industry) identified **123 quality attributes** organized into **four macro-categories and ten sub-categories**:

| Macro-Category | Sub-Categories | Example Attributes |
|----------------|---------------|-------------------|
| **Relational** | Trust, Personality, Empathy | Transparency, friendliness, emotional awareness |
| **Conversational** | Coherence, Understanding, Response Quality | Context retention, intent recognition, relevance |
| **User-Centered** | Usability, Satisfaction, Accessibility | Learnability, perceived usefulness, inclusivity |
| **Quantitative** | Performance, Accuracy | Response time, error rate, task completion |

**Key finding:** Scientific literature emphasizes Relational and Conversational attributes. Industry literature emphasizes User-Centered and Quantitative attributes. This academic/industry gap mirrors the capability/experience gap we identify in agent monitoring.

#### LLM Multi-Turn Evaluation (2025 Survey)

A recent survey (~200 papers, 2023-2025) presents a taxonomy for evaluating LLM-based multi-turn agents:
- **What to evaluate:** Knowledge retention, learning ability, task completion, safety, coherence
- **How to evaluate:** Data-driven annotation, automatic metrics, human evaluation
- **Conversational quality dimensions (IPO model):** Understanding humanness (input), perceived contingency (process), response humanness (output)

### 5.3 Healthcare Conversational AI (Foundation Metrics, 2024)

Nature Digital Medicine published "Foundation metrics for evaluating effectiveness of healthcare conversations powered by generative AI" -- one of the few domain-specific attempts to standardize chatbot quality metrics.

**Dimensions:** Language processing capability, clinical task impact, user-interactive conversation effectiveness.

### 5.4 Lessons for Agent QoE

- **The chatbot quality space is where video was pre-2011** -- fragmented, vendor-specific, no shared vocabulary. This validates our paper's positioning.
- **The 4-macro-category taxonomy (Relational, Conversational, User-Centered, Quantitative) is interesting** but mixes quality attributes (what the system should be) with quality metrics (what we measure). Our framework focuses on metrics.
- **Containment rate and resolution rate are the chatbot equivalents of our Resolution metrics.** They're well-understood but insufficient alone.
- **The subjective/objective gap is acute.** CSAT is surveyed (low response rate, biased sample); operational metrics are objective but don't capture satisfaction. Our framework needs to bridge this.
- **No one has applied the Zhang model to conversational AI.** This is the gap our paper fills.

---

## 6. Human-Computer Interaction (HCI)

### 6.1 ISO 9241-11: Usability Framework

**The three pillars of usability:**

| Dimension | Definition | How Measured |
|-----------|-----------|-------------|
| **Effectiveness** | Accuracy and completeness of goal achievement | Task completion rate, error rate |
| **Efficiency** | Resources used relative to results achieved | Time on task, number of steps, cognitive load |
| **Satisfaction** | User's subjective response to using the system | Likert-scale surveys, SUS score |

**Design principle:** Usability is context-dependent -- it must be measured for "specified users, goals, and context of use." There is no universal usability score.

**ISO 9241-11 revision (2018)** expanded the definition to include "user experience" as a broader concept encompassing usability, with additional attention to emotional responses, expectations, and perceptions.

### 6.2 Nielsen's 10 Usability Heuristics

Jakob Nielsen's heuristics (1990, refined 1994 from factor analysis of 249 usability problems):

| # | Heuristic | Measurable Proxy |
|---|-----------|-----------------|
| 1 | **Visibility of system status** | Time without feedback, progress indicator presence |
| 2 | **Match between system and real world** | Error rate from terminology confusion |
| 3 | **User control and freedom** | Rate of undo/back usage; availability of exit paths |
| 4 | **Consistency and standards** | Cross-page variance in interaction patterns |
| 5 | **Error prevention** | Number of user errors detected/reported |
| 6 | **Recognition rather than recall** | Time to complete task; clicks required |
| 7 | **Flexibility and efficiency of use** | Expert vs. novice completion time ratio |
| 8 | **Aesthetic and minimalist design** | Signal-to-noise ratio in UI elements |
| 9 | **Help users recognize, diagnose, and recover from errors** | Error recovery time; recovery success rate |
| 10 | **Help and documentation** | Time to find help; help utilization rate |

**Key insight for agent QoE:** Several heuristics map directly to agent experience dimensions:
- **Visibility of system status** -> Our Responsiveness metrics (TTFR, progress indicators)
- **User control and freedom** -> Our Interaction metrics (steering events, user effort)
- **Error prevention + recovery** -> Our Resolution metrics (error handling, recovery)
- **Flexibility and efficiency** -> Our Autonomy concept (agent handles complexity; user intervenes only when needed)

### 6.3 NASA Task Load Index (NASA-TLX)

**Source:** Hart & Staveland (1988). The most widely used cognitive workload assessment tool (cited >10,000 times).

**Six dimensions:**

| Dimension | Category | What It Captures |
|-----------|----------|-----------------|
| **Mental Demand** | Task demands | Thinking, deciding, calculating, remembering |
| **Physical Demand** | Task demands | Physical activity required |
| **Temporal Demand** | Task demands | Time pressure, pace of the task |
| **Effort** | Interaction | How hard the participant worked |
| **Performance** | Interaction | Self-assessed success in achieving goals |
| **Frustration** | Interaction | Insecurity, discouragement, irritation, stress |

**Structure:** Two conceptual groups:
1. **Demands imposed on the subject** (Mental, Physical, Temporal) -- exogenous
2. **Interaction of subject with task** (Effort, Performance, Frustration) -- endogenous

**Measurement:** Each dimension rated 1-20 on a visual analog scale. Weighted by pairwise comparisons to produce overall workload score.

**Key insight for agent QoE:**
- The demand/interaction split is powerful. Agent metrics should separately capture what the task demands and how the user experiences the interaction.
- **Frustration** is a first-class dimension in NASA-TLX. Our framework captures frustration indirectly (through stalls, steering effort, errors) but doesn't name it explicitly.
- **Temporal Demand** maps to our Progress phase -- is the agent working fast enough relative to the user's time pressure?

### 6.4 GOMS/KLM Models

**GOMS** (Goals, Operators, Methods, Selection rules) decomposes tasks into:
- **Goals:** What the user wants to achieve
- **Operators:** Atomic actions (keystrokes, mouse clicks, eye movements)
- **Methods:** Sequences of operators to achieve goals
- **Selection rules:** How users choose between methods

**KLM** (Keystroke-Level Model) is the simplest GOMS variant, predicting task execution time by summing atomic action times:
- K (keystroke): 0.2-1.2s depending on skill
- P (pointing): ~1.1s
- H (homing -- hand movement between devices): ~0.4s
- M (mental preparation): ~1.35s
- R (system response): variable

**Accuracy:** Within 10-30% of actual expert task times.

**Limitations:** Only valid for well-practiced, error-free tasks. Does not account for learning, fatigue, context, or output quality.

**Lesson for agent QoE:** GOMS/KLM model *user effort* as the sum of individual actions. Our concept of "steering effort" and "interaction overhead" is similar -- we're measuring how much work the user does to guide the agent. The difference is that agent interaction is fundamentally less predictable than GUI interaction, so we can't enumerate actions in advance.

---

## 7. Gaming QoE

### 7.1 Key Quality Indicators (KQIs)

Gaming QoE research identifies several categories of quality indicators:

| Category | Key Metrics | Impact |
|----------|------------|--------|
| **Input Latency** | End-to-end delay from input to visual response | Most critical for competitive gaming; >100ms is noticeable |
| **Frame Rate / Frame Time** | FPS (average), frame time consistency (variance) | 95th percentile frame rate floor predicts QoE across games |
| **Network Jitter** | Variation in packet arrival times | Causes rubber-banding, teleporting |
| **Freezes** | Complete playback stalls (analogous to video rebuffering) | Most disruptive to experience |
| **Visual Quality** | Resolution, texture quality, rendering fidelity | Perceived quality degrades with distance from native resolution |

### 7.2 Cloud Gaming Metrics Taxonomy

Research (ScienceDirect, 2023) proposes a structured taxonomy for cloud gaming QoE:

**KQI vs. KPI distinction:**
- **KPI (Key Performance Indicators):** Network-level metrics (bandwidth, latency, packet loss) -- analogous to SRE Golden Signals
- **KQI (Key Quality Indicators):** Service-level metrics derived from KPIs that directly predict perceived quality (input lag, freezes, perceived frame rate) -- analogous to experience metrics

This KPI->KQI mapping is exactly the operational->experiential bridge our framework provides.

### 7.3 Player Engagement Taxonomy

Player engagement is measured across **cognitive, emotional, and behavioral** aspects:

**Behavioral metrics:** DAU/MAU, retention rates, session length, churn rate
**Cognitive metrics:** Flow state indicators, challenge-skill balance
**Emotional metrics:** Sentiment analysis, physiological responses (heart rate, skin conductance)

### 7.4 Frame Time vs. Frame Rate

A CHI 2023 paper ("The Effects of Frame Rate Variation on Game Player Quality of Experience") established that **frame time consistency matters more than average frame rate.** A steady 45fps feels better than a fluctuating 30-60fps with the same average.

**Lesson for agent QoE:** This validates our emphasis on **stall predictability** and **progress consistency** over raw throughput. An agent that produces tokens at a steady 30 tok/s may feel better than one that bursts at 60 tok/s with intermittent pauses.

### 7.5 Latency Compensation Survey

A comprehensive ACM survey (2022) categorized >80 papers on latency compensation into 11 base technique types organized into 4 groups. The taxonomy itself is relevant:
- **Prediction** (what will happen next?)
- **Concealment** (hide the latency from the user)
- **Compensation** (adjust game state retroactively)
- **Prevention** (architectural changes to reduce latency)

**Lesson:** These categories map to agent strategies: prediction (prefetching context), concealment (streaming output), compensation (error recovery), prevention (faster models). Our framework measures the *experience outcome* of these strategies, not the strategies themselves.

---

## 8. Cross-Domain Synthesis

### 8.1 Recurring Patterns

#### Pattern 1: The Lifecycle/Phase Structure

Almost every framework organizes metrics around a temporal lifecycle:

| Domain | Phases |
|--------|--------|
| **Video QoE** | Startup -> Playback -> Interruptions -> End |
| **Web Vitals** | Loading -> Interactivity -> Visual Stability |
| **RAIL** | Load -> Response -> Animation -> Idle |
| **Telephony** | Connection -> Conversation -> Degradation |
| **Gaming** | Launch -> Gameplay -> Interruptions |
| **Chatbot** | First response -> Conversation -> Resolution |

**Our framework:** Initiation -> Progress -> Interaction -> Delivery -> Resolution

This is the most consistent pattern across all domains. The lifecycle is the natural organizing principle for experience metrics.

#### Pattern 2: The "Can It Start?" Gate

Every framework has a binary "can it start?" check that gates all other metrics:

| Domain | Gate Metric |
|--------|------------|
| **Video** | Video Start Failure (VSF) |
| **Web** | Page load failure |
| **Telephony** | Call setup failure |
| **Apdex** | Server error = Frustrated |
| **Agent** | Start Failure Rate |

**Implication:** Our gate mechanism (G_start, G_resolve in AXS) is not arbitrary -- it reflects a universal pattern. If the interaction can't start, nothing else matters.

#### Pattern 3: The Responsiveness/Latency Dimension

Present in every single framework:

| Domain | Responsiveness Metric |
|--------|----------------------|
| **Video** | Join Time |
| **Web** | LCP, INP, TTFB |
| **RAIL** | Response <100ms, Load <5s |
| **Telephony** | Delay impairment (Id) |
| **Apdex** | Response time T |
| **Gaming** | Input latency |
| **Agent** | TTFR, Perceived Throughput |

This is the **most universal dimension** in QoE. Every domain measures "how fast did the system respond?"

#### Pattern 4: The Interruption/Stall Dimension

Most frameworks have an explicit "mid-experience interruption" concept:

| Domain | Interruption Metric |
|--------|--------------------|
| **Video** | Buffering Ratio, Rebuffering Frequency |
| **Gaming** | Freeze rate, frame drops |
| **Web** | CLS (visual disruption) |
| **Agent** | Stall Ratio, Stall Frequency |

The pattern: **Interruptions are measured separately from initial latency** because they represent a qualitatively different user experience (broken promise vs. unmet expectation).

#### Pattern 5: The Outcome/Quality Dimension

Every framework has a "was the output good?" dimension, though it's the hardest to measure:

| Domain | Output Quality Metric |
|--------|----------------------|
| **Video** | Average bitrate, VMAF |
| **Web** | (Implicit -- correct rendering) |
| **Telephony** | R-factor (overall quality) |
| **Chatbot** | Resolution rate, CSAT |
| **Agent** | Task Completion, Answer Quality |

### 8.2 Typical Number of Top-Level Categories

| Framework | # of Top-Level Categories |
|-----------|--------------------------|
| Core Web Vitals | **3** (loading, interactivity, stability) |
| RAIL | **4** (response, animation, idle, load) |
| SRE Golden Signals | **4** (latency, traffic, errors, saturation) |
| Video QoE (Zhang) | **5** (join time, buffering ratio, rebuf frequency, bitrate, rendering quality) |
| Mux | **4** (failures, startup, rebuffering, quality) |
| E-model | **5** (Ro, Is, Id, Ie, A) |
| ISO 9241-11 | **3** (effectiveness, efficiency, satisfaction) |
| NASA-TLX | **6** (mental, physical, temporal, effort, performance, frustration) |
| Chatbot quality (Coppola) | **4** macro-categories |
| Our framework | **5** (Initiation, Progress, Interaction, Delivery, Resolution) |

**Distribution:**
- 3 categories: 2 frameworks (CWV, ISO 9241-11)
- 4 categories: 4 frameworks (RAIL, SRE, Mux, Coppola)
- 5 categories: 3 frameworks (Zhang, E-model, ours)
- 6 categories: 1 framework (NASA-TLX)

**Mean: 4.1. Mode: 4. Range: 3-6.**

**Insight:** Three is optimal for external communication (CWV's success proves this). Four-to-five is standard for technical depth. Six risks cognitive overload. Our five categories are at the upper end of the comfortable range. Consider whether five can be communicated as effectively as three.

**Option to explore:** Can our five phases be grouped into three "super-categories" for executive communication?
- **Start** (Initiation) -- "Can it start?"
- **Experience** (Progress + Interaction) -- "How does it feel?"
- **Outcome** (Delivery + Resolution) -- "Did it work?"

### 8.3 The Subjective/Objective Divide

Every domain grapples with this:

| Domain | Objective Metrics | Subjective Metrics | Bridge |
|--------|------------------|-------------------|--------|
| **Video** | Bitrate, rebuffering ratio | MOS (ITU-T P.1203) | P.1203 predicts MOS from objective inputs |
| **Web** | LCP, INP, CLS (milliseconds) | User satisfaction surveys | CrUX data correlates metrics to satisfaction |
| **Telephony** | Delay, jitter, packet loss | MOS (P.800) | E-model (G.107) predicts MOS from network params |
| **Chatbot** | Response time, resolution rate | CSAT | Intercom CX Score auto-predicts satisfaction |
| **HCI** | Task time, error rate | SUS, NASA-TLX | ISO 9241-11 defines both as facets of usability |
| **Agent** | TTFR, Stall Ratio, etc. | ??? | AXS (proposed) -- but not yet validated against subjective ratings |

**Universal pattern:** Mature frameworks start with objective metrics, then build computational models that predict subjective quality from objective inputs (E-model, P.1203, VMAF). The subjective validation comes later, not first.

**Implication for our work:** Our framework is at the right stage -- defining objective metrics and proposing a composite (AXS). Paper-1 should validate AXS against subjective ratings, following the E-model / P.1203 / VMAF trajectory.

### 8.4 Task-Specific vs. Universal Metrics

| Domain | Universal Metrics | Task-Specific Adaptations |
|--------|------------------|--------------------------|
| **Video** | Buffering ratio, join time | Live vs. VOD (different sensitivity) |
| **Web** | LCP, INP, CLS | E-commerce vs. media vs. SaaS (different thresholds) |
| **Telephony** | R-factor, MOS | Narrow-band vs. wideband (G.107 vs. G.107.1) |
| **Gaming** | Input latency, frame rate | Genre-specific (FPS vs. strategy vs. puzzle) |
| **Agent** | TTFR, Stall Ratio, Completion | Content-type adaptation (guided_task vs. quick_answer vs. autonomous_workflow) |

**Universal pattern:** The top-level metrics are universal. The thresholds and weights are task-specific.

Our content-type-aware weight adaptation in AXS follows this pattern exactly. The metrics are the same everywhere; the relative importance shifts by context.

### 8.5 What Makes Frameworks Succeed or Fail

**Success factors (from frameworks that became industry standards):**

| Factor | Examples |
|--------|---------|
| **Small number of core metrics (3-5)** | CWV (3), Golden Signals (4), Zhang (5) |
| **Anchored in a formal model** | Zhang's state machine, E-model's formula |
| **Named after user perception, not system internals** | "Buffering Ratio" not "CDN throughput deficit" |
| **Causal link to business outcomes** | Zhang: "1% buffering = 3 min lost"; CWV: search ranking |
| **Open specification** | CWV (published), E-model (ITU standard), VMAF (open source) |
| **Tooling ecosystem** | CWV (Lighthouse, PageSpeed Insights), Conviva (SaaS) |
| **Evolution mechanism** | CWV: FID->INP replacement process |

**Failure factors:**

| Factor | Examples |
|--------|---------|
| **Too many metrics** | Enterprise APM dashboards with 50+ metrics |
| **No formal model** | Ad hoc chatbot metrics (no state machine, no lifecycle) |
| **Opaque composite score** | Proprietary scores without published formulas |
| **No business outcome link** | Academic metrics (BLEU, METEOR) without engagement correlation |
| **Static -- can't evolve** | Legacy standards that can't incorporate new metrics |
| **Lab-only measurement** | Metrics that can't be collected in production |

---

## 9. Implications for Agent Experience Taxonomy

### 9.1 What Our Framework Gets Right

Based on this cross-domain analysis, our framework aligns with proven patterns:

1. **State machine as anchor** -- follows the Zhang model, the most successful QoE framework ever created. This is the right foundation.
2. **Lifecycle-phase organization** -- our five phases (Initiation, Progress, Interaction, Delivery, Resolution) follow the universal lifecycle pattern.
3. **Gate mechanism** -- our G_start and G_resolve gates mirror the universal "can it start?" pattern.
4. **Responsiveness as primary metric** -- TTFR and Perceived Throughput map to the most universal QoE dimension.
5. **Content-type weight adaptation** -- follows the universal pattern of same-metrics-different-weights.
6. **Open, published formula** -- AXS formula is transparent, unlike proprietary alternatives.
7. **Observable events at the boundary** -- follows Zhang's principle of deriving metrics from client-side instrumentation.

### 9.2 Potential Gaps and Improvements

| Gap | Evidence from Other Domains | Potential Action |
|-----|----------------------------|-----------------|
| **Five phases may be too many for communication** | CWV succeeded with 3; most frameworks use 3-4 | Consider 3-tier "super-categories" (Start, Experience, Outcome) for executive communication, with 5 phases as the detailed view |
| **No subjective validation** | Every mature framework bridges objective->subjective (E-model, P.1203, VMAF) | Plan Paper-1 to validate AXS against user satisfaction ratings |
| **Frustration is implicit, not explicit** | NASA-TLX has frustration as first-class dimension; Nielsen's heuristic #9 is about error recovery frustration | Consider whether frustration deserves explicit treatment in the taxonomy (possibly as a derived dimension) |
| **No "concealment" / perceived quality concept** | Video has VMAF (perceptual quality separate from bitrate); Gaming has frame time consistency vs. average frame rate | Streaming output quality (perceived throughput) is good but may need a "burstiness" or "consistency" metric |
| **No "advantage factor"** | E-model's A factor captures user willingness to tolerate degradation for convenience | Agent users may tolerate worse quality for autonomous agents vs. guided tasks -- our content-type weights partially capture this |
| **Temporal aggregation not addressed** | Known problem in telephony, video, and web (hourly vs. daily vs. weekly) | Already identified as a pitfall in METRICS-4; ensure it's prominent in the paper |
| **Diagnostic vs. experiential tier not explicit** | CWV's biggest innovation was separating "core" metrics from "broader" metrics | Our L1/L2/L3 observability classification serves this role, but we could make the experiential/diagnostic distinction more explicit |

### 9.3 Strengthening the Research Grounding in the Paper

Based on this research, the paper's Section 2 (Related Work) should be strengthened with:

1. **Explicit comparison table** mapping our taxonomy to other frameworks:

| Our Phase | Video QoE Equivalent | Web Vitals Equivalent | Telephony Equivalent | HCI Equivalent |
|-----------|---------------------|----------------------|---------------------|---------------|
| Initiation | Join Time / VSF | LCP | Call Setup | Task onset |
| Progress | Buffering Ratio / Rebuffering | (Loading completeness) | Conversation quality | Efficiency |
| Interaction | (N/A -- unidirectional) | INP | (N/A) | User control |
| Delivery | Average Bitrate / VMAF | (Correct rendering) | Voice quality (R-factor) | Effectiveness |
| Resolution | (Engagement duration) | (Bounce rate proxy) | Call completion | Task completion |

2. **The Interaction phase is our key innovation** -- video and telephony lack it because they're unidirectional/passive. This is the structural addition that adapts the Zhang model to interactive AI systems.

3. **Position AXS in the family of composite scores:**

| Score | Domain | Structure | Open? |
|-------|--------|-----------|-------|
| MOS | Voice | Single scale (1-5) | Yes (ITU) |
| R-factor | Voice | Subtractive (R = Ro - Is - Id - Ie + A) | Yes (ITU) |
| Apdex | Web apps | Weighted ratio (Satisfied + 0.5*Tolerating / Total) | Yes (Alliance) |
| SPI | Video | % of streams passing all thresholds | No (Conviva proprietary) |
| Viewer Experience Score | Video | Proprietary weighted composite | No (Mux proprietary) |
| AXS | Agent | Gated multiplicative-additive (G * Q * 100) | Yes (our paper) |

### 9.4 The Strongest Analogy

The closest analogy to our work is not any single framework but the **trajectory from Zhang 2011 -> Conviva SPI -> ITU-T P.1203:**

1. **Zhang 2011:** State machine + individual metrics + causal engagement link (our Paper-0)
2. **Conviva SPI:** Composite score + dimensional slicing at scale (our AXS + diagnostic dimensions)
3. **ITU-T P.1203:** Standardized, multi-mode quality estimation with formal subjective validation (our Paper-1+)

We are at stage 1 (defining the state machine and metrics) with elements of stage 2 (proposing AXS). Stage 3 (subjective validation, potential standardization) is future work. This trajectory should be made explicit in the paper.

---

## Appendix A: Source Bibliography

### Video QoE
- Dobrian, Sekar, Awan, Stoica, Joseph, Ganjam, Zhan, Zhang. "Understanding the Impact of Video Quality on User Engagement." ACM SIGCOMM 2011. http://conferences.sigcomm.org/sigcomm/2011/papers/sigcomm/p362.pdf
- Balachandran et al. "A Quest for an Internet Video Quality-of-Experience Metric." ACM HotNets 2012. http://conferences.sigcomm.org/hotnets/2012/papers/hotnets12-final116.pdf
- Conviva Blog: "The Most Important Metrics for Video Streaming." https://www.conviva.com/blog/anatomy-of-a-metric/
- Conviva SPI Documentation. https://docs.conviva.com/learning-center-files/content/ei_application/ea-features/spi_intro.htm
- ITU-T P.1203 Implementation. https://github.com/itu-p1203/itu-p1203
- Streaming Learning Center: "Introducing ITU-T Metrics P.1203 and P.1204." https://streaminglearningcenter.com/blogs/itu-t-p1203-p1204.html
- Netflix VMAF. https://github.com/Netflix/vmaf
- Netflix Tech Blog: "Toward A Practical Perceptual Video Quality Metric." https://netflixtechblog.com/toward-a-practical-perceptual-video-quality-metric-653f208b9652
- Mux Blog: "The Four Elements of Video Performance." https://www.mux.com/blog/the-four-elements-of-video-performance

### Web Performance
- web.dev: "Web Vitals." https://web.dev/articles/vitals
- web.dev: "How the Core Web Vitals metrics thresholds were defined." https://web.dev/articles/defining-core-web-vitals-thresholds
- web.dev: "Measure performance with the RAIL model." https://web.dev/articles/rail
- Addy Osmani: "The History of Core Web Vitals." https://addyosmani.com/blog/core-web-vitals/
- web.dev: "Interaction to Next Paint becomes a Core Web Vital." https://web.dev/blog/inp-cwv-march-12
- Google Search Central: "Introducing INP to Core Web Vitals." https://developers.google.com/search/blog/2023/05/introducing-inp
- Smashing Magazine: "Introducing RAIL: A User-Centric Model For Performance." https://www.smashingmagazine.com/2015/10/rail-user-centric-model-performance/

### Voice/Telephony QoE
- ITU-T G.107: "The E-model." https://www.itu.int/ITU-T/2005-2008/com12/emodelv1/tut.htm
- Sage Instruments: "The E-Model, R Factor and MOS Overview." https://www.sageinst.com/assets/download_doc/E-Model-R-Factor-MOS-Overview.pdf
- VoIP Troubleshooter: "Measuring Voice Quality." https://www.voiptroubleshooter.com/basics/mosr.html
- Wikipedia: "Mean Opinion Score." https://en.wikipedia.org/wiki/Mean_opinion_score

### Application Performance
- Wikipedia: "Apdex." https://en.wikipedia.org/wiki/Apdex
- New Relic: "Apdex: Measure user satisfaction." https://docs.newrelic.com/docs/apm/new-relic-apm/apdex/apdex-measure-user-satisfaction/
- Google SRE Book: "Monitoring Distributed Systems." https://sre.google/sre-book/monitoring-distributed-systems/
- Splunk: "SRE Metrics: Core SRE Components, the Four Golden Signals." https://www.splunk.com/en_us/blog/learn/sre-metrics-four-golden-signals-of-monitoring.html

### Conversational AI
- Coppola et al. "Quality Assessment Methods for Textual Conversational Interfaces: A Multivocal Literature Review." MDPI Information, 2021. https://www.mdpi.com/2078-2489/12/11/437
- Deriu et al. "Survey on Evaluation Methods for Dialogue Systems." PMC, 2021. https://pmc.ncbi.nlm.nih.gov/articles/PMC7817575/
- Galileo AI: "Metrics for Evaluating LLM Chatbot Agents." https://galileo.ai/blog/metrics-for-evaluating-llm-chatbots-part-1
- Confident AI: "LLM Chatbot Evaluation Explained." https://www.confident-ai.com/blog/llm-chatbot-evaluation-explained-top-chatbot-evaluation-metrics-and-testing-techniques
- Intercom Help: "Customer satisfaction (CSAT) reporting." https://www.intercom.com/help/en/articles/10244420-customer-satisfaction-csat-reporting

### HCI
- NN/g: "10 Usability Heuristics for User Interface Design." https://www.nngroup.com/articles/ten-usability-heuristics/
- NASA: "NASA Task Load Index (TLX)." https://www.nasa.gov/human-systems-integration-division/nasa-task-load-index-tlx/
- Hart, S.G. "NASA-TASK LOAD INDEX (NASA-TLX); 20 Years Later." https://human-factors.arc.nasa.gov/groups/TLX/downloads/HFES_2006_Paper.pdf
- Usability Body of Knowledge: "KLM-GOMS." https://www.usabilitybok.org/klm-goms/
- ISO: "ISO 9241-11:2018 Ergonomics of human-system interaction." https://www.iso.org/standard/63500.html

### Gaming QoE
- ACM Computing Surveys: "A Survey and Taxonomy of Latency Compensation Techniques for Network Computer Games." https://dl.acm.org/doi/10.1145/3519023
- CHI 2023: "The Effects of Frame Rate Variation on Game Player Quality of Experience." https://dl.acm.org/doi/10.1145/3544548.3580665
- ScienceDirect: "Measuring and estimating Key Quality Indicators in Cloud Gaming services." https://www.sciencedirect.com/science/article/pii/S1389128623002530
- MDPI Sensors: "Measuring Key Quality Indicators in Cloud Gaming: Framework and Assessment Over Wireless Networks." https://www.mdpi.com/1424-8220/21/4/1387
