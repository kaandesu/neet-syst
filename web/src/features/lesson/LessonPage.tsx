import { ArrowLeft, Check, ChevronRight, Crosshair, FastForward, Play, FlaskConical, Lock, Monitor, NotebookPen, RotateCcw, Trophy, Undo2 } from 'lucide-react'
import { ApiCard } from '@/features/api/ApiCard'
import { RevealCard } from '@/features/cases/RevealCard'
import { IdeaCard } from '@/features/ideas/IdeaCard'
import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { BLOCKS } from '@/content/blocks'
import { CHAPTERS, lessonById } from '@/content'
import { applyPatch, autoPlay, idealAnswer, isActionDone, isCanvasAction, removeNodes, setNodeProps, simulate, simulateWhatIf } from '@/engine/lesson/runner'
import type { BlockMatch, Lesson, Section, Step, StepAnswer, WhatIf } from '@/engine/lesson/types'
import { bottleneck, culprits, explainNode } from '@/engine/sim/explain'
import type { BlockId, Design, SimRun } from '@/engine/types'
import { createTree, pathTo } from '@/engine/timeline/tree'
import { DesignCanvas } from '@/features/canvas/DesignCanvas'
import { Inspector } from '@/features/canvas/Inspector'
import { ConceptStepCard, DIAGNOSE_TRIES, EstimateCard, ForkCard, ReasonCard, RequirementsCard, SimulateCard, type SimProbe } from '@/features/mentor/cards'
import { chipsFor, CHIP_LABEL, hintLadder, showMe, whyText, type Callout, type ChipId, type CoachCtx } from '@/features/mentor/coach'
import { REACTIONS } from '@/content/voices'
import { lintDesign } from '@/engine/mentor/lint'
import { react, type MentorLine } from '@/engine/mentor/reactions'
import { TimelineBar } from '@/features/timeline/TimelineBar'
import { cn } from '@/lib/cn'
import { useProgress, type MissKind } from '@/store/progress'
import { runKey, useRuns } from '@/store/runs'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'
import { ThemeToggle } from '@/ui/ThemeToggle'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { GoalBar, MetricsStrip } from './HUD'
import { Dock, isBlocking, QuestionModal, SituationPanel, type FeedItem } from './Stage'
import { designKey, useSimPlayback } from './useSimPlayback'

