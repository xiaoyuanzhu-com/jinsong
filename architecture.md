# Implementation Architecture

System architecture for Jinsong — the agent experience quality platform. One binary, three deployment modes, same compute everywhere.

Companion documents:
- `metrics.md` — what we measure (35 metrics across operational + 5 experience pillars)
- `data-model.md` — what we store (events, sessions, metrics, tool calls)
- `tracking.md` — how we collect (instrumentation points, state machine tracker, stall detection)

---

## 1. Overview

### One Binary, Three Modes

Jinsong ships as a single npm package. The same process adapts to three deployment contexts:

| Mode | Command | Storage | UI | Network |
|------|---------|---------|----|---------|
| **Local CLI** | `npx jinsong` | SQLite (auto) | Static HTML report | None required |
| **Server** | `npx jinsong serve` | SQLite or Postgres | Live web dashboard | HTTP API (ingest + query) |
| **Cloud** | Same server, managed | PostgreSQL / ClickHouse | Multi-tenant dashboard | HTTP API + auth + benchmarks |

Every mode runs the same four-stage engine. The only cloud-specific feature is cross-user benchmarking with anonymized aggregate data.

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        JINSONG PROCESS                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      INGESTION                               │   │
│  │                                                               │   │
│  │   File Import ─┐                                              │   │
│  │   Dir Watcher ──┼──> Event Parser ──> Event Validator ──┐     │   │
│  │   HTTP API ────┘                                         │     │   │
│  │   Local Socket ─────────────────────────────────────────┘     │   │
│  └──────────────────────────────┬────────────────────────────────┘   │
│                                  │ validated events                   │
│                                  v                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      STORAGE                                  │   │
│  │                                                               │   │
│  │   StorageAdapter interface                                    │   │
│  │   ┌────────────┐  ┌────────────┐  ┌──────────────┐          │   │
│  │   │   SQLite    │  │ PostgreSQL │  │  ClickHouse  │          │   │
│  │   │  (default)  │  │  (server)  │  │   (cloud)    │          │   │
│  │   └────────────┘  └────────────┘  └──────────────┘          │   │
│  └──────────────────────────────┬────────────────────────────────┘   │
│                                  │ persisted data                     │
│                                  v                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      COMPUTE                                  │   │
│  │                                                               │   │
│  │   State Machine ──> Session Aggregator ──> Metrics Engine     │   │
│  │   Tracker              (operational)        (5 pillars)       │   │
│  └──────────────────────────────┬────────────────────────────────┘   │
│                                  │ computed metrics                   │
│                                  v                                    │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      PRESENT                                  │   │
│  │                                                               │   │
│  │   HTML Report Generator ──> Static .html file                 │   │
│  │   Web Dashboard Server ──> Live UI (Preact)                   │   │
│  │   JSON API ──> Programmatic access                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Engine

The engine is composed of four stages. Each stage is defined as an interface — what it accepts, what it produces, and what guarantees it provides. All four stages run identically regardless of deployment mode.

### 2.1 Ingestion

**Responsibility.** Accept raw telemetry events from any source, parse them into the 15 event types defined in `data-model.md`, validate schema conformance, and forward valid events to storage and compute.

**Input sources:**

| Source | Format | Used By |
|--------|--------|---------|
| File import | JSON array of events, OTLP JSON/protobuf | CLI `import` command |
| Directory watcher | New files in a watched directory | CLI `watch` command |
| HTTP POST | JSON body, batch of events | Server mode, SDK push |
| Local socket | NDJSON stream (newline-delimited JSON) | In-process SDK, piped agent output |

**Interface contract:**

```
Ingestor {
  // Parse raw input into typed events
  parse(raw: Buffer, format: "json" | "otlp" | "ndjson") → Event[]

  // Validate events against data-model.md schemas
  validate(events: Event[]) → { valid: Event[], errors: ValidationError[] }

  // Route valid events to storage + compute
  ingest(events: Event[]) → { accepted: number, rejected: number }
}
```

**Guarantees:**
- Events are validated before storage. Invalid events are rejected with a descriptive error; they never reach storage or compute.
- Events are written to storage before being acknowledged to the caller (HTTP 200 or import success). No silent data loss.
- Duplicate `event_id` values are silently deduplicated (idempotent ingestion).
- OTLP format mapping: OTLP spans and events are converted to Jinsong's 15 event types using a deterministic mapping layer. Unmappable spans are dropped with a warning.

### 2.2 Storage

**Responsibility.** Persist events, sessions, metrics, and tool calls. Provide query access for compute and present stages. Abstract over the storage backend.

Described fully in Section 3 (Storage Layer).

### 2.3 Compute

**Responsibility.** Transform raw events into session records and computed metrics. Runs the state machine tracker from `tracking.md`, aggregates operational metrics, and derives the five experience pillars from `metrics.md`.

**Interface contract:**

```
ComputeEngine {
  // Process a batch of events through the state machine tracker.
  // Updates session state in real time. Called on every ingest.
  processEvents(events: Event[]) → void

  // Finalize a session: compute all session-level fields and metrics.
  // Called when session_end is received.
  finalizeSession(sessionId: UUID) → { session: Session, metrics: Metrics }

  // Recompute metrics for a session from stored events.
  // Used by batch recompute (e.g., after metric definition changes).
  recompute(sessionId: UUID) → { session: Session, metrics: Metrics }

  // Recompute all sessions. Used by `jinsong report` for full refresh.
  recomputeAll() → void
}
```

