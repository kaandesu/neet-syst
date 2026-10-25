import { CheckCircle2, Circle, CircleDot } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { PROBLEMS } from '@/content/problems'
import type { Difficulty } from '@/engine/problems/types'
import { cn } from '@/lib/cn'
import { progressOf, useProblems } from '@/store/problems'
import { DIFFICULTY, Stars } from './bits'

export function ProblemListPage() {
  const byId = useProblems((s) => s.byId)
  const [filter, setFilter] = useState<Difficulty | 'all'>('all')
  const shown = PROBLEMS.filter((p) => filter === 'all' || p.difficulty === filter)
  const solved = PROBLEMS.filter((p) => progressOf(byId, p.id).solved).length

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Problems</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Standalone system design problems. Each one gives you a story, a starting skeleton, and tests to pass. Run checks the visible tests; Submit runs the hidden ones too.
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold">
              {solved}
              <span className="text-muted">/{PROBLEMS.length}</span>
            </div>
            <div className="text-[11px] font-bold tracking-wide text-muted uppercase">solved</div>
          </div>
        </div>

        <div className="mt-6 flex gap-1.5" role="tablist" aria-label="Difficulty">
          {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={filter === d}
              onClick={() => setFilter(d)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-sm font-semibold transition',
                filter === d ? 'bg-surface-2 text-ink ring-1 ring-line' : 'text-muted hover:text-ink',
              )}
            >
              {d === 'all' ? 'All' : DIFFICULTY[d].label}
            </button>
          ))}
        </div>

        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
          {shown.map((p) => {
            const prog = progressOf(byId, p.id)
            const attempted = !prog.solved && (prog.submits > 0 || !!prog.design)
            return (
              <li key={p.id}>
                <Link to={`/problems/${p.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-2">
                  <span className="shrink-0" title={prog.solved ? 'Solved' : attempted ? 'Attempted' : 'Not started'}>
                    {prog.solved ? <CheckCircle2 size={18} className="text-good" /> : attempted ? <CircleDot size={18} className="text-warn" /> : <Circle size={18} className="text-line" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">
                      {p.number}. {p.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                          {t}
                        </span>
                      ))}
                    </span>
                  </span>
                  {prog.best && <Stars n={prog.best.stars} />}
                  <span className={cn('w-16 text-right text-sm font-semibold', DIFFICULTY[p.difficulty].className)}>{DIFFICULTY[p.difficulty].label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </main>
    </div>
  )
}
