import { describe, expect, it } from 'vitest'
import type { Design } from '../types'
import { childrenOf, commit, createTree, head, leaves, pathTo, rewind } from './tree'

const design = (n: number): Design => ({
  nodes: Array.from({ length: n }, (_, i) => ({ id: `w${i}`, block: 'web-server', x: 0, y: 0 })),
  edges: [],
})

describe('decision tree', () => {
  it('grows a linear history', () => {
    let t = createTree(design(0), 0)
    t = commit(t, 0, design(1), undefined, 1)
    t = commit(t, 1, design(2), undefined, 2)
    expect(pathTo(t, t.headId).map((n) => n.stepIndex)).toEqual([-1, 0, 1])
  })

  it('branches after a rewind and keeps the old branch intact', () => {
    let t = createTree(design(0), 0)
    t = commit(t, 0, design(1), { t: 'fork', optionId: 'sql' }, 1)
    const forkSql = t.headId
    t = commit(t, 1, design(2), undefined, 2)
    const sqlTip = t.headId

    t = rewind(t, t.rootId)
    expect(head(t).design).toEqual(design(0))
    t = commit(t, 0, design(1), { t: 'fork', optionId: 'nosql' }, 3)

    expect(childrenOf(t, t.rootId)).toHaveLength(2)
    expect(t.nodes[sqlTip].parentId).toBe(forkSql)
    expect(leaves(t)).toHaveLength(2)
  })

  it('reuses a branch when the same choice is repeated', () => {
    let t = createTree(design(0), 0)
    t = commit(t, 0, design(1), { t: 'fork', optionId: 'sql' }, 1)
    const first = t.headId
    t = rewind(t, t.rootId)
    t = commit(t, 0, design(1), { t: 'fork', optionId: 'sql' }, 2)
    expect(t.headId).toBe(first)
  })
})
