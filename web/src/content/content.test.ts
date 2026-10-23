import { describe, expect, it } from 'vitest'
import { autoPlay } from '@/engine/lesson/runner'
import type { BlockId } from '@/engine/types'
import { CHAPTERS, CHECKPOINTS } from './index'

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
    const ids = [...CHAPTERS.flatMap((c) => c.lessons), ...Object.values(CHECKPOINTS)].map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
