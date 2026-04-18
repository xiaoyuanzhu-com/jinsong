import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Shared Pill primitive (DASH-12).
 *
 * Small status chip used across the dashboard — Good/Fair/Poor verdicts on
 * the session detail page, "done" markers in the session table, and any
 * future compact status text. Normalises radius, padding, letter-spacing
 * and colour tokens so every pill looks identical regardless of callsite.
 *
 * Variants map to the semantic CSS vars (`--good` / `--fair` / `--poor`)
 * declared in `index.css`; `muted` is the catch-all for non-verdict text.
 */
export type PillVariant = 'good' | 'fair' | 'poor' | 'muted' | 'neutral'

const VARIANT_CLASSES: Record<PillVariant, string> = {
  good: 'bg-good/15 text-good',
  fair: 'bg-fair/15 text-fair',
  poor: 'bg-poor/15 text-poor',
  muted: 'bg-muted text-muted-foreground',
  neutral: 'bg-foreground/10 text-foreground',
}

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
  /** If true, renders an uppercase label with tracked letter-spacing. */
  uppercase?: boolean
}

export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(
  (
    { className, variant = 'muted', uppercase = true, children, ...props },
    ref,
  ) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums',
        uppercase && 'uppercase tracking-wider',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
)
Pill.displayName = 'Pill'
