import { describe, expect, it } from 'vitest'
import { blockCount, judge, runTest } from '@/engine/problems/judge'
import { lintDesign } from '@/engine/mentor/lint'
import { CHAPTERS } from '.'
import { PROBLEMS } from './problems'

const unlockable = new Set(['client', ...CHAPTERS.flatMap((c) => c.lessons.flatMap((l) => l.unlocks))])

describe('problems', () => {
  it('have unique ids and numbers', () => {
    expect(new Set(PROBLEMS.map((p) => p.id)).size).toBe(PROBLEMS.length)
    expect(new Set(PROBLEMS.map((p) => p.number)).size).toBe(PROBLEMS.length)
  })

  for (const p of PROBLEMS) {
    describe(p.id, () => {
      it('reference solution passes every test', () => {
        const v = judge(p, p.solution, { hidden: true })
        const failed = v.results
          .filter((r) => !r.pass)
          .map((r) => `${r.test.label}: ${r.goals.filter((g) => !g.pass).map((g) => `${g.label} (${g.detail})`).join(', ')}`)
        expect(failed).toEqual([])
      })

      it('skeleton fails at least one test', () => {
        expect(judge(p, p.skeleton, { hidden: true }).pass).toBe(false)
      })

      it('has at least one visible and one hidden test', () => {
        expect(p.tests.some((t) => !t.hidden)).toBe(true)
        expect(p.tests.some((t) => t.hidden)).toBe(true)
      })

      it('par matches the reference solution', () => {
        expect(blockCount(p.solution)).toBe(p.par)
      })

      it('solution only uses palette and skeleton blocks', () => {
        const allowed = new Set([...p.palette, ...p.skeleton.nodes.map((n) => n.block)])
        for (const n of p.solution.nodes) expect(allowed.has(n.block), `${p.id} uses ${n.block}`).toBe(true)
        for (const b of p.palette) expect(unlockable.has(b), `${b} is never unlocked`).toBe(true)
      })

      it('solution keeps every skeleton node', () => {
        const ids = new Set(p.solution.nodes.map((n) => n.id))
        for (const n of p.skeleton.nodes) expect(ids.has(n.id), `${p.id} drops ${n.id}`).toBe(true)
      })

      it('solution trips no wiring lint', () => {
        expect(lintDesign(p.solution).map((f) => f.text)).toEqual([])
      })

      if (p.trap) {
        const trap = p.trap.design
        it('trap passes the visible tests but not the hidden ones', () => {
          expect(judge(p, trap, { hidden: false }).pass).toBe(true)
          expect(judge(p, trap, { hidden: true }).pass).toBe(false)
        })
      } else {
        it('some hidden test fails the skeleton', () => {
          const hidden = p.tests.map((t, i) => [t, i] as const).filter(([t]) => t.hidden)
          expect(hidden.some(([t, i]) => !runTest(p, p.skeleton, t, i).pass)).toBe(true)
        })
      }
    })
  }
})
