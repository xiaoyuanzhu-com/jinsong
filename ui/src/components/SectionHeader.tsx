import type { ReactNode } from 'react'

/**
 * Shared section header (DASH-12).
 *
 * Standardises the small uppercase label that sits above every dashboard
 * row. Before this component each row declared its own `<h2>` with
 * slightly different spacing; this normalises the type scale (11px /
 * 0.08em tracking / muted) and vertical rhythm across the page.
 */
export interface SectionHeaderProps {
  /** Left-aligned title, rendered in the micro-label style. */
  title: ReactNode
  /** Optional right-aligned caption (e.g. "Last 30 days"). */
  caption?: ReactNode
  /** Extra classes for the outer flex container. */
  className?: string
}

export function SectionHeader({ title, caption, className }: SectionHeaderProps) {
  return (
    <div
      className={
        'mb-3 flex items-baseline justify-between gap-3' +
        (className ? ` ${className}` : '')
      }
    >
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      {caption != null && (
        <div className="text-[11px] tabular-nums text-muted-foreground/80">
          {caption}
        </div>
      )}
    </div>
  )
}
