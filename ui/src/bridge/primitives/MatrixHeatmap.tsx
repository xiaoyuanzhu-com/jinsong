import { Fragment } from 'react'

/**
 * Agent × Model score matrix. Each cell renders a number with a tinted
 * background (red → amber → green) and a left rail colored by verdict
 * threshold. `null` cells render as "—". Cell tints are computed as
 * rgba() because SVG-free DOM cells can't use CSS-var-based hsl() with
 * per-cell opacity without dropping to `color-mix()`.
 */
interface MatrixHeatmapProps {
  matrix: Array<Array<number | null>>
  rowLabels: string[]
  colLabels: string[]
  cellW?: number
  cellH?: number
  font?: string
  textColor?: string
  mutedColor?: string
  goodColor?: string
  poorColor?: string
  trackColor?: string
}

export function MatrixHeatmap({
  matrix,
  rowLabels,
  colLabels,
  cellW = 64,
  cellH = 34,
  font = 'inherit',
  textColor = 'hsl(var(--foreground))',
  mutedColor = 'hsl(var(--muted-foreground))',
  goodColor = 'hsl(var(--good))',
  poorColor = 'hsl(var(--poor))',
  trackColor = 'hsl(var(--border) / 0.35)',
}: MatrixHeatmapProps) {
  const red: [number, number, number] = [239, 68, 68]
  const amber: [number, number, number] = [234, 179, 8]
  const green: [number, number, number] = [34, 197, 94]

  const mix = (
    a: [number, number, number],
    b: [number, number, number],
    t: number,
  ): [number, number, number] =>
    [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ] as [number, number, number]

  const scoreColor = (v: number | null) => {
    if (v == null) return trackColor
    const t = Math.max(0, Math.min(1, (v - 65) / 30))
    const rgb = t < 0.5 ? mix(red, amber, t * 2) : mix(amber, green, (t - 0.5) * 2)
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.22)`
  }
  const borderColor = (v: number | null) => {
    if (v == null) return 'transparent'
    const t = Math.max(0, Math.min(1, (v - 65) / 30))
    if (t < 0.33) return poorColor
    if (t < 0.66) return 'hsl(var(--fair))'
    return goodColor
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `120px repeat(${colLabels.length}, ${cellW}px)`,
        gap: 3,
        fontFamily: font,
      }}
    >
      <div />
      {colLabels.map((c) => (
        <div
          key={c}
          style={{
            fontSize: 10,
            color: mutedColor,
            textAlign: 'center',
            padding: '0 0 4px',
          }}
        >
          {c}
        </div>
      ))}
      {rowLabels.map((r, i) => (
        <Fragment key={r}>
          <div
            style={{
              fontSize: 11,
              color: textColor,
              display: 'flex',
              alignItems: 'center',
              paddingRight: 8,
            }}
          >
            {r}
          </div>
          {matrix[i].map((v, j) => (
            <div
              key={j}
              title={v == null ? 'no data' : String(v)}
              style={{
                width: cellW,
                height: cellH,
                background: scoreColor(v),
                borderLeft: `2px solid ${borderColor(v)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
                color: v == null ? mutedColor : textColor,
              }}
            >
              {v == null ? '—' : v}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}
