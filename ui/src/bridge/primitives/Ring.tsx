/**
 * Score ring — donut-style progress with centered numeric label.
 * Used in the 5 phase-pillar cards. Score is clamped to [0, 100].
 */
interface RingProps {
  score: number
  size?: number
  stroke?: number
  color?: string
  track?: string
  label?: boolean
  labelColor?: string
  font?: string
}

export function Ring({
  score,
  size = 72,
  stroke = 8,
  color = 'hsl(var(--primary))',
  track = 'hsl(var(--border))',
  label = true,
  labelColor = 'hsl(var(--foreground))',
  font = 'inherit',
}: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {label && (
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={labelColor}
          fontFamily={font}
          fontSize={size * 0.3}
          fontWeight={600}
        >
          {score}
        </text>
      )}
    </svg>
  )
}
