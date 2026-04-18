# RM-3 Codex + Signal Quality + Quality/Infra

## Meta
- Created: 2026-04-18
- Status: planned
- Owner: Director
- Parent: (none — top-level roadmap)
- Predecessors: RM-1 (shipped), RM-2 (shipped through DASH-11, SIG-1, SIG-2)

## Plan
> BOSS-approved direction: three parallel streams. **CDX** is the lead — stand up a second agent connector (Codex) so the dashboard is no longer claude-code-only. **SIG** turns the SIG-1 audit into real signal fixes so the metrics reflect reality (error / retry / cancel events are currently hardcoded to zero for 57% of sessions). **QUAL** closes the loose ends deferred out of RM-2 (E2E tests, bundle size, security / dep hygiene, light-mode parity).
>
> CDX real-sample fixtures will be supplied by BOSS before CDX-1 starts; until they arrive, CDX-0 (scaffold) is the only unblocked Codex task.
>
> Paper-0 is done; no research stream this roadmap.

### Status legend
`[🟢 High | 🟡 Medium | 🔴 Low]` confidence · `[XS | S | M | L]` size.

### CDX — Codex connector (lead)
- [ ] CDX-0: Scaffold `src/connectors/codex/` mirroring the claude-code connector layout (entrypoint, types, converter, index barrel) [🟢 | S]
  - Intent: stand up the connector skeleton so subsequent tasks have a place to land without merge-churn.
  - Acceptance: `src/connectors/codex/index.ts` exports a `convertCodexSession` stub with the same signature shape as `convertClaudeCodeSession`; wired into the connector registry; `npm run build` passes; no behavior change for existing ingest.
