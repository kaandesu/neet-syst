import { GitCompare, History } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Section } from '@/engine/lesson/types'
import { childrenOf, leaves, pathTo, type DecisionNode, type RunTree } from '@/engine/timeline/tree'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { CompareDialog } from './CompareDialog'
import { describeStep } from './describe'

const DX = 30
const DY = 26
const PAD = 14

interface Placed {
  node: DecisionNode
  x: number
  lane: number
}

/** Lays the tree out in lanes: the first child continues its parent's lane. */
function layout(tree: RunTree): { placed: Placed[]; lanes: number } {
  const placed: Placed[] = []
  let nextLane = 0
  const walk = (n: DecisionNode, lane: number) => {
    placed.push({ node: n, x: n.stepIndex + 1, lane })
    childrenOf(tree, n.id).forEach((c, i) => walk(c, i === 0 ? lane : ++nextLane))
  }
  walk(tree.nodes[tree.rootId], 0)
  return { placed, lanes: nextLane + 1 }
}

export function TimelineBar({ tree, section, onRewind }: { tree: RunTree; section: Section; onRewind: (id: string) => void }) {
  const [hover, setHover] = useState<DecisionNode | null>(null)
  const [comparing, setComparing] = useState(false)
  const { placed, lanes } = useMemo(() => layout(tree), [tree])
  const pos = new Map(placed.map((p) => [p.node.id, p]))
  const onPath = new Set(pathTo(tree, tree.headId).map((n) => n.id))
  const width = (section.steps.length + 1) * DX + PAD * 2
  const height = lanes * DY + PAD
  const branches = leaves(tree).length
  const shown = hover ?? tree.nodes[tree.headId]

  return (
    <div className="flex items-center gap-3 border-t border-line bg-surface px-4 py-2">
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
        <History size={14} /> Timeline
      </div>
      <div className="max-h-[92px] min-w-0 flex-1 overflow-auto scrollbar-thin">
        <svg width={width} height={height} className="block">
          {placed.map(({ node, x, lane }) => {
            if (!node.parentId) return null
            const p = pos.get(node.parentId)!
            const x1 = PAD + p.x * DX
            const y1 = PAD / 2 + p.lane * DY + 8
            const x2 = PAD + x * DX
            const y2 = PAD / 2 + lane * DY + 8
            return (
              <path
                key={`e${node.id}`}
                d={lane === p.lane ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + DX / 2},${y1} ${x1 + DX / 2},${y2} ${x2},${y2}`}
                stroke={onPath.has(node.id) ? 'var(--accent)' : 'var(--line)'}
                strokeWidth={2.5}
                fill="none"
              />
            )
          })}
          {placed.map(({ node, x, lane }) => {
            const cx = PAD + x * DX
            const cy = PAD / 2 + lane * DY + 8
            const step = section.steps[node.stepIndex]
            const isFork = step?.t === 'fork'
            const isHead = node.id === tree.headId
            const fill = onPath.has(node.id) ? 'var(--accent)' : 'var(--surface)'
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onClick={() => onRewind(node.id)}
                onMouseEnter={() => setHover(node)}
                onMouseLeave={() => setHover(null)}
              >
                {isHead && <circle cx={cx} cy={cy} r={11} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.5} />}
                {isFork ? (
                  <rect x={cx - 6} y={cy - 6} width={12} height={12} transform={`rotate(45 ${cx} ${cy})`} fill={fill} stroke="var(--accent)" strokeWidth={2} />
                ) : (
                  <circle cx={cx} cy={cy} r={node.stepIndex < 0 ? 5 : 6} fill={fill} stroke={onPath.has(node.id) ? 'var(--accent)' : 'var(--muted)'} strokeWidth={2} />
                )}
                {node.note && <circle cx={cx + 6} cy={cy - 6} r={3} fill="var(--warn)" />}
              </g>
            )
          })}
        </svg>
      </div>
      <div className={cn('hidden w-64 shrink-0 truncate text-xs lg:block', hover ? 'text-ink' : 'text-muted')} title={describeStep(section.steps[shown.stepIndex], shown.answer)}>
        {hover ? 'Rewind to: ' : 'Now: '}
        <span className="font-semibold">{describeStep(section.steps[shown.stepIndex], shown.answer)}</span>
      </div>
      <Button size="sm" variant="secondary" disabled={branches < 2} onClick={() => setComparing(true)} title={branches < 2 ? 'Rewind and take a different path to create a branch' : undefined}>
        <GitCompare size={15} /> Compare{branches > 1 ? ` (${branches})` : ''}
      </Button>
      {comparing && <CompareDialog tree={tree} section={section} onClose={() => setComparing(false)} onRewind={onRewind} />}
    </div>
  )
}
