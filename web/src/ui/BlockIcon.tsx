import { BLOCKS } from '@/content/blocks'
import type { BlockId } from '@/engine/types'
import { ASCII } from '@/features/design/playground/skins'
import { cn } from '@/lib/cn'
import { useSkin } from './ThemeToggle'

/** The illustrated tile used everywhere a block appears. */
export function BlockIcon({ block, size = 36, className }: { block: BlockId; size?: number; className?: string }) {
  const info = BLOCKS[block]
  const Icon = info.icon
  const skin = useSkin()
  if (skin === 'pixel')
    return (
      <span
        className={cn('block-icon-ascii inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size, fontSize: Math.max(11, size * 0.42), color: `hsl(${info.hue} 90% 72%)` }}
      >
        {ASCII[block] ?? info.short.slice(0, 3).toUpperCase()}
      </span>
    )
  return (
    <span
      className={cn('block-icon inline-flex shrink-0 items-center justify-center rounded-xl', className)}
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
