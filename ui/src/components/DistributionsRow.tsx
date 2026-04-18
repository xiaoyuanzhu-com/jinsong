import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DonutCard, type DonutDatum } from '@/components/DonutCard'
import { SectionHeader } from '@/components/SectionHeader'
import { ErrorCard } from '@/components/RowStates'
import { useDashboardData } from '@/context/DashboardDataContext'
import {
  CONTENT_TYPE_COLORS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ORDER,
  END_REASON_COLORS,
  END_REASON_LABELS,
  END_REASON_ORDER,
  TOOL_CATEGORY_COLORS,
  TOOL_CATEGORY_LABELS,
  TOOL_CATEGORY_ORDER,
  type ContentType,
  type EndReasonBucket,
  type ToolCategoryBucket,
} from '@/lib/distributions'

// ─── Loading skeleton ─────────────────────────────────────────────────────

function DonutSkeletonCard() {
  return (
    <Card className="p-5">
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

// ─── Helpers ─────────────────────────────────────────────────────────────

function zipDonut<K extends string>(
  order: readonly K[],
  labels: Record<K, string>,
  colors: Record<K, string>,
  rows: Array<{ label: string; count: number }>,
): DonutDatum[] {
  const byKey = new Map<string, number>()
  for (const r of rows) byKey.set(r.label, r.count)
  return order.map((k) => ({
    key: k,
    label: labels[k],
    value: byKey.get(k) ?? 0,
    color: colors[k],
  }))
}

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Distributions row — 3 donut cards fed by precomputed `distributions`
 * from `/api/aggregate` (DASH-11). Server emits `{label, count}[]` keyed
 * on the canonical ids (e.g. `quick_answer`, `completed`, `execution`);
 * this component zips them against the UI's label+color metadata.
 */
export function DistributionsRow() {
  const { data, isLoading, error, retry } = useDashboardData()

  const datasets = useMemo(() => {
    if (!data) return null
    const contentData = zipDonut<ContentType>(
      CONTENT_TYPE_ORDER,
      CONTENT_TYPE_LABELS,
      CONTENT_TYPE_COLORS,
      data.distributions.content_type,
    )
    const endData = zipDonut<EndReasonBucket>(
      END_REASON_ORDER,
      END_REASON_LABELS,
      END_REASON_COLORS,
      data.distributions.end_reason,
    )
    const toolData = zipDonut<ToolCategoryBucket>(
      TOOL_CATEGORY_ORDER,
      TOOL_CATEGORY_LABELS,
      TOOL_CATEGORY_COLORS,
      data.distributions.tool_category,
    )
    const toolEmpty = toolData.every((d) => d.value === 0)

    return { contentData, endData, toolData, toolEmpty }
  }, [data])

  const gridClass = 'grid grid-cols-1 gap-3 md:grid-cols-3'

  if (error && !isLoading && !data) {
    return (
      <section aria-label="Distributions">
        <SectionHeader title="Distributions" />
        <ErrorCard message={error} onRetry={retry} />
      </section>
    )
  }

  return (
    <section aria-label="Distributions">
      <SectionHeader title="Distributions" />

      {isLoading || !datasets ? (
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
            emptyHint={datasets.toolEmpty ? 'no tool calls in range' : undefined}
          />
        </div>
      )}
    </section>
  )
}
