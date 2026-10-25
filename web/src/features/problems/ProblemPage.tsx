import { BookOpen, Check, ChevronLeft, EyeOff, FlaskConical, Lightbulb, Lock, Monitor, Play, RotateCcw, Send, Trophy, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { BLOCKS } from '@/content/blocks'
import { problemById } from '@/content/problems'
import { SPEAKERS } from '@/content/voices'
import { judge, runTest, starsFor, type TestResult, type Verdict } from '@/engine/problems/judge'
import type { Problem } from '@/engine/problems/types'
import type { Design } from '@/engine/types'
import { DesignCanvas } from '@/features/canvas/DesignCanvas'
import { Inspector } from '@/features/canvas/Inspector'
import { removeNodes, setNodeProps } from '@/engine/lesson/runner'
import { GoalBar, MetricsStrip } from '@/features/lesson/HUD'
import type { Callout } from '@/features/mentor/coach'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { progressOf, useProblems } from '@/store/problems'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'
import { DIFFICULTY, Stars } from './bits'

type Tab = 'brief' | 'tests' | 'hints' | 'solution'

const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 1)}%`

export function ProblemPage() {
  const { problemId = '' } = useParams()
  const problem = problemById(problemId)
  if (!problem)
    return (
      <div className="flex h-full flex-col">
        <AppHeader />
        <p className="p-8 text-center text-muted">
          No such problem. <Link to="/problems" className="font-semibold text-accent">Back to the list</Link>
        </p>
      </div>
    )
  return <ProblemView key={problem.id} problem={problem} />
}

function ProblemView({ problem }: { problem: Problem }) {
  const prog = useProblems((s) => progressOf(s.byId, problem.id))
  const store = useProblems()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [tab, setTab] = useState<Tab>('brief')
  const [verdict, setVerdict] = useState<(Verdict & { mode: 'run' | 'submit' }) | null>(null)
  const [selected, setSelected] = useState(0)
  const [inspected, setInspected] = useState<string | null>(null)
  const [pulse, setPulse] = useState<string[]>([])
  const [peek, setPeek] = useState(false)
  const [accepted, setAccepted] = useState<{ stars: number; blocks: number; p99Ms: number } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  // Bumped when the canvas gets a whole new design, so it re-fits its view.
  const [canvasKey, setCanvasKey] = useState(0)

  const own = prog.design ?? problem.skeleton
  const design = peek ? problem.solution : own
  const test = problem.tests[selected]
  const live = useMemo(() => runTest(problem, design, test, selected), [problem, design, test, selected])
  const phaseResult = live.run.phases[0]
  const solutionOpen = prog.solved || prog.hintsUsed >= problem.hints.length

  const ghostHint = problem.hints
    .slice(0, prog.hintsUsed)
    .reverse()
    .find((h) => h.ghost)?.ghost
  const ghost = !peek && ghostHint && !design.nodes.some((n) => n.block === ghostHint.block) ? ghostHint : null

  const callouts = useMemo<Callout[]>(() => {
    const r = verdict?.results.find((x) => x.index === selected)
    if (peek || !r?.culprit) return []
    return [{ nodeId: r.culprit.nodeId, text: r.culprit.why, tone: 'bad' }]
  }, [verdict, selected, peek])

  function edit(d: Design) {
    store.setDesign(problem.id, d)
    if (verdict) setVerdict(null)
  }

  function check(mode: 'run' | 'submit') {
    setPeek(false)
    const v = judge(problem, own, { hidden: mode === 'submit' })
    setVerdict({ ...v, mode })
    const firstFail = v.results.find((r) => !r.pass)
    if (firstFail) {
      setSelected(firstFail.index)
      if (firstFail.culprit) {
        setPulse([firstFail.culprit.nodeId])
        setTimeout(() => setPulse([]), 2400)
      }
    }
    if (mode !== 'submit') return
    if (v.pass) {
      const best = {
        stars: starsFor(problem, v.blocks, prog.hintsUsed),
        blocks: v.blocks,
        p99Ms: Math.max(...v.results.map((r) => r.p99Ms)),
      }
      store.submitted(problem.id, best)
      setAccepted(best)
    } else store.submitted(problem.id)
  }

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    setConfirmReset(false)
    store.resetDesign(problem.id)
    setVerdict(null)
    setInspected(null)
    setCanvasKey((k) => k + 1)
  }

  const inspectedNode = design.nodes.find((n) => n.id === inspected)
  const diff = DIFFICULTY[problem.difficulty]
  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'brief', label: 'Brief', icon: BookOpen },
    { id: 'tests', label: 'Tests', icon: FlaskConical },
    { id: 'hints', label: `Hints ${prog.hintsUsed}/${problem.hints.length}`, icon: Lightbulb },
    { id: 'solution', label: 'Solution', icon: solutionOpen ? Trophy : Lock },
  ]

  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="scrollbar-thin flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-line bg-bg">
          <div className="px-4 pt-4">
            <Link to="/problems" className="flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink">
              <ChevronLeft size={14} /> All problems
            </Link>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight">
              {problem.number}. {problem.title}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
              <span className={cn('font-bold', diff.className)}>{diff.label}</span>
              {problem.tags.map((t) => (
                <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">
                  {t}
                </span>
              ))}
              {prog.best && <Stars n={prog.best.stars} />}
            </div>
          </div>

          <div className="sticky top-0 z-10 mt-3 flex gap-1 border-b border-line bg-bg px-3" role="tablist">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex items-center gap-1 border-b-2 px-2 py-2 text-[13px] font-semibold transition',
                  tab === id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 p-4 text-[14px] leading-relaxed">
            {tab === 'brief' && <Brief problem={problem} />}
            {tab === 'tests' && <Tests problem={problem} verdict={verdict} selected={selected} onSelect={setSelected} />}
            {tab === 'hints' && <Hints problem={problem} used={prog.hintsUsed} onReveal={() => store.revealHint(problem.id)} />}
            {tab === 'solution' && <Solution problem={problem} open={solutionOpen} peek={peek} onPeek={setPeek} />}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-canvas">
          {peek && (
            <div className="z-30 flex shrink-0 items-center gap-3 bg-accent px-4 py-2 text-[13px] text-accent-ink shadow-card">
              <EyeOff size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 font-bold">You’re looking at the reference solution (read-only).</span>
              <Button size="sm" variant="secondary" onClick={() => setPeek(false)}>
                Back to mine
              </Button>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            <div className="pointer-events-none absolute top-3 right-14 left-3 z-10 flex flex-wrap items-start gap-2 [&>*]:pointer-events-auto">
              <GoalBar goals={test.goals ?? problem.goals} results={live.goals} />
              <MetricsStrip run={live.run} phaseIndex={0} playing blind={false} />
            </div>
            <DesignCanvas
              key={`${canvasKey}-${peek}`}
              design={design}
              onChange={peek ? undefined : edit}
              readOnly={peek}
              result={phaseResult}
              palette={peek ? [] : problem.palette}
              zones={problem.zones}
              ghost={ghost}
              pulseIds={pulse}
              inspected={inspected}
              callouts={callouts}
              onNodeClick={setInspected}
              onPaneClick={() => setInspected(null)}
            />
            {inspectedNode && (
              <Inspector
                node={inspectedNode}
                result={phaseResult.nodes[inspectedNode.id]}
                phaseLabel={phaseResult.label}
                onClose={() => setInspected(null)}
                onEdit={peek ? undefined : (p) => edit(setNodeProps(design, inspectedNode.id, p))}
                onDelete={
                  peek
                    ? undefined
                    : () => {
                        edit(removeNodes(design, [inspectedNode.id]))
                        setInspected(null)
                      }
                }
              />
            )}
          </div>

          <div className="z-20 shrink-0 border-t border-line bg-surface">
            {verdict && <ResultStrip verdict={verdict} selected={selected} onSelect={setSelected} onClose={() => setVerdict(null)} />}
            <div className="flex items-center gap-2 px-4 py-2.5">
              <span className="text-[13px] text-muted">
                Testing live against <span className="font-semibold text-ink">{test.hidden && !verdict?.results.some((r) => r.index === selected) ? 'a hidden test' : test.label}</span>
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" onClick={reset} disabled={peek}>
                  <RotateCcw size={14} /> {confirmReset ? 'Sure? Click again' : 'Reset'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => check('run')} disabled={peek}>
                  <Play size={14} /> Run
                </Button>
                <Button size="sm" variant="good" onClick={() => check('submit')} disabled={peek}>
                  <Send size={14} /> Submit
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {accepted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-6 backdrop-blur-sm"
            onClick={() => setAccepted(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-card ring-1 ring-line"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="Accepted"
            >
              <Trophy size={36} className="mx-auto text-accent" />
              <h2 className="mt-2 text-2xl font-extrabold text-good">Accepted</h2>
              <p className="mt-1 text-sm text-muted">All {problem.tests.length} tests passed, hidden ones included.</p>
              <div className="mt-4 flex justify-center">
                <Stars n={accepted.stars} size={26} />
              </div>
              <ul className="mt-4 space-y-1 text-left text-[13px]">
                <StarRow ok label="Solved" />
                <StarRow ok={prog.hintsUsed === 0} label={prog.hintsUsed ? `Used ${prog.hintsUsed} hint${prog.hintsUsed > 1 ? 's' : ''}` : 'No hints'} />
                <StarRow ok={accepted.blocks <= problem.par} label={`${accepted.blocks} blocks (par ${problem.par})`} />
              </ul>
              <p className="mt-3 font-mono text-[12px] text-muted">worst p99 {accepted.p99Ms} ms</p>
              <div className="mt-5 flex justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAccepted(null)
                    setTab('solution')
                  }}
                >
                  Read the editorial
                </Button>
                <Link to="/problems">
                  <Button>Next problem</Button>
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {narrow && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/95 p-8 text-center backdrop-blur">
          <Monitor size={40} className="text-accent" />
          <h2 className="text-lg font-extrabold">Problems need a bigger screen</h2>
          <p className="max-w-xs text-sm text-muted">Building systems needs room for the canvas. Open it on a tablet or desktop.</p>
          <Link to="/problems" className="font-semibold text-accent">
            Back to the list
          </Link>
        </div>
      )}
    </div>
  )
}

function StarRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn('flex items-center gap-2', ok ? 'text-ink' : 'text-muted')}>
      {ok ? <Check size={14} className="text-good" /> : <X size={14} className="text-muted" />}
      {label}
    </li>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Brief({ problem }: { problem: Problem }) {
  const who = SPEAKERS[problem.speaker]
  const Icon = who.icon
  return (
    <>
      <div className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-line">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: `light-dark(hsl(${who.hue} 80% 92%), hsl(${who.hue} 35% 25%))`, color: `light-dark(hsl(${who.hue} 60% 38%), hsl(${who.hue} 80% 78%))` }}
          >
            <Icon size={15} />
          </span>
          <span className="text-[13px] font-bold">{who.name}</span>
          <span className="text-[12px] text-muted">{who.role}</span>
        </div>
        <div className="space-y-2 text-muted">
          {problem.story.map((p, i) => (
            <p key={i}>
              <RichText text={p} />
            </p>
          ))}
        </div>
      </div>
      <Section title="Must work">
        <ul className="space-y-1">
          {problem.asks.map((a) => (
            <li key={a} className="flex gap-2">
              <Check size={15} className="mt-0.5 shrink-0 text-good" /> {a}
            </li>
          ))}
        </ul>
      </Section>
      {problem.outOfScope && (
        <Section title="Out of scope">
          <ul className="space-y-1 text-muted">
            {problem.outOfScope.map((a) => (
              <li key={a} className="flex gap-2">
                <X size={15} className="mt-0.5 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Numbers">
        <dl className="grid grid-cols-2 gap-1.5">
          {problem.numbers.map((n) => (
            <div key={n.label} className="rounded-xl bg-surface-2 px-2.5 py-1.5">
              <dt className="text-[11px] text-muted">{n.label}</dt>
              <dd className="font-mono text-[13px] font-bold">{n.value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section title="Blocks you can use">
        <div className="flex flex-wrap gap-1">
          {problem.palette.map((b) => (
            <span key={b} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px]">
              {BLOCKS[b].name}
            </span>
          ))}
        </div>
      </Section>
    </>
  )
}

function Tests({ problem, verdict, selected, onSelect }: { problem: Problem; verdict: Verdict | null; selected: number; onSelect: (i: number) => void }) {
  return (
    <>
      <p className="text-muted">
        The canvas is tested live against the selected test. <strong className="text-ink">Run</strong> checks the visible tests; <strong className="text-ink">Submit</strong> also runs the hidden ones. A hidden test is revealed once it fails.
      </p>
      <ul className="space-y-1.5">
        {problem.tests.map((t, i) => {
          const r = verdict?.results.find((x) => x.index === i)
          const revealed = !t.hidden || (r && !r.pass)
          return (
            <li key={i}>
              <button
                onClick={() => onSelect(i)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left ring-1 transition',
                  selected === i ? 'bg-surface ring-accent' : 'bg-surface-2/60 ring-transparent hover:ring-line',
                )}
              >
                <TestIcon r={r} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {revealed ? <RichText text={t.label} /> : `Hidden test ${i + 1}`}
                    {t.hidden && <Lock size={11} className="ml-1 inline text-muted" />}
                  </span>
                  {revealed && (
                    <span className="block font-mono text-[11px] text-muted">
                      {t.phases.map((p) => `${p.rps.toLocaleString('en-US')} req/s${p.failures?.length ? ' + failure' : ''}`).join(' → ')}
                    </span>
                  )}
                  {r && !r.pass && <span className="mt-0.5 block text-[12px] text-bad">{failSummary(r)}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function TestIcon({ r }: { r?: TestResult }) {
  if (!r) return <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-line" />
  return r.pass ? <Check size={16} className="mt-0.5 shrink-0 text-good" /> : <X size={16} className="mt-0.5 shrink-0 text-bad" />
}

const failSummary = (r: TestResult) =>
  r.goals
    .filter((g) => !g.pass)
    .map((g) => `${g.label}: ${g.detail}`)
    .join(' · ')

function Hints({ problem, used, onReveal }: { problem: Problem; used: number; onReveal: () => void }) {
  return (
    <>
      <p className="text-muted">Hints go from a gentle nudge to nearly the answer. Using any costs the no-hints star.</p>
      <ol className="space-y-2">
        {problem.hints.slice(0, used).map((h, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 rounded-xl bg-surface p-3 shadow-card ring-1 ring-line">
            <span className="font-mono text-[12px] font-bold text-accent">{i + 1}</span>
            <span>
              <RichText text={h.text} />
              {h.ghost && <span className="mt-1 block text-[12px] text-muted">A dashed slot on the canvas shows where it goes.</span>}
            </span>
          </motion.li>
        ))}
      </ol>
      {used < problem.hints.length ? (
        <Button variant="secondary" onClick={onReveal}>
          <Lightbulb size={14} /> Reveal hint {used + 1}
        </Button>
      ) : (
        <p className="text-[13px] text-muted">That’s every hint. The solution tab is open now.</p>
      )}
    </>
  )
}

function Solution({ problem, open, peek, onPeek }: { problem: Problem; open: boolean; peek: boolean; onPeek: (v: boolean) => void }) {
  if (!open)
    return (
      <div className="rounded-2xl bg-surface-2 p-4 text-center text-muted">
        <Lock size={22} className="mx-auto" />
        <p className="mt-2">The editorial unlocks once you solve the problem, or after you’ve used every hint.</p>
      </div>
    )
  return (
    <>
      <Button variant={peek ? 'primary' : 'secondary'} onClick={() => onPeek(!peek)}>
        {peek ? 'Back to my design' : 'Show reference design on the canvas'}
      </Button>
      <div className="space-y-2 text-muted">
        {problem.editorial.map((p, i) => (
          <p key={i}>
            <RichText text={p} />
          </p>
        ))}
      </div>
      {problem.trap && (
        <Section title="The tempting wrong answer">
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-[13px]">{problem.trap.why} It passes the visible tests and fails a hidden one.</p>
        </Section>
      )}
      {problem.sources && (
        <Section title="Further reading">
          <ul className="space-y-1">
            {problem.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

function ResultStrip({
  verdict,
  selected,
  onSelect,
  onClose,
}: {
  verdict: Verdict & { mode: 'run' | 'submit' }
  selected: number
  onSelect: (i: number) => void
  onClose: () => void
}) {
  const passed = verdict.results.filter((r) => r.pass).length
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-2">
      <span className={cn('text-[15px] font-extrabold', verdict.pass ? 'text-good' : 'text-bad')}>
        {verdict.pass ? (verdict.mode === 'submit' ? 'Accepted' : 'Visible tests pass') : 'Wrong answer'}
      </span>
      <span className="font-mono text-[12px] text-muted">
        {passed}/{verdict.results.length} {verdict.mode === 'run' ? 'visible ' : ''}tests
      </span>
      <div className="flex flex-wrap gap-1">
        {verdict.results.map((r) => (
          <button
            key={r.index}
            onClick={() => onSelect(r.index)}
            title={r.pass ? `Passed: ${r.test.label}` : failSummary(r)}
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-0.5 font-mono text-[11px] font-bold ring-1',
              r.pass ? 'bg-good-soft text-good ring-transparent' : 'bg-bad-soft text-bad ring-transparent',
              selected === r.index && 'ring-ink',
            )}
          >
            {r.pass ? <Check size={11} /> : <X size={11} />}
            {r.index + 1} · {pct(r.errorRate)} · {r.p99Ms}ms
          </button>
        ))}
      </div>
      {verdict.mode === 'run' && verdict.pass && <span className="text-[12px] text-muted">Hidden tests are waiting. Submit when ready.</span>}
      <button onClick={onClose} className="ml-auto rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close results">
        <X size={14} />
      </button>
    </div>
  )
}
