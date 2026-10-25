import { ArrowRight, Check, ChevronRight, CircleHelp, Crosshair, FlaskConical, GitBranch, Play, RotateCcw, Search, TriangleAlert, X, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import type { GoalResult } from '@/engine/sim/goals'
import type { Step, StepAnswer, WhatIf } from '@/engine/lesson/types'
import type { MissKind } from '@/store/progress'
import { SPEAKERS } from '@/content/voices'
import type { SpeakerId } from '@/engine/mentor/reactions'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'
import { ConceptCard } from './ConceptCard'

type S<T extends Step['t']> = Extract<Step, { t: T }>

/** A mentor speech bubble. */
export function Bubble({
  children,
  tone = 'mentor',
  speaker,
  className,
}: {
  children: ReactNode
  /** `plain` drops the bubble chrome, for content that already sits in a panel (the lesson dock). */
  tone?: 'mentor' | 'task' | 'user' | 'plain'
  /** Show who's talking (mentor lines in the lesson flow stay unlabeled). */
  speaker?: SpeakerId
  className?: string
}) {
  const who = speaker ? SPEAKERS[speaker] : undefined
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'text-[14px] leading-relaxed',
        tone !== 'plain' && 'rounded-2xl px-4 py-3',
        tone === 'mentor' && 'rounded-tl-md bg-surface shadow-card ring-1 ring-line',
        tone === 'task' && 'rounded-tl-md bg-accent-soft ring-1 ring-accent/30',
        tone === 'user' && 'ml-8 rounded-tr-md bg-ink text-bg',
        who && speaker !== 'mentor' && 'ring-2',
        className,
      )}
      style={who && speaker !== 'mentor' ? { ['--tw-ring-color' as string]: `hsl(${who.hue} 70% 55% / 0.45)` } : undefined}
    >
      {who && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: `light-dark(hsl(${who.hue} 80% 92%), hsl(${who.hue} 35% 25%))`, color: `light-dark(hsl(${who.hue} 60% 38%), hsl(${who.hue} 80% 78%))` }}
          >
            <who.icon size={12} />
          </span>
          {who.name}
          <span className="font-semibold text-muted">· {who.role}</span>
        </div>
      )}
      {children}
    </motion.div>
  )
}

function ContinueButton({ onClick, label = 'Continue' }: { onClick: () => void; label?: string }) {
  return (
    <Button onClick={onClick} className="mt-3" size="sm" autoFocus>
      {label} <ChevronRight size={16} />
    </Button>
  )
}

export function ConceptStepCard({ step, active, onDone }: { step: S<'concept'>; active: boolean; onDone: () => void }) {
  return (
    <div>
      <ConceptCard block={step.block} compact={!active} />
      {active && <ContinueButton onClick={onDone} label="Got it" />}
    </div>
  )
}

