import { Lock } from 'lucide-react'
import { AppHeader } from '@/app/AppHeader'
import { BLOCKS } from '@/content/blocks'
import { CHAPTERS } from '@/content'
import type { BlockId } from '@/engine/types'
import { ConceptCard } from '@/features/mentor/ConceptCard'
import { useProgress } from '@/store/progress'

const ORDER = CHAPTERS.flatMap((c) => c.lessons.flatMap((l) => l.unlocks.map((b) => ({ block: b, lesson: l.title }))))

export function CollectionPage() {
  const unlocked = useProgress((s) => s.unlocked)
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24">
        <h1 className="text-2xl font-extrabold">Your building blocks</h1>
        <p className="mt-1 text-muted">
          {unlocked.length} of {Object.keys(BLOCKS).length} collected. Each one unlocks when a lesson gives you a reason to need it.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ORDER.map(({ block, lesson }) =>
            unlocked.includes(block) ? <ConceptCard key={block} block={block} /> : <LockedCard key={block} block={block} lesson={lesson} />,
          )}
        </div>
      </main>
    </div>
  )
}

function LockedCard({ block, lesson }: { block: BlockId; lesson: string }) {
  const Icon = BLOCKS[block].icon
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface-2/60 p-6 text-center text-muted">
      <div className="relative">
        <Icon size={40} className="opacity-25 blur-[1.5px]" />
        <Lock size={16} className="absolute -right-2 -bottom-1" />
      </div>
      <div className="font-bold">???</div>
      <div className="text-xs">Unlocks in “{lesson}”</div>
    </div>
  )
}
