import { Button } from '@/components/ui/button'
import { DemoChart } from '@/components/DemoChart'
import { DashboardShell } from '@/components/DashboardShell'
import { HeroKpiRow } from '@/components/HeroKpiRow'
import { PillarHealthRow } from '@/components/PillarHealthRow'
import { TrendsRow } from '@/components/TrendsRow'
import { DistributionsRow } from '@/components/DistributionsRow'
import { ToolPerformanceRow } from '@/components/ToolPerformanceRow'
import { ActivityRow } from '@/components/ActivityRow'
import { AgentModelRow } from '@/components/AgentModelRow'
import { SessionTableRow } from '@/components/SessionTableRow'
import { ErrorCard } from '@/components/RowStates'
import {
  DashboardDataProvider,
  useDashboardData,
} from '@/context/DashboardDataContext'

/**
 * Main dashboard page (route `/`). Extracted from `App.tsx` in DASH-10 so
 * the router can mount a sibling `/session/:id` detail page without this
 * tree re-rendering on navigation.
 */
export function DashboardPage() {
  return (
    <DashboardDataProvider>
      <DashboardPageInner />
    </DashboardDataProvider>
  )
}

function DashboardPageInner() {
  const { error, retry, data, isLoading } = useDashboardData()

  // Full-page error — render a single Retry card instead of 8 broken
  // rows. Loading + non-error paths fall through to the grid.
  if (error && !isLoading && !data) {
    return (
      <DashboardShell>
        <ErrorCard
          title="Failed to load dashboard data"
          message={error}
          onRetry={retry}
        />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      {/* Vertical rhythm: every row sits inside a single `space-y-8`
          container so the gap between rows is uniform. Previously each
          row set its own `mt-6` which made the spacing drift. */}
      <div className="space-y-8">
        {/* DASH-3: hero KPI row — six summary cards with sparklines. */}
        <HeroKpiRow />

        {/* DASH-4: pillar health row — five cards, one per AX pillar. */}
        <PillarHealthRow />

        {/* DASH-5: trends row — 4 timeline charts. */}
        <TrendsRow />

        {/* DASH-6: distributions row — 3 donut charts. */}
        <DistributionsRow />

        {/* DASH-7: tool performance row — 2 horizontal bar charts. */}
        <ToolPerformanceRow />

        {/* DASH-8: activity heatmap — 7 × 24 session count grid. */}
        <ActivityRow />

        {/* DASH-9: agent/model breakdown — 2 horizontal bar charts. */}
        <AgentModelRow />

        {/* DASH-10: session list — most recent first, links to /session/:id. */}
        <SessionTableRow />
      </div>

      {/* Smoke-test blocks kept below a hairline until they're formally
          retired — they don't belong to the dashboard's information
          architecture but other tickets reference them. */}
      <div className="mt-16 border-t border-border/40 pt-8">
        <div className="mb-3 text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
          Internal smoke tests
        </div>
        <div className="max-w-3xl">
          <DemoChart />
        </div>
        <div className="mt-6 max-w-3xl rounded-lg border border-border bg-card p-8 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">
            shadcn primitive smoke test
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Buttons from DASH-0 kept as a secondary smoke test alongside the
            Recharts + Card demo above.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
