# Paper-0 Review: Measuring Agent Experience

**Reviewer:** Automated review against source material (RES-research-foundation, METRICS-metrics-design)
**Date:** 2026-04-14

---

## 1. Overall Assessment

This is a strong, well-structured design paper that faithfully translates the Zhang SIGCOMM 2011 argumentation template into the agent domain. The state machine, metrics taxonomy, diagnostic dimensions, and AXS composite score are all present and internally consistent. The writing is dense, precise, and appropriately calibrated for a design paper (using "we define" and "we propose" rather than "we show"). The three worked examples are vivid and exercise different content types effectively. The paper is close to shippable but has several math errors in the illustrative examples, a few missing items from the source material, and a handful of rhetorical issues that should be addressed in a revision pass.

---

## 2. Strengths

- **Argumentation chain is intact.** The paper follows the definitions -> operationalization -> predictions -> design guidance arc cleanly. Every section builds on the previous one.
- **State machine is the anchor.** As prescribed by the Zhang template, the state machine is introduced early and referenced throughout. Every metric traces back to a state or transition.
- **All 29 metrics present.** The full taxonomy from METRICS-2 is faithfully reproduced with consistent naming, correct definitions, and proper Zhang analogues.
- **AXS formula is correctly structured.** The gated multiplicative-additive hybrid (G x Q x 100) matches METRICS-4 exactly, with all sub-score formulas, weight tables, and content-type adaptations present.
- **Confidence calibration is excellent.** The paper consistently uses "we define," "we propose," and "we predict" rather than claiming empirical results. Section 8.4 (Limitations) is honest and thorough.
- **Related work is thorough and well-organized.** The five-category landscape survey from RES-2 is fully integrated, and the positioning against each tool is sharp without being dismissive.
- **Active voice with "we" throughout.** Writing is precise, avoids filler, and uses specifics over adjectives.
- **The three illustrative examples span content types** (guided_task, quick_answer, autonomous_workflow) and include both good and degraded versions, which adds analytical depth.
- **Analogical money numbers and testable predictions** (Section 8.1-8.2) are present and well-framed, following the Zhang template adaptation.
- **Appendices are complete** (Event Schema, Full Metric Reference Table).

---

## 3. Issues Found

### Critical

**Issue 1: Math error in Section 7.1 (Coding Agent) Stall Ratio calculation.**
The paper computes `Stall Ratio = 15.6 / (19.5 + 15.6) = 0.444` and annotates "15.6s stalled out of 35.1s active." However, Starting time is 1.2s (TTFR = 1.2s), so Working time = 35.1 - 1.2 - 15.6 = 18.3s, not 19.5s. The 19.5 erroneously includes Starting time in Working time. Correct Stall Ratio = 15.6 / (18.3 + 15.6) = 15.6 / 33.9 = 0.460. This propagates into the AXS computation for that example (S_stall is clamped to 0 either way due to exceeding 0.20, so the final AXS is not affected, but the stated ratio and Working time are wrong in the metric table and the text).

### Major

**Issue 2: Missing AXS pitfall -- Temporal Aggregation.**
METRICS-4 Section 4.8 defines six pitfalls. The paper's Section 6.8 covers five (Goodhart's Law, Simpson's Paradox, Apples to Oranges, Threshold Sensitivity, Cold Start) but omits "Pitfall 5: Temporal Aggregation" from METRICS-4, which describes the risk of weekly averaging hiding within-week outages and proposes multi-granularity reporting with hourly alerting thresholds. This is a substantive operational insight that should be included.

**Issue 3: Missing dimension interaction pattern -- User x Interface x Geography.**
METRICS-3 Section 3.5 defines six dimension interaction patterns. The paper's Section 5.4 includes five but omits pattern #6: "User x Interface x Geography (latency attribution): TTFR varies with geography and interface. Slice all three together to separate infrastructure latency from agent latency." This is a practical diagnostic insight.

**Issue 4: The "optimized agent" sub-example in Section 7.1 has unclear timing.**
The optimized agent scenario states "Stall Ratio: 3.5/13.5 = 0.259" and "TTTC: 13.5s." But the denominator should be Working + Stalled, not total session time. If TTFR = 0.8s and total = 13.5s, then active = 12.7s, stall = 3.5s, working = 9.2s, and ratio = 3.5/(9.2+3.5) = 3.5/12.7 = 0.276. The math does not add up as presented. This needs reworking with explicit timings similar to the first scenario.

**Issue 5: Section 7.2 (Quick Answer) degraded example is under-specified.**
The degraded quick_answer computation uses `S_stall = (1 - 3.5/(3.5+9.3)/0.20)` which is syntactically ambiguous and not fully worked through. The stall ratio denominator components (3.5 and 9.3) are not derived from the scenario timeline. Several sub-scores in this example use approximate values without showing the derivation, making it impossible for a reader to verify. Contrast with the cohort example in Section 6.5, which is fully explicit.

**Issue 6: Sensitivity analysis from METRICS-4 Section 4.7 is missing.**
METRICS-4 includes a sensitivity analysis table showing how changes to individual input metrics affect AXS (e.g., "halving stall ratio yields +7.4 points"). This is a high-value addition that demonstrates AXS responds appropriately to real improvements and is absent from the paper. It should be added after the cohort worked example in Section 6.5 or as a subsection of Section 6.

### Minor

**Issue 7: Stall Duration p50 calculation in Section 7.1.**
The paper states "Stall Duration p50: 2.6s" for the distribution [2.1, 1.4, 3.8, 8.3]. The median of four values is the average of the 2nd and 3rd values when sorted: sorted = [1.4, 2.1, 3.8, 8.3], p50 = (2.1 + 3.8) / 2 = 2.95s, not 2.6s.

