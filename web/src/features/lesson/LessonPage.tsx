import { ArrowLeft, Check, Lock, Monitor, NotebookPen, RotateCcw, Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { CHAPTERS, lessonById } from '@/content'
import { applyPatch, isActionDone, simulate } from '@/engine/lesson/runner'
import type { BlockMatch, Lesson, Step, StepAnswer } from '@/engine/lesson/types'
import { createTree, pathTo } from '@/engine/timeline/tree'
import { DesignCanvas } from '@/features/canvas/DesignCanvas'
import { ConceptCard } from '@/features/mentor/ConceptCard'
import { MentorPanel } from '@/features/mentor/MentorPanel'
import { TimelineBar } from '@/features/timeline/TimelineBar'
import { cn } from '@/lib/cn'
import { useProgress } from '@/store/progress'
import { runKey, useRuns } from '@/store/runs'
import { Button } from '@/ui/Button'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { GoalBar, MetricsStrip } from './HUD'
import { designKey, useSimPlayback } from './useSimPlayback'

const SECTION_LABEL = { concept: 'Concept', drill: 'Drill', level: 'Level' } as const

export function LessonPage() {
  const { lessonId = '', section } = useParams()
  const lesson = lessonById(lessonId)
  const completed = useProgress((s) => s.completed[lessonId])
  if (!lesson) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted">That lesson doesn’t exist.</p>
        <Link to="/" className="font-semibold text-accent">
          Back to the map
        </Link>
      </div>
    )
  }
  const done = completed ?? []
  const firstOpen = lesson.sections.findIndex((s) => !done.includes(s.kind))
  const requested = section !== undefined ? Number(section) : NaN
  const valid = Number.isInteger(requested) && requested >= 0 && requested < lesson.sections.length
  // Pin the URL to a section so finishing it doesn't silently jump to the next one.
  if (!valid) return <Navigate replace to={`/learn/${lesson.id}/${Math.max(0, firstOpen)}`} />
  const index = requested
  return <SectionView key={`${lesson.id}#${index}`} lesson={lesson} sectionIndex={index} />
}

