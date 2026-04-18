import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarListChart, type BarListDatum } from '@/components/BarListChart'
import { SectionHeader } from '@/components/SectionHeader'
import { ErrorCard } from '@/components/RowStates'
import { useDashboardData } from '@/context/DashboardDataContext'
import { colorForSuccessRate } from '@/lib/tool-stats'

const TOP_N = 10

// ─── Loading skeleton ─────────────────────────────────────────────────────

function BarListSkeletonCard() {
  return (
    <Card className="p-5">
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
 * Tool Performance row — two side-by-side horizontal bar charts fed by
 * precomputed `tool_performance` from `/api/aggregate` (DASH-11).
 *
 *   Left:  Top 10 tools by call count (server sends them descending).
 *   Right: Tools by success rate, worst first, filtered server-side to
 *          >= 5 completed-or-pending calls in the active range.
 */
export function ToolPerformanceRow() {
  const { data, isLoading, error, retry } = useDashboardData()

  const datasets = useMemo(() => {
    if (!data) return null
    const countData: BarListDatum[] = data.tool_performance.top_tools
      .slice(0, TOP_N)
      .map((t) => ({ label: t.tool, value: t.count }))

    const rateData: BarListDatum[] = data.tool_performance.success_rates
      .slice(0, TOP_N)
      .map((t) => ({
        label: t.tool,
        // Store as 0..100 so the X-axis / label math stay integer-friendly.
        value: Math.round((t.rate ?? 0) * 1000) / 10,
        secondary: t.n,
      }))

    return { countData, rateData }
  }, [data])

  const gridClass = 'grid grid-cols-1 gap-3 lg:grid-cols-2'

  if (error && !isLoading && !data) {
    return (
      <section aria-label="Tool performance">
        <SectionHeader title="Tool Performance" />
        <ErrorCard message={error} onRetry={retry} />
      </section>
    )
  }

  return (
    <section aria-label="Tool performance">
      <SectionHeader title="Tool Performance" />

      {isLoading || !datasets ? (
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
            emptyLabel="No tool calls in this range"
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
            emptyLabel="Not enough data"
          />
        </div>
      )}
    </section>
  )
}
