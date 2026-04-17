import { useEffect } from 'react'
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom'

import { DashboardPage } from '@/components/DashboardPage'
import { SessionDetailPage } from '@/components/SessionDetailPage'
import { RangeProvider } from '@/context/RangeContext'

/**
 * Top-level router (DASH-10). Two routes:
 *   - `/`                → full dashboard (all DASH-3..9 rows + session list)
 *   - `/session/:id`     → per-session detail with all 35 metrics
 *
 * `RangeProvider` sits above the routes so both pages read the same
 * `?range=` URL param. Dark mode is applied once on mount to mirror the
 * pre-router behaviour.
 */
function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <BrowserRouter>
      <RangeProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/session/:id" element={<SessionDetailPage />} />
          {/* Unknown paths fall back to the dashboard rather than showing a
              404 page — there's only one other route and the server SPA
              fallback may have routed e.g. a stale bookmark here. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RangeProvider>
    </BrowserRouter>
  )
}

export default App
