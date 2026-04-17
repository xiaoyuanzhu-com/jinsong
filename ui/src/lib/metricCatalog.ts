/**
 * Per-session metric catalog (DASH-10).
 *
 * Definitive UI-side list of every metric shown on the session detail page.
 * Six groups:
 *   - operational      : 12 session-level + per-event operational counters
 *                        (metrics.md §1.1 + §1.2)
 *   - responsiveness   : 4 experience metrics (metrics.md §2.1)
 *   - reliability      : 6 experience metrics (metrics.md §2.2)
 *   - autonomy         : 5 experience metrics (metrics.md §2.3)
 *   - correctness      : 4 experience metrics (metrics.md §2.4)
 *   - completion       : 6 experience metrics (metrics.md §2.5)
 *
 * Every entry is self-contained: extractor (null = missing → "—"), formatter
 * for the rendered value, and an optional threshold classifier that drives
 * the Good/Fair/Poor pill. Thresholds mirror metrics.md §2 exactly; the
 * operational group has no pills by design (raw counters are not scored).
 *
 * Adding a new metric? Extend `Metric` with the extractor + formatter.
 * The detail page iterates this list — no other files need to change.
 */
import type { SessionRow, SessionMetrics } from './api'

export type MetricGroup =
  | 'operational'
  | 'responsiveness'
  | 'reliability'
  | 'autonomy'
  | 'correctness'
  | 'completion'

export type Verdict = 'good' | 'fair' | 'poor' | null

export interface Metric {
  id: string
  label: string
  /** Optional short note rendered as muted secondary text under the label. */
  note?: string
  group: MetricGroup
  /** Pull a raw numeric (or string) value. Return null for "missing — render —". */
  extract: (row: SessionRow) => number | string | null
  /** Format the raw value for display. Gets whatever `extract` returned. */
  format: (v: number | string | null) => string
  /**
   * Classify a raw value into a threshold pill. Return null when no threshold
   * exists for this metric (operational counters, diagnostic distributions
   * like `where_they_gave_up`, or when the input is missing).
   */
  classify?: (v: number | string | null) => Verdict
}

// ─── Formatters ────────────────────────────────────────────────────────────

const dash = '—'

function fmtInt(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  return Math.round(v).toLocaleString('en-US')
}

