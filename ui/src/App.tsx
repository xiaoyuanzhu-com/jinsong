import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { DemoChart } from '@/components/DemoChart'
import { DashboardShell } from '@/components/DashboardShell'
import { HeroKpiRow } from '@/components/HeroKpiRow'
import { RangeProvider } from '@/context/RangeContext'

function App() {
  // Dark mode default — mirror the existing Jinsong UI.
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <RangeProvider>
      <DashboardShell>
        {/* DASH-3: hero KPI row — six summary cards with sparklines. */}
        <HeroKpiRow />

        {/* DemoChart stays below as a smoke test until DASH-5+ replaces it. */}
        <div className="mt-6 max-w-3xl">
          <DemoChart />
        </div>

        <div className="mt-8 max-w-3xl rounded-lg border border-border bg-card p-8 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold">
            shadcn primitive smoke test
          </h2>
          <p className="mb-6 text-muted-foreground">
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
      </DashboardShell>
    </RangeProvider>
  )
}

export default App
