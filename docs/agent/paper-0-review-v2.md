# Paper-0 Structural Review (v2)

Date: 2026-04-15

## Checklist

1. **Structure: All sections present?** PASS
   Abstract, Intro (S1), Related Work (S2), State Machine (S3), Operational Metrics (S4), Five Pillars (S5), Content Types (S6), Dimensions (S7), Examples (S8), Discussion (S9), Conclusion (S10), Appendix A (Event Schema), Appendix B (Metric Reference). All accounted for.

2. **Two-layer architecture: operational -> experience flow clear?** PASS
   Clearly established in the abstract, S1 ("core insight"), S4 (operational layer), S5 (experience layer). The bridge metaphor (E-model, CWV) is repeated consistently. Examples in S8 show operational metrics feeding pillar assessments.

3. **5 pillars all present with plain names?** PASS
   Responsiveness (S5.2), Reliability (S5.3), Autonomy (S5.4), Correctness (S5.5), Completion (S5.6). Each has a plain user question. MECE validation in S5.7.

4. **AXS deprioritized to brief future-work mention?** PASS
   AXS appears only in S9.3 ("Composite Score: Future Work") -- one page, no formulas, no worked examples. Correctly framed as needing empirical weight calibration first.

5. **Cross-domain grounding in related work?** PASS
   S2 references all seven domains: Video (S2.1), Web/CWV (S2.2), Voice/E-model (S2.3), App Perf/RAIL/Apdex (S2.3), Chatbot (S2.3), HCI/ISO/Nielsen/NASA-TLX (S2.3), Gaming (S2.3). Table 1 (S2.6) maps all five pillars across all seven domains.

6. **6-state machine preserved?** PASS
   Starting, Working, Stalled, Waiting, Failed, Ended. ASCII diagram (Figure 1), state definitions (Table 2), transition table (Table 3), design decisions (S3.5), Zhang mapping (S3.6). All intact.

7. **Plain metric names? No jargon?** PASS
   Checked all metric tables. Names are plain English: "Time to First Token," "Stall Ratio," "Questions Asked," "Gave-Up Rate," "Work Multiplier," etc. No "Steering Events" or "Perceived Throughput" found. One minor note: "steering_event" appears in the event schema (Appendix A, line 779) and once in Example 8.2 (line 605), but these are event-level labels, not metric names.

8. **3 illustrative examples showing operational -> experience flow?** PASS
   S8.1: Coding agent / Guided Task -- with optimized contrast.
   S8.2: Customer support bot / Quick Answer -- with degraded contrast.
   S8.3: Autonomous CI/CD agent / Autonomous Workflow -- with failed contrast.
   Each shows: timeline -> operational metrics table -> experience pillar assessment -> diagnosis. Flow is clear.

9. **Any critical errors?** PASS (no critical errors found)
   - Math spot-checks: S8.1 stall ratio 46% (15.6s/33.9s) -- 15.6s = 2.1+1.4+3.8+8.3 = 15.6, active = 35.1-1.2 = 33.9. Correct.
   - S8.2 stall ratio 21% (1.2/5.8) = 20.7%, rounded to 21%. Acceptable.
   - Section numbering is sequential and unbroken (1-10 + A-B).
   - Appendix B metric IDs are sequential (O1-O13, R1-R4, Re1-Re6, A1-A5, Co1-Co4, Cm1-Cm6 = 13+25 = 38 metrics). No gaps.
   - No broken references or missing tables.

## Verdict: Ready
