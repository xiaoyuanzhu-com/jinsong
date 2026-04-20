/**
 * 2-D intensity grid — e.g. day-of-week × hour activity. `data[row][col]`
 * values are normalized to the grid-wide max. `null` values render as
 * the `empty` token color (for sparse matrices).
 */
interface HeatmapProps {
  data: Array<Array<number | null>>
  cellW?: number
  cellH?: number
  gap?: number
  scale?: (v: number) => number
  color?: string
  empty?: string
}

export function Heatmap({
  data,
  cellW = 14,
  cellH = 14,
  gap = 2,
  scale = (v) => v,
  color = 'hsl(var(--primary))',
  empty = 'hsl(var(--border) / 0.4)',
}: HeatmapProps) {
  if (!data.length || !data[0]?.length) return null
  const flat = data
    .flat()
    .filter((v): v is number => v != null && !Number.isNaN(v))
  const max = Math.max(...flat) || 1
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${data[0].length}, ${cellW}px)`,
        gap,
        width: 'fit-content',
      }}
    >
      {data.flat().map((v, i) => {
        if (v == null) {
          return (
            <div
              key={i}
              style={{
                width: cellW,
                height: cellH,
                background: empty,
                borderRadius: 2,
              }}
            />
          )
        }
        const intensity = Math.min(1, scale(v) / max)
        return (
          <div
            key={i}
            title={String(v)}
            style={{
              width: cellW,
              height: cellH,
              background: color,
              opacity: 0.15 + intensity * 0.85,
              borderRadius: 2,
            }}
          />
        )
      })}
    </div>
  )
}
