import { Link } from 'react-router-dom'

import { useDashboardData } from '@/context/DashboardDataContext'
import type { AggregateSessionTableRow } from '@/lib/aggregate-types'
import { StallWave } from '@/bridge/primitives'
import { makeStallWave } from '@/bridge/syntheticData'
import { SectionHeader } from './SectionHeader'

const COLS = '140px 1fr 130px 140px 180px 80px 72px 72px'

/**
 * Recent sessions table — real rows from `data.sessions_table`. The stall
 * waveform column is synthesized per row via `makeStallWave(seed, stalls)`
 * because per-tick session activity isn't exposed by `/api/aggregate`
 * yet; we use each session's `rel_stall_count` as the stall-event input
 * so the waveform at least correlates with the real signal.
 */
export function SessionsTable() {
  const { data } = useDashboardData()
  const rows = (data?.sessions_table ?? []).slice(0, 8)

  return (
    <section aria-label="Recent sessions">
      <SectionHeader
        title="Recent sessions"
        sub="stall waveform · gaps mark stall events"
      />
      <div
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        <HeaderRow />
        {rows.length === 0 ? (
          <div
            style={{
              padding: '18px 16px',
              fontSize: 12,
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            No sessions in range.
          </div>
        ) : (
          rows.map((r, i) => (
            <SessionRow
              key={r.session.session_id}
              row={r}
              last={i === rows.length - 1}
            />
          ))
        )}
      </div>
    </section>
  )
}

function HeaderRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: COLS,
        padding: '10px 16px',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'hsl(var(--muted-foreground))',
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--panel-2))',
      }}
    >
      <div>Started</div>
      <div>Session</div>
      <div>Agent</div>
      <div>Model</div>
      <div>Stall waveform</div>
      <div style={{ textAlign: 'right' }}>Dur</div>
      <div style={{ textAlign: 'right' }}>Turns</div>
      <div style={{ textAlign: 'right' }}>Status</div>
    </div>
  )
}

function SessionRow({
  row,
  last,
}: {
  row: AggregateSessionTableRow
  last: boolean
}) {
  const s = row.session
  const m = row.metrics
  const stalls = m?.rel_stall_count ?? 0
  const stallRatio = m?.rel_stall_ratio ?? 0
  // Verdict tiers mirror the prototype's good/fair/poor palette.
  const verdict: 'good' | 'fair' | 'poor' =
    !s.task_completed || stallRatio > 0.1
      ? 'poor'
      : stallRatio > 0.03
        ? 'fair'
        : 'good'
  const waveColor =
    verdict === 'good'
      ? 'hsl(var(--good))'
      : verdict === 'fair'
        ? 'hsl(var(--fair))'
        : 'hsl(var(--primary))'
  const wave = makeStallWave(s.session_id, Math.min(stalls, 6))
  const started = new Date(s.started_at)

  return (
    <Link
      to={`/session/${encodeURIComponent(s.session_id)}`}
      style={{
        display: 'grid',
        gridTemplateColumns: COLS,
        padding: '10px 16px',
        alignItems: 'center',
        fontSize: 12,
        borderBottom: last ? 'none' : '1px solid hsl(var(--border))',
        color: 'inherit',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'background 80ms ease',
      }}
      className="hover:bg-panel-2"
    >
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          color: 'hsl(var(--text-dim))',
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatShortDateTime(started)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {s.session_id.slice(0, 14)}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          {s.total_tool_calls} tools · {s.total_tokens_in + s.total_tokens_out}t
        </span>
      </div>
      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {s.agent_name}
      </div>
      <div
        style={{
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 11,
          color: 'hsl(var(--text-dim))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {s.model_id}
      </div>
      <div>
        <StallWave
          wave={wave}
          width={160}
          height={18}
          color={waveColor}
          gap="hsl(var(--poor))"
        />
      </div>
      <div
        style={{
          textAlign: 'right',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          color: 'hsl(var(--text-dim))',
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDurationMs(s.duration_ms)}
      </div>
      <div
        style={{
          textAlign: 'right',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {s.total_turns}
      </div>
      <div style={{ textAlign: 'right' }}>
        <VerdictChip verdict={verdict} label={s.task_completed ? 'done' : s.end_reason} />
      </div>
    </Link>
  )
}

function VerdictChip({
  verdict,
  label,
}: {
  verdict: 'good' | 'fair' | 'poor'
  label: string
}) {
  const tone =
    verdict === 'good'
      ? 'hsl(var(--good))'
      : verdict === 'fair'
        ? 'hsl(var(--fair))'
        : 'hsl(var(--poor))'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        fontSize: 10,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: tone,
        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 30%, transparent)`,
        borderRadius: 'var(--radius)',
      }}
    >
      {label}
    </span>
  )
}

// ── Formatters (local — intentionally duplicated from SessionTableRow so
// this section has no coupling to the old dashboard implementation) ──
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function formatShortDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—'
  const mo = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  return `${mo}-${dd} ${hh}:${mm}`
}

function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}
