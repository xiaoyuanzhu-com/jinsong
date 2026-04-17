import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarListChart, type BarListDatum } from '@/components/BarListChart'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { filterByRange } from '@/lib/aggregate'
import { aggregateByAgent, aggregateByModel } from '@/lib/breakdowns'

const TOP_N = 10

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
 * Agent / Model breakdown row — two side-by-side horizontal bar charts.
 *
 *   Left:  Top 10 agent frameworks by session count.
 *   Right: Top 10 model IDs by session count.
 *
 * `null` / `undefined` / empty values bucket to `"unknown"` so the user
 * can still spot sessions that arrived without a reported agent/model.
 * Uses `var(--chart-1)` and `var(--chart-2)` for visual distinction.
 */
export function AgentModelRow() {
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

    const agentData: BarListDatum[] = aggregateByAgent(current, TOP_N).map(
      (d) => ({ label: d.label, value: d.value }),
    )
    const modelData: BarListDatum[] = aggregateByModel(current, TOP_N).map(
      (d) => ({ label: d.label, value: d.value }),
    )

    return { agentData, modelData }
  }, [rows, range])

  const gridClass = 'grid grid-cols-1 gap-3 lg:grid-cols-2'

  return (
    <section aria-label="By agent and model">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        By Agent & Model
      </h2>

      {datasets == null ? (
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

      {error && (
        <div className="mt-2 text-xs text-muted-foreground">
          Failed to load sessions: {error}
        </div>
      )}
    </section>
  )
}