**Internal components:**

1. **State Machine Tracker** — one instance per active session. Maintains current state, state durations, turn count, pending tool calls. Implements the full transition table from `tracking.md` Section 4.2. Produces state duration accumulators.

2. **Session Aggregator** — takes state durations + raw event counts and produces the sessions table record. Computes all fields in `data-model.md` Section 3: operational counters, state durations, outcome fields, dimensions. Also populates the tool_calls table from paired `tool_call_start`/`tool_call_end` events.

3. **Metrics Engine** — takes the session record + events and computes all 35 metrics from `metrics.md`. Writes the metrics table record. Organized by layer:
   - Operational session-level metrics (6): direct from session counters
   - Operational per-event aggregates (9): computed from events within the session
   - Responsiveness (4): from state durations and event timestamps
   - Reliability (6): from state transitions and error counts
   - Autonomy (5): from state transitions, corrections, and duration ratios
   - Correctness (4): from output validation and token counts (L4 fields left null until evaluated)
   - Completion (6): from outcome fields and cross-session analysis

**When does computation happen?**

| Trigger | What runs | Why |
|---------|-----------|-----|
| Event ingested | State Machine Tracker updates | Real-time state tracking |
| `session_end` received | Session Aggregator + Metrics Engine | Finalize session record |
| `jinsong report` | `recomputeAll()` | Ensure all metrics are current |
| Periodic (server mode, every 60s) | Finalize long-running sessions | Sessions that have been active > 5min get intermediate metric snapshots |

**Incremental vs. batch:**
- **Incremental:** on every ingest, the state machine tracker updates in-memory state. On session end, the session and metrics records are computed and written. This is the normal path.
- **Batch:** `jinsong report` and `recomputeAll()` replay stored events through the tracker and recompute everything. Used when metric definitions change or for full-refresh reporting. Batch recompute reads events from storage, so it works even if the in-memory state was lost (process restart).

### 2.4 Present

**Responsibility.** Render computed data for human consumption. Two output modes: static HTML report and live web dashboard.

**Interface contract:**

```
Presenter {
  // Generate a self-contained HTML report file.
  generateReport(options: {
    dateRange?: [Date, Date],
    filters?: SessionFilters,
    outputPath: string
  }) → void

  // Start the web dashboard server (server mode only).
  startDashboard(options: { port: number, host: string }) → void

  // Return report data as JSON (API consumers).
  getReportData(filters?: SessionFilters) → ReportPayload
}
```

Report structure described in Section 7.

---

## 3. Storage Layer

### 3.1 Interface

Every storage backend implements `StorageAdapter`. The engine never touches the database directly — only through this interface.

```
StorageAdapter {
  // --- Lifecycle ---
  connect(uri: string) → void
  disconnect() → void
  migrate() → void          // Auto-apply schema migrations

  // --- Write ---
  writeEvents(events: Event[]) → void
  writeSession(session: Session) → void
  writeMetrics(metrics: Metrics) → void
  writeToolCalls(toolCalls: ToolCall[]) → void

  // --- Read ---
  queryEvents(filters: EventFilters) → Event[]
  querySessions(filters: SessionFilters) → Session[]
  queryMetrics(filters: MetricFilters) → Metrics[]
  queryToolCalls(filters: ToolCallFilters) → ToolCall[]

  // --- Aggregation ---
  aggregateMetrics(filters: SessionFilters, groupBy: Dimension[]) → AggregatedMetrics[]

  // --- Maintenance ---
  pruneEvents(olderThan: Date) → number    // Returns deleted count
  pruneSessions(olderThan: Date) → number
  vacuum() → void
}
```

**Filter types** support: date ranges, dimension equality/in-list, metric threshold comparisons, pagination (offset + limit), and sort ordering. Filters map to SQL WHERE clauses in relational backends.

**Aggregation** supports GROUP BY on any dimension column (agent_name, model_id, interface_type, content_type, etc.) with standard aggregates (avg, p50, p95, min, max, count) on any metric column. This powers the dashboard's slicing and dicing.

### 3.2 Adapters

| Adapter | Use Case | Config | Notes |
|---------|----------|--------|-------|
| **SQLite** | Local CLI, single-user server | `--db sqlite:./jinsong.db` | Default. Zero config. Uses `better-sqlite3` for synchronous operations. Single-file database. |
| **PostgreSQL** | Self-hosted server, cloud | `--db postgres://user:pass@host/jinsong` | For multi-user, concurrent access. Uses connection pooling. |
| **ClickHouse** | Cloud, high-volume analytics | `--db clickhouse://host:8123/jinsong` | Column-oriented. Best for aggregate queries over millions of sessions. Write-optimized append. |

### 3.3 Default Behavior

**Location resolution** (SQLite, in order of precedence):
1. Explicit `--db sqlite:/path/to/file.db` flag
2. Project-local: `.jinsong/data.db` in the current working directory (if `.jinsong/` directory exists)
3. User-global: `~/.jinsong/data.db` (created automatically on first run)

