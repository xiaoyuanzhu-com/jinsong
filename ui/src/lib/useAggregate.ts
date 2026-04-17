/**
 * React hook that fetches the precomputed dashboard aggregate for a given
 * time range from `/api/aggregate` (DASH-11).
 *
 * Before this ticket each dashboard row fetched `/api/sessions` on mount
 * and re-aggregated client-side — the page issued 8 parallel requests.
 * `useAggregate(range)` replaces that with a single server-side pass and
 * shares the result with every row via `<DashboardDataProvider>` (see
 * `@/context/DashboardDataContext`).
 *
 * Behaviour:
 *   - Re-fetches whenever `range` changes.
 *   - Dedupes concurrent calls for the same range via a module-level
 *     in-flight map (cheap insurance against double-renders and
 *     StrictMode's dev-only effect-double-invoke).
 *   - Resets `data` to `null` while a new range's data is loading so
 *     row-level skeletons render (instead of stale numbers) during range
 *     switches.
 */

import { useEffect, useRef, useState } from 'react'
import type { AggregateResponse, Range } from './aggregate-types'

interface UseAggregateState {
  data: AggregateResponse | null
  isLoading: boolean
  error: string | null
}

/** In-flight fetches keyed by range — dedupes parallel callers. */
const inflight = new Map<Range, Promise<AggregateResponse>>()

function fetchAggregate(range: Range): Promise<AggregateResponse> {
  const existing = inflight.get(range)
  if (existing) return existing
  const p = (async () => {
    const res = await fetch(
      `/api/aggregate?range=${encodeURIComponent(range)}`,
      { headers: { accept: 'application/json' } },
    )
    if (!res.ok) {
      throw new Error(`fetchAggregate: HTTP ${res.status}`)
    }
    return (await res.json()) as AggregateResponse
  })()
  inflight.set(range, p)
  // Clear from in-flight map after settle so the NEXT call (e.g. after
  // the SSE-driven cache bust) goes through the network again.
  p.finally(() => {
    if (inflight.get(range) === p) inflight.delete(range)
  })
  return p
}

export function useAggregate(range: Range): UseAggregateState {
  const [state, setState] = useState<UseAggregateState>({
    data: null,
    isLoading: true,
    error: null,
  })
  // Track the most recent range the effect kicked off so late-arriving
  // responses for a previous range don't clobber newer data.
  const activeRangeRef = useRef<Range>(range)

  useEffect(() => {
    activeRangeRef.current = range
    let cancelled = false
    setState({ data: null, isLoading: true, error: null })

    fetchAggregate(range)
      .then((data) => {
        if (cancelled) return
        if (activeRangeRef.current !== range) return
        setState({ data, isLoading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        if (activeRangeRef.current !== range) return
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        })
      })

    return () => {
      cancelled = true
    }
  }, [range])

  return state
}
