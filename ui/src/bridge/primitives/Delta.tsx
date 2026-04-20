/**
 * ▲/▼ percent-change chip with direction-aware good/bad coloring:
 *   - `direction: 'up'`   → positive is good (e.g. task completion)
 *   - `direction: 'down'` → positive is bad (e.g. stall ratio)
 */
interface DeltaProps {
  value: number | null | undefined
  direction?: 'up' | 'down'
}

export function Delta({ value, direction = 'up' }: DeltaProps) {
  if (value == null || Number.isNaN(value)) {
    return (
      <span
        style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}
      >
        —
      </span>
    )
  }
  const positive = value > 0
  const isGood = direction === 'up' ? positive : !positive
  const color = isGood ? 'hsl(var(--good))' : 'hsl(var(--poor))'
  const arrow = positive ? '▲' : '▼'
  return (
    <span
      style={{
        color,
        fontSize: 11,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 500,
      }}
    >
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  )
}
