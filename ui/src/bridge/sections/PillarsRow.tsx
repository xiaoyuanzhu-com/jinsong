import { useDashboardData } from '@/context/DashboardDataContext'
import type { AggregatePillar, PillarId } from '@/lib/aggregate-types'
import { Ring, GFPBar, Delta } from '@/bridge/primitives'
import { SectionHeader } from './SectionHeader'

/**
 * Phase breakdown — one card per AX pillar. The handoff uses the
 * "phase" framing (Initiation → Progress → Interaction → Delivery →
 * Resolution) over the existing `/api/aggregate` pillar ids
 * (responsiveness / reliability / autonomy / correctness / completion).
 * The ids line up 1:1 semantically, so we relabel here rather than
 * migrating the server payload.
 */
interface BridgePhase {
  id: PillarId
  index: number
  name: string
  tagline: string
  formatHead: (v: number | null) => string
  /** Is a positive delta a good or bad signal for this pillar? */
  direction: 'up' | 'down'
  /** Accent color for this pillar's ring. */
  ringColor: string
}

const PHASES: BridgePhase[] = [
  {
    id: 'responsiveness',
    index: 1,
    name: 'Initiation',
    tagline: 'Did it start?',
    formatHead: (v) => (v == null ? '—' : `${v.toFixed(1)}s TTFR`),
    direction: 'down',
    ringColor: 'hsl(var(--primary))',
  },
  {
    id: 'reliability',
    index: 2,
    name: 'Progress',
    tagline: 'Forward motion?',
    formatHead: (v) =>
      v == null ? '—' : `${(v * 100).toFixed(1)}% stall`,
    direction: 'down',
    ringColor: 'hsl(var(--accent-2))',
  },
  {
    id: 'autonomy',
    index: 3,
    name: 'Interaction',
    tagline: 'Smooth handoff?',
    formatHead: (v) => (v == null ? '—' : `${v.toFixed(1)} steers`),
    direction: 'down',
    ringColor: 'hsl(var(--good))',
  },
  {
    id: 'correctness',
    index: 4,
    name: 'Delivery',
    tagline: 'Was it right?',
    formatHead: (v) =>
      v == null ? '—' : `${Math.round(v * 100)}% first-try`,
    direction: 'up',
    ringColor: 'hsl(var(--primary))',
  },
  {
    id: 'completion',
    index: 5,
    name: 'Resolution',
    tagline: 'Worth it?',
    formatHead: (v) =>
      v == null
        ? '—'
        : Math.abs(v) < 10
          ? `${v.toFixed(1)}% return`
          : `${Math.round(v)}% return`,
    direction: 'up',
    ringColor: 'hsl(var(--accent-2))',
  },
]

const EMPTY: Omit<AggregatePillar, 'id'> = {
  good: 0,
  fair: 0,
  poor: 0,
  headline: { value: null, delta: null },
}

export function PillarsRow() {
  const { data } = useDashboardData()
  const byId = new Map<PillarId, AggregatePillar>()
  for (const p of data?.pillars ?? []) byId.set(p.id, p)

  return (
    <section aria-label="Phase breakdown">
      <SectionHeader
        title="Phase breakdown"
        sub="Initiation → Progress → Interaction → Delivery → Resolution"
      />
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
      >
        {PHASES.map((phase) => {
          const payload: AggregatePillar =
            byId.get(phase.id) ?? { id: phase.id, ...EMPTY }
          return <PhaseCard key={phase.id} phase={phase} payload={payload} />
        })}
      </div>
    </section>
  )
}

function scoreFromGfp(good: number, fair: number, poor: number): number {
  const total = good + fair + poor
  if (total === 0) return 0
  return Math.round(((good * 1 + fair * 0.5) / total) * 100)
}

function PhaseCard({
  phase,
  payload,
}: {
  phase: BridgePhase
  payload: AggregatePillar
}) {
  const { good, fair, poor, headline } = payload
  const total = good + fair + poor
  const goodPct = total > 0 ? Math.round((good / total) * 100) : 0
  const fairPct = total > 0 ? Math.round((fair / total) * 100) : 0
  const poorPct = total > 0 ? Math.round((poor / total) * 100) : 0
  const score = scoreFromGfp(good, fair, poor)

  return (
    <div
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
      }}
    >
      <div className="flex items-baseline" style={{ gap: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          0{phase.index}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {phase.name}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
        {phase.tagline}
      </div>
      <div
        className="flex items-center"
        style={{ gap: 10, marginTop: 4 }}
      >
        <Ring
          score={score}
          size={64}
          stroke={6}
          color={phase.ringColor}
        />
        <div className="flex flex-col" style={{ gap: 3 }}>
          <Delta
            value={
              headline.delta != null
                ? // `headline.delta` is in the pillar's natural unit; for the
                  // phase cards we display it as a percentage-point change.
                  headline.delta * (phase.id === 'reliability' ? 100 : 1)
                : null
            }
            direction={phase.direction}
          />
          <span
            style={{
              fontSize: 10,
              color: 'hsl(var(--text-dim))',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            }}
          >
            {phase.formatHead(headline.value)}
          </span>
        </div>
      </div>
      <GFPBar good={goodPct} fair={fairPct} poor={poorPct} height={4} />
      <div
        className="flex justify-between"
        style={{
          fontSize: 9,
          color: 'hsl(var(--muted-foreground))',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
        }}
      >
        <span>{goodPct}% good</span>
        <span>{fairPct}% fair</span>
        <span>{poorPct}% poor</span>
      </div>
    </div>
  )
}
