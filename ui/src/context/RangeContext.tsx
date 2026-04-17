import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_RANGE, isRange, type Range } from '@/lib/range'

/**
 * Global time-range state for the dashboard.
 *
 * State is synced with the URL search param `?range=<value>` so a link like
 * `/?range=90d` opens the dashboard already scoped to 90 days. Writes use
 * `history.replaceState` so switching ranges does NOT pollute the back-stack.
 *
 * react-router is overkill here — this one hook is enough.
 */

interface RangeContextValue {
  range: Range
  setRange: (r: Range) => void
}

const RangeContext = createContext<RangeContextValue | undefined>(undefined)

const QUERY_KEY = 'range'

function readRangeFromUrl(): Range {
  if (typeof window === 'undefined') return DEFAULT_RANGE
  const params = new URLSearchParams(window.location.search)
  const raw = params.get(QUERY_KEY)
  return isRange(raw) ? raw : DEFAULT_RANGE
}

function writeRangeToUrl(next: Range): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set(QUERY_KEY, next)
  window.history.replaceState(null, '', url.toString())
}

/**
 * Internal hook: mirrors `range` state with the URL query param.
 * Encapsulated so the provider stays tidy.
 */
function useRangeQueryParam(): [Range, (r: Range) => void] {
  const [range, setRangeState] = useState<Range>(() => readRangeFromUrl())

  // React to back/forward navigation.
  useEffect(() => {
    const handler = () => setRangeState(readRangeFromUrl())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const setRange = useCallback((next: Range) => {
    setRangeState((prev) => {
      if (prev === next) return prev
      writeRangeToUrl(next)
      return next
    })
  }, [])

  return [range, setRange]
}

export function RangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useRangeQueryParam()
  const value = useMemo<RangeContextValue>(
    () => ({ range, setRange }),
    [range, setRange],
  )
  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>
}

export function useRange(): RangeContextValue {
  const ctx = useContext(RangeContext)
  if (!ctx) {
    throw new Error('useRange() must be used inside a <RangeProvider>')
  }
  return ctx
}
