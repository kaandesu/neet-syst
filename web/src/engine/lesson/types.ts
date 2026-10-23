import type { BlockId, DNode, Design, Goal, RegionZone, Scenario } from '../types'

/** Accept one block or any of several (e.g. "a database" = SQL or NoSQL). */
export type BlockMatch = BlockId | BlockId[]

export interface ChaosBanner {
  title: string
  body: string
}

export type DesignPatch = {
  addNodes?: DNode[]
  addEdges?: { from: string; to: string }[]
  setProps?: { id: string; props: Partial<Pick<DNode, 'sticky'>> }[]
}

export type Step =
  /** A line from the mentor. */
  | { t: 'say'; text: string }
  /** Introduces a building block with its illustrated card. */
  | { t: 'concept'; block: BlockId; text?: string }
  /** Drag a block onto the canvas until there are `count` of them. */
  | { t: 'place'; block: BlockId; count: number; text: string; slot?: { x: number; y: number }; hints?: string[] }
  /** Draw edges between blocks until `count` such edges exist. */
  | { t: 'connect'; from: BlockMatch; to: BlockMatch; count?: number; text: string; hints?: string[] }
  /** Remove every edge between these blocks (select an arrow, press Delete). */
  | { t: 'disconnect'; from: BlockMatch; to: BlockMatch; text: string; hints?: string[] }
  /** Pick the right reason. Wrong answers explain why they're tempting. */
  | {
      t: 'reason'
      question: string
      options: { id: string; text: string; correct?: boolean; why: string }[]
    }
  /** A real design decision. Every option is valid and leads to its own branch. */
  | {
      t: 'fork'
      question: string
      options: { id: string; label: string; pitch: string; consequence: string; patch: DesignPatch }[]
    }
  /** Run traffic through the current design. */
  | {
      t: 'simulate'
      text: string
      scenario: Scenario
      /** 'fail' = we expect it to break (feel the pain); 'pass' = must meet goals; 'observe' = either is fine. */
      expect: 'fail' | 'pass' | 'observe'
      goals?: Goal[]
      chaos?: ChaosBanner
      explainPass?: string
      explainFail?: string
      hints?: string[]
      /** For free-build steps: a design that passes, used by content tests. */
      solution?: Design
    }
  /** Capstone scoping: sort features into in- and out-of-scope. */
  | { t: 'requirements'; text: string; items: { text: string; inScope: boolean; why: string }[] }
  /** Back-of-the-envelope estimate; answers within `tolerance`× count as right. */
  | { t: 'estimate'; question: string; unit: string; answer: number; tolerance: number; working: string; hints?: string[] }

export type StepType = Step['t']

export type SectionKind = 'concept' | 'drill' | 'level'

export interface Section {
  kind: SectionKind
  title: string
  startDesign: Design
  /** Blocks shown in the palette tray for this section. */
  palette: BlockId[]
  zones?: RegionZone[]
  /** Hide all health and metrics until a Monitoring block is on the canvas. */
  blind?: boolean
  goals: Goal[]
  steps: Step[]
}

export type LessonKind = 'unit' | 'capstone' | 'checkpoint'

export interface Lesson {
  id: string
  chapter: string
  kind: LessonKind
  title: string
  /** One-line hook shown on the map: the new concern that motivates this lesson. */
  concern: string
  unlocks: BlockId[]
  sections: Section[]
}

export interface Chapter {
  id: string
  title: string
  subtitle: string
  lessons: Lesson[]
}

/** Recorded answer for a completed step. */
export type StepAnswer =
  | { t: 'reason'; optionId: string; attempts: number }
  | { t: 'fork'; optionId: string }
  | { t: 'requirements'; picks: boolean[]; attempts: number }
  | { t: 'estimate'; value: number; attempts: number }
  | { t: 'simulate'; passed: boolean; errorRate: number; p99Ms: number }
