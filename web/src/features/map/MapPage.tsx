import { ArrowRight, BellRing, Calculator, Check, Clock, FastForward, Lock, Play, RotateCcw, Skull, Star, TrendingUp, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { BLOCKS } from '@/content/blocks'
import { CHAPTERS, CHECKPOINTS } from '@/content'
import { SHIFTS } from '@/content/shifts'
import type { Shift } from '@/engine/shifts/types'
import type { Chapter, Lesson } from '@/engine/lesson/types'
import type { BlockId } from '@/engine/types'
import { BlockDrawer } from '@/features/collection/BlockDrawer'
import { cn } from '@/lib/cn'
import { chapterDone, incidentStatus, lessonStatus, useProgress, type IncidentStatus, type LessonStatus } from '@/store/progress'
import { shiftProgressOf, useShifts } from '@/store/shifts'
import { BlockIcon } from '@/ui/BlockIcon'

export function MapPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24">
        <h1 className="sr-only">Story</h1>
        {CHAPTERS.map((c, i) => (
          <ChapterStory key={c.id} chapter={c} number={i + 1} />
        ))}
      </main>
    </div>
  )
}

interface Episode {
  lesson: Lesson
  index: number
  status: LessonStatus
  done: string[]
}

const minutesOf = (l: Lesson) => l.minutes ?? l.sections.length * 5

