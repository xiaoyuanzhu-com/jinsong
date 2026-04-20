import { useMemo } from 'react'

import { useDashboardData } from '@/context/DashboardDataContext'
import { useRange } from '@/context/RangeContext'
import {
  axsHeadline,
  axsTrendSeries,
} from '@/bridge/syntheticData'
import { Sparkline, TrendChart, Delta } from '@/bridge/primitives'

/**
 * Hero row — single 1.6fr / 1fr split:
 *
 *   - Left: the Agent Experience Score headline + 30d trend overlay.
 *     AXS is still synthetic (DASH-13 stub); the aggregated pillars
 *     are there but we haven't yet decided the exact weighting.
 *   - Right: a 2-column grid of 5 supporting KPIs. Those pull from the
 *     real `/api/aggregate` endpoint where the field exists, and fall
 *     back to "—" otherwise so the card skeleton still reads.
 */
export function HeroRow() {
  const { data } = useDashboardData()
  const { range } = useRange()

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 60
  const trend = useMemo(() => axsTrendSeries(days), [days])
  // Fire the regression marker at the same relative point as the
  // prototype (roughly 70% into the window).
  const regressionIdx = Math.floor(days * 0.7)

  return (
    <div
      className="grid gap-5"
      style={{ gridTemplateColumns: '1.6fr 1fr' }}
    >
      <AxsPanel trend={trend} regressionIdx={regressionIdx} range={range} />
      <KpiGrid data={data} />
    </div>
  )
}

// ── Left panel: big AXS score + trend ─────────────────────────────────
function AxsPanel({
  trend,
  regressionIdx,
  range,
}: {
  trend: Array<{ date: string; axs: number; stall: number }>
  regressionIdx: number
  range: string
}) {
  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: 20,
        boxShadow:
          '0 1px 0 hsl(var(--foreground) / 0.02) inset, 0 1px 3px hsl(0 0% 0% / 0.08)',
      }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 4 }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          Agent Experience Score · {range}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          AXS = f(init, prog, inter, deliv, resol)
        </div>
      </div>

      <div
        className="flex items-baseline"
        style={{ gap: 14, marginTop: 6 }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 84,
            letterSpacing: '-0.025em',
            lineHeight: 0.95,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {axsHeadline.score}
        </div>
        <div
          style={{
            fontSize: 18,
            color: 'hsl(var(--muted-foreground))',
            fontWeight: 400,
          }}
        >
          /100
        </div>
        <div
          style={{ marginLeft: 10, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Delta value={axsHeadline.delta} direction="up" />
          <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
            vs prev {range}
          </span>
        </div>
        <IncidentBadge label={axsHeadline.incidentBadge.label} />
      </div>

      <div style={{ marginTop: 14, overflow: 'hidden' }}>
        <TrendChart
          data={trend}
          width={720}
          height={160}
          regressionIndex={regressionIdx}
          style="area"
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 18,
          fontSize: 11,
          color: 'hsl(var(--text-dim))',
          marginTop: 8,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 2,
              background: 'hsl(var(--primary))',
              verticalAlign: 'middle',
              marginRight: 6,
            }}
          />
          AXS
        </span>
        <span>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 2,
              background: 'hsl(var(--accent-2))',
              verticalAlign: 'middle',
              marginRight: 6,
              opacity: 0.8,
            }}
          />
          Stall ratio %
        </span>
      </div>
    </div>
  )
}

function IncidentBadge({ label }: { label: string }) {
  return (
    <div
      className="flex items-center"
      style={{
        marginLeft: 'auto',
        gap: 8,
        padding: '4px 8px',
        border: '1px solid hsl(var(--poor) / 0.33)',
        background: 'hsl(var(--poor) / 0.07)',
        borderRadius: 'var(--radius)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'hsl(var(--poor))',
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: 'hsl(var(--poor))',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ── Right: 2-column grid of 5 supporting KPIs ─────────────────────────
interface KpiCellData {
  label: string
  value: string
  unit?: string
  delta: number | null
  /** `up` = positive-is-good, `down` = positive-is-bad. */
  direction: 'up' | 'down'
  /** Source series for the sparkline. Deterministic synthetic when the
   *  aggregate payload doesn't yet have a trend. */
  spark: number[]
  alert?: boolean
}

function KpiGrid({
  data,
}: {
  data: ReturnType<typeof useDashboardData>['data']
}) {
  const cells: KpiCellData[] = useMemo(() => buildKpiCells(data), [data])
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: '1fr 1fr' }}
    >
      {cells.map((k) => (
        <KpiCard key={k.label} data={k} />
      ))}
    </div>
  )
}

function KpiCard({ data }: { data: KpiCellData }) {
  const stroke = data.alert ? 'hsl(var(--poor))' : 'hsl(var(--primary))'
  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {data.alert && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'hsl(var(--poor))',
          }}
        />
      )}
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'hsl(var(--muted-foreground))',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        {data.label}
      </div>
      <div className="flex items-baseline" style={{ gap: 4 }}>
        <span
          style={{
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: '-0.025em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {data.value}
        </span>
        {data.unit && (
          <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
            {data.unit}
          </span>
        )}
      </div>
      <Sparkline
        data={data.spark}
        width={160}
        height={24}
        stroke={stroke}
        fill={stroke}
        style="area"
      />
      <Delta value={data.delta} direction={data.direction} />
    </div>
  )
}

