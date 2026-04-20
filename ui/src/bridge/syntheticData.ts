/**
 * Synthetic fixtures for rows the real `/api/aggregate` endpoint doesn't
 * populate yet (incidents feed, agent×model matrix, AXS hero score).
 * All numbers come from a deterministic PRNG seeded at module load so
 * the dashboard renders the same "story" on every reload — making it
 * usable as a design reference while the backend catches up.
 */

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(42)

// ── Incidents ────────────────────────────────────────────────────
export type IncidentSeverity = 'high' | 'med' | 'low'

export interface Incident {
  time: string
  severity: IncidentSeverity
  title: string
  detail: string
  affects: string
}

export const incidents: Incident[] = [
  {
    time: 'Tue 14:22',
    severity: 'high',
    title: 'Stall rate up 3.1× in Claude Code × opus-4',
    detail: 'Bash tool p95 climbed from 4.2s to 13.8s',
    affects: '2,104 sessions',
  },
  {
    time: 'Mon 09:10',
    severity: 'med',
    title: 'TTFR regression on gpt-5-codex',
    detail: 'Median TTFR 1.1s → 2.6s after model refresh',
    affects: '842 sessions',
  },
  {
    time: 'Sun 02:48',
    severity: 'low',
    title: 'Rework rate drifting on Cursor × sonnet',
    detail: 'Rework rate 6% → 9%, not yet breaching SLO',
    affects: '311 sessions',
  },
]

// ── Agent × Model matrix ─────────────────────────────────────────
export const matrixAgents = [
  'Claude Code',
  'Cursor',
  'ChatGPT',
  'Codex CLI',
  'Continue',
  'LangGraph',
] as const

export const matrixModels = [
  'opus-4',
  'sonnet-4.5',
  'haiku-4.5',
  'gpt-5',
  'gpt-5-codex',
  'gemini-2.5',
] as const

export const matrix: Array<Array<number | null>> = matrixAgents.map((_, i) =>
  matrixModels.map((_m, j) => {
    const base = 72 + ((i * 7 + j * 11) % 24)
    const jitter = (rng() - 0.5) * 6
    const v = Math.round(base + jitter)
    // Punch a few gaps for realism.
    const sparse = (i === 4 && j > 3) || (i === 5 && j === 2)
    return sparse ? null : v
  }),
)

// ── AXS hero (30d sparkline + headline delta) ────────────────────
/** Deterministic 30-point AXS sparkline for the hero KPI. */
export const axsSpark: number[] = (() => {
  const out: number[] = []
  let v = 87
  for (let i = 0; i < 30; i++) {
    v += (rng() - 0.5) * 2 - 0.1
    out.push(Math.max(60, Math.min(100, v)))
  }
  return out
})()

export const axsHeadline = {
  score: 87,
  delta: -2.3, // pp vs prev window
  incidentBadge: {
    label: 'stall regression · Tue 14:22',
  },
}

/** Synthetic 30d (axs, stall) pair for the hero trend chart. */
export function axsTrendSeries(days: number): Array<{
  date: string
  axs: number
  stall: number
}> {
  const out: Array<{ date: string; axs: number; stall: number }> = []
  let axs = 91
  let stall = 4.5
  const start = Date.now() - (days - 1) * 86_400_000
  for (let i = 0; i < days; i++) {
    if (i === Math.floor(days * 0.7)) {
      axs -= 5
      stall += 3.8
    }
    axs += (rng() - 0.5) * 1.2
    stall += (rng() - 0.5) * 0.6
    out.push({
      date: new Date(start + i * 86_400_000).toISOString(),
      axs: Math.max(60, Math.min(100, axs)),
      stall: Math.max(0, stall),
    })
  }
  return out
}

/**
 * Synthetic "stall waveform" for a session — 40 ticks with a few
 * deterministic stall gaps, ready to hand to `<StallWave>`.
 */
export function makeStallWave(seed: string, stalls: number): number[] {
  const hash = Array.from(seed).reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    2166136261,
  )
  const local = mulberry32(hash || 1)
  const ticks = 40
  const wave = Array.from({ length: ticks }, () => 1 + local() * 4)
  for (let s = 0; s < stalls; s++) {
    const at = Math.floor(local() * ticks)
    const len = 1 + Math.floor(local() * 3)
    for (let k = 0; k < len && at + k < ticks; k++) wave[at + k] = 0
  }
  return wave
}

// ── Header copy (persona="dev", per DASH-13 handoff) ─────────────
export const headerCopy = {
  title: 'My agents — this week',
  sub: 'Local install · jinsong',
}