- [ ] CDX-1: Parse Codex transcript format from real fixtures [🟡 | M]
  - Intent: turn BOSS-supplied Codex sample sessions into a typed intermediate representation (Codex's message / event shape).
  - Acceptance: `codex/parser.ts` consumes at least 2 real fixtures end-to-end; round-trips to a typed AST; unknown fields logged but non-fatal; fixture files committed under `src/connectors/codex/__fixtures__/`.
- [ ] CDX-2: Map Codex events → canonical event schema [🟡 | M]
  - Intent: same canonical event shape the claude-code connector emits, so downstream compute is connector-agnostic.
  - Acceptance: `codex/convert.ts` produces `session_start`, `user_message`, `assistant_message`, `tool_call_start/end`, `session_end`, and whichever of `error` / `retry_start` / `user_cancel` the Codex format exposes; canonical types unchanged; session records include `agent: 'codex'`.
- [ ] CDX-3: Connector-level tests using real Codex fixtures [🟢 | S]
  - Intent: lock parser + converter against real transcripts.
  - Acceptance: new test file under `src/connectors/codex/__tests__/` exercises each fixture, asserts event counts + key status fields; `npm test` green; coverage of the converter main branches.
- [ ] CDX-4: Wire into ingest pipeline + verify metrics populate [🟢 | S]
  - Intent: route Codex files through the scanner / ingester so they land in SQLite alongside CC sessions.
  - Acceptance: ingest of a Codex fixture creates rows in `sessions`, `events`, `metrics`; spot-check at least 10 pillar metrics are non-null; no regressions for existing CC ingest.
- [ ] CDX-5: Dashboard — verify all 35 metrics render for a Codex session [🟡 | S]
  - Intent: confirm the session detail page is connector-agnostic (no hidden CC assumptions in the UI layer).
  - Acceptance: visit `/sessions/<codex-session-id>`; all 5 pillar groups render; no "N/A" cascades caused by connector-specific field names; any missing values tracked back to connector gaps, not UI bugs.
- [ ] CDX-6: Agent/model breakdown surfaces `codex` alongside `claude_code` [🟢 | XS]
  - Intent: the DASH-9 chart should show both agents when data is present.
  - Acceptance: agent breakdown chart lists `codex` bucket; model breakdown includes Codex's models; legends / tooltips read correctly; zero data states still look clean.

### SIG — Signal quality follow-ups (from SIG-1 audit)
- [ ] SIG-3: Emit `error` + `tool_call_end.status='failure'` from `tool_result.is_error` [🟢 | S]
  - Intent: the single highest-yield fix from SIG-1 — 57% of sessions have real tool failures currently labelled `success`.
  - Acceptance: CC connector sets `status: 'failure'` on tool_call_end when the matching `tool_result.is_error === true`, captures a truncated `error_message`; also emits a non-fatal `error` event with `error_type: 'tool_error'`; backfill/rescan a fixture set and see `tool_success_rate < 1.0` and non-zero `errors_per_session` where expected; unit tests cover the new branch.
- [ ] SIG-4: Emit retry events from `system/api_error` + `retryAttempt`/`maxRetries` [🟢 | S]
  - Intent: CC currently ignores 326 `api_error` system events across 62 sessions; wire them into `retry_start`/`retry_end`.
  - Acceptance: connector branches on `type: 'system', subtype: 'api_error'`; emits `retry_start` with `retry_attempt` + `retry_reason`; pairs a `retry_end` (`status: 'success'` when the next assistant message lands, `'budget_exhausted'` when `retryAttempt === maxRetries` with no recovery); metrics `retry_count_total` / `rel_hidden_retries` become non-zero on those sessions; tests from a retry-heavy fixture.
- [ ] SIG-6: Detect canonical user-cancel strings → emit real `user_cancel` events [🟢 | S]
  - Intent: populate `comp_where_they_gave_up` (currently NULL for every session) and cut gave-up false positives.
  - Acceptance: connector matches the two canonical abort markers documented in SIG-1 (`[Request interrupted by user for tool use]` in user text; `The user doesn't want to proceed with this tool use.` in tool_result) and emits `user_cancel` with `current_state`; corpus spot-check shows `comp_where_they_gave_up` populated for ≥20 sessions.
- [ ] SIG-5: Wire `rel_start_failure_rate` via pre-first-assistant api_errors [🟢 | XS] — *Later tier*
  - Intent: trivial follow-on to SIG-4 once `error` events exist.
  - Acceptance: `api_error` that occurs before the first assistant message is tagged `is_fatal: true`; `rel_start_failure_rate` becomes non-zero on applicable fixtures.
- [ ] SIG-7: Introduce `end_reason: 'truncated'` [🟡 | S] — *Later tier*
  - Intent: stop classifying in-progress / dead sessions as user-cancelled.
  - Acceptance: new enum value added to session_end schema; connector chooses it when no `task_complete` AND no cancel marker AND last message is a `tool_result`; downstream metrics (`comp_gave_up_rate`) updated; UI legend handles the new value.
- [ ] SIG-8: Detect `system/compact_boundary` [🟡 | M] — *Later tier*
  - Intent: compaction currently looks like an end-of-session; needs to be surfaced as its own boundary.
  - Acceptance: connector emits a compaction marker event (or splits sessions deterministically); downstream metrics don't conflate compacted continuations with abandoned sessions; documented behavior in the connector README section.

### QUAL — Quality / infrastructure
- [ ] QUAL-1: E2E smoke test suite [🟡 | M]
  - Intent: one command that spins up the server against a fixture DB, exercises every `/api/*` endpoint and every SPA route, and asserts non-error responses — RM-2 shipped without this.
  - Acceptance: `npm run test:e2e` (or similar) boots the built binary, runs through all current endpoints + SPA routes, returns 0 on success; runs in CI; documented in `docs/agent/epics/`.
- [ ] QUAL-2: Tech audit pass — security, bundle, dep hygiene [🟡 | M]
  - Intent: `npm audit`, bundle analysis, outdated-dep review — RM-2 left a 770 kB raw bundle warning and never reviewed the dep tree.
  - Acceptance: audit report doc under `docs/agent/epics/QUAL-2-audit.md`; high/critical vulnerabilities resolved or explicitly waived with justification; top-5 bundle contributors enumerated; dep-update PR list prepared for follow-up tasks.
- [ ] QUAL-3: Bundle code-splitting for session detail route [🟢 | S]
  - Intent: the session detail page owns the heavy Recharts usage; lazy-load it so the dashboard landing stays fast.
  - Acceptance: `React.lazy` boundary around session detail; landing-page bundle drops below 500 kB raw; route still functional; loading state is not jarring.
- [ ] QUAL-4: Light-mode color token parity [🟢 | XS]
  - Intent: spot-check light mode after DASH-12 — ensure semantic tokens (`--good/--fair/--poor`) and chart colors look correct in both modes.
  - Acceptance: every page rendered side-by-side in both modes; any token mismatches fixed; screenshot diff committed to the epic doc.
- [ ] QUAL-5: Replace / clarify `comp_came_back_rate` semantics per SIG-1 note [🟡 | S] — *Optional*
  - Intent: metric name and definition are ambiguous; either redefine precisely or retire.
  - Acceptance: decision captured in `docs/agent/epics/SIG-signal-quality.md`; metric either renamed + documented or removed from the dashboard; tests updated.
- [ ] QUAL-6: User-testing protocol — 1–2 teammates through the dashboard [🟡 | S] — *Optional*
  - Intent: get real confusion data before polishing further.
  - Acceptance: session script + consent note under `docs/agent/epics/`; notes from each run captured; top-3 friction findings surfaced as tasks on RM-4.

## Risks & open questions
- **CDX fixture availability.** CDX-1..5 are blocked until BOSS supplies real Codex transcripts. CDX-0 is the only unblocked Codex task. If fixtures slip, rotate CDX capacity to SIG.
- **Canonical schema stability.** CDX-2 assumes the current canonical event schema survives contact with a second agent. If Codex carries concepts that don't map cleanly (e.g. subagent dispatch, multi-turn tool orchestration), we may need a schema-level extension; flag as an SCH-* task instead of forcing a round peg.
- **Signal regressions.** SIG-3/4/6 change historical metric values on re-ingest (by design). We should communicate "the numbers moving is the feature" before anyone panics about dashboard deltas.
- **Bundle vs DX.** Code-splitting (QUAL-3) trades a small perceived-latency cost on navigation for a faster first paint. Need to confirm the tradeoff feels right after DASH-12.
- **Out of scope this roadmap.** Paper-1 (empirical validation), a second dashboard (team view), extra agents beyond Codex, and the L-tier SIG items (SIG-9 classifier, tool-level retries).

## Starting line
**First task to dispatch: SIG-3 — emit `error` + `tool_call_end.status='failure'` from `tool_result.is_error`.**

Why SIG-3 and not CDX-0:
1. CDX-1..6 are gated on BOSS-supplied Codex fixtures; CDX-0 alone can proceed but has small ROI until the fixtures arrive.
2. SIG-3 is the highest-yield, lowest-risk task on the whole roadmap: SIG-1 quantified the win (57% of sessions currently misreport `tool_success_rate = 1.0`; 2,846 real tool failures are silently labelled success). The fix is tens of lines in one file with clear acceptance.
3. Shipping SIG-3 first also tightens the feedback loop when CDX-2 arrives: the canonical event schema will be exercised on both connectors instead of being proven only against CC happy paths.

Parallel dispatch is fine: CDX-0 can run alongside SIG-3 without contention — they touch disjoint files.

## Execution Results
(populated as tasks complete)

## Decisions Needed
(populated if any task is skipped with 🔴 Low confidence)

## Handoff
(written if session ends before roadmap completes)
