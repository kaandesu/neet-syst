import { Check, ChevronRight, CircleHelp, GitBranch, Lightbulb, Play, RotateCcw, TriangleAlert, X, Zap } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import type { GoalResult } from '@/engine/sim/goals'
import type { Step, StepAnswer } from '@/engine/lesson/types'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'
import { ConceptCard } from './ConceptCard'
import { scriptedMentor } from './source'

type S<T extends Step['t']> = Extract<Step, { t: T }>

/** A mentor speech bubble. */
export function Bubble({ children, tone = 'mentor', className }: { children: ReactNode; tone?: 'mentor' | 'task' | 'user'; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl px-4 py-3 text-[14px] leading-relaxed',
        tone === 'mentor' && 'rounded-tl-md bg-surface shadow-card ring-1 ring-line',
        tone === 'task' && 'rounded-tl-md bg-accent-soft ring-1 ring-accent/30',
        tone === 'user' && 'ml-8 rounded-tr-md bg-ink text-bg',
        className,
      )}
    >
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

export function Hints({ step }: { step: Step }) {
  const hints = scriptedMentor.hints(step)
  const [shown, setShown] = useState(0)
  if (!hints.length) return null
  return (
    <div className="mt-2 space-y-1.5">
      {hints.slice(0, shown).map((h, i) => (
        <div key={i} className="flex gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[13px]">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <RichText text={h} />
          </span>
        </div>
      ))}
      {shown < hints.length && (
        <button className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink" onClick={() => setShown(shown + 1)}>
          <CircleHelp size={14} /> {shown === 0 ? 'Need a hint?' : 'Another hint'}
        </button>
      )}
    </div>
  )
}

export function SayCard({ step, active, onDone }: { step: S<'say'>; active: boolean; onDone: () => void }) {
  return (
    <Bubble>
      <RichText text={step.text} />
      {active && (
        <div>
          <ContinueButton onClick={onDone} />
        </div>
      )}
    </Bubble>
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
}: {
  step: S<'reason'>
  answer?: StepAnswer
  active: boolean
  onDone: (a: StepAnswer) => void
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
}: {
  step: S<'requirements'>
  answer?: StepAnswer
  active: boolean
  onDone: (a: StepAnswer) => void
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
}: {
  step: S<'estimate'>
  answer?: StepAnswer
  active: boolean
  onDone: (a: StepAnswer) => void
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
    else setVerdict(v > step.answer ? 'high' : 'low')
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
      {active && verdict && verdict !== 'right' && <Hints step={step} />}
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

export function ActionCard({ step, active }: { step: S<'place'> | S<'connect'> | S<'disconnect'>; active: boolean }) {
  return (
    <Bubble tone={active ? 'task' : 'mentor'} className={cn(!active && 'py-2 text-[13px] text-muted')}>
      <div className="flex items-start gap-2">
        {active ? (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-ink">
            →
          </span>
        ) : (
          <Check size={16} className="mt-0.5 shrink-0 text-good" />
        )}
        <span>
          <RichText text={step.text} />
        </span>
      </div>
      {active && <Hints step={step} />}
    </Bubble>
  )
}

export interface SimOutcome {
  passed: boolean
  goals: GoalResult[]
  errorRate: number
  p99Ms: number
  warnings: string[]
}

export function SimulateCard({
  step,
  answer,
  active,
  playing,
  outcome,
  onRun,
  onDone,
}: {
  step: S<'simulate'>
  answer?: StepAnswer
  active: boolean
  playing: boolean
  outcome: SimOutcome | null
  onRun: () => void
  onDone: (a: StepAnswer) => void
}) {
  const done = answer?.t === 'simulate' ? answer : undefined
  const result = active ? outcome : done ? { passed: done.passed } : null
  const canContinue = active && outcome && !playing && (step.expect !== 'pass' || outcome.passed)
  const explain = result ? (result.passed ? step.explainPass : step.explainFail) : undefined

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
      <Bubble tone={active ? 'task' : 'mentor'}>
        <RichText text={step.text} />
        {active && (
          <div className="mt-3">
            <Button onClick={onRun} disabled={playing} variant={outcome && !outcome.passed && step.expect === 'pass' ? 'secondary' : 'primary'}>
              {outcome ? <RotateCcw size={16} /> : <Play size={16} />}
              {playing ? 'Running…' : outcome ? 'Run again' : 'Run traffic'}
            </Button>
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
            {active && outcome && !outcome.passed && outcome.warnings.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted">
                {outcome.warnings.slice(0, 3).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {active && outcome && !outcome.passed && step.expect === 'pass' && !playing && <Hints step={step} />}
        {canContinue && (
          <ContinueButton
            onClick={() => onDone({ t: 'simulate', passed: outcome.passed, errorRate: outcome.errorRate, p99Ms: outcome.p99Ms })}
          />
        )}
      </Bubble>
    </div>
  )
}
