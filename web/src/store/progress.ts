import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Chapter, Lesson, SectionKind } from '@/engine/lesson/types'
import type { BlockId } from '@/engine/types'
import { repo } from '@/repo/storage'

export type Theme = 'system' | 'light' | 'dark'

interface ProgressState {
  /** Completed sections per lesson id. */
  completed: Record<string, SectionKind[]>
  unlocked: BlockId[]
  /** Blocks unlocked but not yet celebrated. */
  pendingUnlocks: BlockId[]
  testedOut: string[]
  theme: Theme
  completeSection: (lesson: Lesson, kind: SectionKind) => void
  testOut: (chapter: Chapter, checkpoint: Lesson) => void
  ackUnlock: () => void
  setTheme: (t: Theme) => void
  resetProgress: () => void
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      completed: {},
      unlocked: [],
      pendingUnlocks: [],
      testedOut: [],
      theme: 'system',
      completeSection: (lesson, kind) =>
        set((s) => {
          const done = new Set(s.completed[lesson.id] ?? [])
          done.add(kind)
          const completed = { ...s.completed, [lesson.id]: [...done] }
          const finished = lesson.sections.every((sec) => done.has(sec.kind))
          if (!finished) return { completed }
          const fresh = lesson.unlocks.filter((b) => !s.unlocked.includes(b))
          return {
            completed,
            unlocked: [...s.unlocked, ...fresh],
            pendingUnlocks: [...s.pendingUnlocks, ...fresh],
          }
        }),
      testOut: (chapter, checkpoint) =>
        set((s) => {
          const completed = { ...s.completed }
          for (const l of [...chapter.lessons, checkpoint]) completed[l.id] = l.sections.map((x) => x.kind)
          const blocks = [...chapter.lessons.flatMap((l) => l.unlocks), ...checkpoint.unlocks]
          const fresh = [...new Set(blocks)].filter((b) => !s.unlocked.includes(b))
          return {
            completed,
            testedOut: [...new Set([...s.testedOut, chapter.id])],
            unlocked: [...s.unlocked, ...fresh],
            pendingUnlocks: [...s.pendingUnlocks, ...fresh.slice(0, 3)],
          }
        }),
      ackUnlock: () => set((s) => ({ pendingUnlocks: s.pendingUnlocks.slice(1) })),
      setTheme: (theme) => set({ theme }),
      resetProgress: () => set({ completed: {}, unlocked: [], pendingUnlocks: [], testedOut: [] }),
    }),
    { name: 'neet-syst:progress', version: 1, storage: createJSONStorage(() => repo) },
  ),
)

export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'done'

export function lessonStatus(chapter: Chapter, index: number, completed: Record<string, SectionKind[]>): LessonStatus {
  const lesson = chapter.lessons[index]
  const done = completed[lesson.id] ?? []
  if (lesson.sections.every((s) => done.includes(s.kind))) return 'done'
  if (done.length) return 'in-progress'
  if (index === 0) return 'available'
  const prev = chapter.lessons[index - 1]
  const prevDone = completed[prev.id] ?? []
  return prev.sections.every((s) => prevDone.includes(s.kind)) ? 'available' : 'locked'
}
