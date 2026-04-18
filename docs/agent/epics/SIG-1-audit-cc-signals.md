# SIG-1: Audit — Claude Code connector signal quality

Status: completed
Date: 2026-04-18
Author: Director (sub-agent)
Parent epic: [SIG](./SIG-signal-quality.md)

## Summary

The Claude Code connector currently extracts only the happy-path event shape from the JSONL: it never consumes the two strongest failure signals the transcript offers (`tool_result.is_error` on user messages and `type=system, subtype=api_error` system events). As a result `rel_error_rate`, `rel_hidden_retries`, `retry_count_total`, and `errors_per_session` are uniformly zero across all 776 sessions in the local DB, while `tool_success_rate` is reported as 1.0 for 444 sessions that actually contain failed tool calls (2,846 tool failures in total). Overall grade: **Weak**. The single most impactful next move is to wire the two signals listed above into `tool_call_end.status` and a new `error` / `retry_start` event stream — the data is already there and unambiguous.

## Scope

Looked at:
- `src/connectors/claude-code.ts` (conversion logic)
- `src/compute/tracker.ts` + `src/compute/metrics.ts` (derivation)
- `src/types.ts` (event payload contracts) — indirectly via compute code
- Real ingest: 2,618 JSONL files under `~/.claude/projects`, yielding 776 sessions and 204,905 events in `/home/xiaoyuanzhu/.jinsong/data.db`

Out of scope:
- Other connectors (Cursor, ChatGPT, etc.)
- Metrics that don't appear in the SIG epic context table (e.g. output speed, time-to-first-token)
- Proposing UI tooltip copy (SIG-2 territory)

## Findings

### 1. Tool call failures (tool_call_end.status)

**Grade:** Weak

**Current state** — `src/connectors/claude-code.ts:170-208`:
- A `tool_result` block inside a user message is matched back to its `tool_use_id`.
- `status` is hardcoded to `'success'` unless `msg.toolUseResult.interrupted === true`, in which case `'timeout'` is used.
- Two inline heuristics are explicitly noted as no-ops in comments:
  - `toolUseResult.stderr` is checked but deliberately ignored ("stderr doesn't necessarily mean failure" — correct, but nothing else replaces it).
  - `resultContent.includes('Error:')` is checked and also ignored.
- The canonical failure marker — `is_error: true` on the `tool_result` content block itself — is **never read**.
- There is a secondary fallback at `claude-code.ts:357-364` that closes any still-pending `pendingTools` at session end with `status: 'timeout'` — this is how the only non-success values in the DB arise.

**Evidence:**
- `events` table: 29,931 `tool_call_end` events; status distribution is `success: 29226, timeout: 705`. No `failure` statuses ever emitted.
- `toolUseResult.interrupted === true` is observed **0 times** across the 2,618 JSONL files — the one code path the connector uses to mark tool failure never actually fires on real data.
- `tool_result` blocks with `is_error: true` appear **2,846 times** across 454 distinct sessions (444 of which are in the DB). Every one of these is currently labelled `status: 'success'`.
- Concrete session examples (all currently show `tool_success_rate = 1.0` in `metrics`):
  - `090fc382-f23b-4c43-8f43-5b87689e4ca3` — 99 `is_error=true` tool results, 47 tool calls, reported 100% success
  - `a653d929-8f3d-42e9-a449-b0f097bf422a` — 73 `is_error=true` tool results
  - `791b70d1-bad7-4eff-a993-851ef165d666` — 40 `is_error=true` tool results
- The subagent/Task tool additionally carries `toolUseResult.status` (values `completed` / `async_launched`, 480 samples seen) which could disambiguate dispatch failures — also unused today.

**Gaps:**
- Primary signal `is_error: true` ignored.
- `interrupted` check is dead code; never sets to `true` in the real format.
- No distinction made between "errored" and "timeout-at-session-end" — both collapse into `timeout`.
- Heuristic comments left as TODOs but never replaced.

