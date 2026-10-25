import { FlaskConical, Lock } from 'lucide-react'
import { useState } from 'react'
import { AppHeader } from '@/app/AppHeader'
import { BLOCKS } from '@/content/blocks'
import { CHAPTERS } from '@/content'
import type { BlockId } from '@/engine/types'
import { useProgress } from '@/store/progress'
import { BlockIcon } from '@/ui/BlockIcon'
import { BlockDrawer } from './BlockDrawer'

const GROUPS = CHAPTERS.map((c) => ({
  chapter: c,
  blocks: c.lessons.flatMap((l) => l.unlocks.map((b) => ({ block: b, lesson: l.title }))),
})).filter((g) => g.blocks.length > 0)

export function CollectionPage() {
  const unlocked = useProgress((s) => s.unlocked)
  const devMode = useProgress((s) => s.devMode)
  const unlockBlocks = useProgress((s) => s.unlockBlocks)
  const [open, setOpen] = useState<BlockId | null>(null)
  const missing = GROUPS.flatMap((g) => g.blocks.map((b) => b.block)).filter((b) => !unlocked.includes(b))
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">Your building blocks</h1>
          {(import.meta.env.DEV || devMode) && missing.length > 0 && (
            <button
              onClick={() => unlockBlocks(missing)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-warn ring-1 ring-warn/50 ring-inset hover:bg-warn-soft"
              title="Dev: collect every block without playing the lessons"
            >
              <FlaskConical size={14} /> Dev: unlock all {missing.length}
            </button>
          )}
        </div>
        <p className="mt-1 text-muted">
          {unlocked.length} of {Object.keys(BLOCKS).length} collected. Each one unlocks when a lesson gives you a reason to need it. Tap one to read its card.
        </p>
        {GROUPS.map(({ chapter, blocks }) => (
          <section key={chapter.id} className="mt-8">
            <h2 className="mb-3 text-xs font-bold tracking-wider text-muted uppercase">{chapter.title}</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
              {blocks.map(({ block, lesson }) =>
                unlocked.includes(block) ? (
                  <BlockTile key={block} block={block} onOpen={() => setOpen(block)} />
                ) : (
                  <LockedTile key={block} block={block} lesson={lesson} />
                ),
              )}
            </div>
          </section>
        ))}
      </main>
      <BlockDrawer block={open} onClose={() => setOpen(null)} />
    </div>
  )
}

function BlockTile({ block, onOpen }: { block: BlockId; onOpen: () => void }) {
  const b = BLOCKS[block]
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-3 text-center shadow-card transition hover:-translate-y-0.5 hover:border-accent"
    >
      <BlockIcon block={block} size={36} />
      <div className="text-[13px] leading-tight font-bold">{b.name}</div>
      <div className="line-clamp-2 text-[11px] leading-snug text-muted">{b.tagline}</div>
    </button>
  )
}

function LockedTile({ block, lesson }: { block: BlockId; lesson: string }) {
  const Icon = BLOCKS[block].icon
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-line bg-surface-2/60 px-2 py-3 text-center text-muted">
      <div className="relative flex h-9 items-center">
        <Icon size={26} className="opacity-25 blur-[1px]" />
        <Lock size={13} className="absolute -right-2 bottom-0" />
      </div>
      <div className="text-[13px] font-bold">???</div>
      <div className="line-clamp-2 text-[11px] leading-snug">Unlocks in “{lesson}”</div>
    </div>
  )
}
