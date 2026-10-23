import { BLOCKS } from '@/content/blocks'
import type { BlockMatch, Step, StepAnswer } from '@/engine/lesson/types'

const nm = (m: BlockMatch) => (Array.isArray(m) ? 'database' : BLOCKS[m].short)

/** Short label for a step on the timeline. */
export function describeStep(step: Step | undefined, answer?: StepAnswer): string {
  if (!step) return 'Start'
  switch (step.t) {
    case 'say':
      return 'Mentor'
    case 'concept':
      return `Learned ${BLOCKS[step.block].name}`
    case 'place':
      return `Placed ${BLOCKS[step.block].short}`
    case 'connect':
      return `Connected ${nm(step.from)} → ${nm(step.to)}`
    case 'disconnect':
      return `Removed ${nm(step.from)} → ${nm(step.to)}`
    case 'reason': {
      const o = answer?.t === 'reason' ? step.options.find((x) => x.id === answer.optionId) : undefined
      return o ? `Reasoned: ${o.text.slice(0, 48)}${o.text.length > 48 ? '…' : ''}` : 'Reasoning'
    }
    case 'fork': {
      const o = answer?.t === 'fork' ? step.options.find((x) => x.id === answer.optionId) : undefined
      return o ? `Chose ${o.label}` : 'Decision'
    }
    case 'simulate':
      return answer?.t === 'simulate' ? `Ran traffic: ${answer.passed ? 'passed' : 'broke'}` : 'Ran traffic'
    case 'requirements':
      return 'Scoped requirements'
    case 'estimate':
      return answer?.t === 'estimate' ? `Estimated ${answer.value.toLocaleString()}` : 'Estimate'
  }
}
