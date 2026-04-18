import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shared row-level state views (DASH-12).
 *
 * Each dashboard row can be in one of four states: loading, loaded,
 * empty, or errored. Before this module each row home-rolled its own
 * one-liner error message and empty hint; this consolidates the visual
 * language so they all look identical (and, importantly, so the error
 * state surfaces a `Retry` button).
 *
 * These primitives don't replace per-row skeletons (those need to mirror
 * the row's exact geometry to avoid reflow) — they cover the simpler
 * error + empty states and give `SectionCard` an easy slot.
 */

export interface EmptyStateProps {
  label?: string
  /** Optional short hint under the label. */
  hint?: ReactNode
  className?: string
}

/**
 * Centred muted line for empty data. Use inside the body of a card when
 * the row has no sessions in the active range. Height is driven by the
 * parent (e.g. the chart's fixed body height) so the row footprint stays
 * constant whether data is present or not.
 */
export function EmptyState({
  label = 'No sessions in this range',
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground',
        className,
      )}
      role="status"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
        />
        {label}
      </span>
      {hint != null && (
        <span className="text-[11px] text-muted-foreground/70">{hint}</span>
      )}
    </div>
  )
}

export interface ErrorCardProps {
  /** Short headline, e.g. "Failed to load aggregate". */
  title?: string
  /** Underlying error message. Shown as small monospaced body. */
  message: string
  onRetry?: () => void
  /** Extra classes (e.g. to stretch across a grid row). */
  className?: string
}

/**
 * Compact red-muted error card with an optional Retry button. Used at the
 * row scope so one row's failure doesn't poison the rest of the page.
 */
export function ErrorCard({
  title = 'Failed to load aggregate',
  message,
  onRetry,
  className,
}: ErrorCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-2 border-poor/30 bg-poor/5 p-4 text-xs',
        className,
      )}
      role="alert"
    >
      <div className="flex items-center gap-2 text-poor">
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full bg-poor"
        />
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="font-mono text-[11px] leading-snug text-muted-foreground">
        {message}
      </p>
      {onRetry && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-7 border-poor/40 px-2.5 text-[11px] text-poor hover:bg-poor/10 hover:text-poor"
          >
            Retry
          </Button>
        </div>
      )}
    </Card>
  )
}
