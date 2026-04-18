import type { ReactElement, ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'

interface TimelineChartProps<T> {
  title: ReactNode
  description?: ReactNode
  /** Passed to `<ChartContainer>` so --color-<key> vars resolve inside. */
  config: ChartConfig
  data: T[]
  /** Renders the actual Recharts chart given the (non-empty) data. */
  renderChart: (data: T[]) => ReactElement
  /** Optional Tailwind height class for the chart body; default ~220px. */
  chartHeight?: string
  /** Optional hint when `data` is empty after filtering. */
  emptyLabel?: string
}

/**
 * Shared wrapper used by the four Trends charts — renders a shadcn Card with
 * a title/description, then a fixed-height chart body. On empty data we
 * render a centred muted label in place of the ChartContainer, because
 * ChartContainer insists on a Recharts element child (via ResponsiveContainer).
 */
export function TimelineChart<T>({
  title,
  description,
  config,
  data,
  renderChart,
  chartHeight = 'h-[220px]',
  emptyLabel = 'No data in this range',
}: TimelineChartProps<T>) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-0.5 p-5 pb-2">
        <CardTitle className="text-[13px] font-semibold">{title}</CardTitle>
        {description && (
          <CardDescription className="text-[11px] text-muted-foreground/80">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-5 pt-0">
        {data.length === 0 ? (
          <div
            className={`${chartHeight} flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground`}
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
            className={`${chartHeight} w-full`}
          >
            {renderChart(data)}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