**Auto-creation:** on first run, Jinsong creates the `~/.jinsong/` directory, the `data.db` file, and all tables. No manual setup required.

### 3.4 Schema Migration

**Strategy:** auto-migrate on startup. Every time Jinsong starts, it checks the current schema version and applies any pending migrations.

**Implementation:**
- A `_migrations` table tracks applied migrations: `{ version: int, applied_at: timestamp, description: string }`.
- Migrations are embedded in the binary (not external SQL files). Each migration is a numbered, idempotent function.
- Migrations are forward-only. No down migrations. If a rollback is needed, restore from backup.
- For SQLite: migrations run in a transaction. If any step fails, the entire migration is rolled back.
- For PostgreSQL/ClickHouse: migrations use advisory locks to prevent concurrent migration from multiple server instances.

**Schema mapping across backends:**

| data-model.md Type | SQLite | PostgreSQL | ClickHouse |
|--------------------|--------|------------|------------|
| UUID | TEXT (36 chars) | UUID | UUID |
| timestamp (ms) | TEXT (ISO 8601) | TIMESTAMPTZ | DateTime64(3) |
| enum | TEXT with CHECK constraint | TEXT with CHECK or custom ENUM | LowCardinality(String) |
| JSON (payload) | TEXT (JSON string) | JSONB | String (JSON) |
| int | INTEGER | INTEGER | Int32 / Int64 |
| float | REAL | DOUBLE PRECISION | Float64 |
| bool | INTEGER (0/1) | BOOLEAN | UInt8 |

**Index strategy:**
- Events: `(session_id, timestamp)` clustered, `(event_type, timestamp)` secondary
- Sessions: `(started_at)` for time-range queries, composite indexes on high-use dimension pairs `(agent_name, model_id)`, `(content_type, started_at)`
- Metrics: `(session_id)` primary key (1:1 with sessions)
- Tool calls: `(session_id, started_at)`, `(tool_name, status)`

---

## 4. Deployment Modes

### 4.1 Local CLI Mode (`npx jinsong`)

The simplest mode. A single user runs Jinsong on their machine to analyze agent sessions.

**Architecture:**

```
┌────────────────┐     ┌───────────────────────────────────────────┐
│  Agent Session  │     │              Jinsong CLI                  │
│                 │     │                                           │
│  telemetry.json │────>│  jinsong import ──> Ingestion             │
│  (or directory) │     │                        │                  │
└────────────────┘     │                     Storage (SQLite)       │
                        │                        │                  │
                        │  jinsong report ──> Compute ──> Present   │
                        │                                  │        │
                        │                      jinsong-report.html  │
                        └───────────────────────────────────────────┘
```

**Data collection methods:**

| Method | Command | How It Works |
|--------|---------|-------------|
| **Import** | `npx jinsong import <file>` | Reads a JSON or OTLP file, parses events, validates, writes to SQLite. One-shot. |
| **Watch** | `npx jinsong watch <dir>` | Watches a directory with `fs.watch`. When new `.json` files appear, imports them automatically. Runs until killed. Tracks processed files to avoid re-import. |
| **Pipe** | `agent ... \| npx jinsong pipe` | Reads NDJSON from stdin. Each line is one event. Useful for agents that stream telemetry to stdout. |

**Report generation:**

`npx jinsong report` triggers:
1. `recomputeAll()` — replay all stored events, rebuild sessions and metrics
2. `generateReport()` — query sessions and metrics, render HTML

The HTML report is a single self-contained file:
- All CSS inlined in a `<style>` block
- All JS inlined in a `<script>` block (charts, interactivity)
- No external network requests — opens in any browser, works offline
- Default output: `./jinsong-report.html` (configurable with `--out`)

**Example workflows:**

```bash
# One-shot analysis
npx jinsong import ./agent-traces.json
npx jinsong report
open jinsong-report.html

# Continuous local collection
npx jinsong watch ~/.claude/telemetry/ &
# ... use Claude Code normally ...
npx jinsong report

# Pipe from agent
my-agent --telemetry-format ndjson | npx jinsong pipe
npx jinsong report
```

**Storage:** SQLite at `~/.jinsong/data.db` by default. All data stays local.

### 4.2 Server Mode (`npx jinsong serve`)

Same engine, but runs as a long-lived HTTP server. Exposes an API for remote event ingestion and serves a live web dashboard.

**Architecture:**

```
┌────────────────┐          ┌──────────────────────────────────────┐
│  Agent + SDK   │          │           Jinsong Server              │
│  (remote)      │──HTTP──> │                                      │
└────────────────┘          │   HTTP Router                        │
                            │     │                                │
┌────────────────┐          │     ├── POST /v1/events ──> Ingest   │
│  Agent + SDK   │──HTTP──> │     ├── GET /v1/sessions ──> Query   │
│  (another)     │          │     ├── GET /v1/metrics ──> Query    │
└────────────────┘          │     ├── GET /v1/report ──> Compute   │
                            │     └── GET / ──> Dashboard (Preact) │
┌────────────────┐          │                                      │
│  Local files   │          │   Storage (SQLite / Postgres)        │
│  (optional)    │──watch──>│                                      │
└────────────────┘          └──────────────────────────────────────┘
```

