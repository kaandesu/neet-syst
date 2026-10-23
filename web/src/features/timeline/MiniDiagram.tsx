import { BLOCKS } from '@/content/blocks'
import type { Design, PhaseResult } from '@/engine/types'

const W = 152
const H = 64

/** A lightweight, static rendering of a design (for compare views). */
export function MiniDiagram({ design, result, height = 220 }: { design: Design; result?: PhaseResult; height?: number }) {
  if (!design.nodes.length) return <div className="flex h-full items-center justify-center text-sm text-muted">Empty canvas</div>
  const xs = design.nodes.map((n) => n.x)
  const ys = design.nodes.map((n) => n.y)
  const minX = Math.min(...xs) - 20
  const minY = Math.min(...ys) - 20
  const w = Math.max(...xs) + W + 20 - minX
  const h = Math.max(...ys) + H + 20 - minY
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  const tone = (id: string) => {
    const s = result?.nodes[id]?.status
    return s === 'hot' || s === 'down' ? 'var(--bad)' : s === 'warm' ? 'var(--warn)' : s === 'ok' ? 'var(--good)' : 'var(--line)'
  }
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} style={{ height, width: '100%' }} preserveAspectRatio="xMidYMid meet">
      {design.edges.map((e) => {
        const a = byId.get(e.from)
        const b = byId.get(e.to)
        if (!a || !b) return null
        const x1 = a.x + W
        const y1 = a.y + H / 2
        const x2 = b.x
        const y2 = b.y + H / 2
        const mx = (x1 + x2) / 2
        return <path key={e.id} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="var(--muted)" strokeWidth={2} opacity={0.6} />
      })}
      {design.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x},${n.y})`}>
          <rect width={W} height={H} rx={16} fill="var(--surface)" stroke={tone(n.id)} strokeWidth={3} />
          <circle cx={30} cy={H / 2} r={16} fill={`hsl(${BLOCKS[n.block].hue} 70% 85%)`} />
          <text x={56} y={H / 2 + 5} fontSize={16} fontWeight={700} fill="var(--ink)">
            {BLOCKS[n.block].short}
          </text>
        </g>
      ))}
    </svg>
  )
}
