import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Design } from '@/engine/types'
import { DEFAULT_TRAFFIC, type Traffic } from '@/features/sandbox/traffic'
import { repo } from '@/repo/storage'

export const SANDBOX_START: Design = {
  nodes: [{ id: 'client', block: 'client', x: 0, y: 200, locked: true }],
  edges: [],
}

interface SandboxState {
  design: Design
  traffic: Traffic
  /** Nodes switched off from the inspector. */
  killed: string[]
  /** Challenge being attempted, if any. */
  active: string | null
  cleared: string[]
  setDesign: (d: Design) => void
  setTraffic: (patch: Partial<Traffic>) => void
  toggleKill: (id: string) => void
  revive: () => void
  setActive: (id: string | null) => void
  clear: (id: string) => void
  load: (design: Design, traffic: Traffic) => void
  reset: () => void
}

export const useSandbox = create<SandboxState>()(
  persist(
    (set) => ({
      design: SANDBOX_START,
      traffic: DEFAULT_TRAFFIC,
      killed: [],
      active: null,
      cleared: [],
      setDesign: (design) =>
        set((s) => ({ design, killed: s.killed.filter((id) => design.nodes.some((n) => n.id === id)) })),
      setTraffic: (patch) => set((s) => ({ traffic: { ...s.traffic, ...patch } })),
      toggleKill: (id) => set((s) => ({ killed: s.killed.includes(id) ? s.killed.filter((k) => k !== id) : [...s.killed, id] })),
      revive: () => set({ killed: [] }),
      setActive: (active) => set({ active }),
      clear: (id) => set((s) => (s.cleared.includes(id) ? s : { cleared: [...s.cleared, id] })),
      load: (design, traffic) => set({ design, traffic, killed: [] }),
      reset: () => set({ design: SANDBOX_START, killed: [] }),
    }),
    {
      name: 'neet-syst:sandbox',
      version: 1,
      storage: createJSONStorage(() => repo),
    },
  ),
)
