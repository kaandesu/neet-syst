import { motion } from 'motion/react'
import { IDEAS, type IdeaId } from '@/content/ideas'
import { cn } from '@/lib/cn'
import { RichText } from '@/ui/RichText'
import { IdempotencyDiagram } from './IdempotencyDiagram'

export function IdeaIcon({ idea, size = 36, className }: { idea: IdeaId; size?: number; className?: string }) {
  const { icon: Icon, hue } = IDEAS[idea]
  return (
    <span
      className={cn('block-icon inline-flex shrink-0 items-center justify-center rounded-xl', className)}
      style={{ width: size, height: size, background: `light-dark(hsl(${hue} 80% 93%), hsl(${hue} 35% 24%))`, color: `light-dark(hsl(${hue} 60% 38%), hsl(${hue} 80% 78%))` }}
    >
      <Icon size={size * 0.55} strokeWidth={2.2} />
    </span>
  )
}

/** The "trading card" for an idea, with a worked diagram when it has one. */
export function IdeaCard({ idea }: { idea: IdeaId }) {
  const d = IDEAS[idea]
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: `light-dark(hsl(${d.hue} 80% 96%), hsl(${d.hue} 30% 18%))` }}>
        <IdeaIcon idea={idea} size={44} />
        <div>
          <div className="text-[11px] font-bold tracking-wider text-muted uppercase">Idea</div>
          <div className="text-lg leading-tight font-extrabold">{d.name}</div>
          <div className="text-sm text-muted">{d.tagline}</div>
        </div>
      </div>
      <div className="space-y-2.5 px-4 py-3 text-sm leading-relaxed">
        <p>
          <RichText text={d.what} />
        </p>
        {d.diagram === 'idempotency-key' && <IdempotencyDiagram />}
        <p>
          <span className="font-semibold">Why it matters: </span>
          <RichText text={d.why} />
        </p>
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-muted">
          <span className="mr-1">💡</span>
          {d.analogy}
        </p>
        <ul className="space-y-1">
          {d.tradeoffs.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-warn">⚖︎</span>
              <span>
                <RichText text={t} />
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">In the wild: {d.examples}</p>
      </div>
    </motion.div>
  )
}
