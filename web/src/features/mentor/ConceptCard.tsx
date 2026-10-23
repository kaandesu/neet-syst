import { motion } from 'motion/react'
import { BLOCKS } from '@/content/blocks'
import type { BlockId } from '@/engine/types'
import { BlockIcon } from '@/ui/BlockIcon'

/** The illustrated "trading card" for a building block. */
export function ConceptCard({ block, compact }: { block: BlockId; compact?: boolean }) {
  const b = BLOCKS[block]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: `light-dark(hsl(${b.hue} 80% 96%), hsl(${b.hue} 30% 18%))` }}
      >
        <BlockIcon block={block} size={44} />
        <div>
          <div className="text-[11px] font-bold tracking-wider text-muted uppercase">Building block</div>
          <div className="text-lg leading-tight font-extrabold">{b.name}</div>
          <div className="text-sm text-muted">{b.tagline}</div>
        </div>
      </div>
      <div className="space-y-2.5 px-4 py-3 text-sm leading-relaxed">
        <p>{b.concept.what}</p>
        {!compact && (
          <>
            <p>
              <span className="font-semibold">Why it matters: </span>
              {b.concept.why}
            </p>
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-muted">
              <span className="mr-1">💡</span>
              {b.concept.analogy}
            </p>
            <ul className="space-y-1">
              {b.concept.tradeoffs.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-warn">⚖︎</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">In the wild: {b.concept.examples}</p>
          </>
        )}
      </div>
    </motion.div>
  )
}
