import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Design } from '@/engine/types'
import { repo } from '@/repo/storage'

export interface ProblemProgress {
  /** Draft on the canvas; missing means "start from the skeleton". */
  design?: Design
  hintsUsed: number
  submits: number
  solved: boolean
  /** Best accepted submission so far. */
  best?: { stars: number; blocks: number; p99Ms: number }
}

const EMPTY: ProblemProgress = { hintsUsed: 0, submits: 0, solved: false }

interface ProblemsState {
  byId: Record<string, ProblemProgress>
  setDesign: (id: string, design: Design) => void
  revealHint: (id: string) => void
  submitted: (id: string, accepted?: { stars: number; blocks: number; p99Ms: number }) => void
  resetDesign: (id: string) => void
}

const better = (a: NonNullable<ProblemProgress['best']>, b?: ProblemProgress['best']) =>
  !b || a.stars > b.stars || (a.stars === b.stars && (a.blocks < b.blocks || (a.blocks === b.blocks && a.p99Ms < b.p99Ms)))

export const useProblems = create<ProblemsState>()(
  persist(
    (set) => {
      const patch = (id: string, f: (p: ProblemProgress) => Partial<ProblemProgress>) =>
        set((s) => {
          const cur = s.byId[id] ?? EMPTY
          return { byId: { ...s.byId, [id]: { ...cur, ...f(cur) } } }
        })
      return {
        byId: {},
        setDesign: (id, design) => patch(id, () => ({ design })),
        revealHint: (id) => patch(id, (p) => ({ hintsUsed: p.hintsUsed + 1 })),
        submitted: (id, accepted) =>
          patch(id, (p) => ({
            submits: p.submits + 1,
            solved: p.solved || !!accepted,
            best: accepted && better(accepted, p.best) ? accepted : p.best,
          })),
        resetDesign: (id) => patch(id, () => ({ design: undefined })),
      }
    },
    {
      name: 'neet-syst:problems',
      version: 1,
      storage: createJSONStorage(() => repo),
    },
  ),
)

export const progressOf = (byId: Record<string, ProblemProgress>, id: string) => byId[id] ?? EMPTY
