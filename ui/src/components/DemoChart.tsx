import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

// Deterministic pseudo-random so the demo renders the same on every build,
// which is handy for screenshot-style review. 14 days, sessions 5..50.
function buildFakeSeries() {
  let seed = 1337
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  return Array.from({ length: 14 }, (_, i) => ({
    day: `Day ${i + 1}`,
    sessions: Math.round(5 + rand() * 45),
  }))
}

const data = buildFakeSeries()

const chartConfig = {
  sessions: {
    label: 'Sessions',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

export function DemoChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessions per day</CardTitle>
        <CardDescription>
          chart primitive smoke test — DASH-1
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="fill-sessions" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-sessions)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-sessions)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={32}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area
              dataKey="sessions"
              type="monotone"
              stroke="var(--color-sessions)"
              strokeWidth={2}
              fill="url(#fill-sessions)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
