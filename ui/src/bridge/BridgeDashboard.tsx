import { DashboardDataProvider, useDashboardData } from '@/context/DashboardDataContext'
import { ErrorCard } from '@/components/RowStates'
import { TopBar } from './sections/TopBar'
import { HeroRow } from './sections/HeroRow'
import { PillarsRow } from './sections/PillarsRow'
import { IncidentsActivity } from './sections/IncidentsActivity'
import { MatrixRow } from './sections/MatrixRow'
import { SessionsTable } from './sections/SessionsTable'

/**
 * Bridge-direction dashboard (DASH-13). Replaces the DASH-3..10 row
 * stack with the handoff's "phase breakdown" IA:
 *
 *   TopBar  — brand + filters + range
 *   HeroRow — Agent Experience Score + 5 KPIs
 *   PillarsRow — 5 phase cards (Initiation → Resolution)
 *   IncidentsActivity — synthetic incidents + real activity heatmap
 *   MatrixRow — synthetic agent × model AXS matrix
 *   SessionsTable — real recent sessions + stall waveform
 *
 * Data is hybrid: hero KPIs/pillars/heatmap/sessions pull from
 * `/api/aggregate` via `DashboardDataContext`; AXS headline, incidents,
 * and the agent×model matrix are synthetic (see `syntheticData.ts`).
 */
export function BridgeDashboard() {
  return (
    <DashboardDataProvider>
      <BridgeShell />
    </DashboardDataProvider>
  )
}

function BridgeShell() {
  const { error, retry, data, isLoading } = useDashboardData()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        fontSize: 13,
        lineHeight: 1.45,
      }}
    >
      <TopBar />
      <main
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '18px 22px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {error && !isLoading && !data ? (
          <ErrorCard
            title="Failed to load dashboard data"
            message={error}
            onRetry={retry}
          />
        ) : (
          <>
            <HeroRow />
            <PillarsRow />
            <IncidentsActivity />
            <MatrixRow />
            <SessionsTable />
          </>
        )}
      </main>
    </div>
  )
}