**What server mode adds over local CLI:**

- **HTTP API** for ingesting events from remote agents and SDKs
- **Live web dashboard** with real-time updates (not just static HTML)
- **Continuous operation** — runs as a daemon, processes events as they arrive
- **Concurrent access** — multiple agents push telemetry simultaneously

**API surface:**

```
POST /v1/events                  Ingest a batch of events
  Request:  { events: Event[] }
  Response: { accepted: number, rejected: number, errors?: ValidationError[] }
  Auth:     API key (optional, configurable)

POST /v1/sessions                Ingest pre-computed session records (for migration/bulk upload)
  Request:  { sessions: Session[] }
  Response: { accepted: number }

GET  /v1/sessions                List sessions with filters
  Query:    ?from=<iso>&to=<iso>&agent=<name>&model=<id>&content_type=<type>
            &sort=<field>&order=asc|desc&limit=<n>&offset=<n>
  Response: { sessions: Session[], total: number }

GET  /v1/sessions/:id            Get session detail including metrics and events
  Response: { session: Session, metrics: Metrics, events: Event[], toolCalls: ToolCall[] }

GET  /v1/metrics                 Query aggregated metrics
  Query:    ?from=<iso>&to=<iso>&group_by=<dimension>&agent=<name>&model=<id>
  Response: { aggregations: AggregatedMetrics[] }

GET  /v1/report                  Generate report
  Query:    ?format=html|json&from=<iso>&to=<iso>
  Response: HTML file or JSON payload

GET  /                           Web dashboard (serves Preact SPA)
```

**Configuration:**

```bash
# SQLite (single-user or small team)
npx jinsong serve --port 3000 --db sqlite:./jinsong.db

# PostgreSQL (team/org scale)
npx jinsong serve --port 3000 --db postgres://user:pass@host/jinsong

# With local file watching alongside HTTP ingestion
npx jinsong serve --port 3000 --watch ~/.claude/telemetry/
```

**Use cases:**
- **Team server:** one instance on a shared machine, multiple developers push telemetry via the SDK
- **Org server:** department-wide agent quality monitoring, Postgres backend
- **Self-hosted:** full control over data, data never leaves the network

### 4.3 Cloud Mode

The same server binary, deployed as a managed multi-tenant service.

**What cloud adds over self-hosted server:**

| Capability | Implementation |
|------------|---------------|
| **Multi-tenant isolation** | Org-scoped API keys. Each org's data is logically isolated (schema-per-org or row-level filtering). |
| **Authentication** | API keys for SDK ingestion. SSO (SAML/OIDC) for dashboard access. |
| **Cross-user benchmarks** | Anonymized aggregate metrics pooled across all orgs. "How does your agent compare to the ecosystem?" |
| **Managed hosting** | No ops burden for the user. Auto-scaling, backups, uptime guarantees. |

**Cloud sync from local:**

```bash
npx jinsong sync --api-key <key> --endpoint https://cloud.jinsong.io
```

This reads completed sessions from local storage and uploads session-level metrics to the cloud. The user controls exactly what is shared.

**Privacy boundary — what crosses the wire:**

| Data | Uploaded? | Rationale |
|------|-----------|-----------|
| Raw events | No | Contains timing details, tool names — too granular for benchmarking |
| Session records (anonymized) | Yes | Session shape needed for benchmarking |
| Computed metrics (all 35) | Yes | Core comparison data |
| Dimensions (agent, model, interface, content type) | Yes | Needed for slicing benchmarks |
| Prompt/output content | Never | Privacy — not even captured by the instrumentation |
| User identity | Anonymized hash only | Privacy — `user_id` is already a hash in `data-model.md` |
| Tool call details | No | Tool names could reveal proprietary workflows |

**Sync behavior:**
- Runs as a background process or one-shot command
- Tracks last-synced timestamp to avoid re-uploading
- Respects `privacy.upload_raw_events` config (default: `false`)
- Can be automated via `cloud.auto_sync: true` in config

---

## 5. CLI Design

### 5.1 Command Reference

```
jinsong                               Show help and version
jinsong import <file> [--format json|otlp]
                                      Import telemetry data from a file
jinsong watch <dir> [--poll-interval 1000]
                                      Watch directory for new telemetry files
jinsong pipe                          Read NDJSON events from stdin
jinsong report [--out ./report.html] [--from <date>] [--to <date>]
                                      Generate HTML report from stored data
jinsong serve [--port 3000] [--host 0.0.0.0] [--watch <dir>]
                                      Start server mode with HTTP API + dashboard
jinsong sync [--endpoint <url>] [--api-key <key>]
                                      Upload session metrics to cloud instance
jinsong status                        Show local data summary
jinsong config [--set key=value]      Show or edit configuration
jinsong reset [--confirm]             Clear all local data
```

### 5.2 Global Flags

```
--db <uri>           Storage backend URI
                     Default: sqlite:~/.jinsong/data.db
                     Examples: sqlite:./local.db
                               postgres://user:pass@host/jinsong
                               clickhouse://host:8123/jinsong

--config <path>      Path to config file
                     Default: ~/.jinsong/config.json

--verbose            Verbose output (event counts, timing, debug info)

--quiet              Suppress all output except errors

--version            Print version and exit
```

