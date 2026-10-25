import { BLOCKS } from '@/content/blocks'
import { matches } from '@/engine/lesson/runner'
import type { BlockMatch, Step } from '@/engine/lesson/types'
import type { Finding } from '@/engine/mentor/lint'
import { goalLabel } from '@/engine/sim/goals'
import type { Design, Goal } from '@/engine/types'
import type { SimOutcome } from './cards'
import { scriptedMentor } from './source'

/** Canned questions the learner can ask instead of typing. */
export type ChipId = 'why' | 'show' | 'stuck'

/** A speech bubble pinned to a block on the canvas. */
export interface Callout {
  nodeId: string
  text: string
  tone: 'info' | 'warn' | 'bad' | 'good'
}

export interface CoachCtx {
  step: Step
  design: Design
  goals: Goal[]
  outcome: SimOutcome | null
  playing: boolean
  /** The card is busy asking "which part…?", so no shortcuts. */
  probing: boolean
  lint: Finding[]
  label: (id: string) => string
}

const name = (m: BlockMatch) => (Array.isArray(m) ? m.map((b) => BLOCKS[b].name).join(' or ') : BLOCKS[m].name)
const failedRun = (c: CoachCtx) => c.step.t === 'simulate' && !!c.outcome && !c.outcome.passed && !c.playing

export const CHIP_LABEL: Record<ChipId, string> = { why: 'Why does this matter?', show: 'Show me', stuck: 'I’m stuck' }

/** Which questions make sense right now. */
export function chipsFor(c: CoachCtx): ChipId[] {
  if (c.probing || c.playing) return []
  const s = c.step
  const chips: ChipId[] = []
  if (whyText(c)) chips.push('why')
  if (s.t === 'connect' || s.t === 'disconnect' || (failedRun(c) && c.outcome!.culprits.length) || c.lint.length) chips.push('show')
  if (hintLadder(c).length) chips.push('stuck')
  return chips
}

/** The "why" behind the current step, written for this step type. */
export function whyText(c: CoachCtx): string | null {
  const s = c.step
  switch (s.t) {
    case 'place': {
      const b = BLOCKS[s.block]
      return `**Why a ${b.name}?** ${b.concept.why}`
    }
    case 'connect':
      return `Requests only travel along arrows. Until **${name(s.from)} → ${name(s.to)}** exists, the ${name(s.to)} never sees a single request.`
    case 'reveal':
      return 'There’s rarely one right answer. Comparing your call with a real one shows which trade-offs you saw and which you missed. That’s what interviewers probe.'
    case 'api':
      return '**Why does the API matter?** It’s the one part other teams and apps build against. Boxes can change behind it any time; a published endpoint is a promise you keep for years.'
    case 'configure':
      return s.tier
        ? `**Why resize?** A bigger machine handles more work with no new wiring. But it is still *one* machine: it costs more and it can still die.`
        : `**Why a name?** In a real system, “web-server-2” tells nobody what breaks when it goes down. “Checkout Service” does.`
    case 'disconnect':
      return `Old arrows keep sending traffic the old way. While **${name(s.from)} → ${name(s.to)}** exists, requests skip what you just added.`
    case 'simulate':
      if (failedRun(c) && c.outcome!.culprits[0]) {
        const id = c.outcome!.culprits[0]
        return `**${c.label(id)}** is the bottleneck: ${c.outcome!.notes[id]} For anything red, ask: does it need **more copies**, **less work**, or a **different path**?`
      }
      return `The goals (${c.goals.map(goalLabel).join(', ') || 'none'}) are the bar. Running traffic proves the design clears it, instead of arguing about it.`
    case 'estimate':
      return 'Interviewers don’t want precision. They want to watch you turn *users* into *requests per second*, because that number decides how many machines you need.'
    case 'requirements':
      return 'Scoping first stops you from designing features nobody asked for. Interviewers judge where you draw the line as much as the boxes you draw.'
    default:
      return null
  }
}

/** Nudge → concept → answer, plus anything the design review spotted. */
export function hintLadder(c: CoachCtx): string[] {
  const s = c.step
  if (s.t === 'simulate') {
    if (!failedRun(c)) return []
    const review = c.lint.slice(0, 1).map((f) => `Check **${c.label(f.nodeId)}**: ${f.text}`)
    const culprit = c.outcome!.culprits[0]
    const start = culprit ? [`Start with **${c.label(culprit)}**. ${c.outcome!.notes[culprit]}`] : []
    return [...review, ...start, ...scriptedMentor.hints(s)]
  }
  return scriptedMentor.hints(s)
}

/** Pin bubbles on the canvas that point at what the step is about. */
export function showMe(c: CoachCtx): Callout[] {
  const s = c.step
  const first = (m: BlockMatch) => c.design.nodes.find((n) => matches(n.block, m))?.id
  if (c.lint.length) return c.lint.slice(0, 2).map((f) => ({ nodeId: f.nodeId, text: f.text, tone: 'warn' }))
  if (s.t === 'connect') {
    const a = first(s.from)
    const b = c.design.nodes.find((n) => matches(n.block, s.to) && n.id !== a)?.id
    return [
      ...(a ? [{ nodeId: a, text: 'Drag from the dot on this side →', tone: 'info' as const }] : []),
      ...(b ? [{ nodeId: b, text: '…and drop it here.', tone: 'info' as const }] : []),
    ]
  }
  if (s.t === 'disconnect') {
    const edge = c.design.edges.find((e) => {
      const from = c.design.nodes.find((n) => n.id === e.from)
      const to = c.design.nodes.find((n) => n.id === e.to)
      return from && to && matches(from.block, s.from) && matches(to.block, s.to)
    })
    return edge ? [{ nodeId: edge.from, text: 'Click the arrow leaving this block, then press Delete.', tone: 'info' }] : []
  }
  if (failedRun(c)) {
    const id = c.outcome!.culprits[0]
    return id ? [{ nodeId: id, text: c.outcome!.notes[id], tone: 'bad' }] : []
  }
  return []
}
