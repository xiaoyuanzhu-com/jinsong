/**
 * Per-session activity waveform. Each tick is either a non-zero bar
 * (session time active) or a flat red strip (stall event). The input
 * array is expected to be pre-normalized to values in roughly [0, 5].
 */
interface StallWaveProps {
  wave: number[]
  width?: number
  height?: number
  color?: string
  gap?: string
}

export function StallWave({
  wave,
  width = 140,
  height = 18,
  color = 'currentColor',
  gap = 'hsl(var(--poor))',
}: StallWaveProps) {
  if (!wave || wave.length === 0) return null
  const bw = width / wave.length
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {wave.map((v, i) => {
        if (v === 0) {
          return (
            <rect
              key={i}
              x={i * bw}
              y={height / 2 - 0.5}
              width={bw * 0.9}
              height={1}
              fill={gap}
            />
          )
        }
        const h = (v / 5) * height
        return (
          <rect
            key={i}
            x={i * bw}
            y={(height - h) / 2}
            width={bw * 0.9}
            height={h}
            fill={color}
            opacity={0.85}
          />
        )
      })}
    </svg>
  )
}
