import type { BlockId, DNode, Design } from '../types'
import { runScenario, wouldCreateCycle } from '../sim/solver'
import { allPass, evaluateGoals, type GoalResult } from '../sim/goals'
import type { BlockMatch, DesignPatch, Section, Step, StepAnswer, WhatIf } from './types'

export const matches = (block: BlockId, m: BlockMatch) => (Array.isArray(m) ? m.includes(block) : block === m)

export function countEdges(design: Design, from: BlockMatch, to: BlockMatch): number {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  return design.edges.filter((e) => {
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    return a && b && matches(a.block, from) && matches(b.block, to)
  }).length
}

/** Whether a canvas-action step (place / connect) is done in this design. */
export function isActionDone(step: Step, design: Design): boolean {
  if (step.t === 'place') return design.nodes.filter((n) => n.block === step.block).length >= step.count
  if (step.t === 'connect') return countEdges(design, step.from, step.to) >= (step.count ?? 1)
  if (step.t === 'disconnect') return countEdges(design, step.from, step.to) === 0
  return false
}

export function nextNodeId(design: Design, block: BlockId): string {
  const used = new Set(design.nodes.map((n) => n.id))
  for (let i = 1; ; i++) {
    const id = `${block}-${i}`
    if (!used.has(id)) return id
  }
}

export function nextEdgeId(design: Design, from: string, to: string): string {
  const used = new Set(design.edges.map((e) => e.id))
  let id = `${from}->${to}`
  for (let i = 2; used.has(id); i++) id = `${from}->${to}#${i}`
  return id
}

export function addNode(design: Design, block: BlockId, x: number, y: number): { design: Design; node: DNode } {
  const node: DNode = { id: nextNodeId(design, block), block, x, y }
  return { design: { ...design, nodes: [...design.nodes, node] }, node }
}

export function canConnect(design: Design, from: string, to: string): boolean {
  if (from === to) return false
  if (design.edges.some((e) => e.from === from && e.to === to)) return false
  return !wouldCreateCycle(design, from, to)
}

export function addEdge(design: Design, from: string, to: string): Design {
  if (!canConnect(design, from, to)) return design
  return { ...design, edges: [...design.edges, { id: nextEdgeId(design, from, to), from, to }] }
}

export function removeNodes(design: Design, ids: string[]): Design {
  const drop = new Set(design.nodes.filter((n) => ids.includes(n.id) && !n.locked).map((n) => n.id))
  return {
    nodes: design.nodes.filter((n) => !drop.has(n.id)),
    edges: design.edges.filter((e) => !drop.has(e.from) && !drop.has(e.to)),
  }
}

export function removeEdgesBetween(design: Design, from: BlockMatch, to: BlockMatch): Design {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  return {
    ...design,
    edges: design.edges.filter((e) => !(matches(byId.get(e.from)!.block, from) && matches(byId.get(e.to)!.block, to))),
  }
}

export function removeEdges(design: Design, ids: string[]): Design {
  return { ...design, edges: design.edges.filter((e) => !ids.includes(e.id)) }
}

export function applyPatch(design: Design, patch: DesignPatch): Design {
  let next: Design = { nodes: [...design.nodes], edges: [...design.edges] }
  for (const n of patch.addNodes ?? []) {
    if (!next.nodes.some((x) => x.id === n.id)) next.nodes.push({ ...n })
  }
  for (const e of patch.addEdges ?? []) next = addEdge(next, e.from, e.to)
  for (const { id, props } of patch.setProps ?? []) {
    next.nodes = next.nodes.map((n) => (n.id === id ? { ...n, ...props } : n))
  }
  return next
}

/** Run a reason option's "simulate it anyway" scenario. */
export function simulateWhatIf(w: WhatIf) {
  const run = runScenario(w.design, w.scenario, { zones: w.zones })
  const goals = evaluateGoals(w.design, run, w.goals)
  return { run, goals, passed: allPass(goals) }
}