### 5.3 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (invalid input, failed import) |
| 2 | Storage error (cannot connect, migration failed) |
| 3 | Validation error (malformed events, schema mismatch) |

---

## 6. Compute Pipeline

### 6.1 Pipeline Stages

```
Raw Events (from ingestion)
  │
  ▼
State Machine Tracker (per session, real-time)
  │  Maintains: current_state, state_durations, turn_number,
  │             pending_tool_calls, stall_reason
  │  Produces:  state transition log, accumulated state durations
  │
  ▼
Session Aggregator (on session_end)
  │  Reads:     state durations, raw event counts, dimension fields
  │  Produces:  sessions table record (data-model.md Section 3)
  │
  ▼
Metrics Engine (on session_end)
  │  Reads:     session record + raw events for this session
  │  Produces:  metrics table record (data-model.md Section 4)
  │  Computes:  all 35 metric IDs from metrics.md
  │
  ▼
Persisted in Storage
  │
  ▼
Available to Present layer (report generation, dashboard queries)
```

### 6.2 State Machine Tracker Detail

The tracker implements the full transition table from `tracking.md` Section 4.2. Key behaviors:

- **One instance per active session.** Created on `session_start`, destroyed after `session_end` is processed and session is finalized.
- **Sequential event processing.** Events for a session are processed in timestamp order. The tracker maintains a mutex per session to prevent concurrent state mutations.
- **Duration accumulation.** On every state transition: `state_durations[exiting_state] += (now - state_entry_timestamp)`. This is the foundation for most metrics.
- **Pending tool call tracking.** Multiple tool calls can overlap (rare but possible). The tracker maintains a set of in-flight `tool_call_id` values. Stalled -> Working transition only occurs when the set is empty.
- **L1 stall detection.** When operating without framework events (L1 mode), the tracker runs the 2-second output gap heuristic from `tracking.md` Section 5.2. A timer fires if no `output_chunk` arrives within 2 seconds of the last one, synthesizing a Stalled transition.

### 6.3 Session Aggregator Detail

Triggered by `session_end`. Reads the tracker's accumulated state and raw events from storage, then populates every field in the sessions table:

- **Identity:** `session_id`, `user_id` from `session_start` payload
- **Timestamps:** `started_at`, `ended_at`, `duration_ms` from first and last events
- **Operational counters:** `total_turns` = count of `prompt_submit`, `total_tool_calls` = count of `tool_call_start`, etc.
- **State durations:** directly from the tracker's `state_durations` map
- **Outcome:** `end_reason` from `session_end` payload, `task_completed` = true if any `task_complete` event exists
- **Dimensions:** copied from `session_start` payload. `content_type` derived from session shape (see below).
- **Tool calls table:** populated from paired `tool_call_start`/`tool_call_end` events

**Content type derivation:**

```
if total_turns <= 2 AND total_tool_calls <= 2 AND duration_ms < 30000:
    content_type = "quick_answer"
elif session_mode == "multi_turn_autonomous" OR session_mode == "background_batch":
    content_type = "autonomous_workflow"
elif total_turns > 15 OR duration_ms > 900000:   // 15 turns or 15 min
    content_type = "deep_session"
else:
    content_type = "guided_task"
```

### 6.4 Metrics Engine Detail

Takes the session record and computes all 35 metrics. Organized by the layers defined in `metrics.md`:

**Operational session-level (6 metrics):** direct mappings from session counters. `tokens_per_session` = `total_tokens_in + total_tokens_out + total_tokens_reasoning`. `time_per_turn_avg` = `(duration_ms - time_in_waiting_ms) / total_turns / 1000`.

**Operational per-event aggregates (9 metrics):** requires scanning events for the session. `time_to_first_token` = first `first_token.payload.latency_ms / 1000`. Tool call duration percentiles computed from `tool_call_end.payload.duration_ms` values. `tool_success_rate` = count of `tool_call_end` where `status = success` / total `tool_call_end`.

**Experience pillars (23 metrics across 5 pillars):** formulas exactly as specified in `metrics.md` Sections 2.1-2.5. Key derivations:

- **Responsiveness:** `output_speed` = visible output tokens / (time_in_working_ms / 1000). `resume_speed` = time from each `user_input_received` to next `output_chunk`, averaged.
- **Reliability:** `stall_ratio` = `time_in_stalled_ms / (time_in_working_ms + time_in_stalled_ms)`. `hidden_retries` = count of `retry_start` events where no `output_chunk` was emitted between `retry_start` and `retry_end`.
- **Autonomy:** `work_multiplier` = `time_in_working_ms / (time_in_waiting_ms + user_input_time_ms)`. Null if denominator is zero.
- **Correctness:** `c_output_quality_score` left null (requires L4). `useful_token_pct` = `total_tokens_out / (total_tokens_in + total_tokens_out + total_tokens_reasoning) * 100`.
- **Completion:** `comp_task_completion_rate` = 1.0 if `task_completed` is true with no `user_correction` in the post-completion window; else 0.0. `comp_redo_rate` requires cross-session analysis — deferred until query time or left null.

---

## 7. Report Format

