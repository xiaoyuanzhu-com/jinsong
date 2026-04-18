# SIG-2: Document the `questions_asked` heuristic

Status: completed (document-only)
Date: 2026-04-18
Author: Director (sub-agent)
Parent epic: [SIG](./SIG-signal-quality.md)

## Summary

The `questions_asked` metric (and the derived `a_questions_asked` + `a_first_try_success_rate`) is driven by a very small heuristic in the Claude Code connector: emit a `user_input_requested` event whenever an assistant turn ends (`stop_reason === 'end_turn'`) with no `tool_use` blocks and the joined text, trimmed, ends with a `?`. Measured against 60 hand-inspected sessions from the local DB (30 with `a_questions_asked ≥ 1`, 30 with `a_questions_asked = 0`), the rule scores **P = 1.00 (30/30)** and **R = 0.97 (30/31)**. Both are comfortably ≥ 0.8, so per the SIG-2 decision rule this ticket is **document-only**. The rule is clearly a simplification — it will drift when assistants switch style or language, and the count can over-inflate on long interactive sessions with many confirmation prompts — but at today's usage it reliably separates "blocked on user" from "autonomous" turns. Recommended follow-ups are cosmetic (exclude final punctuation other than `?`, tolerate trailing fences) and a deferred offline classifier if/when this metric drives a user-facing claim.

## Current rule

**Location:** `src/connectors/claude-code.ts` lines 334-352

```ts
// Check for end_turn with no tool_use — might be asking a question or completing
if (amsg.stop_reason === 'end_turn') {
  const hasToolUse = contentBlocks.some(b => b.type === 'tool_use');
  if (!hasToolUse) {
    const textContent = contentBlocks
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('\n');

    // Heuristic: if the text ends with a question mark, it's asking a question
    const trimmed = textContent.trim();
    if (trimmed.endsWith('?')) {
      events.push(makeEvent('user_input_requested', ts, {
        input_type: 'clarification',
        question_hash: sha256(trimmed.slice(-100)),
      }));
    }
  }
}
```

Downstream:

- `src/compute/tracker.ts:195-196` — every `user_input_requested` event increments `questionsAsked` and, if the session is Working, transitions it to Waiting.
- `src/compute/metrics.ts:176` — exposed as `a_questions_asked`.
- `src/compute/metrics.ts:178-179` — combined with `user_corrections` and `task_completed` into `a_first_try_success_rate`.

Scope of the heuristic:

- Runs **per assistant turn**, not per session — a single session can emit many `user_input_requested` events.
- Requires `stop_reason === 'end_turn'` — streams that terminate on `tool_use` never fire (which is correct: the agent is still working).
- Requires **no `tool_use` blocks in the same message** — a message with mixed text + tool_use never fires, even if the text portion ends with `?`.
- Concatenates all `text` blocks with `\n` before trimming, so only the *very last* character after trim matters.
- Payload carries a `sha256` hash of the trailing 100 chars (for dedupe), not the text itself — important for privacy but means ground-truth can't be recovered from the DB alone (see "Methodology" below).

## Methodology

Ground-truth comes from the raw Claude Code JSONL transcripts in `~/.claude/projects`, which still contain the full message text. For each sampled `session_id` I look up the JSONL by filename (`<session_id>.jsonl`, found by recursive glob; 60/60 matched) and re-run the same selection the ingest does — every assistant message with `stop_reason === 'end_turn'` and no `tool_use` blocks — then judge manually.

- **Positive sample (with_q, n = 30):** random draw (seed = 42) from the 223 sessions where `a_questions_asked ≥ 1`.
- **Negative sample (zero_q, n = 30):** random draw (seed = 42) from the 553 sessions where `a_questions_asked = 0`.
- **True positive** = the assistant is actually asking the user something (including confirmation questions like "Ready to commit, push, and clean up?"). Rhetorical questions would count as false positives, but none appeared in the sample.
- **False negative** = the session's end_turn assistant text contains a sentence ending in `?` but that sentence is not the very last character of the message — so the heuristic doesn't fire.

### Precision (with_q sample)

All 30 sessions contain at least one genuine, user-addressed question in a firing message. Common shapes:

- **Confirmation requests** (by far the most common) — "Ready to commit, push, and clean up?", "Want me to push and clean up?"
- **Clarifying questions** — "What's the SSH connection details?", "Are you thinking about actually building this?"
- **Offer / choose-between** — "Want me to read it and visualize your token usage trends?", "Want to refine the criteria, or start rating some apps?"

Precision = **30 / 30 = 1.00**.

