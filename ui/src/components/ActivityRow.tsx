import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ActivityHeatmap } from '@/components/ActivityHeatmap'
import { useRange } from '@/context/RangeContext'
import { filterByRange } from '@/lib/aggregate'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { buildHeatmapCounts } from '@/lib/heatmap'

// ─── Loading skeleton ─────────────────────────────────────────────────────

function HeatmapSkeletonCard() {
  return (
    <Card className="p-4">
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
 * counts. Shares `/api/sessions` with the other rows (DASH-11 will
 * consolidate into a single aggregate endpoint).
 */
export function ActivityRow() {
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

  const grid = useMemo(() => {
    if (rows == null) return null
    const current = filterByRange(rows, range)
    return buildHeatmapCounts(current)
  }, [rows, range])

  return (
    <section aria-label="Activity heatmap">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Activity
      </h2>

      {grid == null ? (
        <HeatmapSkeletonCard />
      ) : (
        <ActivityHeatmap grid={grid} />
      )}

      {error && (
        <div className="mt-2 text-xs text-muted-foreground">
          Failed to load sessions: {error}
        </div>
      )}
    </section>
  )
}
