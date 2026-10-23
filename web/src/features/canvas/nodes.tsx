import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Pin, X } from 'lucide-react'
import { BLOCKS } from '@/content/blocks'
import type { BlockId, NodeStatus } from '@/engine/types'
import { cn } from '@/lib/cn'
import { BlockIcon } from '@/ui/BlockIcon'

export const NODE_W = 152
export const NODE_H = 64

export type BlockNodeData = {
  block: BlockId
  locked?: boolean
  sticky?: boolean
  status?: NodeStatus
  utilization?: number
  inRps?: number
  backlog?: number
  blind?: boolean
  highlight?: boolean
  /** Managed / infinite-capacity blocks don't show a load bar. */
  unlimited?: boolean
}
export type BlockFlowNode = Node<BlockNodeData, 'block'>

const STATUS_RING: Record<NodeStatus, string> = {
  idle: 'border-line',
  ok: 'border-good',
  warm: 'border-warn',
  hot: 'border-bad',
  down: 'border-bad border-dashed',
}

const BAR: Record<NodeStatus, string> = {
  idle: 'bg-line',
  ok: 'bg-good',
  warm: 'bg-warn',
  hot: 'bg-bad',
  down: 'bg-bad',
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${Math.round(n)}`)

export function BlockNode({ id, data, selected }: NodeProps<BlockFlowNode>) {
  const info = BLOCKS[data.block]
  const status = data.blind ? undefined : data.status
  const u = Math.min(1.25, data.utilization ?? 0)
  const down = status === 'down'
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2.5 rounded-2xl border-2 bg-surface px-2.5 shadow-card transition-colors',
        status ? STATUS_RING[status] : 'border-line',
        selected && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas',
        data.highlight && 'pulse-ring',
        down && 'opacity-60 grayscale',
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Left} />
      <BlockIcon block={data.block} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] leading-tight font-bold">{info.short}</div>
        <div className="truncate font-mono text-[10px] text-muted">{id}</div>
      </div>
      {data.sticky && (
        <span className="absolute -top-2.5 right-2 flex items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[9px] font-bold text-warn">
          <Pin size={9} /> sticky
        </span>
      )}
      {down && (
        <span className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-bad text-white">
          <X size={14} strokeWidth={3} />
        </span>
      )}
      {status && status !== 'idle' && !down && !data.unlimited && (
        <div className="absolute right-2.5 -bottom-2.5 left-2.5 flex items-center gap-1.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
            <div className={cn('h-full rounded-full transition-all duration-500', BAR[status])} style={{ width: `${Math.min(100, u * 100)}%` }} />
          </div>
          <span className="rounded bg-surface px-1 font-mono text-[9px] font-bold text-muted ring-1 ring-line">
            {data.backlog ? `${fmt(data.backlog)} queued` : `${Math.round(u * 100)}%`}
          </span>
        </div>
      )}
      {data.blind && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-surface-2 px-1.5 font-mono text-[9px] text-muted">no metrics</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

export type GhostNodeData = { block: BlockId }
export type GhostFlowNode = Node<GhostNodeData, 'ghost'>

export function GhostNode({ data }: NodeProps<GhostFlowNode>) {
  return (
    <div
      className="ghost-breathe flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-accent bg-accent-soft/60 px-2.5"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <BlockIcon block={data.block} size={36} className="opacity-60" />
      <div className="text-[12px] leading-tight font-semibold text-accent">
        Drop {BLOCKS[data.block].short}
        <br />
        here
      </div>
    </div>
  )
}

export type ZoneNodeData = { label: string; w: number; h: number }
export type ZoneFlowNode = Node<ZoneNodeData, 'zone'>

export function ZoneNode({ data }: NodeProps<ZoneFlowNode>) {
  return (
    <div
      className="rounded-3xl border-2 border-dashed border-line bg-surface-2/50"
      style={{ width: data.w, height: data.h }}
    >
      <div className="px-4 py-2 text-xs font-bold tracking-wide text-muted uppercase">{data.label}</div>
    </div>
  )
}

export const nodeTypes = { block: BlockNode, ghost: GhostNode, zone: ZoneNode }