**Issue 8: Section 6.7 (Comparison to Industry Composite Scores) is thinner than the source.**
METRICS-4 Section 4.9 includes a detailed comparison table with columns for Structure, What Worked, What Didn't, and Lesson for AXS. The paper's Table in Section 6.7 omits the "What Didn't Work" column, which provided important context (e.g., Apdex being too crude, VMAF being opaque, Conviva being proprietary). Adding this column would strengthen the positioning.

**Issue 9: Missing open questions from METRICS-4 Section 4.10.**
METRICS-4 raises six open questions for Paper-1 (weight calibration, gate exponent tuning, content type boundaries, threshold calibration, cross-domain validity, subjective validation). The paper's Section 8.3 covers five of these but omits "gate exponent tuning" (are alpha=1.0 and beta=0.8 the right sensitivities?) as a distinct item. It is partially implied but not stated explicitly.

**Issue 10: The Stall Ratio note for L1 vs L2 observability appears in Section 4.7 but the asterisk convention is inconsistent.**
In the observability classification table, Stall Ratio is listed under L1 with an asterisk, and the footnote explains the L1/L2 distinction. However, in Appendix B the observability is listed as "L1/L2" without the explanatory note. A reader consulting only Appendix B would not understand the distinction.

**Issue 11: Reference [1] and [2] appear to be placeholder citations.**
"Markets and Markets. AI Agent Market Size..." and "McKinsey & Company. The State of AI in 2025..." are plausible but unverifiable. If these are fabricated or estimated references, they should be either (a) replaced with real citations or (b) marked as illustrative with a note.

**Issue 12: Section 3.4 transition table -- minor formatting inconsistency.**
The transition table in METRICS-1 uses the format "Starting -> Working" with arrows in the From column, while the paper's Table 2 uses separate From/To columns. The paper's format is actually cleaner, but this means the paper's transition table in Section 3.4 lists "Starting | Ended" for user-cancel-before-output, which is correct but could surprise a reader since Starting -> Ended is not in the state machine diagram (the diagram only shows Starting -> Failed and Starting -> Working).

---

## 4. Specific Edits Recommended

### Section 7.1, line ~712
**Fix:** Change the Stall Ratio row in the metric table from:
`| Stall Ratio | 15.6 / (19.5 + 15.6) = 0.444 | 15.6s stalled out of 35.1s active |`
to:
`| Stall Ratio | 15.6 / (18.3 + 15.6) = 0.460 | 15.6s stalled, 18.3s working (excl. 1.2s Starting) |`

### Section 7.1, line ~714
**Fix:** Change Stall Duration p50 from 2.6s to 2.95s (or note that the values are approximate).

### Section 7.1, lines ~740-763
**Fix:** Rewrite the "optimized agent" sub-example with a full timeline similar to the first scenario, showing explicit state transitions and correctly derived stall ratio.

### Section 7.2, lines ~828-838
**Fix:** Fully work through the degraded quick_answer example with explicit intermediate calculations, as done in the cohort example (Section 6.5).

### Section 6.8
**Add:** A "Temporal Aggregation" pitfall paragraph between the current pitfalls. Content from METRICS-4 Section 4.8 Pitfall 5: "Risk: Averaging AXS over a week hides within-week variance. A Tuesday outage that cratered quality to AXS 20 for 4 hours may barely dent the weekly average. Mitigation: Report AXS at multiple temporal granularities (per-session, hourly, daily, weekly). Alert on hourly AXS drops exceeding a threshold (proposed: >15 points below trailing 24-hour average)."

### Section 5.4
**Add:** A sixth dimension interaction pattern: "User x Interface x Geography (latency attribution): TTFR varies with geography (network latency to model provider) and interface (web chat adds rendering overhead vs. CLI). Slice all three together to separate infrastructure latency from agent latency."

### After Section 6.5 (or as Section 6.6, renumbering subsequent sections)
**Add:** Sensitivity analysis table from METRICS-4 Section 4.7, showing partial sensitivities around the worked-example operating point. This demonstrates AXS responds appropriately and confirms that stall ratio is the largest lever for guided_task.

### Section 6.7
**Expand:** Add a "What Didn't Work" column to the industry comparison table, drawing from METRICS-4 Section 4.9. The contrast sharpens AXS's positioning.

### Section 8.3
**Add:** Explicit mention of gate exponent tuning as an open question: "Are alpha = 1.0 and beta = 0.8 the right gate sensitivities? Does a 1% start failure rate feel twice as bad as a 1% non-resolution rate?"

---

## 5. Missing Content

1. **Temporal Aggregation pitfall** (from METRICS-4 Section 4.8 Pitfall 5) -- substantive operational guidance missing from Section 6.8.
2. **Sensitivity analysis** (from METRICS-4 Section 4.7) -- high-value addition demonstrating AXS responds correctly to metric changes.
3. **User x Interface x Geography** dimension interaction pattern (from METRICS-3 Section 3.5 pattern #6).
4. **Gate exponent tuning** as an explicit open question (from METRICS-4 Section 4.10 item #2).
5. **Expanded industry comparison table** with "What Didn't Work" column (from METRICS-4 Section 4.9).

None of these are large additions -- each is 1-3 paragraphs or a table column. All source material already exists in the METRICS epic.

---

## 6. Verdict

**Needs revision pass.**

The paper is structurally complete, rhetorically well-calibrated, and covers all major contributions. The issues are concentrated in (a) math errors in the illustrative examples, (b) a handful of items from the source material that were not carried over, and (c) under-specified worked examples in Sections 7.1-7.2. None of these require rethinking the paper's structure or argument -- they are fixable in a single focused revision pass. After that pass, the paper is ready to ship.
