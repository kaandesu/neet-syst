import { describe, expect, it } from 'vitest'
import { isScene } from './runner'
import type { Section, Step } from './types'

const section = (steps: Step[]): Section => ({ kind: 'concept', title: 't', startDesign: { nodes: [], edges: [] }, palette: [], goals: [], steps })
const say = (extra: Partial<Extract<Step, { t: 'say' }>> = {}): Step => ({ t: 'say', text: 'hi', ...extra })
const place: Step = { t: 'place', block: 'dns', count: 1, text: 'place it' }

describe('isScene', () => {
  it('plays the opening run of Ada lines as a scene, then hands over to the dock', () => {
    const s = section([say(), say(), place, say()])
    expect([0, 1, 2, 3].map((i) => isScene(s, i))).toEqual([true, true, false, false])
  })

  it('leaves the rest of the cast, and worried lines, in the dock', () => {
    const s = section([say({ speaker: 'oncall' }), say({ mood: 'worried' })])
    expect(isScene(s, 0)).toBe(false)
    expect(isScene(section([say({ mood: 'worried' })]), 0)).toBe(false)
  })

  it('lets a line force the scene on or off', () => {
    const s = section([say({ scene: false }), place, say({ scene: true }), say({ speaker: 'pm', scene: true })])
    expect([0, 2, 3].map((i) => isScene(s, i))).toEqual([false, true, false])
  })

  it('is false past the end of the section', () => {
    expect(isScene(section([say()]), 1)).toBe(false)
  })
})
