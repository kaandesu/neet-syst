import { describe, expect, it } from 'vitest'
import type { BlockId, Design, ScenarioPhase } from '../types'
import { findSpofs, solvePhase, wouldCreateCycle } from './solver'

/** Tiny builder: `d(['c','client'],['w','web-server']).link('c','w')` */
function d(...nodes: [string, BlockId, Partial<{ x: number; y: number; sticky: boolean }>?][]) {
  const design: Design = {
    nodes: nodes.map(([id, block, extra]) => ({ id, block, x: extra?.x ?? 0, y: extra?.y ?? 0, sticky: extra?.sticky })),
    edges: [],
  }
  const api = {
    design,
    link(...pairs: [string, string][]) {
      for (const [from, to] of pairs) design.edges.push({ id: `${from}-${to}`, from, to })
      return api
    },
  }
  return api
}

const phase = (p: Partial<ScenarioPhase>): ScenarioPhase => ({ label: 't', seconds: 10, rps: 100, ...p })

describe('single server', () => {
  const { design } = d(['c', 'client'], ['dns', 'dns'], ['w', 'web-server']).link(['c', 'dns'], ['dns', 'w'])

  it('serves light traffic without errors', () => {
    const r = solvePhase(design, phase({ rps: 200 }))
    expect(r.errorRate).toBe(0)
    expect(r.nodes.w.status).toBe('ok')
  })

  it('melts when local storage doubles the work', () => {
    // 600 reads cost 600 (logic) + 600 (local disk) = 1200 > 1000 capacity
    const r = solvePhase(design, phase({ rps: 600 }))
    expect(r.nodes.w.utilization).toBeCloseTo(1.2)
    expect(r.errorRate).toBeGreaterThan(0.1)
    expect(r.p99Ms).toBeGreaterThan(300)
  })
})

describe('separate database', () => {
  const { design } = d(['c', 'client'], ['w', 'web-server'], ['db', 'sql-db']).link(['c', 'w'], ['w', 'db'])

  it('moves storage work off the web server', () => {
    const r = solvePhase(design, phase({ rps: 600, writeRatio: 0.1 }))
    expect(r.errorRate).toBe(0)
    expect(r.nodes.w.utilization).toBeCloseTo(0.6)
    expect(r.nodes.db.load).toBeCloseTo(540 + 120)
  })

  it('a full database rejects writes', () => {
    const r = solvePhase(design, phase({ rps: 100, writeRatio: 0.5, dataGB: 1500 }))
    expect(r.errorRate).toBeCloseTo(0.5)
    expect(r.warnings.some((w) => w.includes('full'))).toBe(true)
  })
})

describe('load balancer', () => {
  const { design } = d(
    ['c', 'client'],
    ['lb', 'load-balancer'],
    ['w1', 'web-server'],
    ['w2', 'web-server'],
    ['db', 'nosql-db'],
  ).link(['c', 'lb'], ['lb', 'w1'], ['lb', 'w2'], ['w1', 'db'], ['w2', 'db'])

  it('splits load across servers', () => {
    const r = solvePhase(design, phase({ rps: 1600 }))
    expect(r.nodes.w1.inRps).toBeCloseTo(800)
    expect(r.nodes.w2.inRps).toBeCloseTo(800)
    expect(r.errorRate).toBe(0)
  })

  it('routes around a dead server', () => {
    const r = solvePhase(design, phase({ rps: 800, failures: [{ id: 'w1' }] }))
    expect(r.nodes.w1.status).toBe('down')
    expect(r.nodes.w2.inRps).toBeCloseTo(800)
    expect(r.errorRate).toBe(0)
  })

  it('logs users out when sessions are local and the LB is not sticky', () => {
    const r = solvePhase(design, phase({ rps: 400, writeRatio: 0.2, sessions: true }))
    expect(r.errorRate).toBeCloseTo(0.1) // half of the 20% writes
  })

  it('reports the database as the only single point of failure', () => {
    expect(findSpofs(design, phase({ rps: 400 }))).toEqual(['db'])
  })
})

describe('cache', () => {
  const base = () =>
    d(['c', 'client'], ['w', 'web-server'], ['k', 'cache'], ['db', 'sql-db']).link(['c', 'w'], ['w', 'k'], ['w', 'db'])

  it('absorbs most reads (cache-aside)', () => {
    const r = solvePhase(base().design, phase({ rps: 900 }))
    expect(r.nodes.k.inRps).toBeCloseTo(720)
    expect(r.nodes.db.inRps).toBeCloseTo(180)
  })

  it('a flushed cache sends everything to the DB (thundering herd)', () => {
    const r = solvePhase(base().design, phase({ rps: 900, failures: [{ block: 'cache' }] }))
    expect(r.nodes.db.inRps).toBeCloseTo(900)
  })

  it('works as read-through when placed in front of the DB', () => {
    const { design } = d(['c', 'client'], ['w', 'web-server'], ['k', 'cache'], ['db', 'sql-db']).link(
      ['c', 'w'],
      ['w', 'k'],
      ['k', 'db'],
    )
    const r = solvePhase(design, phase({ rps: 500, writeRatio: 0.2 }))
    expect(r.nodes.db.inRps).toBeCloseTo(400 * 0.2 + 100)
    expect(r.errorRate).toBe(0)
  })
})

