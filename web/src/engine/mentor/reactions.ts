import type { LessonKind } from '../lesson/types'
import type { BlockId } from '../types'

export type SpeakerId = 'mentor' | 'oncall' | 'pm'

/** Which face a speaker's portrait shows. */
export type Mood = 'neutral' | 'happy' | 'worried'

export type MentorEvent =
  | 'predict-right'
  | 'predict-wrong'
  /** A run the learner had to make pass did not. */
  | 'fix-failed'
  /** A must-pass run passed after at least one failure. */
  | 'fix-passed'
  /** No progress on a hands-on step for a while. */
  | 'stuck'

export interface ReactionCtx {
  event: MentorEvent
  lessonKind: LessonKind
  /** Failed attempts on this step so far (including this one). */
  attempts: number
  /** The part that broke, if any. */
  block?: BlockId
  /** Label and plain-English state of that part. */
  node?: string
  note?: string
  /** Title of an earlier lesson where the learner struggled with the same block. */
  past?: string
}

/** One authored reaction. The first rule whose conditions match wins; its lines rotate. */
export interface Reaction {
  on: MentorEvent
  block?: BlockId | BlockId[]
  kind?: LessonKind
  minAttempts?: number
  /** Only when the learner struggled with this block in an earlier lesson. */
  needsPast?: boolean
  speaker?: SpeakerId
  lines: string[]
}

export interface MentorLine {
  speaker: SpeakerId
  text: string
  mood?: Mood
}

const MOOD: Partial<Record<MentorEvent, Mood>> = {
  'predict-right': 'happy',
  'fix-passed': 'happy',
  'predict-wrong': 'worried',
  'fix-failed': 'worried',
}

const fill = (text: string, c: ReactionCtx) =>
  text.replace(/\{(node|note|past)\}/g, (_, k: 'node' | 'note' | 'past') => c[k] ?? '')

/** Pick the line for an event. `seq` rotates variants so repeats don't feel canned. */
export function react(rules: Reaction[], c: ReactionCtx, seq = 0): MentorLine | null {
  const rule = rules.find(
    (r) =>
      r.on === c.event &&
      (!r.block || (c.block && (Array.isArray(r.block) ? r.block.includes(c.block) : r.block === c.block))) &&
      (!r.kind || r.kind === c.lessonKind) &&
      (!r.minAttempts || c.attempts >= r.minAttempts) &&
      (!r.needsPast || !!c.past),
  )
  if (!rule || !rule.lines.length) return null
  return { speaker: rule.speaker ?? 'mentor', text: fill(rule.lines[seq % rule.lines.length], c), mood: MOOD[c.event] }
}