No rhetorical or self-directed questions fired in the sample, though the rule does not defend against them in principle.

### Recall (zero_q sample)

I scanned every end_turn text in each of the 30 zero_q sessions for any sentence ending in `?` (regex split on `[.!?]` plus newlines). Only one session had a miss:

- **`70d0e0da…`** — the assistant said: *"Ready to commit, push, and clean up? The changes are in the main directory directly (not a worktree), so just a commit + push when you say 'go.'"* — the `?` is mid-paragraph, the very last character is `.`, so the heuristic correctly stays silent under the "last char only" rule but we'd want it flagged.

That gives 1 false negative against 30 true positives in the positive sample + 1 additional positive in the negative sample = 31 real "has a question" sessions, of which 30 are flagged.

Recall = **30 / 31 ≈ 0.97**.

## Decision

Both metrics are ≥ 0.8, so per the SIG-2 rule this ticket is **document-only** — no code change in this commit.

Why this is comfortable even though the rule is simple:

- Claude Code's assistant style almost always ends a blocking turn with a trailing `?`, because the agent loop itself prompts the user for confirmation before exiting.
- End-of-turn with no tool_use is already a strong filter: it excludes every turn that the agent intends to continue autonomously.
- The one missed case (trailing sentence continues past the `?`) is a stylistic edge — not a reasoning error in the rule.

Why *not* "strengthen anyway":

- The sample set is small. Chasing a single miss (0.03 of recall) risks over-fitting: any regex change tuned on this corpus could regress elsewhere without a larger labeled set.
- The real failure modes for this metric — rhetorical questions, questions asked to *tools* rather than users, multilingual sessions, the output-inflation issue below — are not what the heuristic currently gets wrong. They're what it *can't* get right without a classifier.

## Known limits (kept for a future ticket)

1. **"Last character" fragility.** Assistant messages that end with a question followed by a short clarification (`"Ready to commit? Changes are in the main dir."`) are missed. Easy mitigation: check if *any of the last 1–2 sentences* end in `?`. Risk: adds false positives on mid-answer rhetorical questions. Deferred because the observed miss rate is 3%.

2. **No rhetorical-question defense.** A message like "But why does that matter?" followed by the assistant's own answer would fire today. None appeared in the sample, but the rule is structurally vulnerable.

3. **Count inflation on long interactive sessions.** Sessions 3 (`a9bf7ef6`) and 8 (`e6962c09`) emitted 17 and 20 `user_input_requested` events respectively. Each is a legitimate question, so precision is unaffected, but the raw *count* (`a_questions_asked`) mixes "this session had any blocking question" with "this session had 20 blocking questions" — which is fine for the derived `a_first_try_success_rate` (which only checks `=0`) but could mislead anyone reading `a_questions_asked` as an intensity metric. Worth a ticket to clarify the metric's semantics, not a heuristic change.

4. **Language / locale.** A Chinese turn ending in `？` (full-width) would not fire. None appeared in the sample, but as soon as we ingest non-English sessions this becomes a recall regression. Cheap fix: allow `/[?？]$/`.

5. **Ground-truth recoverability.** Because the payload only stores `sha256` of the trailing 100 chars, future audits always need the raw JSONL alongside the DB. Not a bug, but a constraint on anyone trying to reproduce this report six months from now.

## Follow-ups

Two practical next tickets — both deferred until they unblock something user-facing:

- **SIG-3 (S) `a_questions_asked` semantics + locale tolerance.** Decide whether the exposed metric should be "count of blocking questions" or "session had any blocking question (0/1)", document it in `metrics.md`, and add `？` (full-width) plus "last 1–2 sentences end in `?`" to the heuristic. Add a tiny unit test with the 3-4 transcripts sampled here as golden inputs. Expected delta: recall ~0.97 → ~1.00, precision unchanged; metric semantics no longer a footnote.

- **SIG-9 (L) Offline LLM-as-judge classifier.** Already on the parent-epic backlog — only worth spending on if and when `questions_asked` starts driving a claim outside the dashboard (e.g. vendor comparisons in a research report). Rough shape: run a cheap LLM pass over each end_turn assistant message, label `{real_question, rhetorical, confirmation, none}`, keep a labeled corpus of ~300 turns as the regression set.

Out of scope / explicitly not doing:

- Changing the event name or payload shape. `user_input_requested` is already referenced by downstream code and by the SIG-1 audit; churn there should live with a larger refactor.
- Re-ingesting the whole DB. With the heuristic unchanged, there's nothing to re-compute.
