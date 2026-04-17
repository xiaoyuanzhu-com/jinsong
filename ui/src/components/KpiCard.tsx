import { useId } from 'react'
import { Area, AreaChart } from 'recharts'

import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { DailyBucket } from '@/lib/aggregate'

/**
 * Improvement direction for a KPI — controls delta color only.
 *
 * - `up-is-good`   : higher values are better (Sessions, Completion).
 * - `down-is-good` : lower values are better (TTFT, Stall ratio).
 * - `neutral`      : no value judgment (Tokens, Duration) — delta is grey.
 */
export type Direction = 'up-is-good' | 'down-is-good' | 'neutral'

export interface KpiCardProps {
  label: string
  /** Pre-formatted value so the caller controls units (tokens vs ms vs %). */
  value: string
  /** Percent change vs the prior period. `null` renders as "—". */
  deltaPct: number | null
  direction: Direction
  sparklineData: DailyBucket[]
  /** Optional suffix e.g. `"vs prev 30d"` — keeps the delta line readable. */
  deltaSuffix?: string
}

const chartConfig = {
  value: {
    label: 'value',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

/**
 * Color the delta number by whether the change is an improvement.
 *
 * For `neutral` we deliberately NEVER color — Tokens and Duration grow with
 * usage, and painting them green/red would imply a value judgment we don't
 * mean. The arrow still shows direction.
 */
function deltaColorClass(direction: Direction, pct: number): string {
  if (direction === 'neutral') return 'text-muted-foreground'
  const improving =
    (direction === 'up-is-good' && pct > 0) ||
    (direction === 'down-is-good' && pct < 0)
  if (pct === 0) return 'text-muted-foreground'
  return improving ? 'text-good' : 'text-poor'
}

function formatDelta(pct: number): string {
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  const magnitude = Math.abs(pct)
  // One decimal below 10%, whole numbers above — keeps the line short.
  const formatted = magnitude < 10 ? magnitude.toFixed(1) : Math.round(magnitude).toString()
  return `${arrow} ${formatted}%`
}

export function KpiCard({
  label,
  value,
  deltaPct,
  direction,
  sparklineData,
  deltaSuffix = 'vs prev',
}: KpiCardProps) {
  // React's stable per-instance id keeps multiple KpiCards from sharing a
  // <linearGradient> node. The `:` chars are stripped for SVG id safety.
  const gradientId = `kpi-spark-fill-${useId().replace(/:/g, '')}`
  const hasSparkline = sparklineData.length > 0 && sparklineData.some((d) => d.value > 0)

  const deltaNode =
    deltaPct == null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className={cn('tabular-nums', deltaColorClass(direction, deltaPct))}>
        {formatDelta(deltaPct)}
      </span>
    )

  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums leading-tight">
        {value}
      </div>

      <div className="mt-2 h-8">
        {hasSparkline ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-8 w-full"
          >
            <AreaChart
              data={sparklineData}
              margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          // Empty sparkline slot — keeps the card height stable whether we
          // have trend data or not, so the grid never jumps on load.
          <div className="h-full w-full" aria-hidden="true" />
        )}
      </div>

      <div className="mt-2 text-xs">
        {deltaNode}
        {deltaPct != null && (
          <span className="ml-1 text-muted-foreground">{deltaSuffix}</span>
        )}
      </div>
    </Card>
  )
}
