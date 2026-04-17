import type { ReactNode } from 'react'
import { TimeRangeSelector } from '@/components/TimeRangeSelector'

/**
 * Permanent dashboard chrome: a sticky app header + a max-width main container.
 *
 * Future DASH tasks drop their widgets in as `children` inside the main area.
 * The header's center slot is intentionally empty today — reserved for
 * additional global filters later in the roadmap.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-6">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold tracking-tight">
              Jinsong
            </span>
            <span className="text-xs text-muted-foreground">
              Agent Experience
            </span>
          </div>

          {/* Reserved for future global filters. */}
          <div className="flex-1" aria-hidden="true" />

          <div className="flex items-center">
            <TimeRangeSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  )
}
