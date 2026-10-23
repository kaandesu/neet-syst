import { useCallback, useEffect, useState } from 'react'
import type { GoalResult } from '@/engine/sim/goals'
import type { Design, SimRun } from '@/engine/types'

const PHASE_MS = 1700

export interface Playback {
  run: SimRun
  goals: GoalResult[]
  passed: boolean
  phase: number
  playing: boolean
  stepIndex: number
  designKey: string
}

export const designKey = (d: Design) => JSON.stringify(d)

/** Steps through a simulation's phases so the learner can watch it unfold. */
export function useSimPlayback() {
  const [pb, setPb] = useState<Playback | null>(null)

  useEffect(() => {
    if (!pb?.playing) return
    const t = setTimeout(() => {
      setPb((cur) => {
        if (!cur) return cur
        const last = cur.phase >= cur.run.phases.length - 1
        return last ? { ...cur, playing: false } : { ...cur, phase: cur.phase + 1 }
      })
    }, PHASE_MS)
    return () => clearTimeout(t)
  }, [pb])

  const start = useCallback((run: SimRun, goals: GoalResult[], passed: boolean, design: Design, stepIndex: number) => {
    setPb({ run, goals, passed, phase: 0, playing: true, stepIndex, designKey: designKey(design) })
  }, [])

  const clear = useCallback(() => setPb(null), [])

  return { pb, start, clear }
}
