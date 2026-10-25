import { describe, expect, it } from 'vitest'
import type { BlockId, Design, ScenarioPhase } from '../types'
import { breakingPoint } from './capacity'
import { solvePhase } from './solver'

function d(nodes: [string, BlockId][], edges: [string, string][]): Design {
  return {
    nodes: nodes.map(([id, block]) => ({ id, block, x: 0, y: 0 })),
    edges: edges.map(([from, to]) => ({ id: `${from}-${to}`, from, to })),
  }
}

const phase: ScenarioPhase = { label: 't', seconds: 10, rps: 100 }

const single = d(
  [
    ['c', 'client'],
    ['dns', 'dns'],
    ['w', 'web-server'],
  ],
  [
    ['c', 'dns'],
    ['dns', 'w'],
  ],
)

const balanced = d(
  [
    ['c', 'client'],
    ['dns', 'dns'],
    ['lb', 'load-balancer'],
    ['w1', 'web-server'],
    ['w2', 'web-server'],
    ['db', 'sql-db'],
  ],
  [
    ['c', 'dns'],
    ['dns', 'lb'],
    ['lb', 'w1'],
    ['lb', 'w2'],
    ['w1', 'db'],
    ['w2', 'db'],
  ],
)

describe('breakingPoint', () => {
  it('finds where one server with local storage gives out', () => {
    // Each read costs 2 units on a 1,000-unit server, so ~500 req/s plus the 1% error budget.
    const bp = breakingPoint(single, phase)
    expect(bp.rps).toBeGreaterThanOrEqual(490)
    expect(bp.rps).toBeLessThanOrEqual(510)
    expect(bp.firstToFail).toBe('w')
  })

  it('reports a number the design actually survives', () => {
    for (const design of [single, balanced]) {
      const bp = breakingPoint(design, phase)
      expect(solvePhase(design, { ...phase, rps: bp.rps }).errorRate).toBeLessThanOrEqual(0.01)
    }
  })

  it('goes up when you scale out', () => {
    expect(breakingPoint(balanced, phase).rps).toBeGreaterThan(breakingPoint(single, phase).rps * 2)
  })

  it('is 0 when nothing can serve requests', () => {
    const orphan = d([['c', 'client'], ['w', 'web-server']], [])
    expect(breakingPoint(orphan, phase).rps).toBe(0)
  })

  it('counts failed nodes from the phase', () => {
    const healthy = breakingPoint(balanced, phase).rps
    const degraded = breakingPoint(balanced, { ...phase, failures: [{ id: 'w1' }] }).rps
    expect(degraded).toBeLessThan(healthy)
    expect(degraded).toBeGreaterThan(0)
  })
})
