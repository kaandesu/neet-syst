import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, useReactFlow, type Edge, type EdgeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import type { NodeStatus } from '@/engine/types'
import { useSkin } from '@/ui/ThemeToggle'

export type FlowEdgeData = {
  rps?: number
  maxRps?: number
  tone?: NodeStatus
  /** Async hand-off (into a queue): drawn dashed. */
  async?: boolean
  /** Monitoring / replication-style edges that carry no user traffic. */
  passive?: boolean
  /** Touches the focused block: drawn a little brighter. */
  lit?: boolean
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
  const skin = useSkin()
  const ends = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }
  // Pixel skins route links on a grid: square corners, no curves.
  const [path, lx, ly] = skin === 'current' ? getBezierPath(ends) : getSmoothStepPath({ ...ends, borderRadius: 0 })
  const rps = data?.rps ?? 0
  const share = data?.maxRps ? rps / data.maxRps : 0
  const dots = rps > 0 ? Math.max(1, Math.min(5, Math.round(share * 5))) : 0
  const color = data?.tone ? TONE[data.tone] : 'var(--accent)'
  const dur = 1.8 - Math.min(0.9, share * 0.9)

  const stroke = selected ? 'var(--accent)' : rps > 0 ? color : data?.lit ? 'color-mix(in oklab, var(--accent) 60%, var(--muted))' : 'var(--muted)'
  const idleRail = data?.lit ? 'color-mix(in oklab, var(--accent) 35%, #3a3a3a)' : '#3a3a3a'

  return (
    <>
      {skin === 'factory' && (
        // Conveyor belt: a dark rail with a dashed belt on top that moves while traffic flows.
        <path d={path} fill="none" className="fac-rail" style={{ stroke: selected ? 'var(--accent)' : rps > 0 ? undefined : idleRail }} />
      )}
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={skin === 'factory' && rps > 0 ? 'fac-belt' : undefined}
        style={
          skin === 'factory'
            ? { stroke: rps > 0 ? '#6e6e6e' : '#555', strokeWidth: 8, strokeDasharray: '3 7' }
            : {
                stroke,
                strokeWidth: selected ? 3 : rps > 0 ? (skin === 'pixel' ? 2 : 1.5) + share * 3 : skin === 'pixel' ? 2 : 1.5,
                strokeDasharray: data?.async || data?.passive ? '6 5' : undefined,
                opacity: rps > 0 || selected || data?.lit ? 1 : 0.55,
              }
        }
        interactionWidth={22}
      />
      {Array.from({ length: dots }, (_, i) => {
        const motion = <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} begin={`${(i * dur) / dots}s`} />
        if (skin === 'pixel') return <rect key={i} x={-4} y={-4} width={8} height={8} fill={color}>{motion}</rect>
        if (skin === 'factory')
          return (
            <rect key={i} x={-6} y={-6} width={12} height={12} className="fac-crate">
              {motion}
            </rect>
          )
        return (
          <circle key={i} r={3.5} fill={color}>
            {motion}
          </circle>
        )
      })}
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