describe('replication', () => {
  const { design } = d(['c', 'client'], ['w', 'web-server'], ['p', 'sql-db'], ['r', 'read-replica']).link(
    ['c', 'w'],
    ['w', 'p'],
    ['w', 'r'],
  )

  it('sends reads to replicas and writes to the primary', () => {
    const r = solvePhase(design, phase({ rps: 500, writeRatio: 0.1 }))
    expect(r.nodes.r.inRps).toBeCloseTo(450)
    expect(r.nodes.p.inRps).toBeCloseTo(50)
  })

  it('a primary hands reads to its replicas and promotes one on failure', () => {
    const chain = d(['c', 'client'], ['w', 'web-server'], ['p', 'sql-db'], ['r1', 'read-replica'], ['r2', 'read-replica']).link(
      ['c', 'w'],
      ['w', 'p'],
      ['p', 'r1'],
      ['p', 'r2'],
    ).design
    const calm = solvePhase(chain, phase({ rps: 600, writeRatio: 0.1, queryCost: 3 }))
    expect(calm.nodes.r1.load).toBeCloseTo(270 * 3)
    expect(calm.nodes.p.load).toBeCloseTo(60 * 2)
    const dead = solvePhase(chain, phase({ rps: 600, writeRatio: 0.1, failures: [{ id: 'p' }] }))
    expect(dead.errorRate).toBe(0)
    expect(dead.nodes.r1.inRps).toBeCloseTo(270 + 60)
  })

  it('promotes a replica when the primary dies', () => {
    const r = solvePhase(design, phase({ rps: 500, writeRatio: 0.1, failures: [{ block: 'sql-db' }] }))
    expect(r.errorRate).toBe(0)
    expect(r.warnings.some((w) => w.includes('promoted'))).toBe(true)
  })
})

describe('cdn and regions', () => {
  it('serves static files at the edge', () => {
    const { design } = d(['c', 'client'], ['cdn', 'cdn'], ['s', 'object-storage'], ['w', 'web-server']).link(
      ['c', 'cdn'],
      ['cdn', 's'],
      ['c', 'w'],
    )
    const r = solvePhase(design, phase({ rps: 1000, staticRatio: 0.6 }))
    expect(r.nodes.w.inRps).toBeCloseTo(400)
    expect(r.nodes.s.inRps).toBeCloseTo(30)
  })

  it('far-away users pay a cross-region round trip', () => {
    const { design } = d(['c', 'client'], ['dns', 'dns'], ['w', 'web-server']).link(['c', 'dns'], ['dns', 'w'])
    const near = solvePhase(design, phase({ rps: 100, euShare: 0 })).p99Ms
    const far = solvePhase(design, phase({ rps: 100, euShare: 0.5 })).p99Ms
    expect(far - near).toBeGreaterThanOrEqual(150)
  })

  it('geo DNS keeps EU users in the EU and fails over on outage', () => {
    const zones = [{ id: 'eu' as const, label: 'EU', x: 1000, y: 0, w: 1000, h: 1000 }]
    const { design } = d(
      ['c', 'client'],
      ['g', 'geo-dns'],
      ['wn', 'web-server'],
      ['we', 'web-server', { x: 1100, y: 10 }],
    ).link(['c', 'g'], ['g', 'wn'], ['g', 'we'])
    const calm = solvePhase(design, phase({ rps: 400, euShare: 0.5 }), { zones })
    expect(calm.nodes.we.inRps).toBeCloseTo(200)
    const outage = solvePhase(design, phase({ rps: 400, euShare: 0.5, failures: [{ region: 'eu' }] }), { zones })
    expect(outage.nodes.wn.inRps).toBeCloseTo(400)
    expect(outage.errorRate).toBe(0)
  })
})

describe('queues and sharding', () => {
  it('slow inline tasks crush the web server; a queue fixes it', () => {
    const inline = d(['c', 'client'], ['w', 'web-server'], ['db', 'sql-db']).link(['c', 'w'], ['w', 'db'])
    const r1 = solvePhase(inline.design, phase({ rps: 500, taskRatio: 0.1 }))
    expect(r1.errorRate).toBeGreaterThan(0.3)

    const queued = d(['c', 'client'], ['w', 'web-server'], ['db', 'sql-db'], ['q', 'message-queue'], ['k', 'worker']).link(
      ['c', 'w'],
      ['w', 'db'],
      ['w', 'q'],
      ['q', 'k'],
    )
    const r2 = solvePhase(queued.design, phase({ rps: 500, taskRatio: 0.1 }))
    expect(r2.errorRate).toBe(0)
    expect(r2.nodes.k.backlog).toBe(0)
  })

  it('shards split data and hot keys overload one shard', () => {
    const { design } = d(['c', 'client'], ['w', 'web-server'], ['sr', 'shard-router'], ['s1', 'sql-db'], ['s2', 'sql-db']).link(
      ['c', 'w'],
      ['w', 'sr'],
      ['sr', 's1'],
      ['sr', 's2'],
    )
    const ok = solvePhase(design, phase({ rps: 600, writeRatio: 0.5, dataGB: 1800 }))
    expect(ok.errorRate).toBe(0)
    const hot = solvePhase(design, phase({ rps: 900, writeRatio: 0.5, hotKeyShare: 0.8 }))
    expect(hot.nodes.s1.inRps).toBeGreaterThan(hot.nodes.s2.inRps * 5)
  })

  it('detects cycles', () => {
    const { design } = d(['a', 'web-server'], ['b', 'cache']).link(['a', 'b'])
    expect(wouldCreateCycle(design, 'b', 'a')).toBe(true)
    expect(wouldCreateCycle(design, 'a', 'b')).toBe(false)
  })
})
