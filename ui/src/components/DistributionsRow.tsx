import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DonutCard, type DonutDatum } from '@/components/DonutCard'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { filterByRange } from '@/lib/aggregate'
import {
  bucketByContentType,
  bucketByEndReason,
  bucketByToolCategory,
  CONTENT_TYPE_COLORS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ORDER,
  END_REASON_COLORS,
  END_REASON_LABELS,
  END_REASON_ORDER,
  TOOL_CATEGORY_COLORS,
  TOOL_CATEGORY_LABELS,
  TOOL_CATEGORY_ORDER,
} from '@/lib/distributions'

// ─── Loading skeleton ─────────────────────────────────────────────────────

function DonutSkeletonCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-1 h-3 w-20" />
      <div className="mt-3 flex items-center gap-4">
        <Skeleton className="h-[112px] w-[112px] rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Distributions row — 3 donut cards showing how sessions break down by
 * content type (metrics.md §3 thresholds), end reason, and tool category.
 *
 * Fetches /api/sessions independently for now (DASH-11 will consolidate
 * row-level fetches into a single /api/aggregate). Content-type inference
 * runs client-side; end-reason normalization handles the `failed`→`error`
 * legacy mapping; tool-category counts come from the server-side extension
 * added in this ticket (falls back to an empty-state donut when the field
 * is missing, e.g. an older server build).
 */
export function DistributionsRow() {
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

    const ct = bucketByContentType(current)
    const contentData: DonutDatum[] = CONTENT_TYPE_ORDER.map((k) => ({
      key: k,
      label: CONTENT_TYPE_LABELS[k],
      value: ct[k],
      color: CONTENT_TYPE_COLORS[k],
    }))

    const er = bucketByEndReason(current)
    const endData: DonutDatum[] = END_REASON_ORDER.map((k) => ({
      key: k,
      label: END_REASON_LABELS[k],
      value: er[k],
      color: END_REASON_COLORS[k],
    }))

    const tc = bucketByToolCategory(current)
    const toolData: DonutDatum[] = TOOL_CATEGORY_ORDER.map((k) => ({
      key: k,
      label: TOOL_CATEGORY_LABELS[k],
      value: tc?.[k] ?? 0,
      color: TOOL_CATEGORY_COLORS[k],
    }))
    const toolEmpty = tc == null

    return { contentData, endData, toolData, toolEmpty }
  }, [rows, range])

  const gridClass = 'grid grid-cols-1 gap-3 md:grid-cols-3'

  return (
    <section aria-label="Distributions">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Distributions
      </h2>

      {datasets == null ? (
        <div className={gridClass}>
          <DonutSkeletonCard />
          <DonutSkeletonCard />
          <DonutSkeletonCard />
        </div>
      ) : (
        <div className={gridClass}>
          <DonutCard
            title="Content type"
            description="Session shape distribution"
            data={datasets.contentData}
            centerLabel="sessions"
          />
          <DonutCard
            title="End reason"
            description="How sessions ended"
            data={datasets.endData}
            centerLabel="sessions"
          />
          <DonutCard
            title="Tool category"
            description="Tool invocation mix"
            data={datasets.toolData}
            centerLabel="calls"
            empty={datasets.toolEmpty}
            emptyHint={
              datasets.toolEmpty ? 'awaiting server aggregation' : undefined
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
