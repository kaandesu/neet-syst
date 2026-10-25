import { blockCount } from '../problems/judge'
import { allPass, evaluateGoals, type GoalResult } from '../sim/goals'
import { bottleneck, explainNode } from '../sim/explain'
import { runScenario } from '../sim/solver'
import type { Design, SimRun } from '../types'
import type { Shift } from './types'

export interface ShiftResult {
  run: SimRun
  goals: GoalResult[]
  survived: boolean
  /** Index of the first wave that broke the error or latency budget, if any. */
  fellAt: number | null
  blocks: number
  p99Ms: number
  stars: number
  /** The node that hurt most, with a plain-English reason. */
  culprit?: { nodeId: string; why: string }
}

/** The error and latency budget each wave is held to. */
function budget(shift: Shift) {
  const err = shift.goals.find((g) => g.kind === 'maxErrorRate')
  const p99 = shift.goals.find((g) => g.kind === 'maxP99')
  return { maxErr: err?.kind === 'maxErrorRate' ? err.value : 0.01, maxP99: p99?.kind === 'maxP99' ? p99.value : Infinity }
}

/** Did this wave hold, by the shift's error and latency budget? */
export function waveHeld(shift: Shift, run: SimRun, i: number) {
  const { maxErr, maxP99 } = budget(shift)
  const p = run.phases[i]
  return p.errorRate <= maxErr && p.p99Ms <= maxP99
}

/** ★ survived every wave · ★ at or under par · ★ worst p99 at or under `fastMs`. */
export function shiftStars(shift: Shift, survived: boolean, blocks: number, p99Ms: number) {
  if (!survived) return 0
  return 1 + (blocks <= shift.par ? 1 : 0) + (p99Ms <= shift.fastMs ? 1 : 0)
}

export function runShift(shift: Shift, design: Design): ShiftResult {
  const run = runScenario(design, { phases: shift.waves.map((w) => w.phase) })
  const goals = evaluateGoals(design, run, shift.goals)
  const survived = allPass(goals)
  const fell = run.phases.findIndex((_, i) => !waveHeld(shift, run, i))
  const blocks = blockCount(design)
  const p99Ms = Math.max(0, ...run.phases.map((p) => p.p99Ms))
  const b = survived ? null : bottleneck(run)
  const r = b && run.phases[b.phaseIndex].nodes[b.nodeId]
  return {
    run,
    goals,
    survived,
    fellAt: fell === -1 ? null : fell,
    blocks,
    p99Ms,
    stars: shiftStars(shift, survived, blocks, p99Ms),
    culprit: b && r ? { nodeId: b.nodeId, why: explainNode(r) } : undefined,
  }
}
