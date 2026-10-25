import type { Chapter, Lesson } from '@/engine/lesson/types'
import { chapter1, chapter1Checkpoint } from './chapters/ch1'
import { chapter2 } from './chapters/ch2'

export const CHAPTERS: Chapter[] = [chapter1, chapter2]

/** Test-out checkpoints, keyed by chapter id. */
export const CHECKPOINTS: Record<string, Lesson> = { ch1: chapter1Checkpoint }

const ALL: Lesson[] = [
  ...CHAPTERS.flatMap((c) => [...c.lessons, ...(c.incidents ?? [])]),
  ...Object.values(CHECKPOINTS),
]

export const lessonById = (id: string): Lesson | undefined => ALL.find((l) => l.id === id)

export const allLessons = () => ALL
