/**
 * Shared dashboard value types.
 *
 * DASH-11 moved aggregation server-side (`/api/aggregate`); the UI no
 * longer bucket-counts sessions on the client. All that remains here is
 * the `DailyBucket` shape consumed by the KPI sparkline renderer.
 */

/** A single sparkline point — shape consumed by `KpiCard` / `HeroKpiRow`. */
export interface DailyBucket {
  /** ISO day (YYYY-MM-DD) in UTC — stable and locale-free for sort/compare. */
  day: string
  value: number
}
