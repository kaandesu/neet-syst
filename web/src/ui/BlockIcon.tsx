import { BLOCKS } from '@/content/blocks'
import type { BlockId } from '@/engine/types'
import { cn } from '@/lib/cn'

/** The illustrated tile used everywhere a block appears. */
export function BlockIcon({ block, size = 36, className }: { block: BlockId; size?: number; className?: string }) {
  const info = BLOCKS[block]
  const Icon = info.icon
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-xl', className)}
      style={{
        width: size,
        height: size,
        background: `light-dark(hsl(${info.hue} 80% 93%), hsl(${info.hue} 35% 24%))`,
        color: `light-dark(hsl(${info.hue} 60% 38%), hsl(${info.hue} 80% 78%))`,
      }}
    >
      <Icon size={size * 0.55} strokeWidth={2.2} />
    </span>
  )
}
