/**
 * Pillar metadata for the dashboard's "Pillar Health" row.
 *
 * As of DASH-11 the aggregation lives server-side (`/api/aggregate`) and
 * this module is purely presentational — name, tagline, direction (for
 * delta-arrow color), and formatters. The card consumes precomputed
 * `good / fair / poor / headline` counts from the aggregate and uses this
 * file only to render the right labels and format headlines/deltas.
 */

export type PillarId =
  | 'responsiveness'
  | 'reliability'
  | 'autonomy'
  | 'correctness'
  | 'completion'

export interface PillarDef {
  id: PillarId
  name: string
  tagline: string
  /** Higher is better? Controls trend-arrow color. */
  direction: 'up-is-good' | 'down-is-good'
  /** Format the window-wide aggregated headline value. */
  formatHeadline: (v: number | null) => string
  /**
   * Format the absolute delta between current and prior aggregates as shown
   * next to the trend arrow (e.g. "0.3s", "2.1%"). Magnitude only — the
   * card renders the arrow separately.
   */
  formatDelta: (absDelta: number) => string
}

// ─── Formatters ────────────────────────────────────────────────────────────

function fmtSeconds(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v < 1) return `${Math.round(v * 1000)}ms`
  return `${v.toFixed(1)}s`
}

function fmtSecondsDelta(abs: number): string {
  if (!Number.isFinite(abs)) return '—'
  if (abs < 1) return `${Math.round(abs * 1000)}ms`
  return `${abs.toFixed(1)}s`
}

function fmtRatioPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const pct = v * 100
  return Math.abs(pct) < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

function fmtRatioPctDelta(abs: number): string {
  if (!Number.isFinite(abs)) return '—'
  const pct = abs * 100
  return Math.abs(pct) < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

function fmtPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return Math.abs(v) < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`
}

function fmtPercentDelta(abs: number): string {
  if (!Number.isFinite(abs)) return '—'
  return Math.abs(abs) < 10 ? `${abs.toFixed(1)}%` : `${Math.round(abs)}%`
}

// ─── Pillar definitions ────────────────────────────────────────────────────

export const PILLARS: PillarDef[] = [
  {
    id: 'responsiveness',
    name: 'Responsiveness',
    tagline: 'Is it fast?',
    direction: 'down-is-good',
    formatHeadline: fmtSeconds,
    formatDelta: fmtSecondsDelta,
  },
  {
    id: 'reliability',
    name: 'Reliability',
    tagline: 'Does it work?',
    direction: 'down-is-good',
    formatHeadline: fmtRatioPct,
    formatDelta: fmtRatioPctDelta,
  },
  {
    id: 'autonomy',
    name: 'Autonomy',
    tagline: 'Can it run alone?',
    direction: 'down-is-good',
    formatHeadline: fmtPercent,
    formatDelta: fmtPercentDelta,
  },
  {
    id: 'correctness',
    name: 'Correctness',
    tagline: 'Is it right?',
    direction: 'up-is-good',
    formatHeadline: fmtRatioPct,
    formatDelta: fmtRatioPctDelta,
  },
  {
    id: 'completion',
    name: 'Completion',
    tagline: 'Did it finish?',
    direction: 'up-is-good',
    formatHeadline: (v) => {
      if (v == null || !Number.isFinite(v)) return '—'
      return Math.abs(v) < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`
    },
    formatDelta: fmtPercentDelta,
  },
]