// ── KPI derivation ────────────────────────────────────────────────────

type AggregateData = ReturnType<typeof useDashboardData>['data']

/**
 * Build 5 KPI cells: use real aggregate values where available, fall
 * back to synthetic numbers where the endpoint doesn't yet expose the
 * field (first-attempt success).
 */
function buildKpiCells(data: AggregateData): KpiCellData[] {
  const sessions = data?.totals.sessions ?? null
  const priorSessions = data?.prior?.totals.sessions ?? null
  const taskCompletionPct =
    data && data.totals.sessions > 0
      ? (data.totals.completions / data.totals.sessions) * 100
      : null
  const priorCompletionPct =
    data?.prior && data.prior.totals.sessions > 0
      ? (data.prior.totals.completions / data.prior.totals.sessions) * 100
      : null

  const ttft = data?.medians.ttft_seconds ?? null
  const priorTtft = data?.prior?.medians.ttft_seconds ?? null

  const stall = data?.medians.stall_ratio ?? null
  const priorStall = data?.prior?.medians.stall_ratio ?? null

  const sessionsSpark =
    (data?.kpi_sparklines.sessions.map((b) => b.count) ?? []).slice(-30)
  const ttftSpark =
    (data?.kpi_sparklines.ttft_median.map((b) => b.value) ?? []).slice(-30)
  const stallSpark =
    (data?.kpi_sparklines.stall_median.map((b) => b.value) ?? []).slice(-30)
  const completionSpark =
    (data?.kpi_sparklines.completion.map((b) => b.rate * 100) ?? []).slice(-30)

  return [
    {
      label: 'Sessions',
      value: sessions != null ? sessions.toLocaleString() : '—',
      delta: pctChange(sessions, priorSessions),
      direction: 'up',
      spark: sessionsSpark.length ? sessionsSpark : fallbackSpark(30, 400, 60),
    },
    {
      label: 'Task Completion',
      value: taskCompletionPct != null ? taskCompletionPct.toFixed(1) : '—',
      unit: '%',
      delta: absoluteChangePct(taskCompletionPct, priorCompletionPct),
      direction: 'up',
      spark: completionSpark.length ? completionSpark : fallbackSpark(30, 84, 3),
    },
    {
      label: 'Median TTFR',
      value: ttft != null ? ttft.toFixed(1) : '—',
      unit: 's',
      delta: pctChange(ttft, priorTtft),
      direction: 'down',
      spark: ttftSpark.length ? ttftSpark : fallbackSpark(30, 2.0, 0.4),
    },
    {
      label: 'Stall Ratio (p50)',
      value: stall != null ? (stall * 100).toFixed(1) : '—',
      unit: '%',
      delta: pctChange(stall, priorStall),
      direction: 'down',
      spark: stallSpark.length ? stallSpark : fallbackSpark(30, 8, 2),
      alert: stall != null && stall > 0.1,
    },
    {
      label: 'First-Attempt Success',
      value: '61.2',
      unit: '%',
      delta: -3.1,
      direction: 'up',
      spark: fallbackSpark(30, 63, 2),
    },
  ]
}

function pctChange(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null
  return ((current - prior) / prior) * 100
}

function absoluteChangePct(
  current: number | null,
  prior: number | null,
): number | null {
  if (current == null || prior == null) return null
  return current - prior
}

// Deterministic synthetic sparkline used as a visual placeholder when
// the aggregate endpoint hasn't emitted the series yet. Stable across
// reloads so the dashboard doesn't flicker.
function fallbackSpark(n: number, base: number, vol: number): number[] {
  const out: number[] = []
  let v = base
  for (let i = 0; i < n; i++) {
    v += (hash(i * 7) - 0.5) * vol
    out.push(Math.max(0, v))
  }
  return out
}
function hash(i: number): number {
  // Cheap deterministic 0..1.
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
