/**
 * Client-side mirror of the `/api/aggregate` response shape.
 *
 * Intentionally duplicated from `src/aggregate/dashboard.ts` (server) so
 * the UI bundle stays self-contained — no Vite import of server-only
 * modules and no node_modules shared dependency. Keep these in sync when
 * the server payload changes; a mismatch surfaces at compile time on the
 * row components that consume specific fields.
 */

import type { Session, SessionMetrics } from './api'

export type Range = '7d' | '30d' | '90d' | 'all'

export interface AggregateTotals {
  sessions: number
  tokens_in: number
  tokens_out: number
  duration_seconds: number
  completions: number
}

export interface AggregateMedians {
  ttft_seconds: number | null
  stall_ratio: number | null
}

export interface AggregatePrior {
  totals: AggregateTotals
  medians: AggregateMedians
}

export interface AggregateSparklineBucket {
  bucket: string
  count: number
}
export interface AggregateTokenBucket {
  bucket: string
  in: number
  out: number
}
export interface AggregateDurationBucket {
  bucket: string
  seconds: number
}
export interface AggregateRateBucket {
  bucket: string
  rate: number
}
export interface AggregateScalarBucket {
  bucket: string
  value: number
}

export type PillarId =
  | 'responsiveness'
  | 'reliability'
  | 'autonomy'
  | 'correctness'
  | 'completion'

export interface AggregatePillar {
  id: PillarId
  good: number
  fair: number
  poor: number
  headline: {
    value: number | null
    delta: number | null
  }
}

export interface AggregateTimelines {
  sessions_per_day: Array<{ date: string; count: number }>
  tokens_per_day: Array<{ date: string; in: number; out: number }>
  ttft_p50_p95: Array<{ date: string; p50: number | null; p95: number | null }>
  stall_ratio_median: Array<{ date: string; value: number | null }>
}

export interface AggregateDistributions {
  content_type: Array<{ label: string; count: number }>
  end_reason: Array<{ label: string; count: number }>
  tool_category: Array<{ label: string; count: number }>
}

export interface AggregateToolPerformance {
  top_tools: Array<{ tool: string; count: number }>
  success_rates: Array<{ tool: string; rate: number; n: number }>
}

export interface AggregateBreakdowns {
  agents: Array<{ label: string; count: number }>
  models: Array<{ label: string; count: number }>
}

export interface AggregateSessionTableRow {
  session: Session
  metrics: SessionMetrics | null
}

export interface AggregateResponse {
  range: Range
  generated_at: string
  window: { start: string; end: string; days: number | null }
  totals: AggregateTotals
  medians: AggregateMedians
  prior: AggregatePrior | null
  kpi_sparklines: {
    sessions: AggregateSparklineBucket[]
    tokens: AggregateTokenBucket[]
    duration: AggregateDurationBucket[]
    completion: AggregateRateBucket[]
    ttft_median: AggregateScalarBucket[]
    stall_median: AggregateScalarBucket[]
  }
  pillars: AggregatePillar[]
  timelines: AggregateTimelines
  distributions: AggregateDistributions
  tool_performance: AggregateToolPerformance
  heatmap: { cells: Array<{ dow: number; hour: number; count: number }> }
  breakdowns: AggregateBreakdowns
  sessions_table: AggregateSessionTableRow[]
}
