import { BLOCKS } from '@/content/blocks'
import type { BlockMatch, Step } from '@/engine/lesson/types'

export interface MentorReply {
  role: 'mentor'
  text: string
}

/**
 * Where mentor guidance comes from. v1 is fully scripted from the lesson.
 * An AI mentor (via the future PocketBase/Go backend) implements the same
 * interface and can answer free-form questions about the current design.
 */
export interface MentorSource {
  /** Tiered hints for a step: nudge → concept → answer. */
  hints(step: Step): string[]
  /** Reply to a free-text message from the learner. */
  reply(text: string, ctx: { lessonTitle: string; stepText?: string }): Promise<MentorReply>
}

const name = (m: BlockMatch) => (Array.isArray(m) ? m.map((b) => BLOCKS[b].name).join(' or ') : BLOCKS[m].name)

export const scriptedMentor: MentorSource = {
  hints(step) {
    const own = 'hints' in step && step.hints ? step.hints : []
    switch (step.t) {
      case 'place':
        return [
          ...own,
          `Find **${BLOCKS[step.block].name}** in the tray at the bottom of the canvas.`,
          step.slot ? 'Drag it onto the dashed slot, or just click it in the tray.' : 'Drag it anywhere on the canvas.',
        ]
      case 'connect':
        return [
          ...own,
          `Hover **${name(step.from)}** to reveal its dots, then drag from the **right** dot.`,
          `Release on **${name(step.to)}**. You need ${step.count ?? 1} such arrow${(step.count ?? 1) > 1 ? 's' : ''}.`,
        ]
      case 'disconnect':
        return [...own, 'Click the arrow line itself to select it. A red ✕ appears; click it, or press Delete.']
      default:
        return own
    }
  },
  async reply() {
    return {
      role: 'mentor',
      text: 'Noted, and saved on your timeline next to this step. An AI mentor that can discuss your design will live here soon.',
    }
  },
}
