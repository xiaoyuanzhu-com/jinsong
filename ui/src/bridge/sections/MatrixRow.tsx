import { MatrixHeatmap } from '@/bridge/primitives'
import { matrix, matrixAgents, matrixModels } from '@/bridge/syntheticData'
import { SectionHeader } from './SectionHeader'

/**
 * Agent × Model AXS matrix — synthetic until `/api/aggregate` exposes a
 * `matrix` breakdown. Cells are AXS medians by pairing, colored with a
 * red → amber → green ramp and a verdict rail on the left of each cell.
 */
export function MatrixRow() {
  return (
    <section aria-label="Agent × Model matrix">
      <SectionHeader
        title="Agent × Model"
        sub="AXS median by pairing · 30d (synthetic)"
      />
      <div
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          padding: 18,
        }}
      >
        <MatrixHeatmap
          matrix={matrix}
          rowLabels={matrixAgents as unknown as string[]}
          colLabels={matrixModels as unknown as string[]}
          cellW={72}
          cellH={34}
        />
        <div
          className="flex"
          style={{
            gap: 16,
            marginTop: 14,
            fontSize: 10,
            color: 'hsl(var(--muted-foreground))',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          }}
        >
          <LegendSwatch color="hsl(var(--good))" label="≥85 good" />
          <LegendSwatch color="hsl(var(--fair))" label="75–84 fair" />
          <LegendSwatch color="hsl(var(--poor))" label="<75 poor" />
          <span style={{ marginLeft: 'auto' }}>
            hover a cell to drill → session list
          </span>
        </div>
      </div>
    </section>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center" style={{ gap: 5 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderLeft: `2px solid ${color}`,
          // 22/255 ≈ 0.135 — cell tint opacity matches MatrixHeatmap.
          background: `color-mix(in srgb, ${color} 13%, transparent)`,
        }}
      />
      {label}
    </span>
  )
}
