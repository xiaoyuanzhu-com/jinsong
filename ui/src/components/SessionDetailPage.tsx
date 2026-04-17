import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardShell } from '@/components/DashboardShell'
import {
  fetchSessionById,
  SessionNotFoundError,
  type SessionRow,
} from '@/lib/api'
import {
  GROUPS,
  type Metric,
  metricsForGroup,
  type Verdict,
} from '@/lib/metricCatalog'
import { cn } from '@/lib/utils'

/**
 * Session detail page (DASH-10).
 *
 * Renders every one of the 35 metrics for a single session, grouped into
 * six cards (Operational + the five AX pillars). Each metric row shows:
 * label + optional note, the formatted value, and — when a threshold is
 * defined — a Good/Fair/Poor pill.
 *
 * Shape fed to each card is purely driven by `metricCatalog.ts`; the layout
 * here is intentionally dumb so future metric additions need zero edits
 * to this file.
 */
export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [row, setRow] = useState<SessionRow | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setRow(null)
    setError(null)
    setNotFound(false)
    fetchSessionById(id)
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof SessionNotFoundError) {
          setNotFound(true)
        } else {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <DashboardShell>
      <BackLink />

      {notFound ? (
        <EmptyState
          title="Session not found"
          body={
            <>
              No session with id{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {id ?? ''}
              </code>{' '}
              exists in the local database.
            </>
          }
        />
      ) : error ? (
        <EmptyState
          title="Failed to load session"
          body={<span className="text-poor">{error.message}</span>}
        />
      ) : row == null ? (
        <LoadingState />
      ) : (
        <Loaded row={row} />
      )}
    </DashboardShell>
  )
}

function BackLink() {
  return (
    <div className="mb-4 text-xs text-muted-foreground">
      <Link
        to="/"
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <span aria-hidden="true">←</span>
        <span>back to dashboard</span>
      </Link>
    </div>
  )
}

// ─── Loaded view ───────────────────────────────────────────────────────────

function Loaded({ row }: { row: SessionRow }) {
  return (
    <>
      <SessionHeader row={row} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <MetricGroupCard
            key={g.id}
            title={g.name}
            tagline={g.tagline}
            metrics={metricsForGroup(g.id)}
            row={row}
          />
        ))}
      </div>
    </>
  )
}

function SessionHeader({ row }: { row: SessionRow }) {
  const s = row.session
  const started = new Date(s.started_at)
  const durationStr = formatDurationMs(s.duration_ms)
  return (
    <section
      aria-label="Session header"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Session
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-foreground break-all">
        {s.session_id}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs md:grid-cols-4">
        <HeaderField label="Started" value={started.toLocaleString()} />
        <HeaderField label="Agent" value={s.agent_name} />
        <HeaderField label="Model" value={s.model_id} />
        <HeaderField label="Duration" value={durationStr} />
      </div>
    </section>
  )
}

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm tabular-nums text-foreground">
        {value}
      </div>
    </div>
  )
}

interface MetricGroupCardProps {
  title: string
  tagline: string
  metrics: Metric[]
  row: SessionRow
}

function MetricGroupCard({
  title,
  tagline,
  metrics,
  row,
}: MetricGroupCardProps) {
  return (
    <Card className="p-0">
      <CardHeader className="flex flex-row items-baseline justify-between gap-3 space-y-0 p-4 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <div className="text-[11px] text-muted-foreground">{tagline}</div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {metrics.map((m) => (
            <MetricRow key={m.id} metric={m} row={row} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function MetricRow({ metric, row }: { metric: Metric; row: SessionRow }) {
  const raw = metric.extract(row)
  const value = metric.format(raw)
  const verdict: Verdict = metric.classify ? metric.classify(raw) : null
  return (
    <li className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs text-foreground">{metric.label}</div>
        {metric.note && (
          <div className="truncate text-[10px] text-muted-foreground">
            {metric.note}
          </div>
        )}
      </div>
      <div
        className={cn(
          'tabular-nums text-xs text-right',
          value === '—' ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </div>
      <div className="w-12 text-right">
        {verdict && <VerdictPill verdict={verdict} />}
      </div>
    </li>
  )
}

function VerdictPill({ verdict }: { verdict: Exclude<Verdict, null> }) {
  const cls =
    verdict === 'good'
      ? 'bg-good/15 text-good'
      : verdict === 'fair'
        ? 'bg-fair/15 text-fair'
        : 'bg-poor/15 text-poor'
  const label =
    verdict === 'good' ? 'Good' : verdict === 'fair' ? 'Fair' : 'Poor'
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        cls,
      )}
    >
      {label}
    </span>
  )
}

// ─── Loading / empty states ────────────────────────────────────────────────

function LoadingState() {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-1.5 h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-32" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 5 }).map((__, j) => (
                <Skeleton key={j} className="h-3 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}

function EmptyState({
  title,
  body,
}: {
  title: string
  body: React.ReactNode
}) {
  return (
    <Card className="p-6">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{body}</div>
    </Card>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const remS = s % 60
  if (m < 60) return remS === 0 ? `${m}m` : `${m}m ${remS}s`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM === 0 ? `${h}h` : `${h}h ${remM}m`
}
