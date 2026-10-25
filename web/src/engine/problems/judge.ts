import { explainNode, bottleneck } from '../sim/explain'
import { allPass, evaluateGoals, type GoalResult } from '../sim/goals'
import { runScenario } from '../sim/solver'
import type { Design, SimRun } from '../types'
import type { Problem, TestCase } from './types'

export interface TestResult {
  test: TestCase
  index: number
  pass: boolean
  run: SimRun
  goals: GoalResult[]
  errorRate: number
  p99Ms: number
  /** The node that hurt most, with a plain-English reason. */
  culprit?: { nodeId: string; why: string }
}

export interface Verdict {
  results: TestResult[]
  pass: boolean
  blocks: number
}

export const blockCount = (d: Design) => d.nodes.filter((n) => n.block !== 'client').length

export function runTest(problem: Problem, design: Design, test: TestCase, index: number): TestResult {
  const run = runScenario(design, { phases: test.phases }, { zones: problem.zones })
  const goals = evaluateGoals(design, run, test.goals ?? problem.goals)
  const pass = allPass(goals)
  const b = pass ? null : bottleneck(run)
  const r = b && run.phases[b.phaseIndex].nodes[b.nodeId]
  return {
    test,
    index,
    pass,
    run,
    goals,
    errorRate: Math.max(0, ...run.phases.map((p) => p.errorRate)),
    p99Ms: Math.max(0, ...run.phases.map((p) => p.p99Ms)),
    culprit: b && r ? { nodeId: b.nodeId, why: explainNode(r) } : undefined,
  }
}

/** Run = visible tests only. Submit = every test, hidden ones included. */
export function judge(problem: Problem, design: Design, { hidden }: { hidden: boolean }): Verdict {
  const results = problem.tests
    .map((t, i) => [t, i] as const)
    .filter(([t]) => hidden || !t.hidden)
    .map(([t, i]) => runTest(problem, design, t, i))
  return { results, pass: results.every((r) => r.pass), blocks: blockCount(design) }
}

/** ★ solved, ★ no hints, ★ at or under par. */
export function starsFor(problem: Problem, blocks: number, hintsUsed: number): number {
  return 1 + (hintsUsed === 0 ? 1 : 0) + (blocks <= problem.par ? 1 : 0)
}