**Recommended:**
1. **[S]** Read `is_error: true` from the `tool_result` content block; set `status: 'failure'` and capture a truncated `content` string as `error_message`. This alone lifts signal coverage on 57.2% of sessions (444 / 776).
2. **[S]** Treat `toolUseResult.stderr` non-empty **plus** exit code signal (if available in `toolUseResult`) as a secondary signal for Bash specifically — but gate behind `is_error` so we don't get false positives from informational stderr.
3. **[M]** Distinguish the "still pending at session_end" path from real timeouts by introducing a new status `'aborted'` (tool started, no result emitted) — today it masquerades as `timeout` and inflates `tool_success_rate < 1.0` for 166 sessions in a misleading way.

---

### 2. Retries (rel_retry_rate / rel_hidden_retries / retry_count_total)

**Grade:** Missing

**Current state:**
- `claude-code.ts` emits no `retry_start` or `retry_end` events.
- `tracker.ts:170-193` and `metrics.ts:114-119` *would* count retries if any connector emitted the events, but none currently do.
- `rel_hidden_retries` is hardcoded to 0 for every CC session.

**Evidence:**
- `events` table: 0 rows with `event_type LIKE 'retry_%'`. Distribution across all 204,905 events confirmed.
- Raw JSONL contains exactly the primitive we need: `type: 'system', subtype: 'api_error'` with fields `retryInMs`, `retryAttempt`, `maxRetries`. Example (`65e0cbf4-45ba-4010-8c7a-53e5b015cfe2`, one of many retry loops):
  ```
  {"type":"system","subtype":"api_error","level":"error",
   "retryInMs":1055.21,"retryAttempt":2,"maxRetries":10,...}
  ```
- 326 `system/api_error` events across 62 sessions already in the DB — all silently dropped.
- Top retry-heavy sessions:
  - `8b82ef1c-d103-47d1-ba20-b024ff67f169` — 39 api_error events (currently `rel_hidden_retries = 0`)
  - `487fc77a-1839-42ae-955f-f48ebf0f5d40` — 38
  - `c9db68b0-6083-43be-be4c-84f13ba47442` — 30

**Gaps:**
- Connector doesn't handle `type: 'system'` messages at all (the top-level loop only branches on `user` and `assistant`).
- `retry_end` boundary detection is non-trivial: the system event tells us the retry is *scheduled*, not that it succeeded. Need to pair subsequent successful `assistant` messages (or the next `api_error` on same parent) to synthesize `retry_end.status`.

**Recommended:**
1. **[S]** Emit `retry_start` per `system/api_error` event with `retry_reason` derived from `error.cause` and `retry_attempt: retryAttempt`. Pair with a synthetic `retry_end.status = 'success'` on the next non-error assistant message sharing the same `parentUuid` chain (or `'budget_exhausted'` if `retryAttempt == maxRetries` and no recovery).
2. **[M]** Decide whether `api_error` should also feed `errors_per_session` (I recommend yes — they *are* errors — and making this additive with tool errors).
3. **[L]** Longer-term: tool-level retries (the model re-invokes a tool after a failure) would require detecting same-name-same-args tool calls within a turn. Defer — harder to get right and lower yield.

---

### 3. Errors (rel_error_rate / errors_per_session)

**Grade:** Missing

**Current state:**
- `claude-code.ts` emits **no** `error` events.
- `tracker.ts:220-232` would process them (setting fatal errors to the `Failed` state); today this branch never fires for CC.
- `metrics.ts:172` maps `rel_error_rate := session.total_errors`, so it's always 0.

**Evidence:**
- `events` table: 0 rows with `event_type = 'error'`.
- Combined JSONL-level error signal (any of: `is_error=true` on tool_result, `system/api_error`): **464 sessions** (444 in the DB), vs current 0.
- Corroborates the epic's problem statement — "No connector emits `error` events → always 0".

**Gaps:**
- No mapping from any raw signal → `error` event.
- No concept of "fatal vs non-fatal". A tool `is_error` is usually non-fatal (model recovers); an `api_error` that exhausts retries is fatal.

**Recommended:**
1. **[S]** Emit non-fatal `error` events for `tool_result.is_error: true` (tag `error_type: 'tool_error'`).
2. **[S]** Emit non-fatal `error` events for `system/api_error` (tag `error_type: 'api_error'`).
3. **[S]** Emit a fatal `error` (`is_fatal: true`) when `retryAttempt === maxRetries` and the next event is session_end with no task_complete — this will promote `rel_start_failure_rate` correctly when it hits during `Starting`.

