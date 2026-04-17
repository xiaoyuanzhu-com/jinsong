/**
 * Pillar definitions for the dashboard's "Pillar Health" row.
 *
 * Each of the five AX pillars (Responsiveness, Reliability, Autonomy,
 * Correctness, Completion) has a single headline metric, a Good/Fair/Poor
 * threshold set, and an aggregator used to compute the window-wide value.
 *
 * Thresholds mirror `metrics.md §2` exactly. Keep this file as the single
 * source of truth on the client — if the spec changes, update it here and
 * every card updates in lockstep.
 *
 * Autonomy and Correctness currently reference fields not yet emitted by the
 * ingest pipeline (`a_user_active_time_pct`, `c_clean_output_rate`). Until
 * those land we extract `null` for every session, which surfaces as "—"
 * headlines and empty grey rings — the intended graceful-degradation path.
 */
import type { SessionRow } from './api'
import { median } from './aggregate'

export type PillarId =
  | 'responsiveness'
  | 'reliability'
  | 'autonomy'
  | 'correctness'
  | 'completion'

export type Classification = 'good' | 'fair' | 'poor' | 'na'

export interface Distribution {
  good: number
  fair: number
  poor: number
  total: number
}

export interface PillarDef {
  id: PillarId
  name: string
  tagline: string
  /** How to aggregate per-session values into one window headline number. */
  aggregator: 'median' | 'mean' | 'completion_rate'
  /** Higher is better? Controls trend-arrow color. */
  direction: 'up-is-good' | 'down-is-good'
  /**
   * Per-session metric extractor. Return null to exclude that session from
   * both the donut and the headline aggregate.
   *
   * For the `completion_rate` aggregator, each session returns 1 or 0 and the
   * aggregator produces the fraction; individual sessions still classify
   * Good (completed) vs Poor (not completed) for the donut.
   */
  extract: (row: SessionRow) => number | null
  /** Classify a single per-session value (same units as `extract`). */
  classify: (v: number | null) => Classification
  /** Format the window-wide aggregated headline value. */
  formatHeadline: (v: number | null) => string
  /**
   * Format the absolute delta between current and prior aggregates as shown
   * next to the trend arrow (e.g. "0.3s", "2.1%"). Magnitude only — the
   * card renders the arrow separately.
   */
  formatDelta: (absDelta: number) => string
}

// ─── Thresholds (from metrics.md §2) ───────────────────────────────────────

const TTFT_GOOD_S = 2
const TTFT_FAIR_S = 5
const STALL_GOOD = 0.1
const STALL_FAIR = 0.2
const ACTIVE_GOOD_PCT = 10
const ACTIVE_FAIR_PCT = 30
const CLEAN_GOOD = 0.95
const CLEAN_FAIR = 0.8
// Completion thresholds (85% / 60%) apply to the *window-level* rate, not
// to individual sessions. Per-session completion is binary (1 or 0), so the
// donut uses a simple completed=Good / not=Poor rule (see the pillar def
// below). Window-rate thresholds inform the interpretation of the headline
// value but aren't a direct classifier — kept here as documentation.

// ─── Formatters ────────────────────────────────────────────────────────────

function fmtSeconds(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v < 1) return `${Math.round(v * 1000)}ms`
  return `${v.toFixed(1)}s`
}

function fmtSecondsDelta(abs: number): string {
  if (!Number.isFinite(abs)) return '—'
  if (abs < 1) return `${Math.round(abs * 1000)}ms`
  return `${abs.toFixed(1)}s`
}

function fmtRatioPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const pct = v * 100
  return Math.abs(pct) < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

