import { Calculator, Check, FastForward, Lock, Play, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { CHAPTERS, CHECKPOINTS } from '@/content'
import type { Chapter, Lesson } from '@/engine/lesson/types'
import { cn } from '@/lib/cn'
import { lessonStatus, useProgress, type LessonStatus } from '@/store/progress'
import { BlockIcon } from '@/ui/BlockIcon'

export function MapPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Learn system design by building one.</h1>
          <p className="mt-2 max-w-xl text-muted">
            Every lesson starts with a problem your system can’t handle yet. You’ll learn one new building block, practice it, then use it to save
            the day, and every decision stays on your timeline.
          </p>
        </div>
        {CHAPTERS.map((c, i) => (
          <ChapterPath key={c.id} chapter={c} number={i + 1} />
        ))}
      </main>
    </div>
  )
}

function ChapterPath({ chapter, number }: { chapter: Chapter; number: number }) {
  const completed = useProgress((s) => s.completed)
  const statuses = chapter.lessons.map((_, i) => lessonStatus(chapter, i, completed))
  const doneCount = statuses.filter((s) => s === 'done').length
  const current = statuses.findIndex((s) => s === 'available' || s === 'in-progress')
  const checkpoint = CHECKPOINTS[chapter.id]

  return (
    <section>
      <div className="mb-8 rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-wider text-accent uppercase">Chapter {number}</div>
            <h2 className="text-xl font-extrabold">{chapter.title}</h2>
            <p className="text-sm text-muted">{chapter.subtitle}</p>
          </div>
          {checkpoint && doneCount < chapter.lessons.length && (
            <Link
              to={`/learn/${checkpoint.id}`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
              title={checkpoint.concern}
            >
              <FastForward size={15} /> Test out
            </Link>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-good transition-all" style={{ width: `${(doneCount / chapter.lessons.length) * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-muted">
            {doneCount}/{chapter.lessons.length}
          </span>
        </div>
      </div>

      <ol className="relative">
        {chapter.lessons.map((lesson, i) => (
          <LessonNode key={lesson.id} lesson={lesson} index={i} status={statuses[i]} isCurrent={i === current} done={completed[lesson.id] ?? []} />
        ))}
      </ol>
    </section>
  )
}

function LessonNode({
  lesson,
  index,
  status,
  isCurrent,
  done,
}: {
  lesson: Lesson
  index: number
  status: LessonStatus
  isCurrent: boolean
  done: string[]
}) {
  const offset = Math.round(Math.sin(index * 0.95) * 90)
  const locked = status === 'locked'
  const capstone = lesson.kind === 'capstone'
  const size = capstone ? 84 : 68

  const icon = capstone ? (
    <Trophy size={30} />
  ) : lesson.unlocks[0] ? (
    <BlockIcon block={lesson.unlocks[lesson.unlocks.length > 2 ? 2 : 0]} size={40} className="bg-transparent" />
  ) : (
    <Calculator size={28} />
  )

  const body = (
    <div className="flex items-center gap-5" style={{ transform: `translateX(${offset}px)` }}>
      <div className="relative">
        {isCurrent && (
          <motion.div
            initial={{ y: 4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-xl bg-accent px-2.5 py-1 text-xs font-bold whitespace-nowrap text-accent-ink shadow-card"
          >
            {status === 'in-progress' ? 'Continue' : 'Start here'}
          </motion.div>
        )}
        <div
          className={cn(
            'flex items-center justify-center rounded-full border-b-[6px] transition',
            locked && 'border-line bg-surface-2 text-muted',
            !locked && status !== 'done' && 'border-accent/60 bg-accent-soft text-accent',
            status === 'done' && 'border-good/60 bg-good-soft text-good',
            capstone && !locked && status !== 'done' && 'border-warn/70 bg-warn-soft text-warn',
            isCurrent && 'pulse-ring',
            !locked && 'group-hover:-translate-y-0.5',
          )}
          style={{ width: size, height: size }}
        >
          {locked ? <Lock size={24} /> : status === 'done' && !capstone ? <Check size={30} strokeWidth={3} /> : icon}
        </div>
        <div className="mt-1.5 flex justify-center gap-1">
          {lesson.sections.map((s) => (
            <span key={s.kind} className={cn('h-1.5 w-3 rounded-full', done.includes(s.kind) ? 'bg-good' : 'bg-line')} />
          ))}
        </div>
      </div>
      <div className={cn('max-w-xs', locked && 'opacity-55')}>
        <div className="text-[11px] font-bold tracking-wider text-muted uppercase">
          {capstone ? 'Capstone' : `Lesson ${index + 1}`}
          {lesson.unlocks.length > 0 && !capstone && ' · unlocks a block'}
        </div>
        <div className="font-extrabold">{lesson.title}</div>
        <div className="text-[13px] text-muted">{lesson.concern}</div>
      </div>
    </div>
  )

  return (
    <li className="py-5">
      {locked ? (
        <div className="cursor-not-allowed" title="Finish the previous lesson to unlock">
          {body}
        </div>
      ) : (
        <Link to={`/learn/${lesson.id}`} className="group block">
          {body}
        </Link>
      )}
      <span className="sr-only">{status === 'done' ? 'completed' : status}</span>
      {index === 0 && status === 'available' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted" style={{ transform: `translateX(${offset}px)` }}>
          <Play size={12} /> About 5 minutes per lesson section.
        </p>
      )}
    </li>
  )
}
