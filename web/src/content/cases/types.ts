import type { Lesson } from '@/engine/lesson/types'

/** A real system, worked through in interview order. Plays in the normal lesson screen. */
export interface CaseStudy {
  lesson: Lesson
  company: string
  era: string
  difficulty: 'medium' | 'hard'
  tags: string[]
  /** Chapter worth finishing first; the case still opens without it. */
  recommended: string
}
