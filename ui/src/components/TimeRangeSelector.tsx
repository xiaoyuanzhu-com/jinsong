import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useRange } from '@/context/RangeContext'
import { RANGES, rangeLabel, type Range } from '@/lib/range'

/**
 * Segmented control for selecting the dashboard's global time range.
 *
 * Renders as a shadcn `ToggleGroup` (type="single"), which gives us keyboard
 * navigation, roving tabindex, and `aria-pressed` semantics for free.
 * The active option has `bg-accent`; inactive options stay muted.
 */
export function TimeRangeSelector() {
  const { range, setRange } = useRange()

  return (
    <ToggleGroup
      type="single"
      value={range}
      onValueChange={(next) => {
        // ToggleGroup emits "" when the user clicks the already-active option.
        // Don't allow deselection — a range must always be selected.
        if (!next) return
        setRange(next as Range)
      }}
      size="sm"
      aria-label="Time range"
      className="gap-0.5 rounded-md border border-border bg-muted/40 p-0.5"
    >
      {RANGES.map((r) => (
        <ToggleGroupItem
          key={r}
          value={r}
          aria-label={`Show last ${r === 'all' ? 'all time' : r}`}
          className="h-7 min-w-10 px-2.5 text-xs font-medium text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {rangeLabel(r)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