---

### 4. User corrections (user_corrections)

**Grade:** Weak

**Current state** — `claude-code.ts:46-54`, `244-249`:
- Hardcoded prefix list: `'no,'`, `'no '`, `'nope'`, `'actually'`, `'stop'`, `'wait'`, `'wrong'`, `'that's not'`, `'don't'`, `'do not'`, `'instead'`, `'I meant'`, `'not what I'`.
- Lowercased startswith match on any subsequent user message (after first).
- Fires exactly one `user_correction` event per matching message; no severity, no classification beyond hardcoded `'redirect'`.

**Evidence:**
- `a_user_corrections` distribution across 776 sessions: 742 zero, 25 one, 7 two, 2 three.
- Only 24 total `user_correction` events fired across all ingested sessions (0.03 per session).
- High false-positive surface: `"don't"` triggers on any message starting with "don't forget to …" or "don't worry about …"; `"actually"` on "actually could you also …" (which is a refinement, not a correction); `"stop"` on "stop me if …".
- High false-negative surface: real corrections without these prefixes ("This isn't right — do X instead" won't match because it starts with "This"; "hmm, try again" won't match).

**Gaps:**
- No context: heuristic doesn't check whether the prior assistant turn did something the user could be correcting (e.g. a tool call vs just a question).
- No length filter: "No." alone is counted the same as "No, you misunderstood — rewrite …".
- No semantic fallback (e.g. short-LLM classifier) and no corpus calibration.

**Recommended:**
1. **[S]** Add negative patterns that suppress matches ("don't forget", "don't worry", "no problem", "no rush", "wait for it"). Cheap precision win.
2. **[S]** Require the prior assistant turn to have produced output (tool_use or substantive text) before counting — corrections after a pure question don't match the intent of the metric.
3. **[M]** Surface the raw heuristic-matched text alongside a confidence score in the event payload so the UI can badge "likely" vs "possible" corrections.
4. **[L]** Offline labelling pass to train a light classifier (paper-0 already accepts this as an L3/L4 enhancement).

---

### 5. Gave-up / abandoned tasks (gave_up / comp_where_they_gave_up)

**Grade:** Weak

**Current state** — `claude-code.ts:367-397`, `metrics.ts:200-202`:
- `task_complete` is emitted only when the *last* assistant message has `stop_reason: 'end_turn'` **and** has at least one text block with `> 10 chars`.
- `session_end.end_reason` is then `'completed'` if `task_complete` fired, else `'user_cancelled'`.
- `comp_gave_up_rate := 1.0` iff `end_reason === 'user_cancelled' && !task_completed`.
- `user_cancel` events are never emitted, so `cancelState` in `tracker.ts:201` is always `null`, hence `comp_where_they_gave_up` is **always NULL**.

**Evidence:**
- Distribution: 420 `completed` / 356 `user_cancelled` (45.9% "gave up"). Implausibly high for a personal dev workflow.
- Spot check: session `542e1ab8-ec2d-4383-9bd9-8b85aad49da3` (end_reason=user_cancelled). Last four messages are `assistant(tool_use) → user(tool_result) → assistant(tool_use) → user(tool_result)` — no final end_turn. This is either a session that's still running, a process that died mid-tool, or a compaction boundary. None of those is "user gave up" in the UX sense the metric claims.
- `comp_where_they_gave_up` distribution: `[(None, 776)]` — the metric is entirely unpopulated.

**Gaps:**
- Binary end_turn-or-else mis-classifies truncated / in-progress / compacted sessions as abandoned.
- No `user_cancel` event, so the *where* dimension (paper-0 pillar: "where in the work did they give up") is missing entirely.
- No use of transcript signals that *do* indicate real cancellation: user message text containing `"Request interrupted by user"` or the literal `"The user doesn't want to proceed with this tool use"` fragment that Anthropic's tool runtime injects on rejection (23 occurrences observed in the corpus).

