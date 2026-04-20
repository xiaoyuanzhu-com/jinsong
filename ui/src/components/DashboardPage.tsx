import { BridgeDashboard } from '@/bridge/BridgeDashboard'

/**
 * Main dashboard page (route `/`). As of DASH-13 the bridge-direction
 * IA (hero AXS + 5 phase cards + incidents/heatmap + agent×model matrix
 * + sessions table) replaces the DASH-3..10 row stack. The data context
 * and per-row error handling now live inside `BridgeDashboard` so this
 * module is just the route entrypoint.
 */
export function DashboardPage() {
  return <BridgeDashboard />
}