function SectionView({ lesson, sectionIndex }: { lesson: Lesson; sectionIndex: number }) {
  const navigate = useNavigate()
  const section = lesson.sections[sectionIndex]
  const key = runKey(lesson.id, sectionIndex)
  const stored = useRuns((s) => s.runs[key])
  const { ensure, setDesign, commitStep, rewindTo, note, reset } = useRuns.getState()
  const fallback = useMemo(() => ({ tree: createTree(section.startDesign, 0), design: section.startDesign }), [section])
  const run = stored ?? fallback
  const completedKinds = useProgress((s) => s.completed[lesson.id])
  const completeSection = useProgress((s) => s.completeSection)
  const testOut = useProgress((s) => s.testOut)
  const narrow = useMediaQuery('(max-width: 767px)')

  useEffect(() => ensure(key, section.startDesign), [ensure, key, section])

  const tree = run.tree
  const head = tree.nodes[tree.headId]
  const path = useMemo(() => pathTo(tree, tree.headId), [tree])
  const stepIndex = head.stepIndex + 1
  const step: Step | undefined = section.steps[stepIndex]
  const finished = stepIndex >= section.steps.length
  const answers = useMemo(() => Object.fromEntries(path.map((n) => [n.stepIndex, n.answer])), [path])
  const notes = useMemo(
    () => path.flatMap((n) => (n.note ? n.note.split('\n').map((text) => ({ stepIndex: n.stepIndex + 1, text })) : [])),
    [path],
  )

  const { pb, start, clear } = useSimPlayback()
  const dk = designKey(run.design)
  const showing = pb && pb.designKey === dk ? pb : null
  const outcome =
    showing && !showing.playing && showing.stepIndex === stepIndex
      ? {
          passed: showing.passed,
          goals: showing.goals,
          errorRate: Math.max(...showing.run.phases.map((p) => p.errorRate)),
          p99Ms: Math.max(...showing.run.phases.map((p) => p.p99Ms)),
          warnings: [...new Set(showing.run.phases.flatMap((p) => p.warnings))],
        }
      : null

  // Canvas actions complete themselves as soon as the design satisfies them.
  useEffect(() => {
    if (!stored || !step) return
    if ((step.t === 'place' || step.t === 'connect' || step.t === 'disconnect') && isActionDone(step, run.design)) {
      commitStep(key, stepIndex, run.design)
    }
  }, [stored, step, run.design, stepIndex, key, commitStep])

  useEffect(() => {
    if (!finished || !stored) return
    if (lesson.kind === 'checkpoint') {
      const chapter = CHAPTERS.find((c) => c.id === lesson.chapter)
      if (chapter) testOut(chapter, lesson)
    } else completeSection(lesson, section.kind)
  }, [finished, stored, lesson, section.kind, completeSection, testOut])

  const complete = useCallback((answer?: StepAnswer) => commitStep(key, stepIndex, run.design, answer), [commitStep, key, stepIndex, run.design])

  const onFork = (optionId: string) => {
    if (step?.t !== 'fork') return
    const opt = step.options.find((o) => o.id === optionId)
    if (!opt) return
    commitStep(key, stepIndex, applyPatch(run.design, opt.patch), { t: 'fork', optionId })
  }

  const onRun = () => {
    if (step?.t !== 'simulate') return
    const r = simulate(section, run.design, step)
    start(r.run, r.goals, r.passed, run.design, stepIndex)
  }

  const onRewind = (id: string) => {
    clear()
    rewindTo(key, id)
  }

  const blind = !!section.blind && !run.design.nodes.some((n) => n.block === 'monitoring')
  const ghost = step?.t === 'place' && step.slot && !isActionDone(step, run.design) ? { block: step.block, ...step.slot } : null
  const highlight: BlockMatch[] = step?.t === 'connect' || step?.t === 'disconnect' ? [step.from, step.to] : []
  const goals = step?.t === 'simulate' ? (step.goals ?? section.goals) : section.goals
  const canvasless = section.startDesign.nodes.length === 0 && section.palette.length === 0
  const lastConcept = [...section.steps.slice(0, stepIndex + 1)].reverse().find((s) => s.t === 'concept')

  const nextLesson = (() => {
    const ch = CHAPTERS.find((c) => c.id === lesson.chapter)
    const i = ch?.lessons.findIndex((l) => l.id === lesson.id) ?? -1
    return ch && i >= 0 ? ch.lessons[i + 1] : undefined
  })()

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <Link to="/" className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={16} /> Map
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[15px] leading-tight font-extrabold">{lesson.title}</div>
          <div className="truncate text-xs text-muted">{section.title}</div>
        </div>
        <nav className="mx-auto flex items-center gap-1 rounded-2xl bg-surface-2 p-1">
          {lesson.sections.map((s, i) => {
            const isDone = completedKinds?.includes(s.kind)
            const reachable = i === 0 || lesson.sections.slice(0, i).every((p) => completedKinds?.includes(p.kind))
            return (
              <button
                key={s.kind}
                disabled={!reachable}
                onClick={() => navigate(`/learn/${lesson.id}/${i}`)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition',
                  i === sectionIndex ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
                  !reachable && 'cursor-not-allowed opacity-50',
                )}
              >
                {isDone ? <Check size={14} className="text-good" /> : !reachable ? <Lock size={13} /> : <span className="font-mono text-[11px]">{i + 1}</span>}
                {SECTION_LABEL[s.kind]}
              </button>
            )
          })}
        </nav>
        <button
          title="Restart this section"
          onClick={() => {
            clear()
            reset(key, section.startDesign)
          }}
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <RotateCcw size={17} />
        </button>
        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[400px] shrink-0 border-r border-line bg-bg">
          <MentorPanel
            lessonTitle={lesson.title}
            section={section}
            stepIndex={stepIndex}
            answers={answers}
            notes={notes}
            playing={!!showing?.playing}
            outcome={outcome}
            onComplete={complete}
            onFork={onFork}
            onRun={onRun}
            onNote={(text) => note(key, head.id, head.note ? `${head.note}\n${text}` : text)}
            footer={
              finished && (
                <SectionDone
                  lesson={lesson}
                  sectionIndex={sectionIndex}
                  onNext={() => navigate(`/learn/${lesson.id}/${sectionIndex + 1}`)}
                  onNextLesson={nextLesson ? () => navigate(`/learn/${nextLesson.id}`) : undefined}
                />
              )
            }
          />
        </aside>
        <main className="relative min-w-0 flex-1 bg-canvas">
          {canvasless ? (
            <Notebook concept={lastConcept?.t === 'concept' ? lastConcept.block : undefined} />
          ) : (
            <>
              <div className="pointer-events-none absolute top-3 right-14 left-3 z-10 flex flex-wrap items-start gap-2 [&>*]:pointer-events-auto">
                <GoalBar goals={goals} results={showing?.goals.length === goals.length ? showing.goals : undefined} />
                {showing && <MetricsStrip run={showing.run} phaseIndex={showing.phase} playing={showing.playing} blind={blind} />}
              </div>
              <DesignCanvas
                key={key}
                design={run.design}
                onChange={(d) => setDesign(key, d)}
                result={showing ? showing.run.phases[showing.phase] : null}
                blind={blind}
                palette={section.palette}
                ghost={ghost}
                highlight={highlight}
                zones={section.zones}
                fitPoints={section.steps.flatMap((s) => (s.t === 'place' && s.slot ? [s.slot] : s.t === 'fork' ? s.options.flatMap((o) => o.patch.addNodes ?? []) : []))}
              />
            </>
          )}
        </main>
      </div>
      <TimelineBar tree={tree} section={section} onRewind={onRewind} />
      {narrow && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/95 p-8 text-center backdrop-blur">
          <Monitor size={40} className="text-accent" />
          <h2 className="text-lg font-extrabold">Levels need a bigger screen</h2>
          <p className="max-w-xs text-sm text-muted">Building systems needs room for the canvas. Open this lesson on a tablet or desktop. Your progress is saved.</p>
          <Link to="/collection" className="font-semibold text-accent">
            Browse your block collection instead
          </Link>
        </div>
      )}
    </div>
  )
}

