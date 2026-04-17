import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import {
  DAYS_MON_FIRST,
  HOURS,
  maxFromGrid,
  quantize,
  totalFromGrid,
} from '@/lib/heatmap'

// ─── Geometry ─────────────────────────────────────────────────────────────
//
// Cell size and gap are fixed in viewBox units; the SVG itself scales to
// fill the container via `preserveAspectRatio`. Labels live in gutter
// strips on the left (day labels) and bottom (hour labels).

const CELL = 16
const GAP = 3
const Y_GUTTER = 34 // space reserved for day labels on the left
const X_GUTTER_BOTTOM = 18 // space reserved for hour labels below
const PAD = 4

const GRID_W = 24 * CELL + 23 * GAP
const GRID_H = 7 * CELL + 6 * GAP

const VIEW_W = Y_GUTTER + GRID_W + PAD * 2
const VIEW_H = GRID_H + X_GUTTER_BOTTOM + PAD * 2

// 5 color buckets (quintiles): 0 = empty, 1..4 = ramp of increasing
// opacity on the accent color. Bucket 0 keeps a low-but-visible opacity
// so the grid reads as a soft scaffold even where there is no activity.
const BUCKETS = 5
const BUCKET_OPACITY = [0.08, 0.2, 0.42, 0.68, 1.0] as const

const HOUR_LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const

export interface ActivityHeatmapProps {
  grid: number[][] // 7 × 24
}

function cellX(hour: number): number {
  return Y_GUTTER + PAD + hour * (CELL + GAP)
}

function cellY(day: number): number {
  return PAD + day * (CELL + GAP)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Activity heatmap card — full-width, 7 rows (Mon-Sun) × 24 cols (hours).
 *
 * Color strategy: opacity buckets on `hsl(var(--chart-1))` (5 levels
 * plus an empty state). Linear scale keyed off the max observed cell;
 * sparse data is rare enough that a log scale felt heavy-handed.
 */
export function ActivityHeatmap({ grid }: ActivityHeatmapProps) {
  const { max, total } = useMemo(
    () => ({ max: maxFromGrid(grid), total: totalFromGrid(grid) }),
    [grid],
  )

  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Activity
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        Sessions by hour of day × day of week (local time)
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground/80">
        {total === 0
          ? 'No sessions in this range'
          : `${total.toLocaleString()} session${
              total === 1 ? '' : 's'
            } shown`}
      </div>

      <div className="mt-3">
        <svg
          role="img"
          aria-label="Activity heatmap: sessions by hour and day of week"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ height: 200 }}
        >
          {/* Day labels (Mon..Sun) on the left gutter. */}
          {DAYS_MON_FIRST.map((name, day) => (
            <text
              key={name}
              x={Y_GUTTER - 6}
              y={cellY(day) + CELL / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              style={{
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {name}
            </text>
          ))}

          {/* Cells. */}
          {grid.map((row, day) =>
            row.map((count, hour) => {
              const level = quantize(count, max, BUCKETS)
              const opacity = BUCKET_OPACITY[level]
              const dayName = DAYS_MON_FIRST[day]
              const title =
                count === 0
                  ? `${dayName} ${pad2(hour)}:00 — no sessions`
                  : `${dayName} ${pad2(hour)}:00 — ${count} session${
                      count === 1 ? '' : 's'
                    }`
              return (
                <rect
                  key={`${day}-${hour}`}
                  x={cellX(hour)}
                  y={cellY(day)}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  ry={2}
                  fill="hsl(var(--chart-1))"
                  fillOpacity={opacity}
                >
                  <title>{title}</title>
                </rect>
              )
            }),
          )}

          {/* Hour labels along the bottom. */}
          {HOURS.map((h) => {
            if (!HOUR_LABEL_HOURS.includes(h as (typeof HOUR_LABEL_HOURS)[number])) {
              return null
            }
            return (
              <text
                key={`hour-${h}`}
                x={cellX(h) + CELL / 2}
                y={PAD + GRID_H + 12}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {pad2(h)}
              </text>
            )
          })}
        </svg>

        {/* Legend. */}
        <div className="mt-2 flex items-center justify-end gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Less</span>
          <div className="flex items-center gap-1">
            {BUCKET_OPACITY.map((op, i) => (
              <span
                key={i}
                className="inline-block h-3 w-3 rounded-sm"
                style={{
                  backgroundColor: 'hsl(var(--chart-1))',
                  opacity: op,
                }}
                aria-hidden
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </Card>
  )
}

