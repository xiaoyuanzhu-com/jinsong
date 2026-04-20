/**
 * Small good/fair/poor verdict pill. Uses `color-mix()` for the tinted
 * background and border so the pill follows the theme's good/fair/poor
 * CSS vars in both light and dark mode.
 */
export type Verdict = 'good' | 'fair' | 'poor'

interface VerdictPillProps {
  verdict: Verdict
  label?: string
}

const tokenByVerdict: Record<Verdict, string> = {
  good: '--good',
  fair: '--fair',
  poor: '--poor',
}

export function VerdictPill({ verdict, label }: VerdictPillProps) {
  const token = tokenByVerdict[verdict]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        background: `hsl(var(${token}) / 0.13)`,
        color: `hsl(var(${token}))`,
        border: `1px solid hsl(var(${token}) / 0.27)`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: `hsl(var(${token}))`,
        }}
      />
      {label ?? verdict}
    </span>
  )
}
