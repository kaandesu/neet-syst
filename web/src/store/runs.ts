import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StepAnswer } from '@/engine/lesson/types'
import type { Design } from '@/engine/types'
import { commit, createTree, rewind, setNote, type RunTree } from '@/engine/timeline/tree'
import { repo } from '@/repo/storage'

/** One playthrough of a lesson section: its decision tree plus the live canvas. */
export interface Run {
  tree: RunTree
  design: Design
}

interface RunsState {
  runs: Record<string, Run>
  ensure: (key: string, start: Design) => void
  setDesign: (key: string, design: Design) => void
  commitStep: (key: string, stepIndex: number, design: Design, answer?: StepAnswer) => void
  rewindTo: (key: string, nodeId: string) => void
  note: (key: string, nodeId: string, text: string) => void
  reset: (key: string, start: Design) => void
  /** Practice again from the start, keeping earlier branches on the timeline. */
  restart: (key: string) => void
}

export const runKey = (lessonId: string, sectionIndex: number) => `${lessonId}#${sectionIndex}`

export const useRuns = create<RunsState>()(
  persist(
    (set, get) => ({
      runs: {},
      ensure: (key, start) => {
        if (get().runs[key]) return
        set((s) => ({ runs: { ...s.runs, [key]: { tree: createTree(start), design: start } } }))
      },
      setDesign: (key, design) =>
        set((s) => (s.runs[key] ? { runs: { ...s.runs, [key]: { ...s.runs[key], design } } } : s)),
      commitStep: (key, stepIndex, design, answer) =>
        set((s) => {
          const run = s.runs[key]
          if (!run) return s
          return { runs: { ...s.runs, [key]: { tree: commit(run.tree, stepIndex, design, answer), design } } }
        }),
      rewindTo: (key, nodeId) =>
        set((s) => {
          const run = s.runs[key]
          const node = run?.tree.nodes[nodeId]
          if (!run || !node) return s
          return { runs: { ...s.runs, [key]: { tree: rewind(run.tree, nodeId), design: node.design } } }
        }),
      note: (key, nodeId, text) =>
        set((s) => {
          const run = s.runs[key]
          if (!run) return s
          return { runs: { ...s.runs, [key]: { ...run, tree: setNote(run.tree, nodeId, text) } } }
        }),
      restart: (key) =>
        set((s) => {
          const run = s.runs[key]
          const root = run?.tree.nodes[run.tree.rootId]
          if (!run || !root) return s
          return { runs: { ...s.runs, [key]: { tree: rewind(run.tree, root.id), design: root.design } } }
        }),
      reset: (key, start) => set((s) => ({ runs: { ...s.runs, [key]: { tree: createTree(start), design: start } } })),
    }),
    { name: 'neet-syst:runs', version: 1, storage: createJSONStorage(() => repo) },
  ),
)
