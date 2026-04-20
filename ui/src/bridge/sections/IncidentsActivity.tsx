import { useMemo } from 'react'

import { useDashboardData } from '@/context/DashboardDataContext'
import { Heatmap } from '@/bridge/primitives'
import { incidents, type IncidentSeverity } from '@/bridge/syntheticData'
import { SectionHeader } from './SectionHeader'

/**
 * Incidents + Activity heatmap row — 1.2fr / 1fr split.
 *
 *   - Left: synthetic incident feed (3 deterministic entries).
 *     Incidents aren't exposed by `/api/aggregate` yet; the row is
 *     shaped for future replacement with a real alerts stream.
 *   - Right: real 7 × 24 activity heatmap reshaped from
 *     `data.heatmap.cells` (Mon-first, matching the existing
 *     `/api/aggregate` contract).
 */
export function IncidentsActivity() {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: '1.2fr 1fr' }}
    >
      <IncidentsCard />
      <ActivityCard />
    </div>
  )
}

// ── Incidents ────────────────────────────────────────────────────────
function IncidentsCard() {
  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: 16,
      }}
    >
      <SectionHeader
        title="Incidents"
        sub="regression alerts this window"
        compact
      />
      <div className="flex flex-col">
        {incidents.map((inc, i) => (
          <IncidentRow key={i} incident={inc} first={i === 0} />
        ))}
      </div>
    </div>
  )
}

function severityColor(sev: IncidentSeverity): string {
  switch (sev) {
    case 'high':
      return 'hsl(var(--poor))'
    case 'med':
      return 'hsl(var(--fair))'
    case 'low':
    default:
      return 'hsl(var(--muted-foreground))'
  }
}

function IncidentRow({
  incident,
  first,
}: {
  incident: (typeof incidents)[number]
  first: boolean
}) {
  const sev = severityColor(incident.severity)
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '10px 0',
        borderTop: first ? 'none' : '1px solid hsl(var(--border))',
      }}
    >
      <div
        style={{
          width: 3,
          background: sev,
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div className="flex items-baseline" style={{ gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            {incident.time}
          </span>
          <span
            style={{
              fontSize: 10,
              color: sev,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {incident.severity}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginTop: 2,
            letterSpacing: '-0.005em',
          }}
        >
          {incident.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'hsl(var(--text-dim))',
            marginTop: 2,
          }}
        >
          {incident.detail}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            marginTop: 3,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          affects {incident.affects}
        </div>
      </div>
    </div>
  )
}

// ── Activity heatmap ────────────────────────────────────────────────
// Server `heatmap.cells` uses `dow` in [0..6] Mon-first (see
// `ActivityRow.tsx` for the canonical reshape). The bridge design
// wants Sun-first row labels, so we reorder at render time without
// changing the data contract.
const DAYS_SUN_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ActivityCard() {
  const { data } = useDashboardData()

  // Build Sun-first 7×24 grid from cells.
  const grid = useMemo<Array<Array<number | null>>>(() => {
    const monFirst: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0),
    )
    for (const c of data?.heatmap.cells ?? []) {
      if (c.dow < 0 || c.dow > 6) continue
      if (c.hour < 0 || c.hour > 23) continue
      monFirst[c.dow][c.hour] = c.count
    }
    // Mon-first → Sun-first reorder: Sun is index 6 in Mon-first.
    const sunFirst: number[][] = [
      monFirst[6],
      monFirst[0],
      monFirst[1],
      monFirst[2],
      monFirst[3],
      monFirst[4],
      monFirst[5],
    ]
    return sunFirst
  }, [data])

  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: 16,
      }}
    >
      <SectionHeader
        title="Activity heatmap"
        sub="Sessions · local time · last 7 days"
        compact
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            fontSize: 9,
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            paddingTop: 2,
          }}
        >
          {DAYS_SUN_FIRST.map((day) => (
            <div key={day} style={{ height: 14 }}>
              {day}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Heatmap
            data={grid}
            cellW={14}
            cellH={14}
            gap={2}
            color="hsl(var(--primary))"
            empty="hsl(var(--border) / 0.4)"
          />
          <div
            className="flex justify-between"
            style={{
              marginTop: 4,
              fontSize: 9,
              color: 'hsl(var(--muted-foreground))',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            }}
          >
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </div>
      </div>
      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 14,
          fontSize: 10,
          color: 'hsl(var(--muted-foreground))',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        <span>peak activity window</span>
        <div className="flex items-center" style={{ gap: 4 }}>
          <span>less</span>
          {[0.15, 0.35, 0.55, 0.75, 1].map((o) => (
            <div
              key={o}
              style={{
                width: 10,
                height: 10,
                background: 'hsl(var(--primary))',
                opacity: o,
                borderRadius: 2,
              }}
            />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  )
}
