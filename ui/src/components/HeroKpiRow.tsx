import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCard, type Direction } from '@/components/KpiCard'
import { ErrorCard } from '@/components/RowStates'
import { useRange } from '@/context/RangeContext'
import { useDashboardData } from '@/context/DashboardDataContext'
import { rangeToDays } from '@/lib/range'
import type { DailyBucket } from '@/lib/aggregate'

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

/** Percent delta between current and prior scalars. Null when prior is
 *  zero/null or either side is non-finite. */
function pctDelta(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null) return null
  if (!Number.isFinite(current) || !Number.isFinite(prior)) return null
  if (prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

// ─── Loading skeleton ──────────────────────────────────────────────────────

function SkeletonCard() {
  // Heights match the final KpiCard so the grid doesn't reflow on load:
  // 12px label · 32px value · 32px sparkline slot · 16px delta.
  return (
    <Card className="p-5">
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
 * dashboard. Reads the precomputed payload from `DashboardDataContext`
 * (DASH-11); each card's `{value, delta, sparkline}` is pulled directly
 * from the aggregate — no client-side bucketing left here.
 */
export function HeroKpiRow() {
  const { range } = useRange()
  const { data, isLoading, error, retry } = useDashboardData()

  const kpis = useMemo(() => {
    if (!data) return null
    const t = data.totals
    const p = data.prior

    // Sparklines arrive as `{bucket, <field>}`; KpiCard wants `{day, value}`.
    function toBuckets<T>(
      src: Array<{ bucket: string } & T>,
      pick: (r: { bucket: string } & T) => number,
    ): DailyBucket[] {
      return src.map((r) => ({ day: r.bucket, value: pick(r) }))
    }

    const sparkSessions = toBuckets(data.kpi_sparklines.sessions, (r) => r.count)
    const sparkTokens = toBuckets(
      data.kpi_sparklines.tokens,
      (r) => r.in + r.out,
    )
    const sparkDuration = toBuckets(
      data.kpi_sparklines.duration,
      (r) => r.seconds,
    )
    const sparkCompletion = toBuckets(
      data.kpi_sparklines.completion,
      (r) => r.rate,
    )
    const sparkTtft = toBuckets(data.kpi_sparklines.ttft_median, (r) => r.value)
    const sparkStall = toBuckets(
      data.kpi_sparklines.stall_median,
      (r) => r.value,
    )

    const curTokens = t.tokens_in + t.tokens_out
    const prTokens = p ? p.totals.tokens_in + p.totals.tokens_out : null
    const curCompletion =
      t.sessions === 0 ? null : t.completions / t.sessions
    const prCompletion =
      p == null
        ? null
        : p.totals.sessions === 0
          ? null
          : p.totals.completions / p.totals.sessions

    return {
      sessions: {
        value: formatInt(t.sessions),
        delta: pctDelta(t.sessions, p?.totals.sessions ?? null),
        spark: sparkSessions,
      },
      tokens: {
        value: formatTokens(curTokens),
        delta: pctDelta(curTokens, prTokens),
        spark: sparkTokens,
      },
      duration: {
        value: formatDurationSeconds(t.duration_seconds),
        delta: pctDelta(t.duration_seconds, p?.totals.duration_seconds ?? null),
        spark: sparkDuration,
      },
      completion: {
        value: curCompletion == null ? '—' : formatPct(curCompletion),
        delta: pctDelta(curCompletion, prCompletion),
        spark: sparkCompletion,
      },
      ttft: {
        value:
          data.medians.ttft_seconds == null
            ? '—'
            : formatSeconds(data.medians.ttft_seconds),
        delta: pctDelta(
          data.medians.ttft_seconds,
          p?.medians.ttft_seconds ?? null,
        ),
        spark: sparkTtft,
      },
      stall: {
        value:
          data.medians.stall_ratio == null
            ? '—'
            : formatPct(data.medians.stall_ratio),
        delta: pctDelta(
          data.medians.stall_ratio,
          p?.medians.stall_ratio ?? null,
        ),
        spark: sparkStall,
      },
    }
  }, [data])

  const deltaSuffix = useMemo(() => {
    const days = rangeToDays(range)
    return days == null ? 'vs prev' : `vs prev ${days}d`
  }, [range])

  const gridClass = 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'

  // Row-level error — replace the 6-card grid with a single Retry card.
  if (error && !isLoading && !data) {
    return (
      <section aria-label="Key metrics">
        <ErrorCard message={error} onRetry={retry} />
      </section>
    )
  }

  // Loading state — 6 skeleton cards that preserve the row's layout footprint.
  if (isLoading || !data) {
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

  if (data.totals.sessions === 0 || kpis == null) {
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
