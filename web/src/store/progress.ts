import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Chapter, Lesson, SectionKind } from '@/engine/lesson/types'
import type { BlockId } from '@/engine/types'
import { repo } from '@/repo/storage'

export type Theme = 'system' | 'light' | 'dark'

/** Whole-app look. `current` follows the light/dark theme; the others bring their own palette. */
export type Skin = 'current' | 'pixel' | 'factory'

export type MissKind = 'reason' | 'estimate' | 'requirements' | 'predict' | 'diagnose' | 'hint' | 'whatif'

/** A step the learner struggled with, for the review page. */
export interface Miss {
  lessonId: string
  sectionIndex: number
  stepIndex: number
  kinds: MissKind[]
  count: number
  lastAt: number
}

export const missKey = (lessonId: string, sectionIndex: number, stepIndex: number) => `${lessonId}#${sectionIndex}#${stepIndex}`

interface ProgressState {
  /** Completed sections per lesson id. */
  completed: Record<string, SectionKind[]>
  unlocked: BlockId[]
  /** Blocks unlocked but not yet celebrated. */
  pendingUnlocks: BlockId[]
  testedOut: string[]
  theme: Theme
  skin: Skin
  misses: Record<string, Miss>
  /** Testing aid: every lesson and section is open. */
  devMode: boolean
  setDevMode: (on: boolean) => void
  /** Testing aid: collect these blocks without playing their lessons (no unlock celebration). */
  unlockBlocks: (blocks: BlockId[]) => void
  completeSection: (lesson: Lesson, kind: SectionKind) => void
  testOut: (chapter: Chapter, checkpoint: Lesson) => void
  ackUnlock: () => void
  recordMiss: (lessonId: string, sectionIndex: number, stepIndex: number, kind: MissKind) => void
  clearMiss: (lessonId: string, sectionIndex: number, stepIndex: number) => void
  setTheme: (t: Theme) => void
  setSkin: (s: Skin) => void
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
      skin: 'factory',
      misses: {},
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
      unlockBlocks: (blocks) => set((s) => ({ unlocked: [...new Set([...s.unlocked, ...blocks])] })),
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
      recordMiss: (lessonId, sectionIndex, stepIndex, kind) =>
        set((s) => {
          const k = missKey(lessonId, sectionIndex, stepIndex)
          const prev = s.misses[k]
          const kinds = prev?.kinds.includes(kind) ? prev.kinds : [...(prev?.kinds ?? []), kind]
          return { misses: { ...s.misses, [k]: { lessonId, sectionIndex, stepIndex, kinds, count: (prev?.count ?? 0) + 1, lastAt: Date.now() } } }
        }),
      clearMiss: (lessonId, sectionIndex, stepIndex) =>
        set((s) => {
          const k = missKey(lessonId, sectionIndex, stepIndex)
          if (!s.misses[k]) return s
          const { [k]: _gone, ...misses } = s.misses
          return { misses }
        }),
      setTheme: (theme) => set({ theme }),
      setSkin: (skin) => set({ skin }),
      resetProgress: () => set({ completed: {}, unlocked: [], pendingUnlocks: [], testedOut: [], misses: {} }),
    }),
    {
      name: 'neet-syst:progress',
      version: 2,
      storage: createJSONStorage(() => repo),
      migrate: (state) => ({ misses: {}, ...(state as object) }) as ProgressState,
    },
  ),
)

export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'done'

export function lessonStatus(
  chapter: Chapter,
  index: number,
  completed: Record<string, SectionKind[]>,
  devMode = false,
): LessonStatus {
  const lesson = chapter.lessons[index]
  const done = completed[lesson.id] ?? []
  if (lesson.sections.every((s) => done.includes(s.kind))) return 'done'
  if (done.length) return 'in-progress'
  if (index === 0) return 'available'
  const prev = chapter.lessons[index - 1]
  const prevDone = completed[prev.id] ?? []
  return devMode || prev.sections.every((s) => prevDone.includes(s.kind)) ? 'available' : 'locked'
}

export type IncidentStatus = 'locked' | 'waiting' | 'done'

/** Incidents open once their `due` lesson is finished (or always in dev mode). */
export function incidentStatus(incident: Lesson, dueLesson: Lesson | undefined, completed: Record<string, SectionKind[]>, devMode = false): IncidentStatus {
  const done = completed[incident.id] ?? []
  if (incident.sections.every((s) => done.includes(s.kind))) return 'done'
  const dueDone = dueLesson && dueLesson.sections.every((s) => (completed[dueLesson.id] ?? []).includes(s.kind))
  return devMode || dueDone ? 'waiting' : 'locked'
}
