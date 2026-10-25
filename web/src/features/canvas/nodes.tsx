import { Handle, Position, useConnection, type Node, type NodeProps } from '@xyflow/react'
import { Check, Crosshair, Pin, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { BLOCKS } from '@/content/blocks'
import { FactoryDeco } from '@/features/design/playground/decos'
import type { Callout } from '@/features/mentor/coach'
import type { BlockId, NodeStatus } from '@/engine/types'
import { cn } from '@/lib/cn'
import { BlockIcon } from '@/ui/BlockIcon'
import { useSkin } from '@/ui/ThemeToggle'

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
  /** The canvas is asking "which part…?": nodes act like big buttons. */
  pick?: boolean
  inspected?: boolean
  callout?: Callout
  /** Shows a remove badge while the block is selected. */
  onDelete?: () => void
  /** Wired straight to the focused block: gets a faint halo. */
  neighbor?: boolean
  /** The learner's pick in a "which part…?" question. */
  marked?: boolean
  /** A gentle "is this needed?" nudge for a block the level doesn't call for. */
  doubt?: { onKeep: () => void; onRemove: () => void }
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
  const skin = useSkin()
  // While a wire is being dragged from another block, the whole body becomes a drop target.
  // Its type is the opposite of the dot the wire started from, so dragging from either side works.
  const dropAs = useConnection((c) => (c.inProgress && c.fromNode.id !== id ? (c.fromHandle.type === 'source' ? 'target' : 'source') : null))
  return (
    <div
      data-status={status ?? 'idle'}
      data-focus={data.marked ? 'marked' : selected || data.inspected ? 'selected' : data.neighbor ? 'neighbor' : undefined}
      className={cn(
        'block-node group relative flex items-center gap-2.5 rounded-2xl border-2 bg-surface px-2.5 shadow-card transition-colors',
        status ? STATUS_RING[status] : 'border-line',
        data.pick && 'cursor-crosshair hover:-translate-y-0.5 hover:ring-4 hover:ring-accent/40',
        data.highlight && 'pulse-ring',
        down && 'opacity-60 grayscale',
      )}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle type="target" position={Position.Left} />
      {dropAs && <Handle id="body" type={dropAs} position={dropAs === 'target' ? Position.Left : Position.Right} className="body-handle" />}
      {data.callout && <CalloutBubble callout={data.callout} />}
      {data.marked && (
        <span className="node-tag absolute -top-3.5 left-2 z-10 flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink shadow-card">
          <Crosshair size={11} /> Your call
        </span>
      )}
      {data.doubt && !data.pick && <DoubtChip {...data.doubt} />}
      {skin === 'factory' && status && <FactoryDeco block={data.block} status={status} util={u} dropped={u > 1 ? 1 : 0} />}
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
      {selected && data.onDelete && !data.locked && !down && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            data.onDelete?.()
          }}
          className="nodrag nopan absolute -top-3 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-bad text-white shadow-card hover:scale-110"
          aria-label={`Remove ${info.short}`}
          title="Remove block"
        >
          <Trash2 size={12} strokeWidth={2.5} />
        </button>
      )}
      {data.blind && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-surface-2 px-1.5 font-mono text-[9px] text-muted">no metrics</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

/** "Needed?" with keep / remove, floating off the block's top-left corner. */
function DoubtChip({ onKeep, onRemove }: { onKeep: () => void; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="node-tag nodrag nopan absolute -top-4 -left-3 z-10 flex items-center gap-0.5 rounded-lg bg-surface py-0.5 pr-0.5 pl-2 text-[11px] font-bold shadow-card ring-1 ring-warn/60"
    >
      <span className="text-warn">Needed?</span>
      <button onClick={(e) => (e.stopPropagation(), onKeep())} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-good" aria-label="Keep it" title="Yes, keep it">
        <Check size={12} strokeWidth={3} />
      </button>
      <button onClick={(e) => (e.stopPropagation(), onRemove())} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-bad" aria-label="Remove it" title="No, remove it">
        <Trash2 size={12} />
      </button>
    </motion.div>
  )
}

const CALLOUT_TONE: Record<Callout['tone'], string> = {
  info: 'bg-accent text-accent-ink',
  warn: 'bg-warn text-white',
  bad: 'bg-bad text-white',
  good: 'bg-good text-white',
}

/** A short speech bubble above a block. Pointer events pass through so it never blocks the canvas. */
function CalloutBubble({ callout }: { callout: Callout }) {
  return (
    <motion.div
      key={callout.text}
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'callout pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 w-max max-w-[230px] -translate-x-1/2 rounded-xl px-2.5 py-1.5 text-[11.5px] leading-snug font-semibold shadow-card',
        CALLOUT_TONE[callout.tone],
      )}
    >
      {callout.text}
      <span className={cn('absolute top-full left-1/2 -mt-1 h-2 w-2 -translate-x-1/2 rotate-45', CALLOUT_TONE[callout.tone])} />
    </motion.div>
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