const SECTION_LABEL = { concept: 'Concept', drill: 'Drill', level: 'Level' } as const
const tabOf = (s: Section) => s.tab ?? SECTION_LABEL[s.kind]

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
  const devMode = useProgress((s) => s.devMode)
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
          ...diagnose(showing.run),
        }
      : null

  // Predict / diagnose / inspect / what-if state lives for one step only.
  const [prediction, setPrediction] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<{ picks: string[]; found: boolean }>({ picks: [], found: false })
  const [inspected, setInspected] = useState<string | null>(null)
  const [whatIf, setWhatIf] = useState<WhatIf | null>(null)
  const missed = useRef(false)
  const recordMiss = useProgress((s) => s.recordMiss)
  const clearMiss = useProgress((s) => s.clearMiss)
  useEffect(() => {
    setPrediction(null)
    setDiagnosis({ picks: [], found: false })
    setWhatIf(null)
    missed.current = false
  }, [stepIndex, tree.headId])

  const onMiss = useCallback(
    (at: number, kind: MissKind) => {
      if (at === stepIndex) missed.current = true
      recordMiss(lesson.id, sectionIndex, at, kind)
    },
    [recordMiss, lesson.id, sectionIndex, stepIndex],
  )

  /** Commit the current step; a clean first try clears it from the review list. */
  const finishStep = useCallback(
    (design: Design, answer?: StepAnswer) => {
      if (!missed.current) clearMiss(lesson.id, sectionIndex, stepIndex)
      commitStep(key, stepIndex, design, answer)
    },
    [clearMiss, commitStep, key, lesson.id, sectionIndex, stepIndex],
  )

  const predictable = useMemo(
    () => step?.t === 'simulate' && step.expect === 'fail' && step.predict !== false && !!bottleneck(simulate(section, run.design, step).run),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, section, dk],
  )
  const playing = !!showing?.playing
  const predicting = predictable && !outcome && !playing && prediction !== 'skip'
  const diagnosing =
    step?.t === 'simulate' &&
    step.expect === 'pass' &&
    !!outcome &&
    !outcome.passed &&
    outcome.culprits.length > 0 &&
    !diagnosis.found &&
    diagnosis.picks.length < DIAGNOSE_TRIES
  const pickMode = !whatIf && (predicting || diagnosing)

  // Scripted mentor: reply chips, reactions to what just happened, and bubbles on the canvas.
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [hintTier, setHintTier] = useState(0)
  const [shown, setShown] = useState<Callout[]>([])
  const fails = useRef(0)
  const predictReacted = useRef(false)
  const reacted = useRef<unknown>(null)
  const seq = useRef(0)
  const misses = useProgress((s) => s.misses)
  useEffect(() => {
    setHintTier(0)
    setShown([])
    fails.current = 0
    predictReacted.current = false
    // Rewinding drops the conversation that happened after the point you went back to.
    setFeed((f) => f.filter((x) => x.stepIndex < stepIndex))
  }, [stepIndex, tree.headId])
  useEffect(() => {
    if (!shown.length) return
    const t = setTimeout(() => setShown([]), 6000)
    return () => clearTimeout(t)
  }, [shown])

  const lint = useMemo(() => lintDesign(run.design), [run.design])
  const reviewing = !whatIf && step?.t === 'simulate' && step.expect === 'pass' && !playing && (!outcome || !outcome.passed)
  const push = (...lines: (MentorLine | FeedItem | null)[]) =>
    setFeed((f) => [...f, ...lines.filter((l): l is MentorLine => !!l).map((l) => ({ stepIndex, ...l }))])

  const coach: CoachCtx | null = step
    ? { step, design: run.design, goals: step.t === 'simulate' ? (step.goals ?? section.goals) : section.goals, outcome, playing, probing: pickMode, lint: reviewing ? lint : [], label: (id) => labelOf(run.design, id) }
    : null
  const chips = coach && !whatIf && !finished ? chipsFor(coach) : []

  const onChip = (chip: ChipId) => {
    if (!coach) return
    const ask = { stepIndex, text: CHIP_LABEL[chip] }
    if (chip === 'why') push(ask, { speaker: 'mentor', text: whyText(coach) ?? '' })
    if (chip === 'show') {
      const pins = showMe(coach)
      setShown(pins)
      push(ask, { speaker: 'mentor', text: pins.length ? 'Look at the canvas. I’ve pinned it for you.' : 'Nothing to point at yet. Try **I’m stuck** instead.' })
    }
    if (chip === 'stuck') {
      const ladder = hintLadder(coach)
      if (hintTier >= ladder.length) {
        push(ask, { speaker: 'mentor', text: 'That’s every hint I have. The last one is basically the answer, so reread it.' })
        return
      }
      // Needing the second hint means the idea didn't land; worth reviewing later.
      if (hintTier + 1 >= 2) onMiss(stepIndex, 'hint')
      push(ask, { speaker: 'mentor', text: ladder[hintTier] })
      setHintTier(hintTier + 1)
    }
  }

  // React once per finished run: to the prediction, to a failed fix, to a hard-won pass.
  useEffect(() => {
    if (!outcome || !showing || reacted.current === showing || step?.t !== 'simulate') return
    reacted.current = showing
    const culprit = outcome.culprits[0]
    const block = culprit ? run.design.nodes.find((n) => n.id === culprit)?.block : undefined
    const base = { lessonKind: lesson.kind, block, node: culprit ? labelOf(run.design, culprit) : undefined, note: culprit ? outcome.notes[culprit] : undefined }
    const lines: (MentorLine | null)[] = []
    if (prediction && prediction !== 'skip' && culprit && !predictReacted.current) {
      predictReacted.current = true
      lines.push(react(REACTIONS, { ...base, event: outcome.culprits.includes(prediction) ? 'predict-right' : 'predict-wrong', attempts: 1 }, seq.current++))
    }
    if (step.expect === 'pass' && !outcome.passed) {
      fails.current += 1
      const past = block
        ? Object.values(misses)
            .map((m) => lessonById(m.lessonId))
            .find((l) => l && l.id !== lesson.id && l.unlocks.includes(block))?.title
        : undefined
      if (lint.length) lines.push({ speaker: 'mentor', text: `I flagged ${lint.length === 1 ? 'a wiring problem' : `${lint.length} wiring problems`} on the canvas. Fix ${lint.length === 1 ? 'that' : 'those'} before anything else.` })
      else if (fails.current >= 2 || lesson.kind === 'incident' || past)
        lines.push(react(REACTIONS, { ...base, event: 'fix-failed', attempts: fails.current, past }, seq.current++))
    } else if (step.expect === 'pass' && outcome.passed && fails.current > 0) {
      lines.push(react(REACTIONS, { ...base, event: 'fix-passed', attempts: fails.current }, seq.current++))
    }
    push(...lines)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing, outcome])

  // A gentle nudge after a long pause on a hands-on step; editing the canvas resets the clock.
  useEffect(() => {
    if (!step || !isCanvasAction(step)) return
    const t = setTimeout(() => {
      const line = react(REACTIONS, { event: 'stuck', lessonKind: lesson.kind, attempts: 0 })
      if (line) setFeed((f) => (f.some((x) => x.stepIndex === stepIndex && x.text === line.text) ? f : [...f, { stepIndex, ...line }]))
    }, 45_000)
    return () => clearTimeout(t)
  }, [step, stepIndex, run.design, lesson.kind])

  // Canvas actions complete themselves as soon as the design satisfies them.
  useEffect(() => {
    if (!stored || !step) return
    if (isCanvasAction(step) && isActionDone(step, run.design)) {
      finishStep(run.design)
    }
  }, [stored, step, run.design, finishStep])

  useEffect(() => {
    if (!finished || !stored) return
    if (lesson.kind === 'checkpoint') {
      const chapter = CHAPTERS.find((c) => c.id === lesson.chapter)
      if (chapter) testOut(chapter, lesson)
    } else completeSection(lesson, section.kind)
  }, [finished, stored, lesson, section.kind, completeSection, testOut])

  const complete = useCallback(
    (answer?: StepAnswer) => finishStep(run.design, diagnosis.picks.length && answer?.t === 'simulate' ? { ...answer, diagnoseAttempts: diagnosis.picks.length + 1 } : answer),
    [finishStep, run.design, diagnosis.picks.length],
  )

  const onFork = (optionId: string) => {
    if (step?.t !== 'fork') return
    const opt = step.options.find((o) => o.id === optionId)
    if (!opt) return
    finishStep(applyPatch(run.design, opt.patch), { t: 'fork', optionId })
  }

  const onRun = () => {
    if (step?.t !== 'simulate') return
    const r = simulate(section, run.design, step)
    setDiagnosis({ picks: [], found: false })
    if (prediction && prediction !== 'skip' && !culprits(r.run).includes(prediction)) onMiss(stepIndex, 'predict')
    start(r.run, r.goals, r.passed, run.design, stepIndex)
  }

  const onNodeClick = (id: string) => {
    if (predicting) return setPrediction(id)
    if (diagnosing && outcome) {
      if (outcome.culprits.includes(id)) return setDiagnosis((d) => ({ ...d, found: true }))
      onMiss(stepIndex, 'diagnose')
      return setDiagnosis((d) => ({ ...d, picks: [...d.picks, id] }))
    }
    setInspected(id)
  }

  const label = (id: string) => labelOf(whatIf?.design ?? run.design, id)

  const probe: SimProbe = { predict: predictable, prediction, onSkipPredict: () => setPrediction('skip'), diagnosis, label }

  const tryIt = (w: WhatIf) => {
    setInspected(null)
    setWhatIf(w)
    const r = simulateWhatIf(w)
    start(r.run, r.goals, r.passed, w.design, -1)
  }
  const exitWhatIf = () => {
    setWhatIf(null)
    setInspected(null)
    clear()
  }
  const wiShowing = whatIf && pb && pb.designKey === designKey(whatIf.design) ? pb : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInspected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const reveal = outcome && !playing ? outcome.culprits[0] : undefined
  const pulseIds =
    reveal &&
    ((prediction && prediction !== 'skip' && !outcome!.culprits.includes(prediction)) ||
      (step?.t === 'simulate' && step.expect === 'pass' && !diagnosis.found && diagnosis.picks.length >= DIAGNOSE_TRIES))
      ? [reveal]
      : []
  const lastWrongPick = diagnosis.picks[diagnosis.picks.length - 1]
  const callouts = dedupe([
    ...shown,
    ...(reveal && (pulseIds.length || diagnosis.found) ? [{ nodeId: reveal, text: outcome!.notes[reveal], tone: 'bad' as const }] : []),
    ...(diagnosing && lastWrongPick && outcome ? [{ nodeId: lastWrongPick, text: `Looks fine: ${outcome.notes[lastWrongPick]}`, tone: 'good' as const }] : []),
    ...(reviewing ? lint.slice(0, 2).map((f) => ({ nodeId: f.nodeId, text: f.text, tone: 'warn' as const })) : []),
  ])
  const canvasDesign = whatIf?.design ?? run.design
  const view = whatIf ? wiShowing : showing
  const inspectedNode = inspected ? canvasDesign.nodes.find((n) => n.id === inspected) : undefined

  /** Dev mode: play the rest of the section as an ideal learner. */
  const skipSection = () => {
    clear()
    const log = autoPlay(section)
    for (const entry of log) {
      if (entry.stepIndex < stepIndex) continue
      commitStep(key, entry.stepIndex, entry.design, idealAnswer(entry.step, entry))
    }
  }

  const onRewind = (id: string) => {
    clear()
    setInspected(null)
    rewindTo(key, id)
  }

  const blind = !!section.blind && !run.design.nodes.some((n) => n.block === 'monitoring')
  const ghost = step?.t === 'place' && step.slot && !isActionDone(step, run.design) ? { block: step.block, ...step.slot } : null
  const highlight: BlockMatch[] = step?.t === 'connect' || step?.t === 'disconnect' ? [step.from, step.to] : []
  const goals = step?.t === 'simulate' ? (step.goals ?? section.goals) : section.goals
  const canvasless = section.startDesign.nodes.length === 0 && section.palette.length === 0
  const reply = [...feed].reverse().find((f) => f.stepIndex === stepIndex && f.speaker)
  const briefing = useMemo(() => briefingFor(section, stepIndex), [section, stepIndex])

  // Levels offer every block earned so far, and gently question the ones this level doesn't call for.
  const unlocked = useProgress((s) => s.unlocked)
  const openPalette = section.kind === 'level' && (lesson.kind === 'unit' || lesson.kind === 'capstone')
  const palette = openPalette ? [...new Set([...section.palette, ...unlocked.filter((b) => b !== 'client')])] : section.palette
  const expected = useMemo(() => expectedBlocks(section), [section])
  const [kept, setKept] = useState<string[]>([])
  const doubtIds = openPalette ? run.design.nodes.filter((n) => !n.locked && !expected.has(n.block) && !kept.includes(n.id)).map((n) => n.id) : []
  const onDoubt = (id: string, keep: boolean) => (keep ? setKept((k) => [...k, id]) : setDesign(key, removeNodes(run.design, [id])))
  const onNote = (text: string) => note(key, head.id, head.note ? `${head.note}\n${text}` : text)

  /** The card for a blocking step, shown over the canvas. */
  const blockingCard = (() => {
    const answer = answers[stepIndex]
    const miss = (k: MissKind) => onMiss(stepIndex, k)
    switch (step?.t) {
      case 'concept':
        return <ConceptStepCard step={step} active onDone={() => complete()} />
      case 'idea':
        return (
          <div>
            <IdeaCard idea={step.idea} />
            {/* No autoFocus: focusing the button would scroll this tall card to its bottom. */}
            <Button size="sm" className="mt-3" onClick={() => complete()}>
              Got it <ChevronRight size={16} />
            </Button>
          </div>
        )
      case 'reason':
        return <ReasonCard step={step} answer={answer} active onDone={complete} onMiss={miss} onTryIt={tryIt} />
      case 'fork':
        return <ForkCard step={step} answer={answer} active onPick={onFork} />
      case 'requirements':
        return <RequirementsCard step={step} answer={answer} active onDone={complete} onMiss={miss} />
      case 'estimate':
        return <EstimateCard step={step} answer={answer} active onDone={complete} onMiss={miss} />
      case 'reveal':
        return <RevealCard step={step} section={section} stepIndex={stepIndex} design={run.design} onDone={() => complete()} />
      case 'api': {
        const node = run.design.nodes.find((n) => n.id === step.node)
        return (
          <ApiCard
            key={stepIndex}
            step={step}
            api={node?.api ?? []}
            serviceName={node?.label || step.node}
            answer={answer}
            active
            onChange={(api) => setDesign(key, setNodeProps(run.design, step.node, { api }))}
            onDone={complete}
            onMiss={miss}
          />
        )
      }
      default:
        return null
    }
  })()

  /** What the dialogue dock says for the current step. */
  const dock = (() => {
    if (finished) return { mood: 'happy' as const, kicker: 'Section complete', body: <p>Nice work. Everything you decided is on the timeline below.</p> }
    if (!step) return { body: null }
    switch (step.t) {
      case 'say':
        return {
          speaker: step.speaker,
          mood: step.mood,
          body: (
            <div className="flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <RichText text={step.text} />
              </div>
              <Button size="sm" autoFocus onClick={() => complete()} className="shrink-0">
                Continue <ChevronRight size={16} />
              </Button>
            </div>
          ),
        }
      case 'place':
      case 'connect':
      case 'disconnect':
      case 'configure':
        return { kicker: 'Objective', body: <RichText text={step.text} /> }
      case 'simulate':
        return {
          mood: outcome ? (outcome.passed ? ('happy' as const) : ('worried' as const)) : step.chaos ? ('worried' as const) : undefined,
          kicker: step.chaos ? 'Incident' : 'Test it',
          body: (
            <SimulateCard
              plain
              step={step}
              answer={answers[stepIndex]}
              active
              playing={playing}
              outcome={outcome}
              probe={probe}
              prev={lastFailure(answers, stepIndex)}
              onRun={onRun}
              onDone={complete}
            />
          ),
        }
      default:
        return {
          kicker: 'Your call',
          body: <p className="text-muted">{whatIf ? 'You’re watching a what-if. Go back to your design to answer.' : 'Answer the card on the board to keep going.'}</p>,
        }
    }
  })()

  const nextLesson = (() => {
    const c = CHAPTERS.findIndex((x) => x.id === lesson.chapter)
    const ch = CHAPTERS[c]
    const i = ch?.lessons.findIndex((l) => l.id === lesson.id) ?? -1
    if (!ch || i < 0) return undefined
    // The last episode of a chapter leads into the next chapter.
    return ch.lessons[i + 1] ?? CHAPTERS[c + 1]?.lessons[0]
  })()

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <Link to={lesson.kind === 'case' ? '/cases' : '/'} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={16} /> {lesson.kind === 'case' ? 'Cases' : 'Map'}
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[15px] leading-tight font-extrabold">{lesson.title}</div>
          <div className="truncate text-xs text-muted">{section.title}</div>
        </div>
        <nav className="mx-auto flex items-center gap-1 rounded-2xl bg-surface-2 p-1">
          {lesson.sections.map((s, i) => {
            const isDone = completedKinds?.includes(s.kind)
            const reachable = devMode || i === 0 || lesson.sections.slice(0, i).every((p) => completedKinds?.includes(p.kind))
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
                {tabOf(s)}
              </button>
            )
          })}
        </nav>
        {devMode && !finished && (
          <Button size="sm" variant="secondary" onClick={skipSection} title="Dev mode: auto-complete this section">
            <FastForward size={15} /> Skip section
          </Button>
        )}
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

      <div data-testid="stage" className="flex min-h-0 flex-1">
        <SituationPanel
          section={section}
          stepIndex={stepIndex}
          step={step}
          goals={goals}
          results={showing?.goals.length === goals.length ? showing.goals : undefined}
          run={showing?.run}
          phase={showing?.phase ?? 0}
          playing={playing}
          blind={blind}
          notes={notes}
          onNote={onNote}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1 bg-canvas">
            {whatIf ? (
              <>
                <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-accent px-4 py-2 text-[13px] text-accent-ink shadow-card">
                  <FlaskConical size={16} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">What-if:</span> {whatIf.label}
                    {wiShowing && !wiShowing.playing && (
                      <span className="opacity-90">
                        {' '}
                        · {wiShowing.passed ? 'it actually holds up here.' : `it breaks${whyBroke(wiShowing.run, label)}`}
                      </span>
                    )}
                  </span>
                  <Button size="sm" variant="secondary" onClick={exitWhatIf}>
                    <Undo2 size={15} /> Back to my design
                  </Button>
                </div>
                <div className="pointer-events-none absolute top-14 right-14 left-3 z-10 flex flex-wrap items-start gap-2 [&>*]:pointer-events-auto">
                  <GoalBar goals={whatIf.goals} results={wiShowing?.goals.length === whatIf.goals.length ? wiShowing.goals : undefined} />
                  {wiShowing && <MetricsStrip run={wiShowing.run} phaseIndex={wiShowing.phase} playing={wiShowing.playing} blind={false} />}
                </div>
                <DesignCanvas
                  key={`whatif:${whatIf.label}`}
                  design={whatIf.design}
                  result={wiShowing ? wiShowing.run.phases[wiShowing.phase] : null}
                  zones={whatIf.zones}
                  readOnly
                  inspected={inspected}
                  onNodeClick={setInspected}
                  onPaneClick={() => setInspected(null)}
                />
              </>
            ) : canvasless ? (
              <Notebook />
            ) : (
              <>
                <DesignCanvas
                  key={key}
                  design={run.design}
                  onChange={(d) => setDesign(key, d)}
                  result={showing ? showing.run.phases[showing.phase] : null}
                  blind={blind}
                  palette={palette}
                  ghost={ghost}
                  highlight={highlight}
                  zones={section.zones}
                  fitPoints={section.steps.flatMap((s) => (s.t === 'place' && s.slot ? [s.slot] : s.t === 'fork' ? s.options.flatMap((o) => o.patch.addNodes ?? []) : []))}
                  pickMode={pickMode}
                  pulseIds={pulseIds}
                  inspected={inspected}
                  callouts={callouts}
                  onNodeClick={onNodeClick}
                  onPaneClick={() => setInspected(null)}
                  trayAt="top"
                  marked={prediction && prediction !== 'skip' ? prediction : null}
                  doubtIds={doubtIds}
                  onDoubt={onDoubt}
                />
                {pickMode && (
                  <PickBanner
                    title={predicting ? 'Before you run it: which part breaks first?' : 'Something’s still struggling. Which part is it?'}
                    hint={
                      predicting && prediction && prediction !== 'skip'
                        ? `Your call: ${label(prediction)}. Click another to change your mind.`
                        : diagnosing && diagnosis.picks.length
                          ? `Not ${label(diagnosis.picks[diagnosis.picks.length - 1])}. Look for red or orange.`
                          : 'Click it on the canvas.'
                    }
                  >
                    {predicting && prediction && prediction !== 'skip' ? (
                      <Button size="sm" onClick={onRun}>
                        <Play size={15} /> Run traffic
                      </Button>
                    ) : predicting ? (
                      <Button size="sm" variant="secondary" onClick={() => setPrediction('skip')}>
                        Not sure, just run it
                      </Button>
                    ) : null}
                  </PickBanner>
                )}
              </>
            )}
            {isBlocking(step) && !whatIf && blockingCard && (
              <QuestionModal key={stepIndex} step={step!} context={briefing}>
                {blockingCard}
              </QuestionModal>
            )}
            {finished && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-6">
                <div className="w-full max-w-md">
                  <SectionDone
                    lesson={lesson}
                    sectionIndex={sectionIndex}
                    onNext={() => navigate(`/learn/${lesson.id}/${sectionIndex + 1}`)}
                    onNextLesson={nextLesson ? () => navigate(`/learn/${nextLesson.id}`) : undefined}
                  />
                </div>
              </div>
            )}
            {inspectedNode && !pickMode && (whatIf || !canvasless) && (
              <Inspector
                node={inspectedNode}
                result={view?.run.phases[view.phase].nodes[inspectedNode.id]}
                phaseLabel={view?.run.phases[view.phase].label}
                blind={!whatIf && blind}
                onClose={() => setInspected(null)}
                onEdit={whatIf ? undefined : (p) => setDesign(key, setNodeProps(run.design, inspectedNode.id, p))}
                onDelete={
                  whatIf
                    ? undefined
                    : () => {
                        setDesign(key, removeNodes(run.design, [inspectedNode.id]))
                        setInspected(null)
                      }
                }
              />
            )}
          </main>
          <Dock speaker={dock.speaker} mood={dock.mood} kicker={dock.kicker} reply={reply} chips={chips} onChip={onChip}>
            {dock.body}
          </Dock>
        </div>
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