function fmtSeconds(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  if (v < 1) return `${Math.round(v * 1000)}ms`
  if (v < 60) return `${v.toFixed(1)}s`
  const m = Math.floor(v / 60)
  const s = Math.round(v % 60)
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function fmtMs(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  if (v < 1000) return `${Math.round(v)}ms`
  return fmtSeconds(v / 1000)
}

/** For values already in percent (0..100). */
function fmtPercent(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  return Math.abs(v) < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`
}

/** For ratios in 0..1 — multiply to percent. */
function fmtRatioPct(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  const pct = v * 100
  return Math.abs(pct) < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

function fmtTokensPerSec(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  return `${v.toFixed(1)} tok/s`
}

function fmtRatio(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  return `${v.toFixed(2)}x`
}

function fmtScore01(v: number | string | null): string {
  if (v == null || typeof v === 'string' || !Number.isFinite(v)) return dash
  return v.toFixed(2)
}

function fmtText(v: number | string | null): string {
  if (v == null) return dash
  if (typeof v === 'string') return v
  return String(v)
}

// ─── Extractors ────────────────────────────────────────────────────────────

// Field accessor with runtime null/NaN guarding. Reads off a loose
// `Record<string, unknown>` view so we can mention fields that are optional
// on `SessionMetrics` (and may be missing on older ingest pipelines).
function mnum(m: SessionMetrics | null, key: string): number | null {
  if (!m) return null
  const v = (m as unknown as Record<string, unknown>)[key]
  if (typeof v !== 'number') return null
  if (!Number.isFinite(v)) return null
  return v
}

function mstr(m: SessionMetrics | null, key: string): string | null {
  if (!m) return null
  const v = (m as unknown as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : null
}

// ─── Threshold classifiers ─────────────────────────────────────────────────

function downIsGood(good: number, fair: number) {
  return (v: number | string | null): Verdict => {
    if (v == null || typeof v === 'string' || !Number.isFinite(v)) return null
    if (v < good) return 'good'
    if (v <= fair) return 'fair'
    return 'poor'
  }
}

function upIsGood(good: number, fair: number) {
  return (v: number | string | null): Verdict => {
    if (v == null || typeof v === 'string' || !Number.isFinite(v)) return null
    if (v > good) return 'good'
    if (v >= fair) return 'fair'
    return 'poor'
  }
}

/** Discrete count buckets: good = ≤ goodMax, fair = in [goodMax+1, fairMax]. */
function countBuckets(goodMax: number, fairMax: number) {
  return (v: number | string | null): Verdict => {
    if (v == null || typeof v === 'string' || !Number.isFinite(v)) return null
    if (v <= goodMax) return 'good'
    if (v <= fairMax) return 'fair'
    return 'poor'
  }
}

// ─── Catalog ───────────────────────────────────────────────────────────────

/**
 * Complete metric list. Order within each group is metrics.md's order; the
 * detail page renders groups in the order declared in GROUPS below.
 */
export const METRICS: Metric[] = [
  // Operational — session level (§1.1, 6)
  {
    id: 'tokens_per_session',
    label: 'Tokens per Session',
    note: 'input + output + reasoning',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'tokens_per_session'),
    format: fmtInt,
  },
  {
    id: 'turns_per_session',
    label: 'Turns per Session',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'turns_per_session'),
    format: fmtInt,
  },
  {
    id: 'tool_calls_per_session',
    label: 'Tool Calls per Session',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'tool_calls_per_session'),
    format: fmtInt,
  },
  {
    id: 'duration_seconds',
    label: 'Duration per Session',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'duration_seconds'),
    format: fmtSeconds,
  },
  {
    id: 'errors_per_session',
    label: 'Errors per Session',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'errors_per_session'),
    format: fmtInt,
  },
  {
    id: 'time_per_turn_avg',
    label: 'Avg Time per Turn',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'time_per_turn_avg'),
    format: fmtSeconds,
  },

  // Operational — per-event aggregates (§1.2, 6). `time_to_first_token` also
  // appears in Responsiveness per metrics.md; shown here as the raw aggregate.
  {
    id: 'time_to_first_token',
    label: 'Time to First Token (raw)',
    note: 'per-event latency, no threshold',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'time_to_first_token'),
    format: fmtSeconds,
  },
  {
    id: 'tokens_per_turn_avg',
    label: 'Avg Tokens per Turn',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'tokens_per_turn_avg'),
    format: fmtInt,
  },
  {
    id: 'tool_call_duration_ms_avg',
    label: 'Avg Tool Call Duration',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'tool_call_duration_ms_avg'),
    format: fmtMs,
  },
  {
    id: 'tool_success_rate',
    label: 'Tool Success Rate',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'tool_success_rate'),
    format: fmtRatioPct,
  },
  {
    id: 'retry_count_total',
    label: 'Retry Count (total)',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'retry_count_total'),
    format: fmtInt,
  },
  {
    id: 'stall_duration_ms_avg',
    label: 'Avg Stall Duration',
    group: 'operational',
    extract: (r) => mnum(r.metrics, 'stall_duration_ms_avg'),
    format: fmtMs,
  },

  // Responsiveness (§2.1, 4)
  {
    id: 'r_time_to_first_token',
    label: 'Time to First Token',
    group: 'responsiveness',
    extract: (r) => mnum(r.metrics, 'r_time_to_first_token'),
    format: fmtSeconds,
    classify: downIsGood(2, 5),
  },
  {
    id: 'r_output_speed',
    label: 'Output Speed',
    group: 'responsiveness',
    extract: (r) => mnum(r.metrics, 'r_output_speed'),
    format: fmtTokensPerSec,
    classify: upIsGood(40, 15),
  },
  {
    id: 'r_resume_speed',
    label: 'Resume Speed',
    group: 'responsiveness',
    extract: (r) => mnum(r.metrics, 'r_resume_speed'),
    format: fmtSeconds,
    classify: downIsGood(2, 5),
  },
  {
    id: 'r_time_per_turn',
    label: 'Time per Turn',
    group: 'responsiveness',
    extract: (r) => mnum(r.metrics, 'r_time_per_turn'),
    format: fmtSeconds,
    classify: downIsGood(10, 30),
  },

  // Reliability (§2.2, 6) — per-session values.
  // start_failure_rate / error_rate / hidden_retries thresholds in metrics.md
  // §2.2 are expressed at window level (% or counts per session); we apply
  // the count boundaries per-session where the spec reads them as such, and
  // use a simple 0/>0 split for rates that don't make sense on a single row.
  {
    id: 'rel_start_failure_rate',
    label: 'Start Failure Rate',
    group: 'reliability',
    extract: (r) => mnum(r.metrics, 'rel_start_failure_rate'),
    format: fmtRatioPct,
    // Per-session this is 0 or 1; spec boundaries (<1% good / >5% poor) only
    // make sense aggregated. Flag any non-zero as "poor" for this one session.
    classify: (v) => {
      if (v == null || typeof v === 'string' || !Number.isFinite(v)) return null
      return v === 0 ? 'good' : 'poor'
    },
  },
  {
    id: 'rel_stall_ratio',
    label: 'Stall Ratio',
    group: 'reliability',
    extract: (r) => mnum(r.metrics, 'rel_stall_ratio'),
    format: fmtRatioPct,
    // Ratios in 0..1 → thresholds 10% / 20% become 0.10 / 0.20.
    classify: downIsGood(0.1, 0.2),
  },
  {
    id: 'rel_stall_count',
    label: 'Stall Count',
    group: 'reliability',
    extract: (r) => mnum(r.metrics, 'rel_stall_count'),
    format: fmtInt,
    classify: countBuckets(3, 10),
  },
  {
    id: 'rel_avg_stall_duration',
    label: 'Avg Stall Duration',
    group: 'reliability',
    extract: (r) => mnum(r.metrics, 'rel_avg_stall_duration'),
    format: fmtSeconds,
    classify: downIsGood(2, 5),
  },
  {
    id: 'rel_error_rate',
    label: 'Error Rate',
    note: 'errors per session',
    group: 'reliability',
    extract: (r) => mnum(r.metrics, 'rel_error_rate'),
    format: fmtInt,
    classify: countBuckets(0, 2),
  },
  {
    id: 'rel_hidden_retries',
    label: 'Hidden Retries',
    group: 'reliability',
    extract: (r) => mnum(r.metrics, 'rel_hidden_retries'),
    format: fmtInt,
    classify: countBuckets(0, 3),
  },

  // Autonomy (§2.3, 5)
  {
    id: 'a_questions_asked',
    label: 'Questions Asked',
    group: 'autonomy',
    extract: (r) => mnum(r.metrics, 'a_questions_asked'),
    format: fmtInt,
    classify: countBuckets(0, 2),
  },
  {
    id: 'a_user_corrections',
    label: 'User Corrections',
    group: 'autonomy',
    extract: (r) => mnum(r.metrics, 'a_user_corrections'),
    format: fmtInt,
    classify: countBuckets(0, 1),
  },
  {
    id: 'a_first_try_success_rate',
    label: 'First-Try Success Rate',
    group: 'autonomy',
    extract: (r) => mnum(r.metrics, 'a_first_try_success_rate'),
    // Per-session this is 0 or 1; formatter shows % to match spec.
    format: fmtRatioPct,
    classify: (v) => {
      if (v == null || typeof v === 'string' || !Number.isFinite(v)) return null
      return v >= 1 ? 'good' : 'poor'
    },
  },
  {
    id: 'a_user_active_time_pct',
    label: 'User Active Time %',
    group: 'autonomy',
    extract: (r) => mnum(r.metrics, 'a_user_active_time_pct'),
    format: fmtPercent,
    classify: downIsGood(10, 30),
  },
  {
    id: 'a_work_multiplier',
    label: 'Work Multiplier',
    group: 'autonomy',
    extract: (r) => mnum(r.metrics, 'a_work_multiplier'),
    format: fmtRatio,
    classify: upIsGood(10, 3),
  },

  // Correctness (§2.4, 4)
  {
    id: 'c_output_quality_score',
    label: 'Output Quality Score',
    note: 'L4 judge — not yet emitted',
    group: 'correctness',
    extract: (r) => mnum(r.metrics, 'c_output_quality_score'),
    format: fmtScore01,
    classify: upIsGood(0.85, 0.6),
  },
  {
    id: 'c_clean_output_rate',
    label: 'Clean Output Rate',
    group: 'correctness',
    extract: (r) => mnum(r.metrics, 'c_clean_output_rate'),
    format: fmtRatioPct,
    classify: upIsGood(0.95, 0.8),
  },
  {
    id: 'c_quality_decay',
    label: 'Quality Decay',
    note: 'L4 judge — not yet emitted',
    group: 'correctness',
    extract: (r) => mnum(r.metrics, 'c_quality_decay'),
    format: fmtScore01,
    classify: upIsGood(0.9, 0.7),
  },
  {
    id: 'c_useful_token_pct',
    label: 'Useful Token %',
    group: 'correctness',
    extract: (r) => mnum(r.metrics, 'c_useful_token_pct'),
    format: fmtPercent,
    classify: upIsGood(30, 15),
  },

  // Completion (§2.5, 6)
  {
    id: 'comp_task_completion_rate',
    label: 'Task Completion Rate',
    group: 'completion',
    extract: (r) => mnum(r.metrics, 'comp_task_completion_rate'),
    // Per-session value is 0 or 1. Spec boundaries (>85% / <60%) apply to
    // window-rate; per-session collapse to binary.
    format: fmtRatioPct,
    classify: (v) => {
      if (v == null || typeof v === 'string' || !Number.isFinite(v)) return null
      return v >= 1 ? 'good' : 'poor'
    },
  },
  {
    id: 'comp_redo_rate',
    label: 'Redo Rate',
    group: 'completion',
    extract: (r) => mnum(r.metrics, 'comp_redo_rate'),
    format: fmtRatioPct,
    classify: downIsGood(0.05, 0.15),
  },
  {
    id: 'comp_gave_up_rate',
    label: 'Gave-Up Rate',
    group: 'completion',
    extract: (r) => mnum(r.metrics, 'comp_gave_up_rate'),
    format: fmtRatioPct,
    classify: downIsGood(0.05, 0.15),
  },
  {
    id: 'comp_where_they_gave_up',
    label: 'Where They Gave Up',
    note: 'diagnostic only, no threshold',
    group: 'completion',
    extract: (r) => mstr(r.metrics, 'comp_where_they_gave_up'),
    format: fmtText,
  },
  {
    id: 'comp_time_to_done',
    label: 'Time to Done',
    note: 'threshold depends on content_type',
    group: 'completion',
    extract: (r) => mnum(r.metrics, 'comp_time_to_done'),
    format: fmtSeconds,
  },
  {
    id: 'comp_came_back_rate',
    label: 'Came Back Rate',
    note: 'user-level; not per-session',
    group: 'completion',
    extract: (r) => mnum(r.metrics, 'comp_came_back_rate'),
    format: fmtRatioPct,
  },
]

export interface GroupMeta {
  id: MetricGroup
  name: string
  tagline: string
}

/** Render order for the detail page: operational first, then five pillars. */
export const GROUPS: GroupMeta[] = [
  {
    id: 'operational',
    name: 'Operational',
    tagline: 'Raw counters and aggregates',
  },
  { id: 'responsiveness', name: 'Responsiveness', tagline: 'Is it fast?' },
  { id: 'reliability', name: 'Reliability', tagline: 'Does it work?' },
  { id: 'autonomy', name: 'Autonomy', tagline: 'Can it run alone?' },
  { id: 'correctness', name: 'Correctness', tagline: 'Is it right?' },
  { id: 'completion', name: 'Completion', tagline: 'Did it finish?' },
]

export function metricsForGroup(g: MetricGroup): Metric[] {
  return METRICS.filter((m) => m.group === g)
}
