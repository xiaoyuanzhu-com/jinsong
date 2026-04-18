import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'

export interface BarListDatum {
  /** Y-axis tick label (shown on the left, truncated with ellipsis). */
  label: string
  /** Numeric X-axis value. */
  value: number
  /**
   * Optional secondary number (e.g. total calls alongside success rate).
   * Not used for bar length — passed through so `formatValue` can render
   * it in the right-hand label (e.g. "83% (12 calls)").
   */
  secondary?: number
}

export interface BarListChartProps {
  title: string
  description: string
  /** Rows ordered top-to-bottom in the chart. Callers pre-sort. */
  data: BarListDatum[]
  /** Format a value for the end-of-bar label. Defaults to `String(value)`. */
  formatValue?: (d: BarListDatum) => string
  /**
   * Color picker per row. Defaults to `var(--color-bar)` (which the Bar
   * maps to `--chart-1`). Return any valid CSS color — typically
   * `hsl(var(--poor))` / `hsl(var(--fair))` / `hsl(var(--good))`.
   */
  colorFor?: (d: BarListDatum, index: number) => string
  /** X-axis upper bound; omit for auto-scaling. */
  maxValue?: number
  /** Text shown when `data` is empty. */
  emptyLabel?: string
  /**
   * Per-row height in pixels. Multiplied by `data.length` (clamped) to
   * produce the chart body height so bars don't squish on longer lists.
   */
  rowHeight?: number
  /** Max body height in pixels (clamp for long lists). */
  maxHeight?: number
}

/**
 * A reusable horizontal-bar "top N" card. Built on Recharts `<BarChart>`
 * with `layout="vertical"` (Y-axis = labels, X-axis = values). Used by the
 * DASH-7 Tool Performance row for both the "Top tools" and "Tools by
 * success rate" charts — same primitive, different data + color logic.
 *
 * Layout notes:
 *   - Fixed 140px Y-axis width so long tool names (e.g.
 *     `mcp__provider__some_tool`) truncate with ellipsis.
 *   - End-of-bar label via `<LabelList>` keeps the value visible even when
 *     bars are short — this is the reason X-axis ticks are hidden.
 *   - Height scales with row count (rowHeight * n) clamped by `maxHeight`
 *     so a 3-row card doesn't waste space.
 */
export function BarListChart({
  title,
  description,
  data,
  formatValue = (d) => String(d.value),
  colorFor,
  maxValue,
  emptyLabel = 'No data in this range',
  rowHeight = 40,
  maxHeight = 440,
}: BarListChartProps) {
  const height = useMemo(() => {
    if (data.length === 0) return 160
    return Math.min(maxHeight, Math.max(rowHeight * data.length + 20, 120))
  }, [data.length, maxHeight, rowHeight])

  const config = useMemo<ChartConfig>(
    () => ({ value: { label: 'Value', color: 'hsl(var(--chart-1))' } }),
    [],
  )

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-0.5 p-5 pb-2">
        <CardTitle className="text-[13px] font-semibold">{title}</CardTitle>
        <CardDescription className="text-[11px] text-muted-foreground/80">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-5 pt-0">
        {data.length === 0 ? (
          <div
            className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground"
            style={{ height }}
            role="status"
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            />
            {emptyLabel}
          </div>
        ) : (
          <ChartContainer
            config={config}
            className="w-full"
            style={{ height, aspectRatio: 'auto' }}
          >
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
              barCategoryGap="18%"
            >
              <XAxis
                type="number"
                hide
                domain={maxValue != null ? [0, maxValue] : undefined}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                interval={0}
                tickFormatter={(v: string) =>
                  v.length > 22 ? `${v.slice(0, 21)}…` : v
                }
              />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={[2, 4, 4, 2]}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell
                    key={d.label}
                    fill={colorFor ? colorFor(d, i) : 'var(--color-value)'}
                  />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  content={({ x, y, width, height: h, index }) => {
                    if (index == null) return null
                    const d = data[index as number]
                    if (!d) return null
                    const cx = Number(x) + Number(width) + 6
                    const cy = Number(y) + Number(h) / 2
                    return (
                      <text
                        x={cx}
                        y={cy}
                        dy={3}
                        fontSize={11}
                        fill="hsl(var(--foreground))"
                        className="tabular-nums"
                      >
                        {formatValue(d)}
                      </text>
                    )
                  }}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
