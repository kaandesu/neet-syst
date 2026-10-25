import type { SpeakerId } from '../mentor/reactions'
import type { BlockId, Design, Goal, RegionZone, ScenarioPhase } from '../types'

export type Difficulty = 'easy' | 'medium' | 'hard'

/** One judged run. Hidden tests only show up on Submit, like LeetCode's hidden cases. */
export interface TestCase {
  label: string
  hidden?: boolean
  phases: ScenarioPhase[]
  /** Overrides the problem's goals for this test. */
  goals?: Goal[]
}

export interface ProblemHint {
  text: string
  /** Optional ghost slot shown on the canvas with this hint. */
  ghost?: { block: BlockId; x: number; y: number }
}

/** A standalone practice problem: a story, a skeleton design, and tests it must pass. */
export interface Problem {
  id: string
  number: number
  title: string
  difficulty: Difficulty
  tags: string[]
  speaker: SpeakerId
  /** The brief, one paragraph per entry. `*word*` renders as emphasis. */
  story: string[]
  /** What must work. */
  asks: string[]
  /** Things the story mentions that you can ignore. */
  outOfScope?: string[]
  numbers: { label: string; value: string }[]
  skeleton: Design
  palette: BlockId[]
  zones?: RegionZone[]
  /** Checked on every test unless the test brings its own. */
  goals: Goal[]
  /** Block count of the reference solution: matching it earns a star. */
  par: number
  tests: TestCase[]
  /** Ordered from gentle nudge to near-answer. */
  hints: ProblemHint[]
  solution: Design
  /** The tempting wrong answer: passes the visible tests, fails a hidden one. */
  trap?: { design: Design; why: string }
  editorial: string[]
  sources?: { label: string; url: string }[]
}
