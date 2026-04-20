import { useMemo } from 'react'

/**
 * Hero trend chart — AXS area + stall-ratio dashed overlay with a
 * regression-marker line. Dates are parsed from ISO strings at render
 * time; `regressionIndex` places a vertical annotation (defaults to
 * `null`, which hides the marker).
 */
export interface TrendPoint {
  date: string
  axs: number
  stall: number
}

interface TrendChartProps {
  data: TrendPoint[]
  width?: number
  height?: number
  color?: string
  secondColor?: string
  bg?: string
  style?: 'area' | 'line'
  showSecond?: boolean
  axisColor?: string
  gridColor?: string
  regressionIndex?: number | null
  regressionLabel?: string
}

export function TrendChart({
  data,
  width = 720,
  height = 200,
  color = 'hsl(var(--primary))',
  secondColor = 'hsl(var(--accent-2))',
  bg = 'transparent',
  style = 'area',
  showSecond = true,
  axisColor = 'hsl(var(--muted-foreground))',
  gridColor = 'hsl(var(--border))',
  regressionIndex = null,
  regressionLabel = 'model update',
}: TrendChartProps) {
  const { dPrimary, dArea, dStall, guides, stallPoints, regressX, xTicks } =
    useMemo(() => {
      const pad = { t: 14, r: 40, b: 22, l: 34 }
      const w = width - pad.l - pad.r
      const h = height - pad.t - pad.b

      const denom = Math.max(1, data.length - 1)
      const xs = data.map((_, i) => pad.l + (i / denom) * w)
      const axsVals = data.map((d) => d.axs)
      const aMin = Math.min(...axsVals) - 2
      const aMax = Math.max(...axsVals) + 2
      const y1 = (v: number) =>
        pad.t + (1 - (v - aMin) / (aMax - aMin || 1)) * h

      const stallVals = data.map((d) => d.stall)
      const sMin = 0
      const sMax = Math.max(...stallVals) + 2
      const y2 = (v: number) =>
        pad.t + (1 - (v - sMin) / (sMax - sMin || 1)) * h

      const pts1: Array<[number, number]> = xs.map((x, i) => [x, y1(axsVals[i])])
      const pts2: Array<[number, number]> = xs.map((x, i) => [x, y2(stallVals[i])])
      const prim = pts1
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
        .join(' ')
      const area =
        pts1.length > 0
          ? prim + ` L${pts1[pts1.length - 1][0]},${pad.t + h} L${pts1[0][0]},${pad.t + h} Z`
          : ''
      const stall = pts2
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
        .join(' ')

      const g = [aMax, (aMax + aMin) / 2, aMin].map((v, i) => ({
        y: pad.t + (i * h) / 2,
        label: Math.round(v),
      }))

      const regX =
        regressionIndex != null && regressionIndex >= 0 && regressionIndex < xs.length
          ? xs[regressionIndex]
          : null

      // Tick every ~6th point; include first and last for orientation.
      const tickEvery = Math.max(1, Math.floor(data.length / 5))
      const ticks = data
        .map((d, i) =>
          i % tickEvery === 0 || i === data.length - 1
            ? { x: xs[i], date: d.date }
            : null,
        )
        .filter((t): t is { x: number; date: string } => t !== null)

      return {
        dPrimary: prim,
        dArea: area,
        dStall: stall,
        guides: g,
        stallPoints: pts2,
        regressX: regX,
        xTicks: ticks,
      }
    }, [data, width, height, regressionIndex])

  const fmtTick = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', background: bg, overflow: 'visible' }}
    >
      {guides.map((g, i) => (
        <g key={i}>
          <line
            x1={34}
            y1={g.y}
            x2={width - 40}
            y2={g.y}
            stroke={gridColor}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <text
            x={28}
            y={g.y + 4}
            textAnchor="end"
            fontSize={10}
            fill={axisColor}
            fontFamily="inherit"
          >
            {g.label}
          </text>
        </g>
      ))}

      {regressX != null && (
        <>
          <line
            x1={regressX}
            y1={14}
            x2={regressX}
            y2={height - 22}
            stroke="hsl(var(--poor))"
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={0.6}
          />
          <text
            x={regressX + 4}
            y={20}
            fontSize={9}
            fill="hsl(var(--poor))"
            fontFamily="inherit"
          >
            {regressionLabel}
          </text>
        </>
      )}

      {style === 'area' && dArea && <path d={dArea} fill={color} fillOpacity={0.12} />}
      <path d={dPrimary} fill="none" stroke={color} strokeWidth={1.8} />

      {showSecond && (
        <path
          d={dStall}
          fill="none"
          stroke={secondColor}
          strokeWidth={1.3}
          strokeDasharray="2 2"
        />
      )}
      {showSecond &&
        stallPoints
          .filter((_, i) => i % 5 === 0)
          .map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={2} fill={secondColor} />
          ))}

      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={height - 6}
          textAnchor="middle"
          fontSize={10}
          fill={axisColor}
          fontFamily="inherit"
        >
          {fmtTick(t.date)}
        </text>
      ))}
    </svg>
  )
}
