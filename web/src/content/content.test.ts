import { describe, expect, it } from 'vitest'
import { autoPlay, simulateWhatIf } from '@/engine/lesson/runner'
import { lintDesign } from '@/engine/mentor/lint'
import type { BlockId } from '@/engine/types'
import { CHAPTERS, CHECKPOINTS, lessonById } from './index'

describe.each(CHAPTERS)('$title', (chapter) => {
  const unlockedBefore = new Map<string, Set<BlockId>>()
  const acc = new Set<BlockId>()
  for (const l of chapter.lessons) {
    unlockedBefore.set(l.id, new Set(acc))
    l.unlocks.forEach((b) => acc.add(b))
  }

  for (const lesson of chapter.lessons) {
    describe(lesson.title, () => {
      it('only offers blocks that are unlocked by now', () => {
        const allowed = new Set([...unlockedBefore.get(lesson.id)!, ...lesson.unlocks])
        for (const s of lesson.sections) for (const b of s.palette) expect(allowed, `${s.title}: ${b}`).toContain(b)
      })

      for (const section of lesson.sections) {
        it(`${section.kind}: "${section.title}" plays through as authored`, () => {
          // The first fork option is the "recommended" branch and must pass end to end.
          for (const entry of autoPlay(section, 0)) {
            const step = entry.step
            if (step.t === 'place') expect(section.palette, `place ${step.block}`).toContain(step.block)
            if (step.t !== 'simulate') continue
            const where = `${section.title} step ${entry.stepIndex} (${step.text})`
            if (step.expect === 'pass') expect(entry.passed, `${where} should pass`).toBe(true)
            if (step.expect === 'fail') expect(entry.passed, `${where} should fail`).toBe(false)
          }
        })
      }
    })
  }
})

describe.each(CHAPTERS)('$title incidents', (chapter) => {
  const unlockedBy = new Map<string, Set<BlockId>>()
  const acc = new Set<BlockId>()
  for (const l of chapter.lessons) {
    l.unlocks.forEach((b) => acc.add(b))
    unlockedBy.set(l.id, new Set(acc))
  }

  for (const inc of chapter.incidents ?? []) {
    it(`${inc.title} breaks, then its solution holds`, () => {
      expect(unlockedBy.has(inc.due!), `due lesson ${inc.due}`).toBe(true)
      for (const s of inc.sections) for (const b of s.palette) expect(unlockedBy.get(inc.due!), `${inc.id}: ${b}`).toContain(b)
      for (const e of autoPlay(inc.sections[0])) {
        if (e.step.t !== 'simulate') continue
        expect(e.passed, `${inc.id} step ${e.stepIndex}`).toBe(e.step.expect === 'pass')
      }
    })
  }
})

describe('design review', () => {
  const all = CHAPTERS.flatMap((c) => [...c.lessons, ...(c.incidents ?? [])])
  for (const l of all)
    for (const s of l.sections)
      it(`${l.title} / ${s.title}: passing designs have no wiring warnings`, () => {
        for (const e of autoPlay(s)) {
          if (e.step.t !== 'simulate' || e.step.expect !== 'pass') continue
          expect(lintDesign(e.design).map((f) => `${f.rule}:${f.nodeId}`), `step ${e.stepIndex}`).toEqual([])
        }
      })
})

describe('what-ifs', () => {
  const lessons = CHAPTERS.flatMap((c) => c.lessons)
  for (const l of lessons)
    for (const s of l.sections)
      for (const step of s.steps) {
        if (step.t !== 'reason') continue
        for (const o of step.options) {
          if (!o.tryIt) continue
          it(`${l.title}: "${o.text}" really fails when simulated`, () => {
            expect(o.correct, 'only wrong answers get a what-if').toBeFalsy()
            expect(simulateWhatIf(o.tryIt!).passed).toBe(false)
          })
        }
      }
})

describe('checkpoints', () => {
  for (const cp of Object.values(CHECKPOINTS)) {
    it(`${cp.title} has a passing solution`, () => {
      for (const section of cp.sections) {
        for (const e of autoPlay(section)) if (e.step.t === 'simulate' && e.step.expect === 'pass') expect(e.passed).toBe(true)
      }
    })
  }
})

describe('lesson ids', () => {
  it('are unique', () => {
    const ids = [...CHAPTERS.flatMap((c) => [...c.lessons, ...(c.incidents ?? [])]), ...Object.values(CHECKPOINTS)].map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('services', () => {
  it('sizing up handles the rush but dies with its one box', () => {
    const level = lessonById('services')!.sections.find((s) => s.kind === 'level')!
    const runs = autoPlay(level, 1).filter((e) => e.step.t === 'simulate')
    expect(runs.map((e) => e.passed)).toEqual([false, true, false, false])
  })
})
