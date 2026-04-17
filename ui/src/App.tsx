import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { DemoChart } from '@/components/DemoChart'

function App() {
  // Dark mode default — mirror the existing Jinsong UI.
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-5xl px-6 py-12">
        <header className="flex items-baseline justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Jinsong</h1>
          <span className="text-sm text-muted-foreground">DASH-1 scaffold</span>
        </header>

        <div className="mb-8">
          <DemoChart />
        </div>

        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-2">
            shadcn primitive smoke test
          </h2>
          <p className="text-muted-foreground mb-6">
            Buttons from DASH-0 kept as a secondary smoke test alongside the
            Recharts + Card demo above.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
