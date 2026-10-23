import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import type { NodeStatus } from '@/engine/types'

export type FlowEdgeData = {
  rps?: number
  maxRps?: number
  tone?: NodeStatus
  /** Async hand-off (into a queue): drawn dashed. */
  async?: boolean
  /** Monitoring / replication-style edges that carry no user traffic. */
  passive?: boolean
}
export type FlowEdgeT = Edge<FlowEdgeData, 'flow'>

const TONE: Record<NodeStatus, string> = {
  idle: 'var(--muted)',
  ok: 'var(--good)',
  warm: 'var(--warn)',
  hot: 'var(--bad)',
  down: 'var(--bad)',
}

export function FlowEdge(props: EdgeProps<FlowEdgeT>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd } = props
  const { deleteElements } = useReactFlow()
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const rps = data?.rps ?? 0
  const share = data?.maxRps ? rps / data.maxRps : 0
  const dots = rps > 0 ? Math.max(1, Math.min(5, Math.round(share * 5))) : 0
  const color = data?.tone ? TONE[data.tone] : 'var(--accent)'
  const dur = 1.8 - Math.min(0.9, share * 0.9)

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? 'var(--accent)' : rps > 0 ? color : 'var(--muted)',
          strokeWidth: selected ? 3 : rps > 0 ? 1.5 + share * 3 : 1.5,
          strokeDasharray: data?.async || data?.passive ? '6 5' : undefined,
          opacity: rps > 0 || selected ? 1 : 0.55,
        }}
        interactionWidth={22}
      />
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} r={3.5} fill={color}>
          <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} begin={`${(i * dur) / dots}s`} />
        </circle>
      ))}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
        >
          {rps > 0 && !selected && (
            <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted shadow-card ring-1 ring-line">
              {rps >= 1000 ? `${(rps / 1000).toFixed(1)}k` : Math.round(rps)}/s
            </span>
          )}
          {selected && (
            <button
              aria-label="Delete connection"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-bad text-white shadow-card hover:brightness-110"
              onClick={() => deleteElements({ edges: [{ id }] })}
            >
              <X size={14} strokeWidth={3} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const edgeTypes = { flow: FlowEdge }
