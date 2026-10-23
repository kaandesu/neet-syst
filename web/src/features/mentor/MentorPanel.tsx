import { Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Section, StepAnswer } from '@/engine/lesson/types'
import {
  ActionCard,
  Bubble,
  ConceptStepCard,
  EstimateCard,
  ForkCard,
  ReasonCard,
  RequirementsCard,
  SayCard,
  SimulateCard,
  type SimOutcome,
} from './cards'
import { scriptedMentor } from './source'

export interface MentorPanelProps {
  lessonTitle: string
  section: Section
  stepIndex: number
  answers: Record<number, StepAnswer | undefined>
  notes: { stepIndex: number; text: string }[]
  playing: boolean
  outcome: SimOutcome | null
  footer?: React.ReactNode
  onComplete: (answer?: StepAnswer) => void
  onFork: (optionId: string) => void
  onRun: () => void
  onNote: (text: string) => void
}

export function MentorPanel(p: MentorPanelProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [replies, setReplies] = useState<{ stepIndex: number; text: string }[]>([])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [p.stepIndex, p.outcome, p.playing, p.notes.length, replies.length])

  const visible = p.section.steps.slice(0, Math.min(p.stepIndex + 1, p.section.steps.length))

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    p.onNote(text)
    const r = await scriptedMentor.reply(text, { lessonTitle: p.lessonTitle })
    setReplies((rs) => [...rs, { stepIndex: p.stepIndex, text: r.text }])
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
        {visible.map((step, i) => {
          const active = i === p.stepIndex
          const answer = p.answers[i]
          const key = `${i}:${step.t}`
          let card: React.ReactNode
          switch (step.t) {
            case 'say':
              card = <SayCard step={step} active={active} onDone={() => p.onComplete()} />
              break
            case 'concept':
              card = <ConceptStepCard step={step} active={active} onDone={() => p.onComplete()} />
              break
            case 'reason':
              card = <ReasonCard step={step} answer={answer} active={active} onDone={p.onComplete} />
              break
            case 'fork':
              card = <ForkCard step={step} answer={answer} active={active} onPick={p.onFork} />
              break
            case 'requirements':
              card = <RequirementsCard step={step} answer={answer} active={active} onDone={p.onComplete} />
              break
            case 'estimate':
              card = <EstimateCard step={step} answer={answer} active={active} onDone={p.onComplete} />
              break
            case 'simulate':
              card = (
                <SimulateCard
                  step={step}
                  answer={answer}
                  active={active}
                  playing={active && p.playing}
                  outcome={active ? p.outcome : null}
                  onRun={p.onRun}
                  onDone={p.onComplete}
                />
              )
              break
            default:
              card = <ActionCard step={step} active={active} />
          }
          return (
            <div key={key} className="space-y-2">
              {card}
              {p.notes
                .filter((n) => n.stepIndex === i)
                .map((n, j) => (
                  <Bubble key={j} tone="user">
                    {n.text}
                  </Bubble>
                ))}
              {replies
                .filter((r) => r.stepIndex === i)
                .map((r, j) => (
                  <Bubble key={`r${j}`}>
                    <span className="text-muted">{r.text}</span>
                  </Bubble>
                ))}
            </div>
          )
        })}
        {p.footer}
      </div>
      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface px-3 py-2 focus-within:border-accent">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Write down your reasoning…"
            className="max-h-28 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <button type="submit" disabled={!draft.trim()} className="rounded-lg p-1 text-accent disabled:opacity-30" aria-label="Save note">
            <Send size={18} />
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted">
          <Sparkles size={12} /> Notes are saved to your timeline. AI mentor coming soon.
        </div>
      </form>
    </div>
  )
}
