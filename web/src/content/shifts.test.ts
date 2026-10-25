import { describe, expect, it } from 'vitest'
import { lintDesign } from '@/engine/mentor/lint'
import { blockCount } from '@/engine/problems/judge'
import { runShift } from '@/engine/shifts/score'
import { CHAPTERS } from '.'
import { SHIFTS } from './shifts'

describe('shifts', () => {
  it('have unique ids', () => {
    expect(new Set(SHIFTS.map((s) => s.id)).size).toBe(SHIFTS.length)
  })

  for (const s of SHIFTS) {
    describe(s.id, () => {
      const chapter = CHAPTERS.find((c) => c.id === s.chapter)
      const at = chapter?.lessons.findIndex((l) => l.id === s.after) ?? -1

      it('opens after a lesson in its chapter', () => {
        expect(at).toBeGreaterThanOrEqual(0)
      })

      it('reference solution survives every wave with three stars', () => {
        const r = runShift(s, s.solution)
        expect(r.goals.filter((g) => !g.pass).map((g) => `${g.label} (${g.detail})`)).toEqual([])
        expect(r.stars).toBe(3)
      })

      it('starting design falls over', () => {
        expect(runShift(s, s.start).survived).toBe(false)
      })

      it('par matches the reference solution', () => {
        expect(blockCount(s.solution)).toBe(s.par)
      })

      it('solution only uses blocks earned by the time the shift opens', () => {
        const earned = new Set(['client', ...chapter!.lessons.slice(0, at + 1).flatMap((l) => l.unlocks), ...s.start.nodes.map((n) => n.block)])
        for (const n of s.solution.nodes) expect(earned.has(n.block), `${s.id} uses ${n.block}`).toBe(true)
      })

      it('solution keeps every locked starting node and trips no wiring lint', () => {
        const ids = new Set(s.solution.nodes.map((n) => n.id))
        for (const n of s.start.nodes.filter((x) => x.locked)) expect(ids.has(n.id), `${s.id} drops ${n.id}`).toBe(true)
        expect(lintDesign(s.solution).map((f) => f.text)).toEqual([])
      })

      it('has a line for every wave and at least one hint', () => {
        expect(s.waves.every((w) => w.line.length > 0)).toBe(true)
        expect(s.hints.length).toBeGreaterThan(0)
      })
    })
  }
})