**Recommended:**
1. **[S]** Detect the two canonical abort markers (`[Request interrupted by user for tool use]` in user text, `The user doesn't want to proceed with this tool use.` in tool_result content) and emit a real `user_cancel` event with `current_state` set to the tracker's state at that time. This populates `comp_where_they_gave_up` directly.
2. **[S]** Add a "truncated" classification: if no `task_complete` AND no cancel marker AND the last message is a `tool_result` (i.e. the assistant was supposed to respond next), set `end_reason: 'truncated'` (new enum value) rather than conflating with user-cancelled. Prevents gave_up false positives.
3. **[M]** Detect compaction (`system/compact_boundary` — 26 occurrences in corpus) as a separate session boundary; the current file may contain a continuation, and the signal here is neither "completed" nor "cancelled".

---

### 6. rel_start_failure_rate

**Grade:** Missing (by construction)

**Current state** — `tracker.ts:220-232`, `metrics.ts:164`:
- `rel_start_failure_rate := 1.0` iff a fatal `error` event arrived while the tracker was in `Starting`.
- Since CC emits zero `error` events (see finding 3), this metric is **always 0** across all 776 sessions.

**Evidence:**
- `metrics` table: `rel_start_failure_rate` distribution is `[(0.0, 776)]`.
- Real "failed to start" signal exists in the JSONL: `api_error` with `retryAttempt === maxRetries` before any successful assistant message, or `system/api_error` occurring before the first `assistant` message at all. Neither is currently detected.

**Gaps:**
- Directly tied to finding 3 — fix that and this becomes computable without any metric-layer change.

**Recommended:**
1. **[S]** Once `error` events are emitted (finding 3), mark `is_fatal: true` on any `api_error` that occurs before the first `assistant` message of the session. The tracker's existing `Starting` transition in `tracker.ts:224-229` will do the rest.
2. **[S]** Also consider emitting `is_fatal: true` when *all* first-N assistant attempts are api_errors with no text output — captures "SDK booted but couldn't even return a first token".

---

## Cross-cutting observations

1. **The connector's top-level message loop only branches on `msg.type in { 'user', 'assistant' }`** (claude-code.ts:160, 275). It silently ignores `system`, `progress`, `queue-operation`, and `last-prompt`. That's 2,780 `progress` events and 326 `api_error` system events just in the sample I scanned — a large amount of ground truth being discarded. Adding a `system` branch is a prerequisite for findings 2, 3, and 6.

2. **Heuristics are all one-pass, prefix-only, and context-free.** `looksLikeCorrection`, the `?`-ending question detector (claude-code.ts:345), and the "last assistant with end_turn and >10 chars text" task-complete detector (367-383) all make decisions off a single message in isolation. Wrapping them in "consider the surrounding context" (prior turn had tool use? subsequent user response? length?) would lift all three metrics simultaneously.

3. **The tracker is already well-prepared for stronger signals.** `retry_start`, `retry_end`, `error`, and `user_cancel` event handling is fully implemented in `tracker.ts` and tested implicitly by other connectors' (json, openai) fixtures. The bottleneck is purely the CC connector's extraction. This makes the fix scope small and the upside immediate: no metric-layer changes required for findings 1-3, 5, 6.

4. **The `isMeta` and `sourceToolUseID` skip paths exclude signal on purpose** (`claude-code.ts:162, 213`). That's correct for subagent delegation, but the *Task* tool's toolUseResult (`status`, `totalDurationMs`, `totalTokens`) is useful summary information we're discarding. Worth surfacing on the parent session.

---

## Recommended roadmap (next phase)

Ordered by impact (signal coverage uplift) / effort. All "S" items are <½ day of connector code.

