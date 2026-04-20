import { useRange } from '@/context/RangeContext'
import { type Range } from '@/lib/range'
import { headerCopy } from '@/bridge/syntheticData'

/**
 * Bridge-direction top bar: gradient mark ("金"), title + subtitle,
 * Agent / Model / Task filters (decorative for now — no wire to query
 * state yet), and the 7d/30d/90d range selector driven by the shared
 * `RangeContext`.
 */
export function TopBar() {
  const { range, setRange } = useRange()
  const ranges: Range[] = ['7d', '30d', '90d']

  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '14px 22px',
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
      }}
    >
      <div className="flex items-center gap-3.5">
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 'var(--radius)',
            background:
              'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent-2)))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'hsl(var(--primary-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          金
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Jinsong{' '}
            <span
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              / {headerCopy.title}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'hsl(var(--muted-foreground))',
              marginTop: 1,
            }}
          >
            {headerCopy.sub}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Filters />
        <div
          style={{
            display: 'flex',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: 'hsl(var(--panel-2))',
          }}
        >
          {ranges.map((r) => {
            const active = range === r
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  background: active ? 'hsl(var(--primary))' : 'transparent',
                  color: active
                    ? 'hsl(var(--primary-foreground))'
                    : 'hsl(var(--text-dim))',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {r}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Filters (decorative) ─────────────────────────────────────────────
// These don't filter data yet — the prototype's intent is that they
// become wired once the server exposes agent/model/task facets. For now
// they keep the dashboard's top bar visually complete.
function Filters() {
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ fontSize: 11, color: 'hsl(var(--text-dim))' }}
    >
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>Agent</span>
      <FilterSelect>
        <option>All agents</option>
        <option>Claude Code</option>
        <option>Cursor</option>
        <option>Codex CLI</option>
        <option>ChatGPT</option>
      </FilterSelect>
      <span
        style={{ color: 'hsl(var(--muted-foreground))', marginLeft: 8 }}
      >
        Model
      </span>
      <FilterSelect>
        <option>All models</option>
        <option>opus-4</option>
        <option>sonnet-4.5</option>
        <option>gpt-5</option>
      </FilterSelect>
      <span
        style={{ color: 'hsl(var(--muted-foreground))', marginLeft: 8 }}
      >
        Task
      </span>
      <FilterSelect>
        <option>All tasks</option>
        <option>debug</option>
        <option>refactor</option>
        <option>chat</option>
      </FilterSelect>
    </div>
  )
}

function FilterSelect({ children }: { children: React.ReactNode }) {
  // Inline SVG chevron — we can't reliably recolor it from CSS vars when
  // it lives in `background-image`, so we use `currentColor`-ish neutral
  // alpha that reads on both light and dark panels.
  const chevron =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4 L5 7 L8 4' fill='none' stroke='%23888' stroke-width='1.2'/></svg>\")"
  return (
    <select
      style={{
        background: 'hsl(var(--panel-2))',
        color: 'hsl(var(--text-dim))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: '3px 20px 3px 8px',
        fontSize: 11,
        fontFamily: 'inherit',
        appearance: 'none',
        WebkitAppearance: 'none',
        cursor: 'pointer',
        backgroundImage: chevron,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
      }}
    >
      {children}
    </select>
  )
}
