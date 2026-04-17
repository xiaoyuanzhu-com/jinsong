import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRange } from '@/context/RangeContext'
import { fetchSessions, type SessionRow } from '@/lib/api'
import { filterByRange } from '@/lib/aggregate'

/**
 * Session list row (DASH-10).
 *
 * Dense table of sessions in the active time range, most recent first. Each
 * row is a react-router `<Link>` to the corresponding `/session/:id` detail
 * page. Respects the global range filter (same hook as the rest of the
 * dashboard rows) so switching to "7d" immediately narrows the list.
 *
 * Intentionally minimal columns — we want a quick drill-down affordance,
 * not a replacement for a full sessions explorer.
 */
export function SessionTableRow() {
  const { range } = useRange()
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSessions()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setRows([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (rows == null) return null
    return filterByRange(rows, range).sort((a, b) => {
      // Most recent first. Sort is stable so equal timestamps keep their
      // original order from the API.
      const ta = Date.parse(a.session.started_at)
      const tb = Date.parse(b.session.started_at)
      return tb - ta
    })
  }, [rows, range])

  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <div className="text-sm font-semibold">Sessions</div>
        <div className="text-[11px] text-muted-foreground">
          {filtered == null
            ? ''
            : filtered.length === 0
              ? 'none in range'
              : `${filtered.length} in range`}
        </div>
      </div>

      {filtered == null ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyRow error={error} />
      ) : (
        <Table rows={filtered} />
      )}
    </Card>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-1 px-4 pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  )
}

function EmptyRow({ error }: { error: string | null }) {
  return (
    <div className="px-4 pb-4 text-xs text-muted-foreground">
      {error ? `Failed to load sessions: ${error}` : 'No sessions in range.'}
    </div>
  )
}

function Table({ rows }: { rows: SessionRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border/70 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Th>Started</Th>
            <Th>Agent</Th>
            <Th>Model</Th>
            <ThRight>Duration</ThRight>
            <ThRight>Turns</ThRight>
            <ThRight>Tools</ThRight>
            <ThRight>TTFT</ThRight>
            <Th>Task</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <SessionListRow key={r.session.session_id} row={r} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SessionListRow({ row }: { row: SessionRow }) {
  const s = row.session
  const m = row.metrics
  const started = new Date(s.started_at)
  const ttft = m?.r_time_to_first_token
  return (
    <tr className="group border-b border-border/40 last:border-b-0 hover:bg-muted/40">
      <TdLink id={s.session_id}>
        <span className="tabular-nums text-foreground/90">
          {formatShortDateTime(started)}
        </span>
      </TdLink>
      <Td>
        <span className="truncate text-foreground/80">{s.agent_name}</span>
      </Td>
      <Td>
        <span className="truncate text-muted-foreground">{s.model_id}</span>
      </Td>
      <TdRight>{formatDurationMs(s.duration_ms)}</TdRight>
      <TdRight>{s.total_turns}</TdRight>
      <TdRight>{s.total_tool_calls}</TdRight>
      <TdRight>
        {typeof ttft === 'number' && Number.isFinite(ttft)
          ? formatSeconds(ttft)
          : '—'}
      </TdRight>
      <Td>
        {s.task_completed ? (
          <span className="text-good">done</span>
        ) : (
          <span className="text-muted-foreground">{s.end_reason}</span>
        )}
      </Td>
    </tr>
  )
}

// ─── Cells ─────────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
      {children}
    </th>
  )
}

function ThRight({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="max-w-[220px] overflow-hidden px-3 py-1.5 align-middle">
      {children}
    </td>
  )
}

function TdRight({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-3 py-1.5 text-right tabular-nums align-middle">
      {children}
    </td>
  )
}

/**
 * Left-most cell: wraps the child in a `<Link>` to the detail page. Only the
 * first cell is a link so keyboard focus lands once per row — the whole row
 * still visually highlights on hover via the `tr:hover` rule above.
 */
function TdLink({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <td className="px-3 py-1.5 align-middle">
      <Link
        to={`/session/${encodeURIComponent(id)}`}
        className="hover:text-primary hover:underline"
      >
        {children}
      </Link>
    </td>
  )
}

// ─── Formatters ────────────────────────────────────────────────────────────

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

/** YYYY-MM-DD HH:MM — locale-free and compact. */
function formatShortDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const mo = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${y}-${mo}-${dd} ${hh}:${mm}`
}

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

function formatSeconds(s: number): string {
  if (s < 1) return `${Math.round(s * 1000)}ms`
  return `${s.toFixed(1)}s`
}
