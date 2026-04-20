/**
 * Compact trend line for KPI cards. Accepts a stroke color (typically a
 * `hsl(var(--primary))` reference so light/dark follows the theme) and
 * optional fill style. Degrades to null when the series is empty so
 * callers can render a placeholder.
 */
export type SparklineStyle = 'line' | 'area' | 'bar'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  style?: SparklineStyle
}

export function Sparkline({
  data,
  width = 120,
  height = 30,
  stroke = 'currentColor',
  fill,
  style = 'line',
}: SparklineProps) {
  if (!data || data.length === 0) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / Math.max(1, data.length - 1)
  const pts: Array<[number, number]> = data.map((v, i) => [
    i * step,
    height - ((v - min) / range) * height,
  ])
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ')

  if (style === 'bar') {
    const bw = Math.max(1, step * 0.6)
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        {pts.map(([x, y], i) => (
          <rect
            key={i}
            x={x - bw / 2}
            y={y}
            width={bw}
            height={height - y}
            fill={stroke}
            opacity={0.85}
          />
        ))}
      </svg>
    )
  }

  if (style === 'area') {
    const area = d + ` L${width},${height} L0,${height} Z`
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <path d={area} fill={fill ?? stroke} fillOpacity={0.15} />
        <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} />
      </svg>
    )
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} />
    </svg>
  )
}
