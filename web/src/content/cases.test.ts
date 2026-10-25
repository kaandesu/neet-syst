import { describe, expect, it } from 'vitest'
import { evaluateApi } from '@/engine/api/rules'
import { autoPlay, simulate } from '@/engine/lesson/runner'
import { lintDesign } from '@/engine/mentor/lint'
import { testBefore } from '@/features/cases/RevealCard'
import { CASES } from './cases'
import { lessonById } from './index'

describe.each(CASES)('$company case', ({ lesson }) => {
  it('is reachable by id', () => {
    expect(lessonById(lesson.id)).toBe(lesson)
    expect(lesson.kind).toBe('case')
  })

  for (const section of lesson.sections) {
    it(`${section.tab}: plays through as authored`, () => {
      const log = autoPlay(section, 0)
      log.forEach((entry, i) => {
        const step = entry.step
        if (step.t === 'place') expect(section.palette).toContain(step.block)
        if (step.t === 'simulate') {
          if (step.expect === 'pass') expect(entry.passed, `step ${entry.stepIndex} should pass`).toBe(true)
          if (step.expect === 'fail') expect(entry.passed, `step ${entry.stepIndex} should fail`).toBe(false)
          if (step.expect === 'pass') expect(lintDesign(entry.design).map((f) => f.rule)).toEqual([])
        }
        if (step.t === 'api') {
          const before = i === 0 ? section.startDesign : log[i - 1].design
          const api = (d: typeof before) => d.nodes.find((n) => n.id === step.node)?.api ?? []
          expect(evaluateApi(api(before), step.rules).every((r) => r.pass)).toBe(false)
          expect(evaluateApi(api(entry.design), step.rules).filter((r) => !r.pass).map((r) => r.label)).toEqual([])
        }
      })
    })

    section.steps.forEach((step, i) => {
      if (step.t !== 'reveal' || !step.expert) return
      it(`${section.tab}: the experts' design passes the test it is compared against`, () => {
        const test = testBefore(section, i)!
        expect(test).toBeDefined()
        const sim = { t: 'simulate' as const, text: '', expect: 'pass' as const, scenario: test.scenario, goals: test.goals }
        expect(simulate(section, step.expert!, sim).passed).toBe(true)
      })
    })

    if (section.steps.some((s) => s.t === 'fork'))
      it(`${section.tab}: every fork branch passes`, () => {
        const fork = section.steps.find((s) => s.t === 'fork')!
        for (let pick = 0; pick < (fork.t === 'fork' ? fork.options.length : 0); pick++)
          for (const e of autoPlay(section, pick)) if (e.step.t === 'simulate' && e.step.expect === 'pass') expect(e.passed, `branch ${pick}`).toBe(true)
      })
  }
})