/** The empty floor for sections that are all talk and no building. */
function Notebook() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm text-center text-muted">
        <NotebookPen size={44} className="mx-auto mb-3 text-accent" />
        <div className="text-lg font-extrabold text-ink">Briefing</div>
        <p className="mt-1 text-sm">No building yet. Listen in, answer the questions, and the floor opens up when it’s time to build.</p>
      </div>
    </div>
  )
}

/** A big "which part…?" prompt across the top of the canvas while the learner picks a block. */
function PickBanner({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="pick-banner absolute top-3 left-1/2 z-20 flex w-max max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-accent-ink shadow-card"
      role="status"
    >
      <Crosshair size={26} className="shrink-0 animate-pulse" />
      <div className="min-w-0">
        <div className="text-[16px] leading-tight font-extrabold">{title}</div>
        <div className="text-[13px] opacity-85">{hint}</div>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </motion.div>
  )
}

/**
 * The mentor lines that set up a question: the narration just before it, skipping over earlier
 * questions in the same run (so a second estimate still sees the numbers it's based on).
 */
function briefingFor(section: Section, stepIndex: number): string[] {
  const step = section.steps[stepIndex]
  if (!isBlocking(step) || step.t === 'concept') return []
  const lines: string[] = []
  for (let i = stepIndex - 1; i >= 0; i--) {
    const s = section.steps[i]
    if (s.t === 'say') lines.unshift(s.text)
    else if (isBlocking(s) && !lines.length) continue
    else break
  }
  return lines.slice(-3)
}

