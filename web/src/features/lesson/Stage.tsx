import { Check, CircleDashed, CircleHelp, Crosshair, Eye, LifeBuoy, NotebookPen, Send, X } from 'lucide-react'
import { IDEAS } from '@/content/ideas'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { BLOCKS } from '@/content/blocks'
import { SPEAKERS } from '@/content/voices'
import type { Section, Step } from '@/engine/lesson/types'
import type { Mood, SpeakerId } from '@/engine/mentor/reactions'
import { goalLabel, type GoalResult } from '@/engine/sim/goals'
import type { Goal, SimRun } from '@/engine/types'
import { CHIP_LABEL, type ChipId } from '@/features/mentor/coach'
import { cn } from '@/lib/cn'
import { RichText } from '@/ui/RichText'

/** A line in the lesson that isn't a step: a chip question, its answer, or a reaction. */
export interface FeedItem {
  stepIndex: number
  text: string
  /** Omitted for the learner's own chip taps. */
  speaker?: SpeakerId
  mood?: Mood
}

/** Steps that stop the lesson until the learner answers them. They open as a card over the canvas. */
export const isBlocking = (s: Step | undefined) => !!s && (s.t === 'concept' || s.t === 'idea' || s.t === 'reason' || s.t === 'fork' || s.t === 'requirements' || s.t === 'estimate' || s.t === 'api' || s.t === 'reveal')

const CHIP_ICON: Record<ChipId, typeof Eye> = { why: CircleHelp, show: Eye, stuck: LifeBuoy }

/** A cast member's framed pixel-art face, visual-novel style. */
export function Portrait({
  speaker = 'mentor',
  mood = 'neutral',
  size = 88,
  className,
}: {
  speaker?: SpeakerId
  mood?: Mood
  size?: number
  className?: string
}) {
  const who = SPEAKERS[speaker]
  return (
    <div
      className={cn('vn-portrait relative shrink-0 overflow-hidden rounded-2xl', className)}
      style={{ width: size, height: size, background: `radial-gradient(circle at 50% 35%, hsl(${who.hue} 45% 42%), hsl(${who.hue} 40% 24%))` }}
      data-mood={mood}
      aria-hidden
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={mood}
          src={who.faces[mood]}
          alt=""
          draggable={false}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </AnimatePresence>
    </div>
  )
}

/**
 * The dialogue box along the bottom of the stage: who's talking, what they say, and the
 * buttons to move on or ask for help.
 */
