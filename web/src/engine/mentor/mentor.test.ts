import { describe, expect, it } from 'vitest'
import type { Design } from '../types'
import { lintDesign } from './lint'
import { react, type Reaction } from './reactions'

const d = (nodes: [string, Design['nodes'][number]['block']][], edges: [string, string][]): Design => ({
  nodes: nodes.map(([id, block]) => ({ id, block, x: 0, y: 0 })),
  edges: edges.map(([from, to]) => ({ id: `${from}-${to}`, from, to })),
})

describe('lintDesign', () => {
  it('passes a correctly wired stack', () => {
    const good = d(
      [
        ['c', 'client'],
        ['dns', 'dns'],
        ['lb', 'load-balancer'],
        ['w1', 'web-server'],
        ['w2', 'web-server'],
        ['db', 'sql-db'],
        ['r', 'read-replica'],
      ],
      [
        ['c', 'dns'],
        ['dns', 'lb'],
        ['lb', 'w1'],
        ['lb', 'w2'],
        ['w1', 'db'],
        ['w2', 'db'],
        ['db', 'r'],
      ],
    )
    expect(lintDesign(good)).toEqual([])
  })

  it('flags the classic wiring mistakes', () => {
    const bad = d(
      [
        ['c', 'client'],
        ['dns', 'dns'],
        ['lb', 'load-balancer'],
        ['w1', 'web-server'],
        ['db', 'sql-db'],
        ['r', 'read-replica'],
        ['q', 'message-queue'],
      ],
      [
        ['c', 'dns'],
        ['c', 'lb'],
        ['lb', 'w1'],
        ['w1', 'r'],
        ['w1', 'q'],
      ],
    )
    const rules = lintDesign(bad).map((f) => `${f.rule}:${f.nodeId}`)
    expect(rules).toEqual(expect.arrayContaining(['skips-dns:c', 'lb-single:lb', 'unreachable:db', 'replica-orphan:r', 'queue-no-worker:q']))
  })
})

describe('react', () => {
  const rules: Reaction[] = [
    { on: 'predict-wrong', block: 'sql-db', lines: ['DB: {note}'] },
    { on: 'fix-failed', needsPast: true, lines: ['Like {past}.'] },
    { on: 'fix-failed', minAttempts: 2, lines: ['Second try.'] },
    { on: 'fix-failed', lines: ['First.', 'Again.'] },
  ]

  it('prefers the most specific matching rule', () => {
    expect(react(rules, { event: 'predict-wrong', lessonKind: 'unit', attempts: 1, block: 'sql-db', note: 'full' })?.text).toBe('DB: full')
    expect(react(rules, { event: 'predict-wrong', lessonKind: 'unit', attempts: 1, block: 'cache' })).toBeNull()
  })

  it('uses memory, then attempts, then rotates variants', () => {
    expect(react(rules, { event: 'fix-failed', lessonKind: 'unit', attempts: 1, past: 'Caching' })?.text).toBe('Like Caching.')
    expect(react(rules, { event: 'fix-failed', lessonKind: 'unit', attempts: 2 })?.text).toBe('Second try.')
    expect(react(rules, { event: 'fix-failed', lessonKind: 'unit', attempts: 1 }, 1)?.text).toBe('Again.')
  })
})
