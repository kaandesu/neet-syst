import type { Design, PhaseResult, ScenarioPhase } from '../types'
import { solvePhase, type SimOptions } from './solver'

export interface BreakingPoint {
  /** Highest traffic the design holds within the error budget. 0 = broken at any load; Infinity = past the search ceiling. */
  rps: number
  /** The part that gives out first just past the breaking point. */
  firstToFail: string | null
}

export const BREAK_CEILING = 1_000_000
const FLOOR = 1

/** The node dropping the most traffic, else the hottest one. */
export function weakest(p: PhaseResult): string | null {
  let best: string | null = null
  let score = 0
  for (const [id, r] of Object.entries(p.nodes)) {
    const s = r.status === 'down' ? 0 : r.droppedRps > 0 ? 1e9 + r.droppedRps : r.utilization
    if (s > score) {
      score = s
      best = id
    }
  }
  return best
}

/** Two significant figures, rounded down, so the shown number is always safe. */
const floor2 = (n: number) => {
  if (n < 10) return Math.floor(n)
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.floor(n / mag) * mag
}

/**
 * Find the most requests per second `design` can take before more than `maxErrorRate`
 * of them fail, by bisecting on a log scale. Everything except `rps` comes from `phase`.
 */
export function breakingPoint(design: Design, phase: ScenarioPhase, opts: SimOptions = {}, maxErrorRate = 0.01): BreakingPoint {
  const at = (rps: number) => solvePhase(design, { ...phase, rps }, opts)
  const holds = (rps: number) => at(rps).errorRate <= maxErrorRate + 1e-9
  if (!holds(FLOOR)) return { rps: 0, firstToFail: weakest(at(Math.max(FLOOR, phase.rps))) }
  if (holds(BREAK_CEILING)) return { rps: Infinity, firstToFail: null }
  let lo = Math.log(FLOOR)
  let hi = Math.log(BREAK_CEILING)
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (holds(Math.exp(mid))) lo = mid
    else hi = mid
  }
  return { rps: floor2(Math.exp(lo)), firstToFail: weakest(at(Math.exp(hi) * 1.05)) }
}
