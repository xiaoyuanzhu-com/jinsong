/**
 * Section heading — small eyebrow label + optional subtitle. Matches
 * the handoff typography (10/11px mono eyebrow, 12px serif-weight sub).
 */
interface SectionHeaderProps {
  title: string
  sub?: string
  compact?: boolean
}

export function SectionHeader({ title, sub, compact = false }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: compact ? 8 : 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: compact ? 10 : 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: 'hsl(var(--text-dim))',
              marginTop: 2,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
