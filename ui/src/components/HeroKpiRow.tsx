import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard, type Direction } from '@/components/KpiCard'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import {
  bucketByDay,
  filterByRange,
  median,
  pctDelta,
  priorWindow,
  rangeToDays,
} from '@/lib/aggregate'

// ─── Formatters ────────────────────────────────────────────────────────────

function formatInt(n: number): string {
  return n.toLocaleString('en-US')
}

/** Compact token/large-number formatter: 1,234 → "1,234"; 45,231 → "45.2K"; 1,234,567 → "1.23M". */
function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs < 1000) return formatInt(Math.round(n))
  if (abs < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  return `${(n / 1_000_000_000).toFixed(2)}B`
}

/** Human duration from seconds: "45s", "48m 32s", "2h 14m", "3d 4h". */
function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const remS = s % 60
  if (m < 60) return remS === 0 ? `${m}m` : `${m}m ${remS}s`
  const h = Math.floor(m / 60)
  const remM = m % 60
  if (h < 24) return remM === 0 ? `${h}h` : `${h}h ${remM}m`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH === 0 ? `${d}d` : `${d}d ${remH}h`
}

/** Percent with 0 or 1 decimal: 84.7 → "85%"; 8.3 → "8.3%". */
function formatPct(ratio01: number): string {
  if (!Number.isFinite(ratio01)) return '—'
  const pct = ratio01 * 100
  return Math.abs(pct) < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

/** Seconds → "1.8s" / "420ms" — TTFT is typically sub-5s. */
function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '—'
  if (s < 1) return `${Math.round(s * 1000)}ms`
  return `${s.toFixed(1)}s`
}

// ─── Aggregators ───────────────────────────────────────────────────────────

function sumField(rows: SessionRow[], picker: (r: SessionRow) => number | null | undefined): number {
  let total = 0
  for (const r of rows) {
    const v = picker(r)
    if (typeof v === 'number' && Number.isFinite(v)) total += v
  }
  return total
}

function completionRate(rows: SessionRow[]): number | null {
  if (rows.length === 0) return null
  let done = 0
  for (const r of rows) if (r.session.task_completed) done++
  return done / rows.length
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-8 w-24" />
      <Skeleton className="mt-2 h-8 w-full" />
      <Skeleton className="mt-2 h-3 w-20" />
    </Card>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Hero KPI row — 6 summary cards with 30-day sparklines at the top of the
 * dashboard. Fetches /api/sessions once on mount and computes all metrics
 * client-side; DASH-11 will move aggregation to /api/aggregate but the
 * cards' props shape stays the same.
 */
export function HeroKpiRow() {
  const { range } = useRange()
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSessions()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setRows([]) // degrade to empty-state rather than permanent skeleton
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = useMemo(() => {
    if (rows == null) return null

    const now = Date.now()
    const current = filterByRange(rows, range, now)
    const prior = priorWindow(rows, range, now)
    const days = rangeToDays(range) ?? 30 // sparkline always shows 30 buckets for "all"

    // Current-window scalars
    const curSessions = current.length
    const curTokens = sumField(current, (r) => r.metrics?.tokens_per_session ?? null)
    const curDuration = sumField(current, (r) => r.metrics?.duration_seconds ?? null)
    const curCompletion = completionRate(current) // ratio 0..1 or null
    const curTtft = median(current.map((r) => r.metrics?.r_time_to_first_token ?? null))
    const curStall = median(current.map((r) => r.metrics?.rel_stall_ratio ?? null))

    // Prior-window scalars (null when range === 'all')
    const hasPrior = prior !== null && prior.length > 0
    const prSessions = hasPrior ? prior!.length : null
    const prTokens = hasPrior ? sumField(prior!, (r) => r.metrics?.tokens_per_session ?? null) : null
    const prDuration = hasPrior ? sumField(prior!, (r) => r.metrics?.duration_seconds ?? null) : null
    const prCompletion = hasPrior ? completionRate(prior!) : null
    const prTtft = hasPrior ? median(prior!.map((r) => r.metrics?.r_time_to_first_token ?? null)) : null
    const prStall = hasPrior ? median(prior!.map((r) => r.metrics?.rel_stall_ratio ?? null)) : null

    // Sparklines — every series buckets the same current window.
    const sparkSessions = bucketByDay(current, days, now, (b) => b.length)
    const sparkTokens = bucketByDay(current, days, now, (b) =>
      sumField(b, (r) => r.metrics?.tokens_per_session ?? null),
    )
    const sparkDuration = bucketByDay(current, days, now, (b) =>
      sumField(b, (r) => r.metrics?.duration_seconds ?? null),
    )
    const sparkCompletion = bucketByDay(current, days, now, (b) => {
      const rate = completionRate(b)
      return rate == null ? 0 : rate * 100
    })
    const sparkTtft = bucketByDay(current, days, now, (b) => {
      const m = median(b.map((r) => r.metrics?.r_time_to_first_token ?? null))
      return m ?? 0
    })
    const sparkStall = bucketByDay(current, days, now, (b) => {
      const m = median(b.map((r) => r.metrics?.rel_stall_ratio ?? null))
      return m ?? 0
    })

    return {
      sessions: {
        value: formatInt(curSessions),
        delta: pctDelta(curSessions, prSessions),
        spark: sparkSessions,
      },
      tokens: {
        value: formatTokens(curTokens),
        delta: pctDelta(curTokens, prTokens),
        spark: sparkTokens,
      },
      duration: {
        value: formatDurationSeconds(curDuration),
        delta: pctDelta(curDuration, prDuration),
        spark: sparkDuration,
      },
      completion: {
        value: curCompletion == null ? '—' : formatPct(curCompletion),
        delta: pctDelta(curCompletion, prCompletion),
        spark: sparkCompletion,
      },
      ttft: {
        value: curTtft == null ? '—' : formatSeconds(curTtft),
        delta: pctDelta(curTtft, prTtft),
        spark: sparkTtft,
      },
      stall: {
        value: curStall == null ? '—' : formatPct(curStall),
        delta: pctDelta(curStall, prStall),
        spark: sparkStall,
      },
    }
  }, [rows, range])

  const deltaSuffix = useMemo(() => {
    const days = rangeToDays(range)
    return days == null ? 'vs prev' : `vs prev ${days}d`
  }, [range])

  const gridClass = 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'

  // Loading state — 6 skeleton cards that preserve the row's layout footprint.
  if (rows == null) {
    return (
      <section aria-label="Key metrics" className={gridClass}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
    )
  }

  // Empty state — same 6 slots with em-dashes, no sparkline, no delta.
  const emptyCards: Array<{
    label: string
    direction: Direction
  }> = [
    { label: 'Sessions', direction: 'up-is-good' },
    { label: 'Total Tokens', direction: 'neutral' },
    { label: 'Total Duration', direction: 'neutral' },
    { label: 'Task Completion', direction: 'up-is-good' },
    { label: 'Median TTFT', direction: 'down-is-good' },
    { label: 'Median Stall Ratio', direction: 'down-is-good' },
  ]

  if (rows.length === 0 || kpis == null) {
    return (
      <section aria-label="Key metrics" className={gridClass}>
        {emptyCards.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value="—"
            deltaPct={null}
            direction={c.direction}
            sparklineData={[]}
            deltaSuffix={deltaSuffix}
          />
        ))}
        {error && (
          <div className="col-span-full text-xs text-muted-foreground">
            Failed to load sessions: {error}
          </div>
        )}
      </section>
    )
  }

  return (
    <section aria-label="Key metrics" className={gridClass}>
      <KpiCard
        label="Sessions"
        value={kpis.sessions.value}
        deltaPct={kpis.sessions.delta}
        direction="up-is-good"
        sparklineData={kpis.sessions.spark}
        deltaSuffix={deltaSuffix}
      />
      <KpiCard
        label="Total Tokens"
        value={kpis.tokens.value}
        deltaPct={kpis.tokens.delta}
        direction="neutral"
        sparklineData={kpis.tokens.spark}
        deltaSuffix={deltaSuffix}
      />
      <KpiCard
        label="Total Duration"
        value={kpis.duration.value}
        deltaPct={kpis.duration.delta}
        direction="neutral"
        sparklineData={kpis.duration.spark}
        deltaSuffix={deltaSuffix}
      />
      <KpiCard
        label="Task Completion"
        value={kpis.completion.value}
        deltaPct={kpis.completion.delta}
        direction="up-is-good"
        sparklineData={kpis.completion.spark}
        deltaSuffix={deltaSuffix}
      />
      <KpiCard
        label="Median TTFT"
        value={kpis.ttft.value}
        deltaPct={kpis.ttft.delta}
        direction="down-is-good"
        sparklineData={kpis.ttft.spark}
        deltaSuffix={deltaSuffix}
      />
      <KpiCard
        label="Median Stall Ratio"
        value={kpis.stall.value}
        deltaPct={kpis.stall.delta}
        direction="down-is-good"
        sparklineData={kpis.stall.spark}
        deltaSuffix={deltaSuffix}
      />
    </section>
  )
}

