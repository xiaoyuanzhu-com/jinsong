import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { PillarDef } from '@/lib/pillars'
import type { AggregatePillar } from '@/lib/aggregate-types'

export interface PillarCardProps {
  pillar: PillarDef
  /** Precomputed pillar payload from `/api/aggregate` (DASH-11). */
  data: AggregatePillar
}

const chartConfig = {
  good: { label: 'Good', color: 'hsl(var(--good))' },
  fair: { label: 'Fair', color: 'hsl(var(--fair))' },
  poor: { label: 'Poor', color: 'hsl(var(--poor))' },
} satisfies ChartConfig

/** Fixed three-slot ordering keeps color assignment stable across renders. */
const SLICE_ORDER: Array<'good' | 'fair' | 'poor'> = ['good', 'fair', 'poor']

function deltaColorClass(
  direction: PillarDef['direction'],
  delta: number,
): string {
  if (delta === 0) return 'text-muted-foreground'
  const improving =
    (direction === 'up-is-good' && delta > 0) ||
    (direction === 'down-is-good' && delta < 0)
  return improving ? 'text-good' : 'text-poor'
}

function deltaArrow(delta: number): string {
  if (delta > 0) return '↑'
  if (delta < 0) return '↓'
  return '→'
}

/** Percent (whole number) of n/total; 0 when total == 0. */
function pct(n: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((n / total) * 100)
}

/**
 * Pillar card — reads precomputed `good / fair / poor / headline` from
 * the aggregate and relies on the pillar's static metadata (name,
 * direction, formatters) for presentation.
 */
export function PillarCard({ pillar, data }: PillarCardProps) {
  const total = data.good + data.fair + data.poor
  const distribution = { good: data.good, fair: data.fair, poor: data.poor }

  const donutData = useMemo(() => {
    if (total === 0) {
      // Synthetic full ring so the geometry stays stable when there's
      // nothing to classify. Rendered as muted grey via the Cell override.
      return [{ key: 'empty', value: 1 }]
    }
    return SLICE_ORDER.map((k) => ({ key: k, value: distribution[k] }))
  }, [total, distribution])

  const goodPct = pct(distribution.good, total)
  const fairPct = pct(distribution.fair, total)
  const poorPct = pct(distribution.poor, total)

  const headlineStr = pillar.formatHeadline(data.headline.value)
  const delta = data.headline.delta

  const deltaNode = (() => {
    if (delta == null) {
      return <span className="text-muted-foreground">—</span>
    }
    if (delta === 0) {
      return <span className="text-muted-foreground">→ 0</span>
    }
    return (
      <span
        className={cn(
          'tabular-nums',
          deltaColorClass(pillar.direction, delta),
        )}
      >
        {deltaArrow(delta)} {pillar.formatDelta(Math.abs(delta))}
      </span>
    )
  })()

  const isEmptyRing = total === 0

  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {pillar.name}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {pillar.tagline}
      </div>

      <div className="mt-3 flex items-center gap-3">
        {/* Donut — fixed 72px, hide legend/tooltip for compactness. */}
        <ChartContainer
          config={chartConfig}
          className="aspect-square h-[72px] w-[72px] shrink-0"
        >
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="key"
              innerRadius="60%"
              outerRadius="80%"
              strokeWidth={0}
              cornerRadius={1}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {donutData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    isEmptyRing
                      ? 'hsl(var(--muted-foreground))'
                      : entry.key === 'good'
                        ? 'hsl(var(--good))'
                        : entry.key === 'fair'
                          ? 'hsl(var(--fair))'
                          : 'hsl(var(--poor))'
                  }
                  fillOpacity={isEmptyRing ? 0.25 : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="min-w-0 flex-1">
          <div className="text-2xl font-semibold tabular-nums leading-tight">
            {headlineStr}
          </div>
          <div className="mt-1 text-xs">
            {deltaNode}
            {delta != null && (
              <span className="ml-1 text-muted-foreground">vs prev</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground tabular-nums">
        {total === 0
          ? 'No classifiable sessions'
          : `${goodPct}% good · ${fairPct}% fair · ${poorPct}% poor`}
      </div>
    </Card>
  )
}
