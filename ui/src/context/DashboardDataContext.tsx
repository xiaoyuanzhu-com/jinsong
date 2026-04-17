/**
 * Shared `/api/aggregate` data for every dashboard row (DASH-11).
 *
 * Before this ticket each row called `fetchSessions()` on its own and
 * re-aggregated in the browser. That produced 8 parallel requests and 8
 * copies of the same client-side computation. `DashboardDataProvider`
 * wraps the dashboard page so rows pull data from a single
 * `useAggregate(range)` call — one request per range change, one copy of
 * the output, and a loading flag each row can use to swap in a skeleton.
 *
 * We deliberately keep the RangeContext separate: the range selector
 * still owns the URL param, and the dashboard data provider subscribes.
 */

import { createContext, useContext, type ReactNode } from 'react'
import { useRange } from '@/context/RangeContext'
import { useAggregate } from '@/lib/useAggregate'
import type { AggregateResponse } from '@/lib/aggregate-types'

interface DashboardDataValue {
  data: AggregateResponse | null
  isLoading: boolean
  error: string | null
}

const DashboardDataContext = createContext<DashboardDataValue | undefined>(
  undefined,
)

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { range } = useRange()
  const value = useAggregate(range)
  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  )
}

/**
 * Read the shared aggregate payload. Throws outside a provider so the
 * error surfaces at the row that forgot to mount the context — cheaper
 * than silently rendering an empty card.
 */
export function useDashboardData(): DashboardDataValue {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error(
      'useDashboardData() must be used inside a <DashboardDataProvider>',
    )
  }
  return ctx
}