function Notebook({ concept }: { concept?: Extract<Step, { t: 'concept' }>['block'] }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      {concept ? (
        <div className="w-full max-w-md">
          <ConceptCard block={concept} />
        </div>
      ) : (
        <div className="max-w-sm text-center text-muted">
          <NotebookPen size={44} className="mx-auto mb-3 text-accent" />
          <div className="text-lg font-extrabold text-ink">Think before you draw</div>
          <p className="mt-1 text-sm">This part happens in your head (and in the chat). The canvas comes back when it’s time to build.</p>
        </div>
      )}
    </div>
  )
}

function SectionDone({
  lesson,
  sectionIndex,
  onNext,
  onNextLesson,
}: {
  lesson: Lesson
  sectionIndex: number
  onNext: () => void
  onNextLesson?: () => void
}) {
  const last = sectionIndex >= lesson.sections.length - 1
  return (
    <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl bg-good-soft p-4 ring-1 ring-good/30">
      <div className="flex items-center gap-2 font-extrabold text-good">
        {last ? <Trophy size={18} /> : <Check size={18} />}
        {last ? `${lesson.title}: complete!` : `${SECTION_LABEL[lesson.sections[sectionIndex].kind]} complete`}
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {last
          ? 'Every decision you made is on the timeline below. Rewind any time to try a different path.'
          : `Up next: ${SECTION_LABEL[lesson.sections[sectionIndex + 1].kind]}, ${lesson.sections[sectionIndex + 1].title}.`}
      </p>
      <div className="mt-3 flex gap-2">
        {!last && (
          <Button size="sm" variant="good" onClick={onNext}>
            Continue
          </Button>
        )}
        {last && onNextLesson && (
          <Button size="sm" variant="good" onClick={onNextLesson}>
            Next lesson
          </Button>
        )}
        <Link to="/" className="inline-flex h-8 items-center rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface hover:text-ink">
          Back to map
        </Link>
      </div>
    </motion.div>
  )
}
