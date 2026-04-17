/**
 * Server-side dashboard aggregation (DASH-11).
 *
 * Produces the precomputed payload consumed by `/api/aggregate?range=…` —
 * one request, every chart. Before this module each dashboard row fetched
 * `/api/sessions` on its own and re-aggregated client-side; now a single
 * server-side pass emits exactly what the UI needs for a given time range.
 *
 * The shape and the individual metric definitions are ported from the UI
 * helpers that already shipped for earlier DASH-* tickets, so the rows
 * render identically. Keep this module the source of truth going forward —
 * the client-side `aggregate.ts` / `distributions.ts` / `tool-stats.ts` /
 * `heatmap.ts` / `breakdowns.ts` / `pillars.ts` / `timeline.ts` helpers
 * mirror these algorithms for design-time parity, and the ones no widget
 * still reaches into can be retired once the migration finishes.
 */

import type { SQLiteStorage } from '../storage/sqlite.js';
import type { Session, SessionMetrics } from '../types.js';

// ─── Range ─────────────────────────────────────────────────────────────────

export type Range = '7d' | '30d' | '90d' | 'all';

export const VALID_RANGES: readonly Range[] = ['7d', '30d', '90d', 'all'];

export function isRange(v: unknown): v is Range {
  return v === '7d' || v === '30d' || v === '90d' || v === 'all';
}

