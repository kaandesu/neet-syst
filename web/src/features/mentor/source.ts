import { BLOCKS } from '@/content/blocks'
import type { BlockMatch, Step } from '@/engine/lesson/types'

/**
 * Where step hints come from. Everything is authored: lesson text, `coach.ts` for the reply chips,
 * and `content/voices.ts` for reactions. Nothing is generated.
 */
export interface MentorSource {
  /** Tiered hints for a step: nudge → concept → answer. */
  hints(step: Step): string[]
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
          `Drag from the dot on the **right** edge of **${name(step.from)}**.`,
          `Drop it anywhere on **${name(step.to)}** (it lights up). You need ${step.count ?? 1} such arrow${(step.count ?? 1) > 1 ? 's' : ''}.`,
        ]
      case 'disconnect':
        return [...own, 'Click the arrow line itself to select it. A red ✕ appears; click it, or press Delete.']
      default:
        return own
    }
  },
}
