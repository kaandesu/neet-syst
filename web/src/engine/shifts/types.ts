import type { Mood, SpeakerId } from '../mentor/reactions'
import type { ProblemHint } from '../problems/types'
import type { Design, Goal, ScenarioPhase } from '../types'

/** One wave of a shift: a traffic phase, announced by a line from the cast as it hits. */
export interface Wave {
  phase: ScenarioPhase
  /** Said when the wave starts, e.g. "Server 1 just fell over!". */
  line: string
  speaker?: SpeakerId
  mood?: Mood
}

/**
 * A boss fight on the story path. No step-by-step script: a briefing, a starting design, every block
 * earned so far, and waves of traffic that run back to back. Hints open after the first failed run.
 */
export interface Shift {
  id: string
  chapter: string
  /** Opens once this lesson is done, and sits right after it on the story path. */
  after: string
  title: string
  /** One-line hook for the map. */
  concern: string
  speaker: SpeakerId
  /** The visual-novel intro, one line per Continue. */
  briefing: { text: string; speaker?: SpeakerId; mood?: Mood }[]
  start: Design
  waves: Wave[]
  /** Checked across every wave. */
  goals: Goal[]
  /** Block count of the reference solution: matching it earns a star. */
  par: number
  /** Worst-wave p99 at or under this earns a star. */
  fastMs: number
  /** Ordered from gentle nudge to near-answer. */
  hints: ProblemHint[]
  solution: Design
  /** What the reference design does and why, shown after you survive. */
  debrief: string[]
}
