import { useEffect, useState, type ReactNode } from 'react'
import { TimeRangeSelector } from '@/components/TimeRangeSelector'

/**
 * Permanent dashboard chrome: a sticky app header + a max-width main container.
 *
 * DASH-12 polish: the header surfaces a build-timestamp caption from
 * `/api/status` (falls back gracefully when unavailable), and the main
 * content area gets a one-shot fade-in so reloads don't feel abrupt.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const startedAt = useServerStartedAt()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-6">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold tracking-tight">
              Jinsong
            </span>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Agent Experience
            </span>
            {startedAt && (
              <span
                className="hidden text-[11px] tabular-nums text-muted-foreground/70 md:inline"
                title={`Server started ${new Date(startedAt).toLocaleString()}`}
              >
                · started {formatStartedAt(startedAt)}
              </span>
            )}
          </div>

          {/* Reserved for future global filters. */}
          <div className="flex-1" aria-hidden="true" />

          <div className="flex items-center">
            <TimeRangeSelector />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] animate-fade-in px-6 py-6">
        {children}
      </main>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function useServerStartedAt(): string | null {
  const [startedAt, setStartedAt] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/status', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return
        const v = body && typeof body.startedAt === 'string' ? body.startedAt : null
        setStartedAt(v)
      })
      .catch(() => {
        /* header caption is non-critical */
      })
    return () => {
      cancelled = true
    }
  }, [])
  return startedAt
}

/** Format an ISO timestamp as `HH:MM` today / `Mon D HH:MM` otherwise. */
function formatStartedAt(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  if (sameDay) return `${hh}:${mm}`
  const month = d.toLocaleString('en-US', { month: 'short' })
  return `${month} ${d.getDate()} ${hh}:${mm}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}