1. **SIG-3 [S] Emit `error` + `tool_call_end.status='failure'` from `tool_result.is_error`.** Unlocks errors_per_session, rel_error_rate, tool_success_rate on 444/776 sessions (57.2% of corpus). Core fix.
2. **SIG-4 [S] Emit `retry_start` / `retry_end` from `type:'system', subtype:'api_error'`.** Unlocks retry_count_total, rel_hidden_retries on 60/776 sessions, and is a prerequisite for SIG-5.
3. **SIG-5 [S] Wire `rel_start_failure_rate` via pre-first-assistant api_errors.** Tiny follow-on to SIG-4.
4. **SIG-6 [S] Detect canonical user-cancel strings; emit real `user_cancel` events.** Populates comp_where_they_gave_up for the first time; cuts gave_up false positives.
5. **SIG-7 [S] Introduce `end_reason: 'truncated'`.** Stops labelling dead/in-progress sessions as abandoned.
6. **SIG-2 (existing) [S-M] Refine `user_correction` heuristic** — add negation exclusions, require prior tool use or substantive text.
7. **SIG-8 [M] Detect `system/compact_boundary` and either link continuation sessions or mark boundary explicitly.** Medium because session-chaining has cross-file implications.
8. **SIG-9 [L] Offline classifier for user_corrections and questions_asked.** Deferred; nice-to-have after the cheap wins.

---

## Appendix — useful queries

All run against `/home/xiaoyuanzhu/.jinsong/data.db` (SQLite). The repo uses `better-sqlite3`; I used Python's built-in `sqlite3` because `sqlite3` CLI isn't installed on this Linux box.

```python
# Status distribution of tool_call_end events
import sqlite3, json
c = sqlite3.connect('/home/xiaoyuanzhu/.jinsong/data.db')
dist = {}
for row in c.execute("SELECT payload FROM events WHERE event_type='tool_call_end'"):
    s = json.loads(row[0]).get('status')
    dist[s] = dist.get(s, 0) + 1
print(dist)
# → {'success': 29226, 'timeout': 705}
```

```python
# Confirm zero retry/error events
c.execute("SELECT COUNT(*) FROM events WHERE event_type LIKE 'retry_%'").fetchone()  # (0,)
c.execute("SELECT COUNT(*) FROM events WHERE event_type='error'").fetchone()          # (0,)
```

```python
# Metric-level audits
c.execute("SELECT rel_error_rate, COUNT(*) FROM metrics GROUP BY rel_error_rate").fetchall()
# → [(0, 776)]
c.execute("SELECT rel_hidden_retries, COUNT(*) FROM metrics GROUP BY rel_hidden_retries").fetchall()
# → [(0, 776)]
c.execute("SELECT comp_where_they_gave_up, COUNT(*) FROM metrics GROUP BY comp_where_they_gave_up").fetchall()
# → [(None, 776)]
c.execute("SELECT end_reason, COUNT(*) FROM sessions GROUP BY end_reason").fetchall()
# → [('completed', 420), ('user_cancelled', 356)]
c.execute("""SELECT a_user_corrections, COUNT(*) FROM metrics
             GROUP BY a_user_corrections ORDER BY a_user_corrections""").fetchall()
# → [(0, 742), (1, 25), (2, 7), (3, 2)]
```

```python
# Raw-JSONL ground truth: how many sessions have dropped signal
import glob, os, json, collections
files = glob.glob(os.path.expanduser('~/.claude/projects/*/*.jsonl'))
err_sessions, retry_sessions = set(), set()
for fp in files:
    try:
        for line in open(fp):
            try: o = json.loads(line)
            except: continue
            sid = o.get('sessionId')
            if not sid: continue
            if o.get('type') == 'system' and o.get('subtype') == 'api_error':
                retry_sessions.add(sid)
            if o.get('type') == 'user':
                content = o.get('message', {}).get('content')
                if isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get('type') == 'tool_result' and b.get('is_error') is True:
                            err_sessions.add(sid); break
    except: pass
# → err_sessions: 464 distinct sessions; retry_sessions: 62 distinct sessions
```

```python
# toolUseResult shapes — confirms 'interrupted' is never true
shapes = collections.Counter()
for fp in files[:400]:
    for line in open(fp):
        try: o = json.loads(line)
        except: continue
        tur = o.get('toolUseResult')
        if isinstance(tur, dict):
            shapes[frozenset(tur.keys())] += 1
# Top shape has {interrupted, stderr, stdout, isImage, noOutputExpected} — Bash result.
# interrupted=true count across ALL files: 0.
```