function fmtRatioPctDelta(abs: number): string {
  if (!Number.isFinite(abs)) return '—'
  const pct = abs * 100
  return Math.abs(pct) < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

function fmtPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.abs(v) < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`
}

function fmtPercentDelta(abs: number): string {
  if (!Number.isFinite(abs)) return '—'
  return Math.abs(abs) < 10 ? `${abs.toFixed(1)}%` : `${Math.round(abs)}%`
}

// ─── Per-pillar extractors ─────────────────────────────────────────────────

/**
 * Optional field accessor with runtime null/NaN guarding.
 * Extra `unknown` cast because Autonomy/Correctness reach for fields not
 * yet present on `SessionMetrics` — they'll always resolve to `null`
 * until the ingest pipeline starts emitting them.
 */
function pick(row: SessionRow, key: string): number | null {
  const m = row.metrics as unknown as Record<string, unknown> | null
  if (!m) return null
  const v = m[key]
  if (typeof v !== 'number') return null
  if (!Number.isFinite(v)) return null
  return v
}

// ─── Pillar definitions ────────────────────────────────────────────────────

export const PILLARS: PillarDef[] = [
  {
    id: 'responsiveness',
    name: 'Responsiveness',
    tagline: 'Is it fast?',
    aggregator: 'median',
    direction: 'down-is-good',
    extract: (r) => pick(r, 'r_time_to_first_token'),
    classify: (v) => {
      if (v == null) return 'na'
      if (v <= TTFT_GOOD_S) return 'good'
      if (v <= TTFT_FAIR_S) return 'fair'
      return 'poor'
    },
    formatHeadline: fmtSeconds,
    formatDelta: fmtSecondsDelta,
  },
  {
    id: 'reliability',
    name: 'Reliability',
    tagline: 'Does it work?',
    aggregator: 'median',
    direction: 'down-is-good',
    extract: (r) => pick(r, 'rel_stall_ratio'),
    classify: (v) => {
      if (v == null) return 'na'
      if (v <= STALL_GOOD) return 'good'
      if (v <= STALL_FAIR) return 'fair'
      return 'poor'
    },
    formatHeadline: fmtRatioPct,
    formatDelta: fmtRatioPctDelta,
  },
  {
    id: 'autonomy',
    name: 'Autonomy',
    tagline: 'Can it run alone?',
    aggregator: 'mean',
    direction: 'down-is-good',
    // Headline field: user_active_time_pct (percent, 0..100). Not yet
    // emitted by the pipeline → always null → graceful "—" state.
    extract: (r) => pick(r, 'a_user_active_time_pct'),
    classify: (v) => {
      if (v == null) return 'na'
      if (v <= ACTIVE_GOOD_PCT) return 'good'
      if (v <= ACTIVE_FAIR_PCT) return 'fair'
      return 'poor'
    },
    formatHeadline: fmtPercent,
    formatDelta: fmtPercentDelta,
  },
  {
    id: 'correctness',
    name: 'Correctness',
    tagline: 'Is it right?',
    aggregator: 'mean',
    direction: 'up-is-good',
    // Fraction 0..1. Not yet emitted by the pipeline → null for now.
    extract: (r) => pick(r, 'c_clean_output_rate'),
    classify: (v) => {
      if (v == null) return 'na'
      if (v >= CLEAN_GOOD) return 'good'
      if (v >= CLEAN_FAIR) return 'fair'
      return 'poor'
    },
    formatHeadline: fmtRatioPct,
    formatDelta: fmtRatioPctDelta,
  },
  {
    id: 'completion',
    name: 'Completion',
    tagline: 'Did it finish?',
    aggregator: 'completion_rate',
    direction: 'up-is-good',
    // Per-session value is 1 (completed) or 0 (not). Classification is
    // therefore binary: Good if completed, Poor otherwise. The headline
    // aggregator turns the binary sequence into a rate (percent).
    extract: (r) => (r.session.task_completed ? 1 : 0),
    classify: (v) => {
      if (v == null) return 'na'
      return v >= 1 ? 'good' : 'poor'
    },
    formatHeadline: (v) => {
      if (v == null || !Number.isFinite(v)) return '—'
      return Math.abs(v) < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`
    },
    formatDelta: fmtPercentDelta,
  },
]

// ─── Aggregation helpers ───────────────────────────────────────────────────

/**
 * Count per-session Good/Fair/Poor classifications for a pillar across the
 * given window. Sessions with a null extract are excluded from `total`.
 */
export function classifyDistribution(
  rows: SessionRow[],
  pillar: PillarDef,
): Distribution {
  let good = 0
  let fair = 0
  let poor = 0
  for (const r of rows) {
    const v = pillar.extract(r)
    const c = pillar.classify(v)
    if (c === 'good') good++
    else if (c === 'fair') fair++
    else if (c === 'poor') poor++
  }
  return { good, fair, poor, total: good + fair + poor }
}

/**
 * Compute the pillar's window-wide headline value. Returns null when the
 * aggregator has nothing to work with (all extracts were null).
 *
 * `completion_rate`: percent of sessions completed. Always has something
 * to report once the window has any rows — `task_completed` is never null.
 */
export function headlineValue(
  rows: SessionRow[],
  pillar: PillarDef,
): number | null {
  if (rows.length === 0) return null

  if (pillar.aggregator === 'completion_rate') {
    // 1/0 per session — collapse to a percent.
    let done = 0
    let seen = 0
    for (const r of rows) {
      const v = pillar.extract(r)
      if (v == null) continue
      seen++
      if (v >= 1) done++
    }
    if (seen === 0) return null
    return (done / seen) * 100
  }

  const vals: Array<number | null> = rows.map((r) => pillar.extract(r))

  if (pillar.aggregator === 'median') {
    return median(vals)
  }

  // mean
  let sum = 0
  let n = 0
  for (const v of vals) {
    if (v == null || !Number.isFinite(v)) continue
    sum += v
    n++
  }
  if (n === 0) return null
  return sum / n
}

/** Absolute delta between current and prior aggregates. Null-safe. */
export function headlineDelta(
  current: number | null,
  prior: number | null,
): number | null {
  if (current == null || prior == null) return null
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null
  return current - prior
}
