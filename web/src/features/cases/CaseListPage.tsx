import { ArrowRight, CheckCircle2, Circle, CircleDot, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { CHAPTERS } from '@/content'
import { CASES } from '@/content/cases'
import { DIFFICULTY } from '@/features/problems/bits'
import { cn } from '@/lib/cn'
import { chapterDone, useProgress } from '@/store/progress'

/** Real systems, worked through in interview order: scope, high-level design, deep dives. */
export function CaseListPage() {
  const completed = useProgress((s) => s.completed)
  const testedOut = useProgress((s) => s.testedOut)
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Case studies</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Real systems, in the order an interview goes: scope it, estimate it, write the API, sketch the boxes, then dig into what broke. After every decision you see what the engineers actually built, next to yours.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {CASES.map(({ lesson, company, era, difficulty, tags, recommended }) => {
            const done = completed[lesson.id] ?? []
            const finished = lesson.sections.every((s) => done.includes(s.kind))
            const started = !finished && done.length > 0
            const rec = CHAPTERS.find((c) => c.id === recommended)
            const ready = !rec || testedOut.includes(rec.id) || chapterDone(rec, completed)
            return (
              <li key={lesson.id}>
                <Link
                  to={`/learn/${lesson.id}`}
                  className="group flex h-full flex-col rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent/50"
                >
                  <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider uppercase">
                    <span className="text-accent">{company}</span>
                    <span className="text-muted">· {era}</span>
                    <span className={cn('ml-auto', DIFFICULTY[difficulty].className)}>{DIFFICULTY[difficulty].label}</span>
                  </div>
                  <div className="mt-1.5 flex items-start gap-2">
                    <h2 className="flex-1 text-[17px] leading-snug font-extrabold">{lesson.title}</h2>
                    <span title={finished ? 'Finished' : started ? 'In progress' : 'Not started'}>
                      {finished ? <CheckCircle2 size={18} className="text-good" /> : started ? <CircleDot size={18} className="text-warn" /> : <Circle size={18} className="text-line" />}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] text-muted">{lesson.concern}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {lesson.sections.map((s, i) => (
                      <span key={s.kind} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-semibold', done.includes(s.kind) ? 'bg-good-soft text-good' : 'bg-surface-2 text-muted')}>
                        {i + 1}. {s.tab ?? s.title}
                      </span>
                    ))}
                    {tags.map((t) => (
                      <span key={t} className="rounded-md px-1.5 py-0.5 text-[11px] text-muted ring-1 ring-line">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center gap-3 pt-4 text-[12px] text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> ~{lesson.minutes ?? 30} min
                    </span>
                    {rec && !ready && <span>Best after “{rec.title}”</span>}
                    <span className="ml-auto flex items-center gap-1 font-bold text-accent group-hover:gap-1.5">
                      {finished ? 'Replay' : started ? 'Continue' : 'Start'} <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