/** Dev-only helper: build synthetic `SessionRow`s so designers can preview
 *  the row without running the ingest pipeline. Not exported into the app. */
export function __buildMockSessionRowsForPreview(days = 30, perDayMax = 12): SessionRow[] {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const rows: SessionRow[] = []
  let seed = 42
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let d = 0; d < days; d++) {
    const count = Math.round(1 + rand() * perDayMax)
    for (let i = 0; i < count; i++) {
      const startedAt = new Date(now - d * DAY - Math.floor(rand() * DAY)).toISOString()
      const durationMs = Math.round(20_000 + rand() * 600_000)
      const tokensIn = Math.round(500 + rand() * 8000)
      const tokensOut = Math.round(500 + rand() * 8000)
      rows.push({
        session: {
          session_id: `mock-${d}-${i}`,
          started_at: startedAt,
          ended_at: new Date(Date.parse(startedAt) + durationMs).toISOString(),
          duration_ms: durationMs,
          total_turns: 1 + Math.floor(rand() * 8),
          total_tool_calls: Math.floor(rand() * 12),
          total_tokens_in: tokensIn,
          total_tokens_out: tokensOut,
          task_completed: rand() > 0.25,
          end_reason: 'completed',
          agent_name: 'mock',
          model_id: 'mock-model',
        },
        metrics: {
          session_id: `mock-${d}-${i}`,
          tokens_per_session: tokensIn + tokensOut,
          turns_per_session: 3,
          tool_calls_per_session: 2,
          duration_seconds: durationMs / 1000,
          errors_per_session: 0,
          time_per_turn_avg: 30,
          r_time_to_first_token: 0.5 + rand() * 3,
          r_output_speed: null,
          r_resume_speed: null,
          r_time_per_turn: 30,
          rel_start_failure_rate: 0,
          rel_stall_ratio: rand() * 0.3,
          rel_stall_count: 0,
          rel_avg_stall_duration: null,
          rel_error_rate: 0,
          comp_task_completion_rate: 1,
        },
      })
    }
  }
  return rows
}
