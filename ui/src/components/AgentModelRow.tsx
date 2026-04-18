import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarListChart, type BarListDatum } from '@/components/BarListChart'
import { SectionHeader } from '@/components/SectionHeader'
import { ErrorCard } from '@/components/RowStates'
import { useDashboardData } from '@/context/DashboardDataContext'

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
 * Agent / Model breakdown row — two side-by-side horizontal bar charts
 * fed by precomputed `breakdowns` from `/api/aggregate` (DASH-11). Server
 * already normalizes blank/unknown values to "unknown" and returns the
 * top-10 per dimension by session count.
 */
export function AgentModelRow() {
  const { data, isLoading, error, retry } = useDashboardData()

  const datasets = useMemo(() => {
    if (!data) return null
    const agentData: BarListDatum[] = data.breakdowns.agents.map((d) => ({
      label: d.label,
      value: d.count,
    }))
    const modelData: BarListDatum[] = data.breakdowns.models.map((d) => ({
      label: d.label,
      value: d.count,
    }))
    return { agentData, modelData }
  }, [data])

  const gridClass = 'grid grid-cols-1 gap-3 lg:grid-cols-2'

  if (error && !isLoading && !data) {
    return (
      <section aria-label="By agent and model">
        <SectionHeader title="By Agent & Model" />
        <ErrorCard message={error} onRetry={retry} />
      </section>
    )
  }

  return (
    <section aria-label="By agent and model">
      <SectionHeader title="By Agent & Model" />

      {isLoading || !datasets ? (
        <div className={gridClass}>
          <BarListSkeletonCard />
          <BarListSkeletonCard />
        </div>
      ) : (
        <div className={gridClass}>
          <BarListChart
            title="Sessions by agent"
            description="Agent framework / client"
            data={datasets.agentData}
            formatValue={(d) => d.value.toLocaleString()}
            colorFor={() => 'hsl(var(--chart-1))'}
            emptyLabel="No sessions in this range"
          />
          <BarListChart
            title="Sessions by model"
            description="Model identifier reported by sessions"
            data={datasets.modelData}
            formatValue={(d) => d.value.toLocaleString()}
            colorFor={() => 'hsl(var(--chart-2))'}
            emptyLabel="No sessions in this range"
          />
        </div>
      )}
    </section>
  )
}
