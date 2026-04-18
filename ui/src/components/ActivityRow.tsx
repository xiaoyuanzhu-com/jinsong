import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ActivityHeatmap } from '@/components/ActivityHeatmap'
import { useDashboardData } from '@/context/DashboardDataContext'

// ─── Loading skeleton ─────────────────────────────────────────────────────

function HeatmapSkeletonCard() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-1 h-3 w-56" />
      <Skeleton className="mt-3 h-[200px] w-full" />
      <div className="mt-2 flex justify-end">
        <Skeleton className="h-3 w-32" />
      </div>
    </Card>
  )
}

/**
 * Activity row — full-width heatmap of hour-of-day × day-of-week session
 * counts, fed by precomputed `heatmap.cells` from `/api/aggregate`
 * (DASH-11). Reconstitutes the 7×24 grid (Mon-first) that
 * `ActivityHeatmap` consumes.
 */
export function ActivityRow() {
  const { data, isLoading, error } = useDashboardData()

  const grid = useMemo(() => {
    if (!data) return null
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const c of data.heatmap.cells) {
      if (c.dow < 0 || c.dow > 6) continue
      if (c.hour < 0 || c.hour > 23) continue
      g[c.dow][c.hour] = c.count
    }
    return g
  }, [data])

  return (
    <section aria-label="Activity heatmap">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Activity
      </h2>

      {isLoading || !grid ? (
        <HeatmapSkeletonCard />
      ) : (
        <ActivityHeatmap grid={grid} />
      )}

      {error && (
        <div className="mt-2 text-xs text-muted-foreground">
          Failed to load dashboard data: {error}
        </div>
      )}
    </section>
  )
}