function ChapterStory({ chapter, number }: { chapter: Chapter; number: number }) {
  const completed = useProgress((s) => s.completed)
  const devMode = useProgress((s) => s.devMode)
  const testedOut = useProgress((s) => s.testedOut)
  const before = CHAPTERS.find((c) => c.id === chapter.requires)
  const open = !before || testedOut.includes(before.id) || chapterDone(before, completed)
  const episodes: Episode[] = chapter.lessons.map((lesson, index) => ({
    lesson,
    index,
    status: lessonStatus(chapter, index, completed, devMode, open),
    done: completed[lesson.id] ?? [],
  }))
  const doneCount = episodes.filter((e) => e.status === 'done').length
  const currentIndex = episodes.findIndex((e) => e.status === 'available' || e.status === 'in-progress')
  const current = episodes[currentIndex]?.lesson.id
  const [picked, setPicked] = useState<string | null>(null)
  const selected = episodes.find((e) => e.lesson.id === (picked ?? current)) ?? episodes[episodes.length - 1]
  const [drawer, setDrawer] = useState<BlockId | null>(null)

  const checkpoint = CHECKPOINTS[chapter.id]
  const incidents = (chapter.incidents ?? []).map((inc) => ({
    inc,
    status: incidentStatus(inc, chapter.lessons.find((l) => l.id === inc.due), completed, devMode),
  }))
  const waiting = incidents.filter((x) => x.status === 'waiting').length
  const milestone = (id: string) => chapter.arc?.find((m) => m.lesson === id)

  const detail = <EpisodeDetail episode={selected} isCurrent={selected.lesson.id === current} onBlock={setDrawer} />

  return (
    <section className="mb-14">
      <ChapterBanner chapter={chapter} number={number} doneCount={doneCount} reached={currentIndex === -1 ? episodes.length : currentIndex}>
        {checkpoint && doneCount < chapter.lessons.length && (
          <Link
            to={`/learn/${checkpoint.id}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
            title={checkpoint.concern}
          >
            <FastForward size={15} /> Test out
          </Link>
        )}
      </ChapterBanner>

      {!open && !devMode && before && (
        <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <Lock size={14} /> Opens after “{before.title}”.
        </div>
      )}

      {waiting > 0 && (
        <div className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-warn">
          <BellRing size={14} /> {waiting} incident{waiting > 1 ? 's' : ''} waiting: quick review drills in the episode list.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="space-y-1.5">
          {episodes.map((ep) => {
            const m = milestone(ep.lesson.id)
            const isSelected = ep.lesson.id === selected.lesson.id
            return [
              m && <MilestoneRow key={`m:${ep.lesson.id}`} label={m.label} reached={ep.status !== 'locked'} />,
              <li key={ep.lesson.id}>
                <EpisodeRow episode={ep} isCurrent={ep.lesson.id === current} selected={isSelected} onSelect={() => setPicked(ep.lesson.id)} />
                {isSelected && <div className="mt-2 mb-3 md:hidden">{detail}</div>}
              </li>,
              ...incidents.filter((x) => x.inc.due === ep.lesson.id).map((x) => <IncidentRow key={x.inc.id} incident={x.inc} status={x.status} />),
              ...SHIFTS.filter((sh) => sh.chapter === chapter.id && sh.after === ep.lesson.id).map((sh) => (
                <ShiftRow key={sh.id} shift={sh} open={devMode || ep.status === 'done'} />
              )),
            ]
          })}
        </ol>
        <div className="hidden md:block">
          <div className="sticky top-6">{detail}</div>
        </div>
      </div>
      <BlockDrawer block={drawer} onClose={() => setDrawer(null)} />
    </section>
  )
}

/** The chapter's premise and how far the user count has grown. */
function ChapterBanner({
  chapter,
  number,
  doneCount,
  reached,
  children,
}: {
  chapter: Chapter
  number: number
  doneCount: number
  /** Index of the first unfinished episode. */
  reached: number
  children?: React.ReactNode
}) {
  const total = chapter.lessons.length
  const pos = (id: string) => Math.max(0, chapter.lessons.findIndex((l) => l.id === id)) / total
  return (
    <div className="relative overflow-hidden rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line">
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
        style={{ background: 'color-mix(in oklab, var(--accent) 22%, transparent)' }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-wider text-accent uppercase">Chapter {number}</div>
          <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight">{chapter.title}</h2>
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">{chapter.story ?? chapter.subtitle}</p>
        </div>
        {children}
      </div>

      <div className="relative mt-8 mb-1">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
          <motion.div
            className="h-full rounded-full bg-good"
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / total) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        {chapter.arc?.map((m) => {
          const at = pos(m.lesson)
          const hit = chapter.lessons.findIndex((l) => l.id === m.lesson) < reached || reached >= total
          return (
            <div key={m.lesson} className="absolute -top-6 -translate-x-1/2" style={{ left: `${Math.max(4, at * 100)}%` }}>
              <div className={cn('hidden text-center font-mono text-[10.5px] font-bold whitespace-nowrap sm:block', hit ? 'text-good' : 'text-muted')}>{m.label}</div>
              <div className={cn('mx-auto mt-5 h-4 w-0.5 rounded-full sm:mt-1', hit ? 'bg-good' : 'bg-line')} />
            </div>
          )
        })}
      </div>
      <div className="relative mt-2 flex justify-between font-mono text-[11px] text-muted">
        <span>
          {doneCount}/{total} episodes
        </span>
        <span className="hidden sm:inline">{chapter.subtitle}</span>
      </div>
    </div>
  )
}

function MilestoneRow({ label, reached }: { label: string; reached: boolean }) {
  return (
    <li className="flex items-center gap-2 px-2 pt-3 pb-1" aria-hidden>
      <TrendingUp size={13} className={reached ? 'text-good' : 'text-muted'} />
      <span className={cn('text-[11px] font-bold tracking-wider uppercase', reached ? 'text-good' : 'text-muted')}>{label}</span>
      <span className="h-px flex-1 bg-line" />
    </li>
  )
}

function EpisodeBadge({ episode, size = 40 }: { episode: Episode; size?: number }) {
  const { lesson, status, index } = episode
  const capstone = lesson.kind === 'capstone'
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-2xl border-b-4 font-extrabold',
        status === 'locked' && 'border-line bg-surface-2 text-muted',
        (status === 'available' || status === 'in-progress') && (capstone ? 'border-warn/70 bg-warn-soft text-warn' : 'border-accent/60 bg-accent-soft text-accent'),
        status === 'done' && 'border-good/60 bg-good-soft text-good',
      )}
      style={{ width: size, height: size }}
    >
      {status === 'locked' ? <Lock size={size * 0.4} /> : status === 'done' ? <Check size={size * 0.5} strokeWidth={3} /> : capstone ? <Trophy size={size * 0.45} /> : index + 1}
    </div>
  )
}

function EpisodeRow({ episode, isCurrent, selected, onSelect }: { episode: Episode; isCurrent: boolean; selected: boolean; onSelect: () => void }) {
  const { lesson, status, done, index } = episode
  const locked = status === 'locked'
  const capstone = lesson.kind === 'capstone'
  return (
    <button
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-center gap-3.5 rounded-2xl border-2 px-3 py-2.5 text-left transition',
        selected ? 'border-accent bg-surface shadow-card' : 'border-transparent hover:bg-surface hover:shadow-card',
        isCurrent && !selected && 'border-accent/30',
      )}
    >
      <EpisodeBadge episode={episode} />
      <div className={cn('min-w-0 flex-1', locked && 'opacity-55')}>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-muted uppercase">
          {capstone ? <span className="text-warn">Capstone</span> : `Episode ${index + 1}`}
          {isCurrent && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] tracking-normal text-accent-ink normal-case">{status === 'in-progress' ? 'Continue' : 'Up next'}</span>}
        </div>
        <div className="truncate font-extrabold">{lesson.title}</div>
        <div className="truncate text-[13px] text-muted">{lesson.concern}</div>
      </div>
      <div className="hidden shrink-0 gap-1 sm:flex">
        {lesson.sections.map((s) => (
          <span key={s.kind} className={cn('h-1.5 w-3 rounded-full', done.includes(s.kind) ? 'bg-good' : 'bg-line')} />
        ))}
      </div>
      <span className="sr-only">{status === 'done' ? 'completed' : status}</span>
    </button>
  )
}

/** The selected episode: its hook, what it unlocks, its parts, and the way in. */
function EpisodeDetail({ episode, isCurrent, onBlock }: { episode: Episode; isCurrent: boolean; onBlock: (b: BlockId) => void }) {
  const unlocked = useProgress((s) => s.unlocked)
  const { lesson, status, done, index } = episode
  const locked = status === 'locked'
  const capstone = lesson.kind === 'capstone'
  const cta = status === 'done' ? 'Replay' : status === 'in-progress' ? 'Continue' : 'Start episode'
  return (
    <motion.div
      key={lesson.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line"
    >
      <div className={cn('px-5 pt-5 pb-4', capstone ? 'bg-warn-soft/60' : 'bg-accent-soft/50')}>
        <div className="flex items-center gap-3">
          <EpisodeBadge episode={episode} size={48} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-wider text-muted uppercase">
              {capstone ? 'Capstone' : `Episode ${index + 1}`}
              {isCurrent && ' · you are here'}
            </div>
            <div className="text-lg leading-tight font-extrabold">{lesson.title}</div>
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed">
          <span className="font-semibold">The problem: </span>
          {lesson.concern}
        </p>
      </div>

      <div className="space-y-4 px-5 py-4">
        {lesson.unlocks.length > 0 ? (
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">{capstone ? 'Uses' : 'Unlocks'}</div>
            <div className="flex flex-wrap gap-1.5">
              {lesson.unlocks.map((b) => {
                const have = unlocked.includes(b)
                return (
                  <button
                    key={b}
                    disabled={!have}
                    onClick={() => onBlock(b)}
                    title={have ? `Read the ${BLOCKS[b].name} card` : 'Finish this episode to collect it'}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface py-1 pr-2.5 pl-1 text-[12.5px] font-semibold transition enabled:hover:border-accent disabled:cursor-default"
                  >
                    <BlockIcon block={b} size={24} className={cn(!have && 'opacity-50 grayscale')} />
                    {BLOCKS[b].name}
                    {!have && <Lock size={11} className="text-muted" />}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Calculator size={15} /> No new block: this one sharpens a skill.
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-wider text-muted uppercase">
            <span>{lesson.sections.length} parts</span>
            <span className="flex items-center gap-1 normal-case">
              <Clock size={12} /> ~{minutesOf(lesson)} min
            </span>
          </div>
          <ol className="space-y-1">
            {lesson.sections.map((s, i) => {
              const ok = done.includes(s.kind)
              return (
                <li key={s.kind} className="flex items-center gap-2.5 text-[13.5px]">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      ok ? 'bg-good text-white' : 'bg-surface-2 text-muted ring-1 ring-line',
                    )}
                  >
                    {ok ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn(ok && 'text-muted')}>{s.title}</span>
                  <span className="ml-auto text-[11px] text-muted capitalize">{s.kind}</span>
                </li>
              )
            })}
          </ol>
        </div>

        {locked ? (
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-2.5 text-[13px] font-semibold text-muted">
            <Lock size={14} /> Finish the episode before this one
          </div>
        ) : (
          <Link
            to={`/learn/${lesson.id}`}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl py-2.5 text-[15px] font-bold shadow-card transition hover:brightness-110',
              status === 'done' ? 'border border-line bg-surface text-ink shadow-none hover:bg-surface-2' : 'bg-accent text-accent-ink',
            )}
          >
            {status === 'done' ? <RotateCcw size={16} /> : <Play size={16} />} {cta}
            {status !== 'done' && <ArrowRight size={16} />}
          </Link>
        )}
      </div>
    </motion.div>
  )
}

/** A review drill tucked under the episode it follows. */
function IncidentRow({ incident, status }: { incident: Lesson; status: IncidentStatus }) {
  const locked = status === 'locked'
  const body = (
    <div className="ml-8 flex items-center gap-3 rounded-xl border-l-2 border-warn/40 px-3 py-1.5">
      <div
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-b-2',
          locked && 'border-line bg-surface-2 text-muted',
          status === 'waiting' && 'border-warn/70 bg-warn-soft text-warn',
          status === 'done' && 'border-good/60 bg-good-soft text-good',
        )}
      >
        {locked ? <Lock size={13} /> : status === 'done' ? <Check size={15} strokeWidth={3} /> : <BellRing size={14} />}
        {status === 'waiting' && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-ping rounded-full bg-warn" />}
      </div>
      <div className={cn('min-w-0', locked && 'opacity-55')}>
        <div className="text-[10px] font-bold tracking-wider text-warn uppercase">Incident · review</div>
        <div className="truncate text-[13.5px] leading-tight font-bold">{incident.title}</div>
      </div>
    </div>
  )
  return (
    <li>
      {locked ? (
        <div className="cursor-not-allowed" title="Unlocks after the episode above">
          {body}
        </div>
      ) : (
        <Link to={`/learn/${incident.id}`} className="block rounded-xl transition hover:bg-surface" title={incident.concern}>
          {body}
        </Link>
      )}
    </li>
  )
}

/** A boss fight on the path: opens once the episode above it is done. */
function ShiftRow({ shift, open }: { shift: Shift; open: boolean }) {
  const best = useShifts((s) => shiftProgressOf(s.byId, shift.id).best)
  const body = (
    <div
      className={cn(
        'shift-row relative my-2 flex items-center gap-3.5 overflow-hidden rounded-2xl border-2 px-3 py-3',
        open ? 'border-bad/60 bg-bad-soft' : 'border-dashed border-line bg-surface-2/60',
      )}
    >
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-b-4',
          open ? 'border-bad/70 bg-bad text-white' : 'border-line bg-surface-2 text-muted',
        )}
      >
        {open ? <Skull size={22} /> : <Lock size={18} />}
      </div>
      <div className={cn('min-w-0 flex-1', !open && 'opacity-60')}>
        <div className="text-[11px] font-bold tracking-wider text-bad uppercase">Boss · Shift</div>
        <div className="truncate font-extrabold">{shift.title}</div>
        <div className="truncate text-[13px] text-muted">{open ? shift.concern : 'Opens when the episode above is done.'}</div>
      </div>
      <span className="flex shrink-0 items-center gap-0.5" aria-label={`${best?.stars ?? 0} of 3 stars`}>
        {[0, 1, 2].map((i) => (
          <Star key={i} size={16} className={i < (best?.stars ?? 0) ? 'fill-accent text-accent' : 'text-line'} />
        ))}
      </span>
    </div>
  )
  return (
    <li>
      {open ? (
        <Link to={`/shift/${shift.id}`} className="block transition hover:-translate-y-0.5">
          {body}
        </Link>
      ) : (
        <div className="cursor-not-allowed">{body}</div>
      )}
    </li>
  )
}