export function ReasonCard({
  step,
  answer,
  active,
  onDone,
  onMiss,
  onTryIt,
}: {
  step: S<'reason'>
  answer?: StepAnswer
  active: boolean
  onDone: (a: StepAnswer) => void
  onMiss?: (k: MissKind) => void
  onTryIt?: (w: WhatIf) => void
}) {
  const done = answer?.t === 'reason' ? answer : undefined
  const [tried, setTried] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(done?.optionId ?? null)
  const correct = step.options.find((o) => o.correct)
  const finished = !!done || (picked !== null && picked === correct?.id)

  return (
    <Bubble tone={active ? 'task' : 'mentor'}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-accent uppercase">
        <CircleHelp size={13} /> Why?
      </div>
      <div className="font-semibold">
        <RichText text={step.question} />
      </div>
      <div className="mt-3 space-y-2">
        {step.options.map((o) => {
          const wrongTried = tried.includes(o.id) && !o.correct
          const isRight = finished && o.correct
          if (!active && !isRight) return null
          return (
            <div key={o.id}>
              <button
                disabled={!active || finished}
                onClick={() => {
                  setPicked(o.id)
                  if (!tried.includes(o.id)) setTried([...tried, o.id])
                  if (!o.correct) onMiss?.('reason')
                }}
                className={cn(
                  'w-full rounded-xl border-2 bg-surface px-3 py-2 text-left text-[13.5px] transition',
                  !finished && !wrongTried && 'border-line hover:border-accent',
                  wrongTried && 'border-bad/60 bg-bad-soft',
                  isRight && 'border-good bg-good-soft',
                  finished && !isRight && !wrongTried && 'opacity-50',
                )}
              >
                <span className="flex items-start gap-2">
                  {isRight ? <Check size={16} className="mt-0.5 shrink-0 text-good" /> : wrongTried ? <X size={16} className="mt-0.5 shrink-0 text-bad" /> : null}
                  <RichText text={o.text} />
                </span>
              </button>
              {(wrongTried || isRight) && (picked === o.id || isRight) && (
                <div className={cn('mt-1 px-3 text-[13px] leading-relaxed', isRight ? 'text-ink' : 'text-muted')}>
                  <RichText text={o.why} />
                  {active && wrongTried && o.tryIt && onTryIt && (
                    <button
                      onClick={() => {
                        onMiss?.('whatif')
                        onTryIt(o.tryIt!)
                      }}
                      className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[12px] font-bold text-accent ring-1 ring-accent/40 hover:bg-accent-soft"
                    >
                      <FlaskConical size={13} /> Simulate it anyway
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {active && finished && correct && (
        <ContinueButton onClick={() => onDone({ t: 'reason', optionId: correct.id, attempts: tried.length })} />
      )}
    </Bubble>
  )
}

export function ForkCard({
  step,
  answer,
  active,
  onPick,
}: {
  step: S<'fork'>
  answer?: StepAnswer
  active: boolean
  onPick: (optionId: string) => void
}) {
  const chosen = answer?.t === 'fork' ? step.options.find((o) => o.id === answer.optionId) : undefined
  return (
    <Bubble tone={active ? 'task' : 'mentor'}>
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-accent uppercase">
        <GitBranch size={13} /> Design decision
      </div>
      <div className="font-semibold">
        <RichText text={step.question} />
      </div>
      {active ? (
        <div className="mt-3 grid gap-2">
          {step.options.map((o) => (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className="rounded-xl border-2 border-line bg-surface px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card"
            >
              <div className="text-[14px] font-bold">{o.label}</div>
              <div className="text-[13px] text-muted">{o.pitch}</div>
            </button>
          ))}
          <p className="text-xs text-muted">There’s no wrong answer. You can rewind on the timeline and try the other branch later.</p>
        </div>
      ) : chosen ? (
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          <div className="font-bold">You chose: {chosen.label}</div>
          <div className="mt-0.5 text-muted">
            <RichText text={chosen.consequence} />
          </div>
        </div>
      ) : null}
    </Bubble>
  )
}

export function RequirementsCard({
  step,
  answer,
  active,
  onDone,
  onMiss,
}: {
  step: S<'requirements'>
  answer?: StepAnswer
  active: boolean
  onDone: (a: StepAnswer) => void
  onMiss?: (k: MissKind) => void
}) {
  const done = answer?.t === 'requirements' ? answer : undefined
  const [picks, setPicks] = useState<(boolean | null)[]>(done?.picks ?? step.items.map(() => null))
  const [checked, setChecked] = useState(!!done)
  const [attempts, setAttempts] = useState(done?.attempts ?? 0)
  const allRight = step.items.every((it, i) => picks[i] === it.inScope)

  return (
    <Bubble tone={active ? 'task' : 'mentor'}>
      <div className="mb-2 text-[11px] font-bold tracking-wider text-accent uppercase">Scope</div>
      <div className="font-semibold">
        <RichText text={step.text} />
      </div>
      <div className="mt-3 space-y-1.5">
        {step.items.map((it, i) => {
          const wrong = checked && picks[i] !== it.inScope
          return (
            <div key={it.text} className={cn('rounded-xl bg-surface px-3 py-2 ring-1 ring-line', wrong && 'ring-2 ring-bad/60', checked && !wrong && 'ring-good/60')}>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[13px]">{it.text}</span>
                {(['in', 'out'] as const).map((v) => {
                  const val = v === 'in'
                  return (
                    <button
                      key={v}
                      disabled={!active || (checked && allRight)}
                      onClick={() => {
                        const next = [...picks]
                        next[i] = val
                        setPicks(next)
                        setChecked(false)
                      }}
                      className={cn(
                        'rounded-lg px-2 py-1 text-[11px] font-bold uppercase transition',
                        picks[i] === val ? (val ? 'bg-good text-white' : 'bg-ink text-bg') : 'bg-surface-2 text-muted hover:text-ink',
                      )}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
              {checked && (wrong || !active) && <div className="mt-1 text-[12px] text-muted">{it.why}</div>}
            </div>
          )
        })}
      </div>
      {active && !checked && (
        <Button
          size="sm"
          className="mt-3"
          disabled={picks.some((p) => p === null)}
          onClick={() => {
            setChecked(true)
            setAttempts(attempts + 1)
            if (!allRight) onMiss?.('requirements')
          }}
        >
          Check
        </Button>
      )}
      {active && checked && !allRight && <p className="mt-2 text-[13px] text-bad">A few are off. Read the notes and adjust.</p>}
      {active && checked && allRight && (
        <ContinueButton onClick={() => onDone({ t: 'requirements', picks: picks as boolean[], attempts })} />
      )}
    </Bubble>
  )
}

export function EstimateCard({
  step,
  answer,
  active,
  onDone,
  onMiss,
}: {
  step: S<'estimate'>
  answer?: StepAnswer
  active: boolean
  onDone: (a: StepAnswer) => void
  onMiss?: (k: MissKind) => void
}) {
  const done = answer?.t === 'estimate' ? answer : undefined
  const [value, setValue] = useState(done ? String(done.value) : '')
  const [attempts, setAttempts] = useState(done?.attempts ?? 0)
  const [verdict, setVerdict] = useState<'right' | 'high' | 'low' | null>(done ? 'right' : null)
  const reveal = verdict === 'right' || attempts >= 3

  const check = () => {
    const v = Number(value.replace(/[, _]/g, ''))
    if (!Number.isFinite(v) || v <= 0) return
    setAttempts(attempts + 1)
    if (v >= step.answer / step.tolerance && v <= step.answer * step.tolerance) setVerdict('right')
    else {
      setVerdict(v > step.answer ? 'high' : 'low')
      onMiss?.('estimate')
    }
  }

  return (
    <Bubble tone={active ? 'task' : 'mentor'}>
      <div className="mb-2 text-[11px] font-bold tracking-wider text-accent uppercase">Estimate</div>
      <div className="font-semibold">
        <RichText text={step.question} />
      </div>
      {active ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            check()
          }}
        >
          <input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={verdict === 'right'}
            className="h-10 w-36 rounded-xl border-2 border-line bg-surface px-3 font-mono text-[15px] outline-none focus:border-accent"
            placeholder="your guess"
            autoFocus
          />
          <span className="text-sm text-muted">{step.unit}</span>
          {verdict !== 'right' && (
            <Button size="sm" type="submit" disabled={!value}>
              Check
            </Button>
          )}
        </form>
      ) : (
        done && <div className="mt-1 font-mono text-sm">Your answer: {done.value.toLocaleString()} {step.unit}</div>
      )}
      {active && verdict === 'high' && <p className="mt-2 text-[13px] text-bad">Too high. Check your units and divisions.</p>}
      {active && verdict === 'low' && <p className="mt-2 text-[13px] text-bad">Too low. Did you multiply everything through?</p>}
      {(reveal || !active) && (
        <div className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
          {verdict === 'right' && active && <div className="mb-1 font-bold text-good">Within {step.tolerance}× of the answer. That’s interview-grade.</div>}
          <RichText text={step.working} />
        </div>
      )}
      {active && reveal && <ContinueButton onClick={() => onDone({ t: 'estimate', value: Number(value) || 0, attempts })} />}
    </Bubble>
  )
}

export interface SimOutcome {
  passed: boolean
  goals: GoalResult[]
  errorRate: number
  p99Ms: number
  warnings: string[]
  /** Nodes a learner may fairly blame for the failure. */
  culprits: string[]
  /** Plain-English state of every node in the worst phase. */
  notes: Record<string, string>
}

/** Predict-before-run and diagnose-the-failure state, owned by the lesson page. */
export interface SimProbe {
  /** This step asks "what breaks first?" before running. */
  predict: boolean
  /** Node id, 'skip', or null while still deciding. */
  prediction: string | null
  onSkipPredict: () => void
  /** Wrong picks so far while diagnosing a failed fix, and whether the culprit was found. */
  diagnosis: { picks: string[]; found: boolean }
  label: (id: string) => string
}

/** After this many wrong picks the culprit is revealed. */
export const DIAGNOSE_TRIES = 2

const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.01 ? 1 : 0)}%`

export function SimulateCard({
  step,
  answer,
  active,
  playing,
  outcome,
  probe,
  prev,
  onRun,
  onDone,
  plain,
}: {
  step: S<'simulate'>
  answer?: StepAnswer
  active: boolean
  playing: boolean
  outcome: SimOutcome | null
  probe?: SimProbe
  /** The last failing run before this step, for the before/after strip. */
  prev?: { errorRate: number; p99Ms: number }
  onRun: () => void
  onDone: (a: StepAnswer) => void
  plain?: boolean
}) {
  const done = answer?.t === 'simulate' ? answer : undefined
  const result = active ? outcome : done ? { passed: done.passed } : null
  const explain = result ? (result.passed ? step.explainPass : step.explainFail) : undefined

  const predicting = active && !!probe?.predict && probe.prediction === null && !outcome && !playing
  const guess = probe?.prediction && probe.prediction !== 'skip' ? probe.prediction : null
  const guessRight = guess && outcome ? outcome.culprits.includes(guess) : undefined
  const culprit = outcome?.culprits[0]

  const failedFix = active && !!outcome && !playing && !outcome.passed && step.expect === 'pass'
  const diagnosis = probe?.diagnosis ?? { picks: [], found: false }
  const canDiagnose = failedFix && !!outcome && outcome.culprits.length > 0
  const diagnosed = diagnosis.found || diagnosis.picks.length >= DIAGNOSE_TRIES
  const canContinue = active && outcome && !playing && (step.expect !== 'pass' || outcome.passed)

  const after = step.expect === 'pass' && prev ? (active ? (outcome?.passed && !playing ? outcome : null) : done?.passed ? done : null) : null
  const delta = after && prev && (after.errorRate < prev.errorRate || after.p99Ms < prev.p99Ms) ? after : null

  return (
    <div className="space-y-2">
      {step.chaos && (active || done) && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex gap-3 rounded-2xl bg-bad px-4 py-3 text-white shadow-card"
        >
          <Zap size={20} className="mt-0.5 shrink-0" />
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase opacity-80">Chaos event</div>
            <div className="font-bold">{step.chaos.title}</div>
            <div className="text-[13px] opacity-90">{step.chaos.body}</div>
          </div>
        </motion.div>
      )}
      <Bubble tone={plain ? 'plain' : active ? 'task' : 'mentor'}>
        <RichText text={step.text} />
        {predicting && (
          <div className="mt-3 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-accent/40">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
              <Crosshair size={15} /> Before you run it: which part breaks first?
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">Click it on the canvas.</div>
            <button onClick={probe!.onSkipPredict} className="mt-1.5 text-[12px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
              Not sure, just run it
            </button>
          </div>
        )}
        {active && guess && !outcome && !playing && (
          <div className="mt-3 flex items-center gap-1.5 text-[13px]">
            <Crosshair size={14} className="text-accent" /> Your call: <span className="font-bold">{probe!.label(guess)}</span>
            <span className="text-muted">(click another to change)</span>
          </div>
        )}
        {active && (
          <div className="mt-3">
            <Button onClick={onRun} disabled={playing || predicting} variant={outcome && !outcome.passed && step.expect === 'pass' ? 'secondary' : 'primary'}>
              {outcome ? <RotateCcw size={16} /> : <Play size={16} />}
              {playing ? 'Running…' : outcome ? 'Run again' : 'Run traffic'}
            </Button>
          </div>
        )}
        {active && guess && outcome && !playing && culprit && (
          <div className={cn('mt-3 rounded-xl px-3 py-2 text-[13px]', guessRight ? 'bg-good-soft' : 'bg-surface-2')}>
            {guessRight ? (
              <>
                <span className="font-bold text-good">✓ You called it.</span> {probe!.label(guess)}: {outcome.notes[guess]}
              </>
            ) : (
              <>
                You picked <span className="font-bold">{probe!.label(guess)}</span>, but it was <span className="font-bold">{probe!.label(culprit)}</span> that
                broke first. {outcome.notes[culprit]}
              </>
            )}
          </div>
        )}
        {result && !playing && (
          <div className={cn('mt-3 rounded-xl px-3 py-2 text-[13px]', result.passed ? 'bg-good-soft' : step.expect === 'pass' ? 'bg-bad-soft' : 'bg-warn-soft')}>
            <div className="flex items-center gap-1.5 font-bold">
              {result.passed ? <Check size={15} className="text-good" /> : <TriangleAlert size={15} className={step.expect === 'pass' ? 'text-bad' : 'text-warn'} />}
              {result.passed ? 'Goals met' : step.expect === 'pass' ? 'Not yet' : 'It broke'}
            </div>
            {explain && (
              <div className="mt-1 leading-relaxed">
                <RichText text={explain} />
              </div>
            )}
            {active && outcome && !outcome.passed && !canDiagnose && outcome.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted">
                {outcome.warnings.slice(0, 3).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {delta && prev && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface px-3 py-2 font-mono text-[12.5px] ring-1 ring-line">
            <span className="flex items-center gap-1">
              errors <span className="text-bad">{pct(prev.errorRate)}</span> <ArrowRight size={12} />
              <span className="font-bold text-good">{pct(delta.errorRate)}</span>
            </span>
            <span className="flex items-center gap-1">
              p99 <span className={cn(delta.p99Ms < prev.p99Ms && 'text-bad')}>{Math.round(prev.p99Ms)} ms</span> <ArrowRight size={12} />
              <span className={cn('font-bold', delta.p99Ms <= prev.p99Ms && 'text-good')}>{Math.round(delta.p99Ms)} ms</span>
            </span>
          </div>
        )}
        {canDiagnose && !diagnosed && (
          <div className="mt-2 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-accent/40">
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-accent">
              <Search size={15} /> Something's still struggling. Click the part you think is the problem.
            </div>
            {diagnosis.picks.length > 0 && (
              <div className="mt-1 text-[12.5px] text-muted">
                {probe!.label(diagnosis.picks[diagnosis.picks.length - 1])} looks fine: {outcome!.notes[diagnosis.picks[diagnosis.picks.length - 1]]} Look for red or orange.
              </div>
            )}
          </div>
        )}
        {canDiagnose && diagnosed && culprit && (
          <div className="mt-2 rounded-xl bg-surface px-3 py-2 text-[13px] ring-1 ring-line">
            {diagnosis.found ? <span className="font-bold text-good">Found it. </span> : <span className="font-bold">Here's the problem: </span>}
            <span className="font-bold">{probe!.label(culprit)}</span>. {outcome!.notes[culprit]}
          </div>
        )}
        {canContinue && (
          <ContinueButton
            onClick={() =>
              onDone({
                t: 'simulate',
                passed: outcome.passed,
                errorRate: outcome.errorRate,
                p99Ms: outcome.p99Ms,
                ...(guess ? { predicted: guess, predictedRight: !!guessRight } : {}),
              })
            }
          />
        )}
      </Bubble>
    </div>
  )
}
