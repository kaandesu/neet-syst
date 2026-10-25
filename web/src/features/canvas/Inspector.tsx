import { Activity, Trash2, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { BLOCKS } from '@/content/blocks'
import { explainNode } from '@/engine/sim/explain'
import { SPECS } from '@/engine/sim/specs'
import type { DNode, NodeResult, NodeStatus } from '@/engine/types'
import { cn } from '@/lib/cn'
import { BlockIcon } from '@/ui/BlockIcon'

const TONE: Record<NodeStatus, string> = {
  idle: 'bg-line',
  ok: 'bg-good',
  warm: 'bg-warn',
  hot: 'bg-bad',
  down: 'bg-bad',
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/** What one block is doing right now, and why it's that colour. */
export function Inspector({
  node,
  result,
  phaseLabel,
  blind,
  onClose,
  onDelete,
  actions,
}: {
  node: DNode
  result?: NodeResult
  phaseLabel?: string
  blind?: boolean
  onClose: () => void
  /** Shows a remove button; left out for read-only canvases. Locked blocks never get one. */
  onDelete?: () => void
  /** Extra buttons under the details (the sandbox uses this for chaos). */
  actions?: ReactNode
}) {
  const info = BLOCKS[node.block]
  const unlimited = SPECS[node.block].capacity >= 1e9
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute right-3 bottom-4 z-20 w-72 rounded-2xl border border-line bg-surface/95 p-3.5 shadow-card backdrop-blur"
      role="dialog"
      aria-label={`${info.name} details`}
    >
      <div className="flex items-start gap-2.5">
        <BlockIcon block={node.block} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-tight font-extrabold">{info.name}</div>
          <div className="font-mono text-[11px] text-muted">{node.id}</div>
        </div>
        {onDelete && !node.locked && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-bad hover:bg-bad-soft"
            aria-label={`Remove ${info.name}`}
          >
            <Trash2 size={14} /> Remove
          </button>
        )}
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      {blind ? (
        <div className="mt-3 flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
          <Activity size={15} className="mt-0.5 shrink-0" />
          No metrics. You can't see inside a system you don't monitor.
        </div>
      ) : !result ? (
        <div className="mt-3 space-y-1 text-[13px]">
          <p className="text-muted">{info.tagline}</p>
          {!unlimited && (
            <p>
              Capacity: <span className="font-mono font-bold">{fmt(SPECS[node.block].capacity)}</span> units/s
            </p>
          )}
          <p className="text-[12px] text-muted">Run traffic to see what it's doing.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {phaseLabel && <div className="text-[11px] font-bold tracking-wide text-muted uppercase">{phaseLabel}</div>}
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat label="req/s in" value={fmt(result.inRps)} />
            <Stat label="dropped/s" value={fmt(result.droppedRps)} bad={result.droppedRps > 0} />
          </div>
          {!unlimited && result.status !== 'down' && (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted">
                <span>
                  {fmt(result.load)} / {fmt(result.capacity)} units/s
                </span>
                <span className="font-mono font-bold">{Math.round(result.utilization * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
                <div className={cn('h-full rounded-full', TONE[result.status])} style={{ width: `${Math.min(100, result.utilization * 100)}%` }} />
              </div>
            </div>
          )}
          <p className={cn('rounded-xl px-3 py-2 text-[13px] leading-snug', result.status === 'hot' || result.status === 'down' ? 'bg-bad-soft' : 'bg-surface-2')}>
            {explainNode(result)}
          </p>
        </div>
      )}
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </motion.div>
  )
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-surface-2 px-2 py-1.5', bad && 'bg-bad-soft')}>
      <div className="font-mono text-[15px] font-bold">{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}
