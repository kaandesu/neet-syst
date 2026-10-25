import type { NodeResult, SimRun } from '../types'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (n: number) => `${Math.round(n * 100)}%`

/** Plain-English reason for a node's colour after a sim phase. */
export function explainNode(r: NodeResult): string {
  if (r.status === 'down') return 'Down: every request sent here fails.'
  if (r.backlog) return `Falling behind: ${fmt(r.backlog)} tasks waiting in the queue.`
  if (r.inRps <= 0) return 'Idle: no traffic reaches this.'
  if (r.utilization > 1)
    return `Overloaded: ${fmt(r.load)} units/s of work against ${fmt(r.capacity)} capacity → ${pct(1 - 1 / r.utilization)} dropped.`
  if (r.droppedRps > 0) return `Rejecting ${fmt(r.droppedRps)} req/s it can't handle.`
  if (r.utilization >= 0.85) return `Running hot (${pct(r.utilization)}): latency climbs steeply near the limit.`
  if (r.utilization >= 0.6) return `Busy (${pct(r.utilization)}): latency starts rising above 60%.`
  return `Comfortable (${pct(r.utilization)} of capacity).`
}

export interface Bottleneck {
  nodeId: string
  phaseIndex: number
}

/** The part that hurt the most: biggest drops, else the hottest node or the biggest backlog. */
export function bottleneck(run: SimRun): Bottleneck | null {
  let best: Bottleneck | null = null
  let bestScore = 0
  run.phases.forEach((p, phaseIndex) => {
    for (const [nodeId, r] of Object.entries(p.nodes)) {
      // Drops dominate; then backlogs; then heat above 85%.
      const score = r.droppedRps > 0 ? 1e6 + r.droppedRps : r.backlog ? 1e3 + r.backlog / 1e3 : r.utilization >= 0.85 ? r.utilization : 0
      if (score > bestScore) {
        bestScore = score
        best = { nodeId, phaseIndex }
      }
    }
  })
  return best
}

/** Nodes a learner may fairly blame: the bottleneck plus anything nearly as bad (e.g. identical siblings). */
export function culprits(run: SimRun): string[] {
  const b = bottleneck(run)
  if (!b) return []
  const worst = new Map<string, NodeResult>()
  for (const p of run.phases)
    for (const [id, r] of Object.entries(p.nodes)) {
      const prev = worst.get(id)
      if (!prev || r.droppedRps > prev.droppedRps || (r.backlog ?? 0) > (prev.backlog ?? 0) || r.utilization > prev.utilization)
        worst.set(id, r)
    }
  const top = worst.get(b.nodeId)!
  const ids = [...worst.entries()].filter(([, r]) => {
    if (top.droppedRps > 0) return r.droppedRps >= top.droppedRps * 0.8
    if (top.backlog) return (r.backlog ?? 0) >= top.backlog * 0.8
    return r.utilization >= 0.85
  })
  return [...new Set([b.nodeId, ...ids.map(([id]) => id)])]
}