The static HTML report generated by `jinsong report`. Self-contained, no external dependencies.

### 7.1 Report Structure

```
┌─────────────────────────────────────────────────────────────┐
│  JINSONG REPORT                                             │
│  Generated: 2026-04-15 · 142 sessions · Mar 15 – Apr 15    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─── Summary Header ───────────────────────────────────┐  │
│  │  Overall health: ●●●○○  Sessions: 142  Agents: 3     │  │
│  │  Avg TTFT: 1.4s  Completion rate: 82%  Gave up: 6%   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Operational Overview ─────────────────────────────┐  │
│  │  Tokens/session trend ~~~~~~~~~~                      │  │
│  │  Turns/session trend  ~~~~~~~~~~                      │  │
│  │  Duration trend       ~~~~~~~~~~                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Five Pillars Dashboard ───────────────────────────┐  │
│  │                                                       │  │
│  │  Responsiveness    Reliability    Autonomy            │  │
│  │  ████░░ 72/100     ████░ 65/100   █████ 88/100       │  │
│  │  TTFT: 1.4s        Stall: 18%     Questions: 0.3     │  │
│  │  Speed: 35 tok/s   Errors: 0.8    Corrections: 0.1   │  │
│  │                                                       │  │
│  │  Correctness       Completion                         │  │
│  │  ███░░ 70/100      ████░ 82/100                       │  │
│  │  Clean: 94%        Done: 82%                          │  │
│  │  Useful: 28%       Gave up: 6%                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Content Type Breakdown ───────────────────────────┐  │
│  │  quick_answer (48)  guided_task (62)                  │  │
│  │  deep_session (22)  autonomous_workflow (10)           │  │
│  │  [per-type pillar scores and key metrics]             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Session List ─────────────────────────────────────┐  │
│  │  ID   Date    Agent   Duration  Turns  Status  Score  │  │
│  │  s001 Apr 14  CC 1.5  21.7s     1      ✓       85    │  │
│  │  s002 Apr 14  CC 1.5  4m32s     8      ✓       72    │  │
│  │  s003 Apr 13  CC 1.5  12.1s     1      ✗       --    │  │
│  │  [sortable, filterable, click to expand]              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Session Detail (expanded) ────────────────────────┐  │
│  │  State Machine Timeline:                              │  │
│  │  Starting ██ Working ████████ Stalled ████ Working ██ │  │
│  │  1.2s        5.2s             8.3s        5.2s        │  │
│  │                                                       │  │
│  │  Per-event breakdown, tool call table, metrics detail │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Trends ───────────────────────────────────────────┐  │
│  │  [Time-series charts if > 20 sessions over > 3 days] │  │
│  │  TTFT over time, completion rate over time, etc.      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Report Sections

| Section | Content | Data Source |
|---------|---------|-------------|
| **Summary header** | Date range, total sessions, overall health indicators (good/fair/poor counts), headline metrics | Aggregated metrics across all sessions in range |
| **Operational overview** | Tokens/session, turns/session, duration — distributions and trends | Session-level operational metrics |
| **Five pillars dashboard** | One card per pillar. Key metrics with good/fair/poor thresholds from `metrics.md`. Sparkline charts for each metric. | Metrics table, aggregated |
| **Content type breakdown** | Per-content-type pillar scores. Shows how quick_answer vs deep_session differ. | Metrics grouped by `content_type` dimension |
| **Session list** | Sortable, filterable table. Columns: session ID, date, agent, model, duration, turns, tool calls, status, pillar scores. | Sessions table |
| **Session detail** | Expandable row. State machine timeline visualization (horizontal bar). Per-event breakdown. Tool call table. All 35 metrics for this session. | Events, sessions, metrics, tool_calls for one session |
| **Trends** | Time-series line charts for key metrics. Only shown if sufficient data (> 20 sessions over > 3 days). | Metrics aggregated by day |

### 7.3 Charting

Charts rendered using **uPlot** (~35KB minified), bundled inline in the HTML file. uPlot is chosen for its minimal footprint and fast rendering — it handles the sparklines, time-series, and distribution charts without bloating the report file.

For the state machine timeline visualization: inline SVG, generated server-side. Each state is a colored rectangle proportional to its duration. Colors: Starting = blue, Working = green, Stalled = orange, Waiting = gray, Failed = red.

---

## 8. Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Language** | TypeScript | npx-friendly, strong typing for the data model, large ecosystem |
| **Runtime** | Node.js 20+ | Runs everywhere, native npx distribution, LTS stability |
| **Local DB** | better-sqlite3 | Synchronous API (no async overhead for CLI), zero-config, single-file, ~5x faster than node-sqlite3 for reads |
| **Cloud DB** | PostgreSQL 15+ | Proven at scale, JSONB for payloads, rich indexing, connection pooling via pgBouncer |
| **Analytics DB** | ClickHouse (optional) | Column-oriented, 100x faster aggregations on millions of sessions, append-optimized |
| **HTTP framework** | Hono | Ultra-lightweight (~14KB), fast routing, runs on Node/Deno/Bun/edge, middleware ecosystem |
| **Dashboard UI** | Preact | 3KB alternative to React, same JSX API, fast rendering for dashboard components |
| **Charts** | uPlot | ~35KB, fastest canvas-based charts, handles time-series and distributions |
| **CLI framework** | citty | Lightweight, TypeScript-native, clean subcommand API, no bloat |
| **Build tool** | tsup (esbuild) | Sub-second builds, produces single CJS bundle for npx, tree-shaking |
| **Testing** | vitest | Fast, TypeScript-native, compatible with Node APIs |
| **Distribution** | npm package | `npx jinsong` works with zero install, global install also supported |
| **File watching** | chokidar | Battle-tested cross-platform file watching for `jinsong watch` |

### Package Structure

```
jinsong/
├── src/
│   ├── cli/                  # CLI entry point, command definitions
│   │   ├── index.ts          # Main entry, command router
│   │   ├── import.ts         # jinsong import
│   │   ├── watch.ts          # jinsong watch
│   │   ├── pipe.ts           # jinsong pipe
│   │   ├── report.ts         # jinsong report
│   │   ├── serve.ts          # jinsong serve
│   │   ├── sync.ts           # jinsong sync
│   │   └── status.ts         # jinsong status
│   │
│   ├── engine/               # Core engine (mode-independent)
│   │   ├── ingest/           # Event parsing, validation, dedup
│   │   │   ├── parser.ts     # JSON/OTLP/NDJSON parsers
│   │   │   ├── validator.ts  # Schema validation per event type
│   │   │   └── mapper.ts     # OTLP-to-Jinsong event mapping
│   │   │
│   │   ├── compute/          # State machine, aggregation, metrics
│   │   │   ├── tracker.ts    # State machine tracker (tracking.md §4)
│   │   │   ├── aggregator.ts # Session aggregator
│   │   │   ├── metrics.ts    # Metrics engine (all 35 metrics)
│   │   │   └── content-type.ts # Content type derivation
│   │   │
│   │   └── present/          # Report generation, dashboard data
│   │       ├── report.ts     # HTML report generator
│   │       ├── template.ts   # HTML template with inlined CSS/JS
│   │       └── api.ts        # JSON report payload builder
│   │
│   ├── storage/              # Storage layer
│   │   ├── adapter.ts        # StorageAdapter interface definition
│   │   ├── sqlite.ts         # SQLite adapter (better-sqlite3)
│   │   ├── postgres.ts       # PostgreSQL adapter
│   │   ├── clickhouse.ts     # ClickHouse adapter
│   │   ├── migrations/       # Schema migration scripts
│   │   └── factory.ts        # Adapter factory (parse URI, instantiate)
│   │
│   ├── server/               # HTTP server (serve mode)
│   │   ├── app.ts            # Hono app, route definitions
│   │   ├── routes/           # Route handlers (events, sessions, metrics)
│   │   ├── middleware/        # Auth, CORS, rate limiting
│   │   └── dashboard/        # Preact SPA source
│   │
│   ├── sync/                 # Cloud sync module
│   │   ├── uploader.ts       # Session/metrics upload logic
│   │   ├── anonymizer.ts     # Strip/hash sensitive fields
│   │   └── tracker.ts        # Last-synced timestamp tracking
│   │
│   └── types/                # Shared type definitions
│       ├── events.ts         # 15 event types from data-model.md
│       ├── sessions.ts       # Session record type
│       ├── metrics.ts        # Metrics record type (35 fields)
│       └── config.ts         # Configuration schema
│
├── package.json              # bin: { "jinsong": "./dist/cli.js" }
├── tsconfig.json
└── tsup.config.ts            # Build config: CJS bundle, target node20
```

---

## 9. Data Flow Diagrams

### 9.1 Local CLI Mode

```
Agent Session
     │
     │  writes telemetry file (.json)
     ▼
