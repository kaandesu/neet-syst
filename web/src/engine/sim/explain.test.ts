import { describe, expect, it } from 'vitest'
import type { Design } from '../types'
import { bottleneck, culprits, explainNode } from './explain'
import { runScenario } from './solver'

const design = (nodes: [string, Design['nodes'][number]['block']][], links: [string, string][]): Design => ({
  nodes: nodes.map(([id, block]) => ({ id, block, x: 0, y: 0 })),
  edges: links.map(([from, to]) => ({ id: `${from}-${to}`, from, to })),
})

const single = design(
  [
    ['c', 'client'],
    ['w', 'web-server'],
    ['db', 'sql-db'],
  ],
  [
    ['c', 'w'],
    ['w', 'db'],
  ],
)

describe('explain', () => {
  it('blames an overloaded web server', () => {
    const run = runScenario(single, { phases: [{ label: 'peak', seconds: 10, rps: 1500 }] })
    expect(bottleneck(run)?.nodeId).toBe('w')
    expect(explainNode(run.phases[0].nodes.w)).toMatch(/^Overloaded/)
  })

  it('blames a dead database with no replica', () => {
    const run = runScenario(single, { phases: [{ label: 'chaos', seconds: 10, rps: 200, failures: [{ id: 'db' }] }] })
    expect(bottleneck(run)?.nodeId).toBe('db')
    expect(explainNode(run.phases[0].nodes.db)).toMatch(/^Down/)
  })

  it('finds nothing wrong with a healthy design', () => {
    const run = runScenario(single, { phases: [{ label: 'calm', seconds: 10, rps: 200 }] })
    expect(bottleneck(run)).toBeNull()
    expect(culprits(run)).toEqual([])
    expect(explainNode(run.phases[0].nodes.w)).toMatch(/^Comfortable/)
  })

  it('accepts any of several identical overloaded siblings', () => {
    const d = design(
      [
        ['c', 'client'],
        ['lb', 'load-balancer'],
        ['w1', 'web-server'],
        ['w2', 'web-server'],
        ['db', 'nosql-db'],
      ],
      [
        ['c', 'lb'],
        ['lb', 'w1'],
        ['lb', 'w2'],
        ['w1', 'db'],
        ['w2', 'db'],
      ],
    )
    const run = runScenario(d, { phases: [{ label: 'peak', seconds: 10, rps: 3000 }] })
    expect(culprits(run).sort()).toEqual(['w1', 'w2'])
  })
})
