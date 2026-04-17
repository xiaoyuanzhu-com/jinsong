import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboardData } from '@/context/DashboardDataContext'
import type { AggregateSessionTableRow } from '@/lib/aggregate-types'

/**
 * Session list row.
 *
 * Dense table of sessions in the active time range, most recent first,
 * fed by precomputed `sessions_table` from `/api/aggregate` (DASH-11).
 * Server limits to the top-N most recent inside the selected range.
 */
export function SessionTableRow() {
  const { data, isLoading, error } = useDashboardData()

  const rows = data?.sessions_table ?? null

  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <div className="text-sm font-semibold">Sessions</div>
        <div className="text-[11px] text-muted-foreground">
          {rows == null
            ? ''
            : rows.length === 0
              ? 'none in range'
              : `${rows.length} shown`}
        </div>
      </div>

      {isLoading || rows == null ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyRow error={error} />
      ) : (
        <Table rows={rows} />
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
      {error
        ? `Failed to load dashboard data: ${error}`
        : 'No sessions in range.'}
    </div>
  )
}

function Table({ rows }: { rows: AggregateSessionTableRow[] }) {
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

function SessionListRow({ row }: { row: AggregateSessionTableRow }) {
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
