import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PillarCard } from '@/components/PillarCard'
import { useDashboardData } from '@/context/DashboardDataContext'
import { PILLARS } from '@/lib/pillars'
import type { AggregatePillar, PillarId } from '@/lib/aggregate-types'

// ─── Loading skeleton ──────────────────────────────────────────────────────

function PillarSkeletonCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-1 h-3 w-16" />
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      </div>
      <Skeleton className="mt-3 h-3 w-32" />
    </Card>
  )
}

const EMPTY_PILLAR: Omit<AggregatePillar, 'id'> = {
  good: 0,
  fair: 0,
  poor: 0,
  headline: { value: null, delta: null },
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Pillar Health row — five cards summarising the five AX pillars side by
 * side. Each card surfaces a Good/Fair/Poor donut, a headline metric, and a
 * trend delta vs the prior window. Precomputed server-side in DASH-11.
 */
export function PillarHealthRow() {
  const { data, isLoading, error } = useDashboardData()

  const gridClass = 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5'

  if (isLoading || !data) {
    return (
      <section aria-label="Pillar health">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
          Pillar Health
        </h2>
        <div className={gridClass}>
          {PILLARS.map((p) => (
            <PillarSkeletonCard key={p.id} />
          ))}
        </div>
      </section>
    )
  }

  const byId = new Map<PillarId, AggregatePillar>()
  for (const p of data.pillars) byId.set(p.id, p)

  return (
    <section aria-label="Pillar health">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Pillar Health
      </h2>

      <div className={gridClass}>
        {PILLARS.map((p) => {
          const payload = byId.get(p.id) ?? { id: p.id, ...EMPTY_PILLAR }
          return <PillarCard key={p.id} pillar={p} data={payload} />
        })}
      </div>

      {error && (
        <div className="mt-2 text-xs text-muted-foreground">
          Failed to load dashboard data: {error}
        </div>
      )}
    </section>
  )
}