/** Every block a section's script uses, so anything else on the canvas is worth a second look. */
function expectedBlocks(section: Section): Set<BlockId> {
  const out = new Set<BlockId>(section.startDesign.nodes.map((n) => n.block))
  const add = (m: BlockMatch) => (Array.isArray(m) ? m : [m]).forEach((b) => out.add(b))
  for (const s of section.steps) {
    if (s.t === 'place' || s.t === 'configure') out.add(s.block)
    if (s.t === 'connect' || s.t === 'disconnect') {
      add(s.from)
      add(s.to)
    }
    if (s.t === 'fork') s.options.forEach((o) => o.patch.addNodes?.forEach((n) => out.add(n.block)))
    if (s.t === 'simulate') s.solution?.nodes.forEach((n) => out.add(n.block))
  }
  return out
}

/** The most recent failed run before step `i`, for the before/after strip. */
function lastFailure(answers: Record<number, StepAnswer | undefined>, i: number) {
  for (let j = i - 1; j >= 0; j--) {
    const a = answers[j]
    if (a?.t === 'simulate' && !a.passed) return a
  }
  return undefined
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
        {last ? `${lesson.title}: complete!` : `${tabOf(lesson.sections[sectionIndex])} complete`}
      </div>
      <p className="mt-1 text-[13px] text-muted">
        {last
          ? 'Every decision you made is on the timeline below. Rewind any time to try a different path.'
          : `Up next: ${tabOf(lesson.sections[sectionIndex + 1])}, ${lesson.sections[sectionIndex + 1].title}.`}
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
        <Link to={lesson.kind === 'case' ? '/cases' : '/'} className="inline-flex h-8 items-center rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface hover:text-ink">
          {lesson.kind === 'case' ? 'Back to cases' : 'Back to map'}
        </Link>
      </div>
    </motion.div>
  )
}

/** Culprits and per-node explanations from the worst moment of a run. */
function diagnose(run: SimRun) {
  const b = bottleneck(run)
  const worst = b ? run.phases[b.phaseIndex] : run.phases.reduce((a, p) => (p.errorRate > a.errorRate ? p : a), run.phases[0])
  const notes = Object.fromEntries(Object.entries(worst.nodes).map(([id, r]) => [id, explainNode(r)]))
  return { culprits: culprits(run), notes }
}

function whyBroke(run: SimRun, label: (id: string) => string) {
  const b = bottleneck(run)
  if (!b) return '.'
  return `: ${label(b.nodeId)} → ${explainNode(run.phases[b.phaseIndex].nodes[b.nodeId]).toLowerCase()}`
}

const labelOf = (design: Design, id: string) => {
  const n = design.nodes.find((x) => x.id === id)
  return n ? `${n.label || BLOCKS[n.block].short} (${id})` : id
}

/** One bubble per block; earlier entries win. */
function dedupe(callouts: Callout[]) {
  const seen = new Set<string>()
  return callouts.filter((c) => !seen.has(c.nodeId) && (seen.add(c.nodeId), true))
}
