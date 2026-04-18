import { useMemo } from 'react'
import { Cell, Pie, PieChart } from 'recharts'

import { Card } from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

export interface DonutDatum {
  /** Stable key used for color lookup and React keys. */
  key: string
  /** Human label shown in the legend. */
  label: string
  /** Absolute count (not percentage — DonutCard computes pct itself). */
  value: number
  /** Fully-resolved CSS color string, e.g. `hsl(var(--chart-1))`. */
  color: string
}

export interface DonutCardProps {
  title: string
  description: string
  /** Ordered slice list. Zero-value slices are still shown in the legend. */
  data: DonutDatum[]
  /** Label shown under the center total. Defaults to `'sessions'`. */
  centerLabel?: string
  /**
   * When true, render the donut in empty-state mode: muted grey ring and
   * an em-dash at the center. Use for "no data yet" / server-pending
   * scenarios. The caller still passes `data` (for the legend stub) and
   * `description` (already set).
   */
  empty?: boolean
  /** Optional muted subtitle shown below the description in empty state. */
  emptyHint?: string
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((n / total) * 100)
}

/**
 * A small donut + legend card. Geometry mirrors the metrics.md "compact
 * donut" spec: `innerRadius=55%`, `outerRadius=80%`, tiny `paddingAngle`
 * for slice separation, rounded corners. The center overlay shows the
 * total count in big tabular nums; the legend sits on the right so narrow
 * screens can reflow it below via the flex-wrap on the outer row.
 */
export function DonutCard({
  title,
  description,
  data,
  centerLabel = 'sessions',
  empty = false,
  emptyHint,
}: DonutCardProps) {
  const total = useMemo(
    () => data.reduce((acc, d) => acc + (Number.isFinite(d.value) ? d.value : 0), 0),
    [data],
  )

  const isEmptyRing = empty || total === 0

  const slices = useMemo(() => {
    if (isEmptyRing) {
      // Synthetic full ring so the donut geometry stays stable when there
      // are no counts yet — the Cell below renders it with a muted grey.
      return [{ key: '__empty__', label: 'empty', value: 1, color: 'hsl(var(--muted-foreground))' }]
    }
    // Recharts drops zero-value slices silently, which is fine for the ring
    // itself. We still surface every key in the legend (rendered outside
    // the PieChart) so the reader can see 0-count categories.
    return data.filter((d) => d.value > 0)
  }, [data, isEmptyRing])

  const chartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {}
    for (const d of data) {
      cfg[d.key] = { label: d.label, color: d.color }
    }
    return cfg
  }, [data])

  return (
    <Card className="p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground/80">
        {description}
      </div>
      {isEmptyRing && emptyHint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground/60">
          {emptyHint}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {/* Donut + centered total. Fixed 112px so three cards line up. */}
        <div className="relative shrink-0">
          <ChartContainer
            config={chartConfig}
            className="aspect-square h-[112px] w-[112px]"
          >
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="key"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={isEmptyRing ? 0 : 1}
                cornerRadius={2}
                strokeWidth={0}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    fillOpacity={isEmptyRing ? 0.25 : 1}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          {/* Center overlay — total count + muted subtitle. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[20px] font-semibold tabular-nums leading-none">
              {isEmptyRing ? '—' : total.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {centerLabel}
            </div>
          </div>
        </div>

        {/* Legend — dot + label + count + muted percentage. */}
        <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
          {data.map((d) => {
            const p = pct(d.value, total)
            return (
              <li
                key={d.key}
                className="flex items-center gap-2 tabular-nums"
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: isEmptyRing
                      ? 'hsl(var(--muted-foreground))'
                      : d.color,
                    opacity: isEmptyRing ? 0.35 : 1,
                  }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {d.label}
                </span>
                <span className="text-foreground">
                  {isEmptyRing ? '—' : d.value.toLocaleString()}
                </span>
                <span className="w-9 text-right text-muted-foreground">
                  {isEmptyRing ? '' : `${p}%`}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </Card>
  )
}
