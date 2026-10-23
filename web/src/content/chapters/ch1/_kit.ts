import type { BlockId, DEdge, DNode, Design, ScenarioPhase, Scenario } from '@/engine/types'

/** A node that ships with the level: movable, not deletable. */
export const N = (id: string, block: BlockId, x: number, y: number, extra: Partial<DNode> = {}): DNode => ({
  id,
  block,
  x,
  y,
  locked: true,
  ...extra,
})

export const E = (from: string, to: string): DEdge => ({ id: `${from}->${to}`, from, to })

export const design = (nodes: DNode[], edges: [string, string][] = []): Design => ({
  nodes,
  edges: edges.map(([a, b]) => E(a, b)),
})

/** Same as `design` but nodes are not locked (for reference solutions). */
export const free = (nodes: DNode[], edges: [string, string][] = []): Design => ({
  nodes: nodes.map((n) => ({ ...n, locked: false })),
  edges: edges.map(([a, b]) => E(a, b)),
})

export const EMPTY: Design = { nodes: [], edges: [] }

export const phase = (label: string, rps: number, extra: Partial<ScenarioPhase> = {}): ScenarioPhase => ({
  label,
  seconds: 4,
  rps,
  ...extra,
})

export const scenario = (...phases: ScenarioPhase[]): Scenario => ({ phases })

/** Lay out `count` nodes in a vertical column centered on `cy`. */
export const column = (prefix: string, block: BlockId, count: number, x: number, cy = 200, gap = 120): DNode[] =>
  Array.from({ length: count }, (_, i) => N(`${prefix}${i + 1}`, block, x, cy + (i - (count - 1) / 2) * gap))

/** Edges from every id in `from` to every id in `to`. */
export const all = (from: string[], to: string[]): [string, string][] => from.flatMap((a) => to.map((b) => [a, b] as [string, string]))

export const ids = (nodes: DNode[]) => nodes.map((n) => n.id)