function rangeToDays(range: Range): number | null {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Shared types (mirrors server /api/sessions shape) ────────────────────

interface ToolStats {
  calls: number;
  successes: number;
  failures: number;
}

interface SessionRow {
  session: Session;
  metrics: SessionMetrics | null;
  tool_category_counts: Record<string, number>;
  tool_stats: Record<string, ToolStats>;
}

// ─── Helpers: windowing + stats ───────────────────────────────────────────

function filterByWindow(
  rows: SessionRow[],
  startMs: number | null,
  endMs: number,
): SessionRow[] {
  if (startMs == null) {
    return rows.filter((r) => {
      const t = Date.parse(r.session.started_at);
      return Number.isFinite(t) && t <= endMs;
    });
  }
  return rows.filter((r) => {
    const t = Date.parse(r.session.started_at);
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
}

function median(xs: Array<number | null | undefined>): number | null {
  const finite: number[] = [];
  for (const x of xs) {
    if (x == null) continue;
    if (typeof x !== 'number') continue;
    if (!Number.isFinite(x)) continue;
    finite.push(x);
  }
  if (finite.length === 0) return null;
  finite.sort((a, b) => a - b);
  const mid = finite.length >> 1;
  if (finite.length % 2 === 1) return finite[mid];
  return (finite[mid - 1] + finite[mid]) / 2;
}

function percentile(
  xs: Array<number | null | undefined>,
  p: number,
): number | null {
  const finite: number[] = [];
  for (const x of xs) {
    if (x == null) continue;
    if (typeof x !== 'number') continue;
    if (!Number.isFinite(x)) continue;
    finite.push(x);
  }
  if (finite.length === 0) return null;
  finite.sort((a, b) => a - b);
  if (finite.length === 1) return finite[0];
  const clamped = Math.min(1, Math.max(0, p));
  const rank = clamped * (finite.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return finite[lo];
  const frac = rank - lo;
  return finite[lo] + (finite[hi] - finite[lo]) * frac;
}

function pctDelta(
  current: number | null,
  prior: number | null,
): number | null {
  if (current == null || prior == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null;
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function sumField(
  rows: SessionRow[],
  pick: (r: SessionRow) => number | null | undefined,
): number {
  let total = 0;
  for (const r of rows) {
    const v = pick(r);
    if (typeof v === 'number' && Number.isFinite(v)) total += v;
  }
  return total;
}

function completionRate(rows: SessionRow[]): number | null {
  if (rows.length === 0) return null;
  let done = 0;
  for (const r of rows) if (r.session.task_completed) done++;
  return done / rows.length;
}

// ─── Day bucketing ────────────────────────────────────────────────────────

/** Returns `YYYY-MM-DD` (UTC) for the day containing `ms`. */
function utcDayKey(ms: number): string {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Fill a day-keyed array of length `days` ending at `now`, oldest first.
 * Missing days get an empty bucket.
 */
function bucketDays<T>(
  rows: SessionRow[],
  days: number,
  now: number,
  aggregator: (bucket: SessionRow[]) => T,
): Array<{ day: string } & T> {
  const endDay = new Date(now);
  endDay.setUTCHours(0, 0, 0, 0);
  const endMs = endDay.getTime();

  const byDay = new Map<string, SessionRow[]>();
  for (const r of rows) {
    const t = Date.parse(r.session.started_at);
    if (!Number.isFinite(t)) continue;
    const key = utcDayKey(t);
    const arr = byDay.get(key);
    if (arr) arr.push(r);
    else byDay.set(key, [r]);
  }

  const out: Array<{ day: string } & T> = [];
  for (let i = days - 1; i >= 0; i--) {
    const ms = endMs - i * DAY_MS;
    const key = utcDayKey(ms);
    const bucket = byDay.get(key) ?? [];
    out.push({ day: key, ...aggregator(bucket) });
  }
  return out;
}

// ─── Content type / end reason / tool category (mirrors ui/lib) ───────────

const MS_15_MIN = 15 * 60 * 1000;
const MS_30_SEC = 30 * 1000;

type ContentType =
  | 'quick_answer'
  | 'guided_task'
  | 'deep_session'
  | 'autonomous_workflow';

const CONTENT_TYPE_ORDER: ContentType[] = [
  'quick_answer',
  'guided_task',
  'deep_session',
  'autonomous_workflow',
];

function inferContentType(session: Session): ContentType {
  const turns = session.total_turns ?? 0;
  const duration = session.duration_ms ?? 0;
  const toolCalls = session.total_tool_calls ?? 0;
  if (turns <= 2 && duration < MS_30_SEC && toolCalls <= 2) return 'quick_answer';
  if (turns <= 1 && duration >= MS_15_MIN) return 'autonomous_workflow';
  if (turns >= 15 || duration >= MS_15_MIN) return 'deep_session';
  return 'guided_task';
}

type EndReasonBucket =
  | 'completed'
  | 'user_cancelled'
  | 'error'
  | 'timeout'
  | 'other';

const END_REASON_ORDER: EndReasonBucket[] = [
  'completed',
  'user_cancelled',
  'error',
  'timeout',
  'other',
];

function normalizeEndReason(
  raw: string | null | undefined,
): EndReasonBucket {
  if (raw === 'completed') return 'completed';
  if (raw === 'user_cancelled') return 'user_cancelled';
  if (raw === 'timeout') return 'timeout';
  if (raw === 'error' || raw === 'failed') return 'error';
  return 'other';
}

type ToolCategoryBucket = 'execution' | 'file_system' | 'browser' | 'other';

const TOOL_CATEGORY_ORDER: ToolCategoryBucket[] = [
  'execution',
  'file_system',
  'browser',
  'other',
];

// ─── Heatmap ──────────────────────────────────────────────────────────────

/**
 * Build the heatmap cells in Mon-first day order — matches the UI's
 * `getDayIndexMonFirst`. We rely on the server's local timezone for
 * `getDay()` / `getHours()` so this mirrors the previous client-side
 * computation when the server and browser happen to share a tz; for remote
 * access the server's tz wins. Acceptable for the single-user local tool.
 */
function buildHeatmap(rows: SessionRow[]): Array<{
  dow: number;
  hour: number;
  count: number;
}> {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    const t = Date.parse(r.session.started_at);
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    const hour = d.getHours();
    if (hour < 0 || hour > 23) continue;
    grid[dow][hour] += 1;
  }
  const cells: Array<{ dow: number; hour: number; count: number }> = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ dow, hour, count: grid[dow][hour] });
    }
  }
  return cells;
}

// ─── Tool merging ─────────────────────────────────────────────────────────

function mergeToolStats(rows: SessionRow[]): Map<string, ToolStats> {
  const out = new Map<string, ToolStats>();
  for (const r of rows) {
    const ts = r.tool_stats;
    if (!ts) continue;
    for (const [tool, s] of Object.entries(ts)) {
      if (!s) continue;
      let acc = out.get(tool);
      if (!acc) {
        acc = { calls: 0, successes: 0, failures: 0 };
        out.set(tool, acc);
      }
      if (Number.isFinite(s.calls)) acc.calls += s.calls;
      if (Number.isFinite(s.successes)) acc.successes += s.successes;
      if (Number.isFinite(s.failures)) acc.failures += s.failures;
    }
  }
  return out;
}

// ─── Tool category inference fallback ─────────────────────────────────────

/**
 * Matches the tiny fallback classifier used by `/api/sessions` so old rows
 * without `tool_category` still land in a sensible bucket.
 */
function inferToolCategoryFallback(name: string): string {
  const n = name.toLowerCase();
  if (n === 'bash' || n === 'execute') return 'execution';
  if (
    n === 'read' ||
    n === 'glob' ||
    n === 'grep' ||
    n === 'edit' ||
    n === 'write'
  ) {
    return 'file_system';
  }
  if (n === 'webfetch' || n === 'websearch') return 'browser';
  return 'other';
}

// ─── Session row assembly (shared with /api/sessions) ─────────────────────

/**
 * Build the authoritative list of `SessionRow` shapes from storage. Mirrors
 * the logic inside `/api/sessions` (see `src/server/index.ts`) but kept
 * here so the aggregate endpoint doesn't need to call out of the handler.
 * Re-derives tool-category counts + per-tool stats from the events table in
 * one pass.
 */
export function buildSessionRows(storage: SQLiteStorage): SessionRow[] {
  const sessions = storage.querySessions();
  const metrics = storage.queryMetrics();
  const metricsBySession = new Map(metrics.map((m) => [m.session_id, m]));

  const toolCategoryBySession = new Map<string, Record<string, number>>();
  const toolStatsBySession = new Map<string, Record<string, ToolStats>>();

  function getToolBucket(sid: string, tool: string): ToolStats {
    let perSession = toolStatsBySession.get(sid);
    if (!perSession) {
      perSession = {};
      toolStatsBySession.set(sid, perSession);
    }
    let b = perSession[tool];
    if (!b) {
      b = { calls: 0, successes: 0, failures: 0 };
      perSession[tool] = b;
    }
    return b;
  }

  const startRows = storage.queryToolCallStartRows();
  for (const r of startRows) {
    const cat = r.tool_category ?? inferToolCategoryFallback(r.tool_name);
    let bucket = toolCategoryBySession.get(r.session_id);
    if (!bucket) {
      bucket = {};
      toolCategoryBySession.set(r.session_id, bucket);
    }
    bucket[cat] = (bucket[cat] ?? 0) + 1;
    getToolBucket(r.session_id, r.tool_name).calls += 1;
  }

  const endRows = storage.queryToolCallEndRows();
  for (const r of endRows) {
    const b = getToolBucket(r.session_id, r.tool_name);
    if (r.status === 'success') b.successes += 1;
    else b.failures += 1;
  }

  return sessions.map((s) => ({
    session: s,
    metrics: metricsBySession.get(s.session_id) ?? null,
    tool_category_counts: toolCategoryBySession.get(s.session_id) ?? {},
    tool_stats: toolStatsBySession.get(s.session_id) ?? {},
  }));
}

// ─── Public output types ──────────────────────────────────────────────────

export interface AggregateSparklineBucket {
  bucket: string;
  count: number;
}
export interface AggregateTokenBucket {
  bucket: string;
  in: number;
  out: number;
}
export interface AggregateScalarBucket {
  bucket: string;
  value: number;
}
export interface AggregateRateBucket {
  bucket: string;
  rate: number;
}
export interface AggregateDurationBucket {
  bucket: string;
  seconds: number;
}

export interface AggregateTotals {
  sessions: number;
  tokens_in: number;
  tokens_out: number;
  duration_seconds: number;
  completions: number;
}

export interface AggregateMedians {
  ttft_seconds: number | null;
  stall_ratio: number | null;
}

export interface AggregatePrior {
  totals: AggregateTotals;
  medians: AggregateMedians;
}

export interface AggregatePillar {
  id: 'responsiveness' | 'reliability' | 'autonomy' | 'correctness' | 'completion';
  good: number;
  fair: number;
  poor: number;
  headline: {
    value: number | null;
    delta: number | null;
  };
}

export interface AggregateTimelines {
  sessions_per_day: Array<{ date: string; count: number }>;
  tokens_per_day: Array<{ date: string; in: number; out: number }>;
  ttft_p50_p95: Array<{ date: string; p50: number | null; p95: number | null }>;
  stall_ratio_median: Array<{ date: string; value: number | null }>;
}

export interface AggregateDistributions {
  content_type: Array<{ label: string; count: number }>;
  end_reason: Array<{ label: string; count: number }>;
  tool_category: Array<{ label: string; count: number }>;
}

export interface AggregateToolPerformance {
  top_tools: Array<{ tool: string; count: number }>;
  success_rates: Array<{
    tool: string;
    rate: number;
    n: number;
  }>;
}

export interface AggregateSessionTableRow {
  session: Session;
  metrics: SessionMetrics | null;
}

export interface AggregateBreakdowns {
  agents: Array<{ label: string; count: number }>;
  models: Array<{ label: string; count: number }>;
}

export interface AggregateResponse {
  range: Range;
  generated_at: string;
  window: { start: string; end: string; days: number | null };
  totals: AggregateTotals;
  medians: AggregateMedians;
  prior: AggregatePrior | null;
  kpi_sparklines: {
    sessions: AggregateSparklineBucket[];
    tokens: AggregateTokenBucket[];
    duration: AggregateDurationBucket[];
    completion: AggregateRateBucket[];
    ttft_median: AggregateScalarBucket[];
    stall_median: AggregateScalarBucket[];
  };
  pillars: AggregatePillar[];
  timelines: AggregateTimelines;
  distributions: AggregateDistributions;
  tool_performance: AggregateToolPerformance;
  heatmap: { cells: Array<{ dow: number; hour: number; count: number }> };
  breakdowns: AggregateBreakdowns;
  sessions_table: AggregateSessionTableRow[];
}

// ─── Pillar math (mirrors ui/lib/pillars.ts) ──────────────────────────────

const TTFT_GOOD_S = 2;
const TTFT_FAIR_S = 5;
const STALL_GOOD = 0.1;
const STALL_FAIR = 0.2;
const ACTIVE_GOOD_PCT = 10;
const ACTIVE_FAIR_PCT = 30;
const CLEAN_GOOD = 0.95;
const CLEAN_FAIR = 0.8;

type Classification = 'good' | 'fair' | 'poor' | 'na';

interface PillarDef {
  id: AggregatePillar['id'];
  aggregator: 'median' | 'mean' | 'completion_rate';
  extract: (row: SessionRow) => number | null;
  classify: (v: number | null) => Classification;
}

function pick(row: SessionRow, key: keyof SessionMetrics): number | null {
  const m = row.metrics;
  if (!m) return null;
  const v = m[key];
  if (typeof v !== 'number') return null;
  if (!Number.isFinite(v)) return null;
  return v;
}

const PILLARS: PillarDef[] = [
  {
    id: 'responsiveness',
    aggregator: 'median',
    extract: (r) => pick(r, 'r_time_to_first_token'),
    classify: (v) => {
      if (v == null) return 'na';
      if (v <= TTFT_GOOD_S) return 'good';
      if (v <= TTFT_FAIR_S) return 'fair';
      return 'poor';
    },
  },
  {
    id: 'reliability',
    aggregator: 'median',
    extract: (r) => pick(r, 'rel_stall_ratio'),
    classify: (v) => {
      if (v == null) return 'na';
      if (v <= STALL_GOOD) return 'good';
      if (v <= STALL_FAIR) return 'fair';
      return 'poor';
    },
  },
  {
    id: 'autonomy',
    aggregator: 'mean',
    extract: (r) => pick(r, 'a_user_active_time_pct'),
    classify: (v) => {
      if (v == null) return 'na';
      if (v <= ACTIVE_GOOD_PCT) return 'good';
      if (v <= ACTIVE_FAIR_PCT) return 'fair';
      return 'poor';
    },
  },
  {
    id: 'correctness',
    aggregator: 'mean',
    extract: (r) => pick(r, 'c_clean_output_rate'),
    classify: (v) => {
      if (v == null) return 'na';
      if (v >= CLEAN_GOOD) return 'good';
      if (v >= CLEAN_FAIR) return 'fair';
      return 'poor';
    },
  },
  {
    id: 'completion',
    aggregator: 'completion_rate',
    extract: (r) => (r.session.task_completed ? 1 : 0),
    classify: (v) => {
      if (v == null) return 'na';
      return v >= 1 ? 'good' : 'poor';
    },
  },
];

function headlineValue(
  rows: SessionRow[],
  pillar: PillarDef,
): number | null {
  if (rows.length === 0) return null;
  if (pillar.aggregator === 'completion_rate') {
    let done = 0;
    let seen = 0;
    for (const r of rows) {
      const v = pillar.extract(r);
      if (v == null) continue;
      seen++;
      if (v >= 1) done++;
    }
    if (seen === 0) return null;
    return (done / seen) * 100;
  }
  const vals = rows.map((r) => pillar.extract(r));
  if (pillar.aggregator === 'median') return median(vals);
  let sum = 0;
  let n = 0;
  for (const v of vals) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    n++;
  }
  if (n === 0) return null;
  return sum / n;
}

function classifyDistribution(
  rows: SessionRow[],
  pillar: PillarDef,
): { good: number; fair: number; poor: number } {
  let good = 0;
  let fair = 0;
  let poor = 0;
  for (const r of rows) {
    const v = pillar.extract(r);
    const c = pillar.classify(v);
    if (c === 'good') good++;
    else if (c === 'fair') fair++;
    else if (c === 'poor') poor++;
  }
  return { good, fair, poor };
}

// ─── Main entry ───────────────────────────────────────────────────────────

export interface ComputeOptions {
  /** Defaults to `Date.now()` — override in tests for determinism. */
  now?: number;
}

/**
 * Compute the full `/api/aggregate` payload for a given range.
 *
 * The algorithm is:
 *   1. Pull every session row + its merged tool stats from storage.
 *   2. Slice to the current window (end = now, start = now − rangeDays).
 *      `range === 'all'` uses no lower bound.
 *   3. Slice a prior window of equal length (skipped for `'all'`).
 *   4. Compute totals, medians, per-pillar rollups, daily timelines,
 *      distributions, tool performance, heatmap, breakdowns, and the
 *      top-50 most-recent session table rows.
 */
export function computeAggregate(
  storage: SQLiteStorage,
  range: Range,
  opts: ComputeOptions = {},
): AggregateResponse {
  const now = opts.now ?? Date.now();
  const days = rangeToDays(range);
  const endMs = now;
  const startMs = days == null ? null : endMs - days * DAY_MS;

  const allRows = buildSessionRows(storage);
  const current = filterByWindow(allRows, startMs, endMs);

  // Prior window — only exists when the range has a fixed length.
  let prior: SessionRow[] | null = null;
  if (days != null && startMs != null) {
    const priorStart = startMs - days * DAY_MS;
    const priorEnd = startMs;
    prior = allRows.filter((r) => {
      const t = Date.parse(r.session.started_at);
      return Number.isFinite(t) && t >= priorStart && t < priorEnd;
    });
  }

  // ─── Totals + medians ───────────────────────────────────────────────────

  const totals: AggregateTotals = {
    sessions: current.length,
    tokens_in: sumField(current, (r) => r.session.total_tokens_in),
    tokens_out: sumField(current, (r) => r.session.total_tokens_out),
    duration_seconds: sumField(current, (r) => r.metrics?.duration_seconds ?? null),
    completions: current.reduce(
      (n, r) => (r.session.task_completed ? n + 1 : n),
      0,
    ),
  };

  const medians: AggregateMedians = {
    ttft_seconds: median(
      current.map((r) => r.metrics?.r_time_to_first_token ?? null),
    ),
    stall_ratio: median(
      current.map((r) => r.metrics?.rel_stall_ratio ?? null),
    ),
  };

  let priorPayload: AggregatePrior | null = null;
  if (prior != null) {
    priorPayload = {
      totals: {
        sessions: prior.length,
        tokens_in: sumField(prior, (r) => r.session.total_tokens_in),
        tokens_out: sumField(prior, (r) => r.session.total_tokens_out),
        duration_seconds: sumField(prior, (r) => r.metrics?.duration_seconds ?? null),
        completions: prior.reduce(
          (n, r) => (r.session.task_completed ? n + 1 : n),
          0,
        ),
      },
      medians: {
        ttft_seconds: median(
          prior.map((r) => r.metrics?.r_time_to_first_token ?? null),
        ),
        stall_ratio: median(
          prior.map((r) => r.metrics?.rel_stall_ratio ?? null),
        ),
      },
    };
  }

  // ─── KPI sparklines (30 buckets when range === 'all') ──────────────────

  const sparkDays = days ?? 30;
  const sparkSessions = bucketDays(current, sparkDays, now, (b) => ({
    count: b.length,
  })).map((e) => ({ bucket: e.day, count: e.count }));

  const sparkTokens = bucketDays(current, sparkDays, now, (b) => ({
    in: sumField(b, (r) => r.session.total_tokens_in),
    out: sumField(b, (r) => r.session.total_tokens_out),
  })).map((e) => ({ bucket: e.day, in: e.in, out: e.out }));

  const sparkDuration = bucketDays(current, sparkDays, now, (b) => ({
    seconds: sumField(b, (r) => r.metrics?.duration_seconds ?? null),
  })).map((e) => ({ bucket: e.day, seconds: e.seconds }));

  const sparkCompletion = bucketDays(current, sparkDays, now, (b) => {
    const r = completionRate(b);
    return { rate: r == null ? 0 : r * 100 };
  }).map((e) => ({ bucket: e.day, rate: e.rate }));

  const sparkTtft = bucketDays(current, sparkDays, now, (b) => {
    const m = median(b.map((r) => r.metrics?.r_time_to_first_token ?? null));
    return { value: m ?? 0 };
  }).map((e) => ({ bucket: e.day, value: e.value }));

  const sparkStall = bucketDays(current, sparkDays, now, (b) => {
    const m = median(b.map((r) => r.metrics?.rel_stall_ratio ?? null));
    return { value: m ?? 0 };
  }).map((e) => ({ bucket: e.day, value: e.value }));

  // ─── Pillars ────────────────────────────────────────────────────────────

  const pillars: AggregatePillar[] = PILLARS.map((p) => {
    const dist = classifyDistribution(current, p);
    const cur = headlineValue(current, p);
    const pr = prior == null ? null : headlineValue(prior, p);
    const delta =
      cur == null || pr == null || !Number.isFinite(cur) || !Number.isFinite(pr)
        ? null
        : cur - pr;
    return {
      id: p.id,
      good: dist.good,
      fair: dist.fair,
      poor: dist.poor,
      headline: { value: cur, delta },
    };
  });

  // ─── Timelines (full daily resolution over the window) ──────────────────

  const timelineDays = days ?? 90;

  const sessionsPerDay = bucketDays(current, timelineDays, now, (b) => ({
    count: b.length,
  })).map((e) => ({ date: e.day, count: e.count }));

  const tokensPerDay = bucketDays(current, timelineDays, now, (b) => ({
    in: sumField(b, (r) => r.session.total_tokens_in),
    out: sumField(b, (r) => r.session.total_tokens_out),
  })).map((e) => ({ date: e.day, in: e.in, out: e.out }));

  const ttftDaily = bucketDays(current, timelineDays, now, (b) => {
    const xs = b.map((r) => r.metrics?.r_time_to_first_token ?? null);
    return {
      p50: percentile(xs, 0.5),
      p95: percentile(xs, 0.95),
    };
  }).map((e) => ({ date: e.day, p50: e.p50, p95: e.p95 }));

  const stallDaily = bucketDays(current, timelineDays, now, (b) => {
    const m = median(b.map((r) => r.metrics?.rel_stall_ratio ?? null));
    return { value: m };
  }).map((e) => ({ date: e.day, value: e.value }));

  // ─── Distributions ──────────────────────────────────────────────────────

  const contentCounts: Record<ContentType, number> = {
    quick_answer: 0,
    guided_task: 0,
    deep_session: 0,
    autonomous_workflow: 0,
  };
  for (const r of current) {
    contentCounts[inferContentType(r.session)] += 1;
  }

  const endReasonCounts: Record<EndReasonBucket, number> = {
    completed: 0,
    user_cancelled: 0,
    error: 0,
    timeout: 0,
    other: 0,
  };
  for (const r of current) {
    endReasonCounts[normalizeEndReason(r.session.end_reason)] += 1;
  }

  const toolCatCounts: Record<ToolCategoryBucket, number> = {
    execution: 0,
    file_system: 0,
    browser: 0,
    other: 0,
  };
  for (const r of current) {
    const counts = r.tool_category_counts;
    for (const [cat, n] of Object.entries(counts)) {
      if (!Number.isFinite(n) || n <= 0) continue;
      if (cat === 'execution') toolCatCounts.execution += n;
      else if (cat === 'file_system') toolCatCounts.file_system += n;
      else if (cat === 'browser') toolCatCounts.browser += n;
      else toolCatCounts.other += n;
    }
  }

  const distributions: AggregateDistributions = {
    content_type: CONTENT_TYPE_ORDER.map((k) => ({
      label: k,
      count: contentCounts[k],
    })),
    end_reason: END_REASON_ORDER.map((k) => ({
      label: k,
      count: endReasonCounts[k],
    })),
    tool_category: TOOL_CATEGORY_ORDER.map((k) => ({
      label: k,
      count: toolCatCounts[k],
    })),
  };

  // ─── Tool performance ───────────────────────────────────────────────────

  const merged = mergeToolStats(current);
  const topTools: Array<{ tool: string; count: number }> = [];
  for (const [tool, s] of merged.entries()) {
    if (s.calls > 0) topTools.push({ tool, count: s.calls });
  }
  topTools.sort(
    (a, b) => b.count - a.count || a.tool.localeCompare(b.tool),
  );

  const successRates: Array<{ tool: string; rate: number; n: number }> = [];
  for (const [tool, s] of merged.entries()) {
    if (s.calls < 5) continue;
    const completed = s.successes + s.failures;
    if (completed <= 0) continue;
    successRates.push({
      tool,
      rate: s.successes / completed,
      n: s.calls,
    });
  }
  // Ascending by rate (worst first), ties broken by higher call count then
  // tool name — identical to the UI aggregator.
  successRates.sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    if (a.n !== b.n) return b.n - a.n;
    return a.tool.localeCompare(b.tool);
  });

  const toolPerformance: AggregateToolPerformance = {
    top_tools: topTools.slice(0, 10),
    success_rates: successRates,
  };

  // ─── Heatmap ────────────────────────────────────────────────────────────

  const heatmap = { cells: buildHeatmap(current) };

  // ─── Breakdowns ─────────────────────────────────────────────────────────

  function breakdown(
    rows: SessionRow[],
    pick: (r: SessionRow) => string | null | undefined,
    topN: number,
  ): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const raw = pick(r);
      const key = raw == null || raw === '' ? 'unknown' : raw;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const arr = Array.from(counts.entries()).map(([label, count]) => ({
      label,
      count,
    }));
    arr.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return arr.slice(0, topN);
  }

  const breakdowns: AggregateBreakdowns = {
    agents: breakdown(current, (r) => r.session.agent_name, 10),
    models: breakdown(current, (r) => r.session.model_id, 10),
  };

  // ─── Session table (top 50 most recent) ─────────────────────────────────

  const sorted = current.slice().sort((a, b) => {
    const ta = Date.parse(a.session.started_at);
    const tb = Date.parse(b.session.started_at);
    return tb - ta;
  });
  const sessionsTable: AggregateSessionTableRow[] = sorted
    .slice(0, 50)
    .map((r) => ({ session: r.session, metrics: r.metrics }));

  // ─── Assemble payload ───────────────────────────────────────────────────

  return {
    range,
    generated_at: new Date(now).toISOString(),
    window: {
      start: startMs == null ? new Date(0).toISOString() : new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      days,
    },
    totals,
    medians,
    prior: priorPayload,
    kpi_sparklines: {
      sessions: sparkSessions,
      tokens: sparkTokens,
      duration: sparkDuration,
      completion: sparkCompletion,
      ttft_median: sparkTtft,
      stall_median: sparkStall,
    },
    pillars,
    timelines: {
      sessions_per_day: sessionsPerDay,
      tokens_per_day: tokensPerDay,
      ttft_p50_p95: ttftDaily,
      stall_ratio_median: stallDaily,
    },
    distributions,
    tool_performance: toolPerformance,
    heatmap,
    breakdowns,
    sessions_table: sessionsTable,
  };
}

// Re-export a small helper for the handler to signal percentage deltas
// identically when it assembles the final JSON (kept here so any consumer
// can compute compatible numbers without re-importing from the UI).
export { pctDelta };
