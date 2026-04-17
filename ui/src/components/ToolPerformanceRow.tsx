import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarListChart, type BarListDatum } from '@/components/BarListChart'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { filterByRange } from '@/lib/aggregate'
import {
  aggregateToolCounts,
  aggregateToolSuccessRates,
  colorForSuccessRate,
  hasToolStats,
} from '@/lib/tool-stats'

const TOP_N = 10
const MIN_CALLS_FOR_RATE = 5

// ─── Loading skeleton ─────────────────────────────────────────────────────

function BarListSkeletonCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-1 h-3 w-40" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton
              className="h-3 flex-1"
              style={{ maxWidth: `${90 - i * 10}%` }}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Tool Performance row — two side-by-side horizontal bar charts.
 *
 *   Left:  Top 10 tools by call count (descending).
 *   Right: Tools by success rate, worst first, filtered to tools with
 *          >= 5 completed-or-pending calls in the active range.
 *
 * Shares `/api/sessions` with the other rows (DASH-11 will consolidate);
 * renders empty/awaiting states when the server hasn't shipped the
 * `tool_stats` field yet or the window has too few data points.
 */
export function ToolPerformanceRow() {
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
          setRows([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const datasets = useMemo(() => {
    if (rows == null) return null
    const current = filterByRange(rows, range)
    const statsAvailable = hasToolStats(current)

    const topByCount = aggregateToolCounts(current).slice(0, TOP_N)
    const countData: BarListDatum[] = topByCount.map((t) => ({
      label: t.tool,
      value: t.count,
    }))

    const successRates = aggregateToolSuccessRates(
      current,
      MIN_CALLS_FOR_RATE,
    ).slice(0, TOP_N)
    const rateData: BarListDatum[] = successRates.map((t) => ({
      label: t.tool,
      // Store as 0..100 so the X-axis / label math stay integer-friendly.
      value: Math.round((t.rate ?? 0) * 1000) / 10,
      secondary: t.calls,
    }))

    return { countData, rateData, statsAvailable }
  }, [rows, range])

  const gridClass = 'grid grid-cols-1 gap-3 lg:grid-cols-2'

  return (
    <section aria-label="Tool performance">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Tool performance
      </h2>

      {datasets == null ? (
        <div className={gridClass}>
          <BarListSkeletonCard />
          <BarListSkeletonCard />
        </div>
      ) : (
        <div className={gridClass}>
          <BarListChart
            title="Top tools"
            description="By invocation count"
            data={datasets.countData}
            formatValue={(d) => d.value.toLocaleString()}
            emptyLabel={
              datasets.statsAvailable
                ? 'No tool calls in this range'
                : 'Awaiting server aggregation'
            }
          />
          <BarListChart
            title="Tools by success rate"
            description="5+ calls in range, lowest first"
            data={datasets.rateData.length >= 2 ? datasets.rateData : []}
            maxValue={100}
            colorFor={(d) => colorForSuccessRate(d.value / 100)}
            formatValue={(d) => {
              const pct = `${d.value.toFixed(d.value < 10 ? 1 : 0)}%`
              const n = d.secondary ?? 0
              return `${pct} (${n} call${n === 1 ? '' : 's'})`
            }}
            emptyLabel={
              datasets.statsAvailable
                ? 'Not enough data'
                : 'Awaiting server aggregation'
            }
          />
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-muted-foreground">
          Failed to load sessions: {error}
        </div>
      )}
    </section>
  )
}
