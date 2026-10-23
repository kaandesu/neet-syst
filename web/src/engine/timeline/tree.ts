import type { Design } from '../types'
import type { StepAnswer } from '../lesson/types'

/**
 * The decision timeline: a tree of snapshots. Every completed step adds a
 * child of the current head. Rewinding moves the head back; completing a step
 * from there grows a new branch, so nothing is ever lost.
 */
export interface DecisionNode {
  id: string
  parentId: string | null
  /** Index of the step this node completed; -1 for the section start. */
  stepIndex: number
  design: Design
  answer?: StepAnswer
  note?: string
  at: number
}

export interface RunTree {
  nodes: Record<string, DecisionNode>
  rootId: string
  headId: string
  seq: number
}

export function createTree(start: Design, now = Date.now()): RunTree {
  const root: DecisionNode = { id: 'n0', parentId: null, stepIndex: -1, design: start, at: now }
  return { nodes: { n0: root }, rootId: 'n0', headId: 'n0', seq: 1 }
}

const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function commit(tree: RunTree, stepIndex: number, design: Design, answer?: StepAnswer, now = Date.now()): RunTree {
  // Re-doing the exact same thing reuses the existing branch.
  const existing = childrenOf(tree, tree.headId).find(
    (c) => c.stepIndex === stepIndex && sameJSON(c.design, design) && sameJSON(c.answer, answer),
  )
  if (existing) return { ...tree, headId: existing.id }
  const id = `n${tree.seq}`
  const node: DecisionNode = { id, parentId: tree.headId, stepIndex, design, answer, at: now }
  return { ...tree, nodes: { ...tree.nodes, [id]: node }, headId: id, seq: tree.seq + 1 }
}

export function rewind(tree: RunTree, nodeId: string): RunTree {
  return tree.nodes[nodeId] ? { ...tree, headId: nodeId } : tree
}

export function setNote(tree: RunTree, nodeId: string, note: string): RunTree {
  const n = tree.nodes[nodeId]
  if (!n) return tree
  return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...n, note } } }
}

export function childrenOf(tree: RunTree, id: string): DecisionNode[] {
  return Object.values(tree.nodes)
    .filter((n) => n.parentId === id)
    .sort((a, b) => a.at - b.at || Number(a.id.slice(1)) - Number(b.id.slice(1)))
}

/** Root → node, inclusive. */
export function pathTo(tree: RunTree, id: string): DecisionNode[] {
  const out: DecisionNode[] = []
  for (let n: DecisionNode | undefined = tree.nodes[id]; n; n = n.parentId ? tree.nodes[n.parentId] : undefined) out.unshift(n)
  return out
}

/** The furthest node reachable from `id` by always taking the newest child. */
export function tipOf(tree: RunTree, id: string): DecisionNode {
  let n = tree.nodes[id]
  for (;;) {
    const kids = childrenOf(tree, n.id)
    if (!kids.length) return n
    n = kids[kids.length - 1]
  }
}

export function leaves(tree: RunTree): DecisionNode[] {
  return Object.values(tree.nodes).filter((n) => childrenOf(tree, n.id).length === 0)
}

export const head = (tree: RunTree) => tree.nodes[tree.headId]
