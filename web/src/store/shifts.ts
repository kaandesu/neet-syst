import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Design } from '@/engine/types'
import { repo } from '@/repo/storage'

export interface ShiftBest {
  stars: number
  blocks: number
  p99Ms: number
}

export interface ShiftProgress {
  /** Draft on the canvas; missing means "start from the shift's starting design". */
  design?: Design
  /** The briefing plays once; after that the shift opens straight on the build. */
  briefed: boolean
  attempts: number
  hintsUsed: number
  best?: ShiftBest
}

const EMPTY: ShiftProgress = { briefed: false, attempts: 0, hintsUsed: 0 }

interface ShiftsState {
  byId: Record<string, ShiftProgress>
  setDesign: (id: string, design: Design) => void
  briefed: (id: string) => void
  attempted: (id: string, survived?: ShiftBest) => void
  revealHint: (id: string) => void
  reset: (id: string) => void
}

const better = (a: ShiftBest, b?: ShiftBest) =>
  !b || a.stars > b.stars || (a.stars === b.stars && (a.blocks < b.blocks || (a.blocks === b.blocks && a.p99Ms < b.p99Ms)))

export const useShifts = create<ShiftsState>()(
  persist(
    (set) => {
      const patch = (id: string, f: (p: ShiftProgress) => Partial<ShiftProgress>) =>
        set((s) => {
          const cur = s.byId[id] ?? EMPTY
          return { byId: { ...s.byId, [id]: { ...cur, ...f(cur) } } }
        })
      return {
        byId: {},
        setDesign: (id, design) => patch(id, () => ({ design })),
        briefed: (id) => patch(id, () => ({ briefed: true })),
        attempted: (id, survived) =>
          patch(id, (p) => ({ attempts: p.attempts + 1, best: survived && better(survived, p.best) ? survived : p.best })),
        revealHint: (id) => patch(id, (p) => ({ hintsUsed: p.hintsUsed + 1 })),
        reset: (id) => patch(id, () => ({ design: undefined })),
      }
    },
    {
      name: 'neet-syst:shifts',
      version: 1,
      storage: createJSONStorage(() => repo),
    },
  ),
)

export const shiftProgressOf = (byId: Record<string, ShiftProgress>, id: string) => byId[id] ?? EMPTY
