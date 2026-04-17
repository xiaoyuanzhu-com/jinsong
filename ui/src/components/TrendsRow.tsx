import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { TimelineChart } from '@/components/TimelineChart'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { filterByRange, median, rangeToDays } from '@/lib/aggregate'
import {
  abbreviateNumber,
  bucketByDayMulti,
  defaultTimelineDays,
  formatAxisDate,
  percentile,
} from '@/lib/timeline'

// ─── Chart configs (color-key → CSS var) ──────────────────────────────────

const sessionsConfig = {
  sessions: { label: 'Sessions', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

const tokensConfig = {
  in: { label: 'Tokens in', color: 'hsl(var(--chart-2))' },
  out: { label: 'Tokens out', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

const ttftConfig = {
  p50: { label: 'p50', color: 'hsl(var(--chart-1))' },
  p95: { label: 'p95', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig

const stallConfig = {
  stall: { label: 'Stall ratio', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig

// ─── Shared axis props ────────────────────────────────────────────────────

const commonMargin = { top: 8, right: 12, bottom: 4, left: 4 }

function xAxisProps() {
  return {
    dataKey: 'day',
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    minTickGap: 24,
    tickFormatter: (v: string) => formatAxisDate(v),
  } as const
}

// ─── Chart-1: Sessions per day ────────────────────────────────────────────

interface SessionsDaily { day: string; sessions: number }

function SessionsChart({ data }: { data: SessionsDaily[] }) {
  return (
    <TimelineChart<SessionsDaily>
      title="Sessions per day"
      description="New agent sessions"
      config={sessionsConfig}
      data={data}
      renderChart={(d) => (
        <AreaChart data={d} margin={commonMargin}>
          <defs>
            <linearGradient id="fill-sessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-sessions)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-sessions)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...xAxisProps()} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={32}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <Area
            dataKey="sessions"
            type="monotone"
            stroke="var(--color-sessions)"
            strokeWidth={1.5}
            fill="url(#fill-sessions)"
          />
        </AreaChart>
      )}
    />
  )
}

// ─── Chart-2: Tokens per day (stacked in + out) ───────────────────────────

interface TokensDaily { day: string; in: number; out: number }

function TokensChart({ data }: { data: TokensDaily[] }) {
  return (
    <TimelineChart<TokensDaily>
      title="Tokens per day"
      description="Input + output"
      config={tokensConfig}
      data={data}
      renderChart={(d) => (
        <AreaChart data={d} margin={commonMargin}>
          <defs>
            <linearGradient id="fill-tokens-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-in)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-in)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-tokens-out" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-out)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--color-out)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...xAxisProps()} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            tickFormatter={(v: number) => abbreviateNumber(v)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
          <Area
            dataKey="in"
            type="monotone"
            stackId="1"
            stroke="var(--color-in)"
            strokeWidth={1.5}
            fill="url(#fill-tokens-in)"
          />
          <Area
            dataKey="out"
            type="monotone"
            stackId="1"
            stroke="var(--color-out)"
            strokeWidth={1.5}
            fill="url(#fill-tokens-out)"
          />
        </AreaChart>
      )}
    />
  )
}

// ─── Chart-3: TTFT trend (p50 solid + p95 dashed) ─────────────────────────

interface TtftDaily { day: string; p50: number | null; p95: number | null }

function TtftChart({ data }: { data: TtftDaily[] }) {
  return (
    <TimelineChart<TtftDaily>
      title="Time to first token"
      description="Daily p50 and p95, seconds"
      config={ttftConfig}
      data={data}
      renderChart={(d) => (
        <ComposedChart data={d} margin={commonMargin}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...xAxisProps()} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={36}
            tickFormatter={(v: number) => `${v.toFixed(1)}s`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" />}
          />
          <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
          <Line
            dataKey="p50"
            type="monotone"
            stroke="var(--color-p50)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            dataKey="p95"
            type="monotone"
            stroke="var(--color-p95)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      )}
    />
  )
}

// ─── Chart-4: Stall ratio trend (daily median, with ref lines) ───────────

interface StallDaily { day: string; stall: number | null }

function StallChart({ data }: { data: StallDaily[] }) {
  return (
    <TimelineChart<StallDaily>
      title="Stall ratio"
      description="Daily median (lower is better)"
      config={stallConfig}
      data={data}
      renderChart={(d) => (
        <LineChart data={d} margin={commonMargin}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...xAxisProps()} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            domain={[0, 'auto']}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          />
          {/* Good (<=10%) / Fair (<=20%) boundaries — muted dashed guides. */}
          <ReferenceLine
            y={0.1}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 3"
            strokeOpacity={0.5}
            label={{
              value: '10%',
              position: 'right',
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
            }}
          />
          <ReferenceLine
            y={0.2}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 3"
            strokeOpacity={0.5}
            label={{
              value: '20%',
              position: 'right',
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
            }}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="line"
                formatter={(value, _name, item) => {
                  // Show "12.3%" in the tooltip instead of the raw ratio.
                  const n = typeof value === 'number' ? value : Number(value)
                  const label =
                    typeof item?.name === 'string' ? item.name : 'stall'
                  return (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono tabular-nums text-foreground">
                        {Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
          <Line
            dataKey="stall"
            type="monotone"
            stroke="var(--color-stall)"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      )}
    />
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────

function TrendsSkeletonCard() {
  return (
    <Card className="p-4">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-1 h-3 w-20" />
      <Skeleton className="mt-3 h-[220px] w-full" />
    </Card>
  )
}

// ─── Component ────────────────────────────────────────────────────────────

/**
 * Trends row — four daily timeline charts arranged 2×2 on wide screens.
 *
 * Fetches /api/sessions independently for now (DASH-11 collapses all row
 * fetches into a single /api/aggregate call). Buckets respect the active
 * range: 7d → 7 buckets, 30d → 30, 90d → 90, 'all' → a stable 90-day window.
 */
export function TrendsRow() {
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
    const now = Date.now()
    const current = filterByRange(rows, range, now)
    const days = defaultTimelineDays(rangeToDays(range))

    const sessionsDaily = bucketByDayMulti<{ sessions: number }>(
      current,
      days,
      now,
      (bucket) => ({ sessions: bucket.length }),
    )

    const tokensDaily = bucketByDayMulti<{ in: number; out: number }>(
      current,
      days,
      now,
      (bucket) => {
        let tokIn = 0
        let tokOut = 0
        for (const r of bucket) {
          const i = r.session.total_tokens_in
          const o = r.session.total_tokens_out
          if (typeof i === 'number' && Number.isFinite(i)) tokIn += i
          if (typeof o === 'number' && Number.isFinite(o)) tokOut += o
        }
        return { in: tokIn, out: tokOut }
      },
    )

    const ttftDaily = bucketByDayMulti<{ p50: number | null; p95: number | null }>(
      current,
      days,
      now,
      (bucket) => {
        const xs = bucket.map((r) => r.metrics?.r_time_to_first_token ?? null)
        return {
          p50: percentile(xs, 0.5),
          p95: percentile(xs, 0.95),
        }
      },
    )

    const stallDaily = bucketByDayMulti<{ stall: number | null }>(
      current,
      days,
      now,
      (bucket) => {
        const m = median(bucket.map((r) => r.metrics?.rel_stall_ratio ?? null))
        return { stall: m }
      },
    )

    return { sessionsDaily, tokensDaily, ttftDaily, stallDaily }
  }, [rows, range])

  const gridClass = 'grid grid-cols-1 gap-3 lg:grid-cols-2'

  return (
    <section aria-label="Trends">
      <h2 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Trends
      </h2>

      {datasets == null ? (
        <div className={gridClass}>
          {Array.from({ length: 4 }).map((_, i) => (
            <TrendsSkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className={gridClass}>
          <SessionsChart data={datasets.sessionsDaily} />
          <TokensChart data={datasets.tokensDaily} />
          <TtftChart data={datasets.ttftDaily} />
          <StallChart data={datasets.stallDaily} />
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
