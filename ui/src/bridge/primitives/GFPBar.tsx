/**
 * Good / Fair / Poor stacked ratio bar. Inputs are percent shares
 * (not raw counts); they don't need to sum to 100 — the component
 * normalizes. Zero-width segments collapse cleanly.
 */
interface GFPBarProps {
  good: number
  fair: number
  poor: number
  height?: number
  colors?: [string, string, string]
}

export function GFPBar({
  good,
  fair,
  poor,
  height = 6,
  colors = [
    'hsl(var(--good))',
    'hsl(var(--fair))',
    'hsl(var(--poor))',
  ],
}: GFPBarProps) {
  const total = good + fair + poor || 1
  return (
    <div
      style={{
        display: 'flex',
        height,
        width: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        background: 'hsl(var(--border) / 0.35)',
      }}
    >
      <div style={{ width: `${(good / total) * 100}%`, background: colors[0] }} />
      <div style={{ width: `${(fair / total) * 100}%`, background: colors[1] }} />
      <div style={{ width: `${(poor / total) * 100}%`, background: colors[2] }} />
    </div>
  )
}
