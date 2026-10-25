import type { Design, Goal, SimRun } from '../types'
import { roleOf } from './specs'

export interface GoalResult {
  goal: Goal
  pass: boolean
  label: string
  detail: string
}

const pct = (v: number) => `${(v * 100).toFixed(v < 0.01 && v > 0 ? 2 : 0)}%`

export function goalLabel(goal: Goal): string {
  switch (goal.kind) {
    case 'maxErrorRate':
      return goal.value === 0 ? 'No failed requests' : `Errors below ${pct(goal.value)}`
    case 'maxP99':
      return `p99 latency under ${goal.value} ms`
    case 'noSPOF':
      return 'No single point of failure'
    case 'hasBlock':
      return `Uses ${goal.count ?? 1}× ${goal.block}`
    case 'stateless':
      return 'Web tier is stateless'
    case 'queueStable':
      return 'Workers keep up with the queue'
    case 'maxBlocks':
      return `At most ${goal.value} blocks`
  }
}

export function evaluateGoals(design: Design, run: SimRun, goals: Goal[]): GoalResult[] {
  return goals.map((goal) => {
    const label = goalLabel(goal)
    switch (goal.kind) {
      case 'maxErrorRate': {
        const worst = Math.max(0, ...run.phases.map((p) => p.errorRate))
        return { goal, label, pass: worst <= goal.value + 1e-9, detail: `worst: ${pct(worst)}` }
      }
      case 'maxP99': {
        const worst = Math.max(0, ...run.phases.map((p) => p.p99Ms))
        return { goal, label, pass: worst <= goal.value, detail: `worst: ${worst} ms` }
      }
      case 'noSPOF':
        return {
          goal,
          label,
          pass: run.spofs.length === 0,
          detail: run.spofs.length ? `fragile: ${run.spofs.join(', ')}` : 'every critical part has a backup',
        }
      case 'hasBlock': {
        const n = design.nodes.filter((x) => x.block === goal.block).length
        return { goal, label, pass: n >= (goal.count ?? 1), detail: `${n} placed` }
      }
      case 'stateless': {
        const apps = design.nodes.filter((n) => roleOf(n.block) === 'app')
        const stateful = apps.filter(
          (a) =>
            !design.edges.some(
              (e) => e.from === a.id && design.nodes.find((n) => n.id === e.to)?.block === 'session-store',
            ),
        )
        return {
          goal,
          label,
          pass: apps.length > 0 && stateful.length === 0,
          detail: stateful.length ? `keeps sessions locally: ${stateful.map((s) => s.id).join(', ')}` : 'sessions are shared',
        }
      }
      case 'queueStable': {
        const backlog = Math.max(
          0,
          ...run.phases.flatMap((p) => Object.values(p.nodes).map((n) => n.backlog ?? 0)),
        )
        return { goal, label, pass: backlog === 0, detail: backlog ? `${Math.round(backlog)} tasks waiting` : 'queue drains' }
      }
      case 'maxBlocks': {
        const n = design.nodes.filter((x) => x.block !== 'client').length
        return { goal, label, pass: n <= goal.value, detail: `${n} placed` }
      }
    }
  })
}

export const allPass = (rs: GoalResult[]) => rs.every((r) => r.pass)