~/.claude/telemetry/trace-2026-04-15.json
     │
     │  jinsong import (or jinsong watch detects new file)
     ▼
Ingestion: parse JSON → validate 15 event types → dedup by event_id
     │
     ▼
Storage: write events to SQLite (~/.jinsong/data.db)
     │
     │  jinsong report
     ▼
Compute: replay events → State Machine Tracker → Session Aggregator → Metrics Engine
     │
     ▼
Storage: write session + metrics records
     │
     ▼
Present: query sessions + metrics → render HTML template → embed uPlot charts
     │
     ▼
./jinsong-report.html (open in browser)
```

### 9.2 Server Mode

```
Remote Agent A ──┐
Remote Agent B ──┤── POST /v1/events (JSON batch) ──┐
Remote Agent C ──┘                                    │
                                                      ▼
                                              Jinsong Server (Hono)
                                                      │
Local dir watcher ── file events ─────────────────────┘
                                                      │
                                                      ▼
                                              Ingestion → Storage (SQLite or Postgres)
                                                      │
                                                      ▼
                                              Compute (real-time on ingest + periodic)
                                                      │
                                              ┌───────┴───────┐
                                              ▼               ▼
                                          Web Dashboard   GET /v1/* API
                                          (Preact SPA)    (JSON responses)
```

### 9.3 Cloud Sync

```
Developer's Machine                         Cloud (cloud.jinsong.io)
┌────────────────────┐                      ┌──────────────────────────┐
│ Jinsong (local)    │                      │ Jinsong Server (managed) │
│                    │                      │                          │
│ SQLite             │  jinsong sync        │ PostgreSQL               │
│  ├─ events         │  ─────────────────>  │  ├─ sessions (anonymized)│
│  ├─ sessions ──────│─ anonymize + upload  │  ├─ metrics              │
│  ├─ metrics ───────│─ upload as-is        │  └─ dimensions           │
│  └─ tool_calls     │                      │                          │
│                    │  NOT uploaded:        │ Cross-user benchmarks:   │
│  events (raw)      │  - raw events        │  "Your TTFT: 1.4s"      │
│  tool_calls        │  - tool call details │  "Ecosystem p50: 2.1s"  │
│  prompt content    │  - any content       │  "You're faster than 72%"│
└────────────────────┘                      └──────────────────────────┘
```

---

## 10. Configuration

### 10.1 Config File

Default location: `~/.jinsong/config.json`. Created on first run with sensible defaults.

```json
{
  "db": "sqlite:~/.jinsong/data.db",

  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "cors_origins": ["*"],
    "api_key": null,
    "max_batch_size": 1000
  },

  "cloud": {
    "endpoint": null,
    "api_key": null,
    "auto_sync": false,
    "sync_interval_minutes": 60
  },

  "privacy": {
    "anonymize_user": true,
    "upload_raw_events": false,
    "upload_tool_calls": false
  },

  "collection": {
    "buffer_size": 50,
    "flush_interval_ms": 5000,
    "stall_threshold_ms": 2000,
    "session_timeout_minutes": 5
  },

  "retention": {
    "events_days": 30,
    "sessions_days": 365,
    "metrics_days": -1
  },

  "report": {
    "default_output": "./jinsong-report.html",
    "default_date_range_days": 30
  }
}
```

### 10.2 Config Resolution Order

Settings are resolved in this order (later overrides earlier):

1. **Built-in defaults** — the values shown above
2. **Config file** — `~/.jinsong/config.json` (or `--config <path>`)
3. **Environment variables** — `JINSONG_DB`, `JINSONG_PORT`, `JINSONG_API_KEY`, etc. (prefixed with `JINSONG_`)
4. **CLI flags** — `--db`, `--port`, etc. (highest precedence)

### 10.3 Retention and Pruning

The retention policy controls how long data is kept:

- **events_days: 30** — raw events are pruned after 30 days. Events are the largest table; pruning keeps the database small for local use.
- **sessions_days: 365** — session records kept for a year. Much smaller than events.
- **metrics_days: -1** — metrics kept indefinitely. Tiny footprint (one row per session).

Pruning runs automatically on startup and once daily in server mode. `jinsong reset --confirm` clears everything.

---

## 11. Extension Points

### 11.1 Custom Storage Adapters

Implement the `StorageAdapter` interface (Section 3.1) to add a new backend. Register it in the adapter factory with a URI scheme.

```
// Example: DuckDB adapter
// URI: duckdb:./analytics.duckdb
// Implement all StorageAdapter methods using DuckDB's Node bindings
```

The adapter must handle its own connection management, schema migrations, and query translation.

### 11.2 Custom Metrics

Add computed fields to the metrics pipeline by registering a metric function:

```
MetricDefinition {
  id: string                           // Unique metric ID
  name: string                         // Human-readable name
  pillar: "operational" | "responsiveness" | "reliability" | "autonomy" | "correctness" | "completion"
  compute: (session, events) → number | null   // Computation function
  unit: string                         // Display unit
  thresholds?: { good: number, fair: number }  // Optional threshold config
}
```

Custom metrics are stored in a `custom_metrics` JSON column on the metrics table — no schema migration required.

### 11.3 Custom Report Templates

The HTML report generator uses a template system. The default template is bundled, but users can provide a custom template:

```bash
npx jinsong report --template ./my-template.html
```

The template receives the full `ReportPayload` (sessions, metrics, aggregations) as a JSON object injected into a `<script>` tag. The template controls all rendering.

### 11.4 Webhooks and Notifications

Server mode supports webhook notifications when metrics cross thresholds:

```json
{
  "webhooks": [
    {
      "url": "https://slack.example.com/webhook",
      "trigger": "session.rel_stall_ratio > 0.30",
      "cooldown_minutes": 60
    }
  ]
}
```

Webhook triggers are evaluated after each session is finalized. The payload includes the session ID, the triggered condition, and the metric values. Cooldown prevents notification storms.

### 11.5 SDK Integration Points

Agent SDKs integrate with Jinsong by emitting events in one of three ways:

| Method | Integration Effort | Best For |
|--------|-------------------|----------|
| **File export** | Minimal — agent writes JSON files, Jinsong watches | Existing agents, no code changes |
| **HTTP push** | Low — agent POSTs events to Jinsong server | Remote agents, team setups |
| **In-process** | Medium — import Jinsong as a library, call `ingest()` directly | Tightest integration, lowest latency |

For in-process integration, the engine exposes a programmatic API:

```
import { createEngine } from "jinsong"

const engine = createEngine({ db: "sqlite:./jinsong.db" })
engine.ingest([event1, event2, event3])
const report = engine.getReportData()
```

This enables agent frameworks to embed Jinsong directly without running a separate process.