export function simulate(section: Section, design: Design, step: Extract<Step, { t: 'simulate' }>) {
  const run = runScenario(design, step.scenario, { zones: section.zones })
  const goals: GoalResult[] = evaluateGoals(design, run, step.goals ?? section.goals)
  return { run, goals, passed: allPass(goals) }
}

/* ------------------------------------------------------------------------ */
/* Auto-play: the "ideal student". Used by content tests and the dev skip.   */
/* ------------------------------------------------------------------------ */

function autoPlace(design: Design, step: Extract<Step, { t: 'place' }>): Design {
  let d = design
  while (d.nodes.filter((n) => n.block === step.block).length < step.count) {
    const pos = step.slot ?? { x: 100 + d.nodes.length * 40, y: 300 }
    d = addNode(d, step.block, pos.x, pos.y).design
  }
  return d
}

function autoConnect(design: Design, step: Extract<Step, { t: 'connect' }>): Design {
  let d = design
  const target = step.count ?? 1
  const froms = d.nodes.filter((n) => matches(n.block, step.from))
  const tos = d.nodes.filter((n) => matches(n.block, step.to))
  // Prefer giving every source an edge first, then every target.
  for (const a of froms) {
    for (const b of tos) {
      if (countEdges(d, step.from, step.to) >= target) return d
      const aHas = d.edges.some((e) => e.from === a.id && tos.some((t) => t.id === e.to))
      const bHas = d.edges.some((e) => e.to === b.id && froms.some((f) => f.id === e.from))
      if (aHas && bHas) continue
      d = addEdge(d, a.id, b.id)
    }
  }
  for (const a of froms) for (const b of tos) if (countEdges(d, step.from, step.to) < target) d = addEdge(d, a.id, b.id)
  return d
}

/** The answer an ideal learner gives (first fork option, correct reason, exact estimate). */
export function idealAnswer(step: Step, entry?: Pick<AutoPlayLog, 'passed' | 'errorRate' | 'p99Ms'>): StepAnswer | undefined {
  switch (step.t) {
    case 'reason':
      return { t: 'reason', optionId: step.options.find((o) => o.correct)?.id ?? step.options[0].id, attempts: 1 }
    case 'fork':
      return { t: 'fork', optionId: step.options[0].id }
    case 'requirements':
      return { t: 'requirements', picks: step.items.map((i) => i.inScope), attempts: 1 }
    case 'estimate':
      return { t: 'estimate', value: step.answer, attempts: 1 }
    case 'simulate':
      return { t: 'simulate', passed: !!entry?.passed, errorRate: entry?.errorRate ?? 0, p99Ms: entry?.p99Ms ?? 0 }
    default:
      return undefined
  }
}

export interface AutoPlayLog {
  stepIndex: number
  step: Step
  design: Design
  passed?: boolean
  errorRate?: number
  p99Ms?: number
}

/** Plays a section with the "right" action at every step (fork option `forkPick`). */
export function autoPlay(section: Section, forkPick = 0): AutoPlayLog[] {
  let design: Design = section.startDesign
  const log: AutoPlayLog[] = []
  section.steps.forEach((step, stepIndex) => {
    if (step.t === 'place') design = autoPlace(design, step)
    if (step.t === 'connect') design = autoConnect(design, step)
    if (step.t === 'disconnect') design = removeEdgesBetween(design, step.from, step.to)
    if (step.t === 'fork') design = applyPatch(design, step.options[Math.min(forkPick, step.options.length - 1)].patch)
    if (step.t === 'simulate') {
      if (step.solution) design = step.solution
      const r = simulate(section, design, step)
      const errorRate = Math.max(...r.run.phases.map((p) => p.errorRate))
      log.push({ stepIndex, step, design, passed: r.passed, errorRate, p99Ms: Math.max(...r.run.phases.map((p) => p.p99Ms)) })
      return
    }
    log.push({ stepIndex, step, design })
  })
  return log
}