export function Dock({
  speaker = 'mentor',
  mood,
  kicker,
  children,
  reply,
  chips,
  onChip,
}: {
  speaker?: SpeakerId
  mood?: Mood
  /** Small label over the text, e.g. "Objective". */
  kicker?: string
  children: ReactNode
  /** The latest answer or reaction for this step. */
  reply?: FeedItem
  chips: ChipId[]
  onChip: (c: ChipId) => void
}) {
  const who = SPEAKERS[speaker]
  // A reaction from the same speaker changes their face; one from someone else gets its own little portrait.
  const face = mood ?? (reply?.speaker === speaker ? reply.mood : undefined)
  return (
    <div className="vn-dock relative z-40 shrink-0 border-t border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-start gap-4 px-4 pt-3 pb-3">
        <Portrait speaker={speaker} mood={face} size={84} className="-mt-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="vn-nameplate rounded-md bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-ink">{who.name}</span>
            <span className="text-[12px] text-muted">{who.role}</span>
            {kicker && <span className="ml-1 text-[11px] font-bold tracking-wider text-accent uppercase">{kicker}</span>}
          </div>
          <div className="mt-1.5 max-h-[30vh] overflow-y-auto pr-1 text-[15px] leading-relaxed scrollbar-thin">{children}</div>
          <AnimatePresence>
            {reply?.speaker && (
              <motion.div
                key={reply.text}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] leading-relaxed"
              >
                {reply.speaker !== speaker && <Portrait speaker={reply.speaker} mood={reply.mood} size={28} className="rounded-lg" />}
                <div className="min-w-0">
                  <span className="mr-1 font-bold">{SPEAKERS[reply.speaker].name}:</span>
                  <RichText text={reply.text} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {chips.length > 0 && (
          <div className="flex shrink-0 flex-col gap-1.5">
            {chips.map((c) => {
              const Icon = CHIP_ICON[c]
              return (
                <button
                  key={c}
                  onClick={() => onChip(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-semibold text-muted transition hover:text-ink',
                    c === 'stuck' && 'text-warn hover:text-warn',
                  )}
                >
                  <Icon size={14} /> {CHIP_LABEL[c]}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const BLOCKING_LABEL: Record<string, string> = {
  concept: 'New building block',
  idea: 'New idea',
  reason: 'Question',
  fork: 'Design decision',
  requirements: 'Scope the problem',
  estimate: 'Estimate',
  api: 'Design the API',
  reveal: 'How the experts did it',
}

/** A blocking step, centred over a dimmed canvas so it can't be missed. */
export function QuestionModal({
  step,
  speaker = 'mentor',
  mood,
  context = [],
  children,
}: {
  step: Step
  speaker?: SpeakerId
  mood?: Mood
  /** The briefing lines that set this question up, so the facts stay in view while answering. */
  context?: string[]
  children: ReactNode
}) {
  const who = SPEAKERS[speaker]
  const concept = step.t === 'concept'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6"
      role="dialog"
      aria-label={BLOCKING_LABEL[step.t]}
    >
      <motion.div
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        className={cn('vn-modal flex max-h-full w-full flex-col', step.t === 'api' || step.t === 'reveal' || step.t === 'idea' ? 'max-w-3xl' : 'max-w-xl', 'overflow-hidden rounded-3xl bg-surface shadow-card')}
      >
        <div className={cn('vn-modal-head flex items-center gap-3 px-5 py-3', concept ? 'bg-good-soft' : 'bg-accent-soft')}>
          <Portrait speaker={speaker} mood={mood} size={52} />
          <div className="min-w-0 flex-1">
            <div className={cn('text-[11px] font-bold tracking-wider uppercase', concept ? 'text-good' : 'text-accent')}>
              {concept ? `★ ${BLOCKING_LABEL.concept}: ${BLOCKS[step.block].name}` : step.t === 'idea' ? `★ ${BLOCKING_LABEL.idea}: ${IDEAS[step.idea].name}` : BLOCKING_LABEL[step.t]}
            </div>
            <div className="text-[13px] text-muted">
              {who.name} {concept ? 'wants you to meet a new block.' : step.t === 'reveal' ? 'shows you what was actually built.' : step.t === 'idea' ? 'wants to show you how something works.' : 'needs an answer before you go on.'}
            </div>
          </div>
        </div>
        <div className="space-y-3 overflow-y-auto p-4 scrollbar-thin">
          {context.length > 0 && (
            <div className="vn-briefing rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed">
              <div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Briefing</div>
              <div className="space-y-1.5">
                {context.map((t, i) => (
                  <p key={i}>
                    <RichText text={t} />
                  </p>
                ))}
              </div>
            </div>
          )}
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

/** What the learner should be doing right now, in a few words. */
export function objectiveOf(step: Step | undefined): string {
  if (!step) return 'Section complete.'
  switch (step.t) {
    case 'say':
      return 'Listen to the briefing.'
    case 'concept':
      return `Meet a new block: **${BLOCKS[step.block].name}**.`
    case 'idea':
      return `Learn an idea: **${IDEAS[step.idea].name}**.`
    case 'reason':
    case 'fork':
      return step.question
    case 'estimate':
      return step.question
    case 'reveal':
      return `Compare your design: **${step.title}**.`
    default:
      return step.text
  }
}

/** The left sidebar: where you are in the section, what to do, how the system is doing, your notes. */
export function SituationPanel({
  section,
  stepIndex,
  step,
  goals,
  results,
  run,
  phase,
  playing,
  blind,
  notes,
  onNote,
}: {
  section: Section
  stepIndex: number
  step: Step | undefined
  goals: Goal[]
  results?: GoalResult[]
  run?: SimRun
  phase: number
  playing: boolean
  blind: boolean
  notes: { stepIndex: number; text: string }[]
  onNote: (text: string) => void
}) {
  const total = section.steps.length
  const done = Math.min(stepIndex, total)
  return (
    <aside className="vn-side flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-bg p-3 scrollbar-thin">
      <Panel title="Progress">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold">{section.title}</span>
          <span className="font-mono text-[12px] text-muted">
            {done}/{total}
          </span>
        </div>
        <div className="mt-2 flex gap-0.5">
          {section.steps.map((_, i) => (
            <span key={i} className={cn('h-2 flex-1 rounded-sm', i < stepIndex ? 'bg-good' : i === stepIndex ? 'bg-accent' : 'bg-surface-2')} />
          ))}
        </div>
      </Panel>

      <Panel title="Objective" icon={<Crosshair size={13} />}>
        <div className="text-[13.5px] leading-snug">
          <RichText text={objectiveOf(step)} />
        </div>
      </Panel>

      {goals.length > 0 && (
        <Panel title="Goals">
          <ul className="space-y-1">
            {goals.map((g, i) => {
              const r = results?.[i]
              return (
                <li key={i} title={r?.detail} className={cn('flex items-center gap-2 text-[13px]', !r && 'text-muted', r?.pass && 'text-good', r && !r.pass && 'text-bad')}>
                  {!r ? <CircleDashed size={14} /> : r.pass ? <Check size={14} /> : <X size={14} />}
                  {goalLabel(g)}
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      {run && <Metrics run={run} phase={phase} playing={playing} blind={blind} />}

      <Notes notes={notes} onNote={onNote} />
    </aside>
  )
}

export function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="vn-panel rounded-2xl bg-surface p-3 shadow-card">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`)

export function Metrics({ run, phase, playing, blind }: { run: SimRun; phase: number; playing: boolean; blind: boolean }) {
  const p = run.phases[phase]
  const hide = (v: string) => (blind ? '??' : v)
  const errTone = blind ? '' : p.errorRate > 0.005 ? 'text-bad' : 'text-good'
  const p99Tone = blind ? '' : p.p99Ms > 300 ? 'text-bad' : p.p99Ms > 150 ? 'text-warn' : 'text-good'
  return (
    <Panel title={playing ? 'Live traffic ●' : 'Last run'}>
      <div className="flex items-center justify-between text-[12px]">
        <span className="truncate font-bold">{p.label}</span>
        <span className="font-mono text-muted">
          {phase + 1}/{run.phases.length}
        </span>
      </div>
      <div className="mt-1 flex gap-0.5">
        {run.phases.map((_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-sm', i <= phase ? 'bg-accent' : 'bg-surface-2')} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <Stat label="traffic" value={`${fmt(p.offeredRps)}/s`} />
        <Stat label="errors" value={hide(`${(p.errorRate * 100).toFixed(p.errorRate > 0 && p.errorRate < 0.01 ? 2 : 1)}%`)} tone={errTone} />
        <Stat label="p99" value={hide(`${p.p99Ms}ms`)} tone={p99Tone} />
      </div>
    </Panel>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-1 py-1.5">
      <div className={cn('font-mono text-[14px] leading-tight font-bold', tone)}>{value}</div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}

function Notes({ notes, onNote }: { notes: { stepIndex: number; text: string }[]; onNote: (text: string) => void }) {
  const [draft, setDraft] = useState('')
  const save = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    onNote(text)
  }
  return (
    <Panel title="Field notes" icon={<NotebookPen size={13} />}>
      {notes.length > 0 && (
        <ul className="mb-2 space-y-1 text-[12.5px] leading-snug">
          {notes.map((n, i) => (
            <li key={i} className="rounded-lg bg-surface-2 px-2 py-1">
              {n.text}
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Explain this step in a sentence…"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={!draft.trim()} className="text-accent disabled:opacity-30" aria-label="Save note">
          <Send size={14} />
        </button>
      </form>
    </Panel>
  )
}
