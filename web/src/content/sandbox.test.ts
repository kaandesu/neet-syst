import { describe, expect, it } from 'vitest'
import { evaluateGoals } from '@/engine/sim/goals'
import { runScenario } from '@/engine/sim/solver'
import type { Design } from '@/engine/types'
import { all, column, design, ids, N } from './chapters/ch1/_kit'
import { CHAPTERS } from '.'
import { SANDBOX_CHALLENGES, type SandboxChallenge } from './sandbox'

const front = [N('c', 'client', 0, 200), N('dns', 'dns', 160, 200), N('lb', 'load-balancer', 320, 200)]

function tier(webs: number, extra: Design['nodes'], edges: [string, string][]): Design {
  const w = column('w', 'web-server', webs, 520)
  return design([...front, ...w, ...extra], [['c', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(w)), ...edges.flatMap(([a, b]) => (a === '*w' ? all(ids(w), [b]) : [[a, b] as [string, string]]))])
}

/** A design that clears each challenge using only the blocks it requires. */
const SOLUTIONS: Record<string, Design> = {
  hello: design([N('c', 'client', 0, 0), N('dns', 'dns', 160, 0), N('w', 'web-server', 320, 0)], [['c', 'dns'], ['dns', 'w']]),
  launch: tier(3, [N('db', 'sql-db', 760, 200)], [['*w', 'db']]),
  'read-storm': tier(8, [N('cache', 'cache', 760, 100), N('db', 'sql-db', 760, 300)], [['*w', 'cache'], ['*w', 'db']]),
  'no-spof': tier(
    4,
    [N('db', 'sql-db', 760, 200), N('r1', 'read-replica', 960, 120), N('r2', 'read-replica', 960, 280)],
    [['*w', 'db'], ['db', 'r1'], ['db', 'r2']],
  ),
  media: tier(3, [N('cdn', 'cdn', 160, 40), N('db', 'sql-db', 760, 200)], [['c', 'cdn'], ['*w', 'db']]),
  jobs: tier(
    2,
    [N('db', 'sql-db', 760, 100), N('q', 'message-queue', 760, 300), N('k1', 'worker', 960, 260), N('k2', 'worker', 960, 360)],
    [['*w', 'db'], ['*w', 'q'], ['q', 'k1'], ['q', 'k2']],
  ),
  'ten-k': tier(
    12,
    [
      N('k1', 'cache', 760, 0),
      N('k2', 'cache', 760, 120),
      N('db', 'sql-db', 760, 300),
      N('r1', 'read-replica', 960, 240),
      N('r2', 'read-replica', 960, 360),
    ],
    [['*w', 'k1'], ['*w', 'k2'], ['*w', 'db'], ['db', 'r1'], ['db', 'r2']],
  ),
}

const grade = (ch: SandboxChallenge, d: Design) => evaluateGoals(d, runScenario(d, { phases: [ch.phase] }), ch.goals)

const unlockable = new Set(CHAPTERS.flatMap((c) => c.lessons.flatMap((l) => l.unlocks)))

describe('sandbox challenges', () => {
  it('have unique ids', () => {
    expect(new Set(SANDBOX_CHALLENGES.map((c) => c.id)).size).toBe(SANDBOX_CHALLENGES.length)
  })

  for (const ch of SANDBOX_CHALLENGES) {
    describe(ch.id, () => {
      const solution = SOLUTIONS[ch.id]

      it('only needs blocks a lesson can unlock', () => {
        for (const b of ch.needs) expect(unlockable.has(b)).toBe(true)
      })

      it('is solvable with its own blocks', () => {
        expect(solution, `missing reference solution for ${ch.id}`).toBeDefined()
        const allowed = new Set([...ch.needs, 'client', 'dns', 'web-server', 'sql-db', 'nosql-db', 'worker', 'object-storage'])
        for (const n of solution.nodes) expect(allowed.has(n.block), `${ch.id} uses ${n.block}`).toBe(true)
        const failed = grade(ch, solution).filter((r) => !r.pass)
        expect(failed.map((r) => `${r.label}: ${r.detail}`)).toEqual([])
      })

      it('is not cleared by an empty canvas', () => {
        expect(grade(ch, design([N('c', 'client', 0, 0)])).every((r) => r.pass)).toBe(false)
      })

      if (ch.id !== 'hello')
        it('takes more than the first lesson’s design', () => {
          expect(grade(ch, SOLUTIONS.hello).every((r) => r.pass)).toBe(false)
        })
    })
  }
})
