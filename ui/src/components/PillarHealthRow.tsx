import { useEffect, useMemo, useState } from 'react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PillarCard } from '@/components/PillarCard'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { filterByRange, priorWindow } from '@/lib/aggregate'
import { PILLARS } from '@/lib/pillars'

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

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * Pillar Health row — five cards summarising the five AX pillars side by
 * side. Each card surfaces a Good/Fair/Poor donut, a headline metric, and a
 * trend delta vs the prior window.
 *
 * Fetches /api/sessions independently of HeroKpiRow for now; DASH-11 will
 * collapse both into /api/aggregate so the page makes one request.
 */
export function PillarHealthRow() {
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

  const windows = useMemo(() => {
    if (rows == null) return null
    const now = Date.now()
    return {
      current: filterByRange(rows, range, now),
      prior: priorWindow(rows, range, now),
    }
  }, [rows, range])

  const gridClass =
    'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5'

  return (
    <section aria-label="Pillar health">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Pillar Health
      </h2>

      {windows == null ? (
        <div className={gridClass}>
          {PILLARS.map((p) => (
            <PillarSkeletonCard key={p.id} />
          ))}
        </div>
      ) : (
        <div className={gridClass}>
          {PILLARS.map((p) => (
            <PillarCard
              key={p.id}
              pillar={p}
              rows={windows.current}
              priorRows={windows.prior}
            />
          ))}
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
