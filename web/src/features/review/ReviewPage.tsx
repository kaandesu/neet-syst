import { BellRing, Crosshair, FlaskConical, Lightbulb, RotateCcw, Search, Sparkles, type LucideIcon } from 'lucide-react'
import { useNavigate, Link } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { CHAPTERS, lessonById } from '@/content'
import type { Step } from '@/engine/lesson/types'
import { useProgress, type Miss, type MissKind } from '@/store/progress'
import { runKey, useRuns } from '@/store/runs'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'

const KIND: Record<MissKind, { label: string; icon: LucideIcon }> = {
  reason: { label: 'wrong reason', icon: Search },
  estimate: { label: 'estimate off', icon: Search },
  requirements: { label: 'scope mix-up', icon: Search },
  predict: { label: 'missed prediction', icon: Crosshair },
  diagnose: { label: 'misdiagnosed', icon: Crosshair },
  hint: { label: 'needed hints', icon: Lightbulb },
  whatif: { label: 'tried a wrong idea', icon: FlaskConical },
}

function stepText(step: Step | undefined) {
  if (!step) return 'A step that no longer exists'
  switch (step.t) {
    case 'reason':
      return step.question
    case 'estimate':
      return step.question
    case 'fork':
      return step.question
    case 'concept':
      return 'Concept card'
    default:
      return step.text
  }
}

/** Steps the learner struggled with, grouped by lesson, with a one-click practice run. */
export function ReviewPage() {
  const misses = useProgress((s) => s.misses)
  const groups = new Map<string, Miss[]>()
  for (const m of Object.values(misses).sort((a, b) => b.lastAt - a.lastAt)) {
    groups.set(m.lessonId, [...(groups.get(m.lessonId) ?? []), m])
  }

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24">
        <h1 className="text-3xl font-extrabold tracking-tight">Weak spots</h1>
        <p className="mt-2 max-w-xl text-muted">
          Every wrong reason, missed prediction or extra hint lands here. Get the step right first try on a later run and it disappears.
        </p>
        {groups.size === 0 ? (
          <div className="mt-10 rounded-3xl bg-surface p-8 text-center shadow-card ring-1 ring-line">
            <Sparkles size={36} className="mx-auto text-good" />
            <div className="mt-2 text-lg font-extrabold">Nothing to review</div>
            <p className="text-sm text-muted">Either you’re flawless or you haven’t started yet.</p>
            <Link to="/" className="mt-3 inline-block font-semibold text-accent">
              Back to the map
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {[...groups.entries()].map(([lessonId, list]) => (
              <LessonGroup key={lessonId} lessonId={lessonId} misses={list} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function LessonGroup({ lessonId, misses }: { lessonId: string; misses: Miss[] }) {
  const navigate = useNavigate()
  const restart = useRuns((s) => s.restart)
  const lesson = lessonById(lessonId)
  if (!lesson) return null
  const sections = [...new Set(misses.map((m) => m.sectionIndex))].sort()
  const incident = CHAPTERS.flatMap((c) => c.incidents ?? []).find(
    (inc) => inc.id !== lesson.id && inc.reviews?.some((b) => lesson.unlocks.includes(b)),
  )

  const practice = (sectionIndex: number) => {
    restart(runKey(lesson.id, sectionIndex))
    navigate(`/learn/${lesson.id}/${sectionIndex}`)
  }

  return (
    <section className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-muted uppercase">{lesson.kind === 'incident' ? 'Incident' : 'Lesson'}</div>
          <h2 className="text-lg font-extrabold">{lesson.title}</h2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {sections.map((i) => (
            <Button key={i} size="sm" variant="secondary" onClick={() => practice(i)}>
              <RotateCcw size={14} /> Practice {lesson.sections[i]?.title ?? `section ${i + 1}`}
            </Button>
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {misses.map((m) => (
          <li key={`${m.sectionIndex}#${m.stepIndex}`} className="rounded-xl bg-surface-2 px-3 py-2 text-[13.5px]">
            <RichText text={stepText(lesson.sections[m.sectionIndex]?.steps[m.stepIndex])} />
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {m.kinds.map((k) => {
                const { label, icon: Icon } = KIND[k]
                return (
                  <span key={k} className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line">
                    <Icon size={11} /> {label}
                  </span>
                )
              })}
              {m.count > 1 && <span className="text-[11px] text-muted">×{m.count}</span>}
            </div>
          </li>
        ))}
      </ul>
      {incident && (
        <Link to={`/learn/${incident.id}`} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-warn hover:underline">
          <BellRing size={14} /> Related incident drill: {incident.title}
        </Link>
      )}
    </section>
  )
}
