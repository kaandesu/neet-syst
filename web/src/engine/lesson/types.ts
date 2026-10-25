import type { Mood, SpeakerId } from '../mentor/reactions'
import type { ApiRule } from '../api/rules'
import type { BlockId, DNode, Design, Endpoint, Goal, RegionZone, Scenario, Tier } from '../types'

/** Accept one block or any of several (e.g. "a database" = SQL or NoSQL). */
export type BlockMatch = BlockId | BlockId[]

export interface ChaosBanner {
  title: string
  body: string
}

/** A wrong idea the learner can simulate anyway, to watch it fail. */
export interface WhatIf {
  label: string
  design: Design
  scenario: Scenario
  goals: Goal[]
  zones?: RegionZone[]
}

export type DesignPatch = {
  addNodes?: DNode[]
  addEdges?: { from: string; to: string }[]
  setProps?: { id: string; props: Partial<Pick<DNode, 'sticky' | 'label' | 'tier' | 'api'>> }[]
}

export type Step =
  /** A line from the mentor, or from another member of the cast. */
  | { t: 'say'; text: string; speaker?: SpeakerId; mood?: Mood }
  /** Introduces a building block with its illustrated card. */
  | { t: 'concept'; block: BlockId; text?: string }
  /** Drag a block onto the canvas until there are `count` of them. */
  | { t: 'place'; block: BlockId; count: number; text: string; slot?: { x: number; y: number }; hints?: string[] }
  /** Draw edges between blocks until `count` such edges exist. */
  | { t: 'connect'; from: BlockMatch; to: BlockMatch; count?: number; text: string; hints?: string[] }
  /** Remove every edge between these blocks (select an arrow, press Delete). */
  | { t: 'disconnect'; from: BlockMatch; to: BlockMatch; text: string; hints?: string[] }
  /**
   * Name a block and/or size it in the Inspector. `label` is the suggested name (any name counts);
   * `tier` must match, and an unsized service counts as medium.
   */
  | { t: 'configure'; block: BlockId; label?: string; tier?: Tier; text: string; hints?: string[] }
  /**
   * Write the endpoints for service `node`, graded by `rules`. The learner edits the node's API directly,
   * so what they write stays on the service for later steps. `solution` is used by the content tests.
   */
  | { t: 'api'; node: string; text: string; rules: ApiRule[]; solution: Endpoint[]; hints?: string[] }
  /** Pick the right reason. Wrong answers explain why they're tempting. */
  | {
      t: 'reason'
      question: string
      options: { id: string; text: string; correct?: boolean; why: string; tryIt?: WhatIf }[]
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
      /** Fail steps ask "what breaks first?" before running; set false to skip that. */
      predict?: false
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

export type LessonKind = 'unit' | 'capstone' | 'checkpoint' | 'incident'

export interface Lesson {
  id: string
  chapter: string
  kind: LessonKind
  title: string
  /** One-line hook shown on the map: the new concern that motivates this lesson. */
  concern: string
  unlocks: BlockId[]
  sections: Section[]
  /** Rough time for the whole lesson; the map falls back to 5 per section. */
  minutes?: number
  /** Incidents only: appears once this lesson is done. */
  due?: string
  /** Incidents only: the blocks this drill reviews. */
  reviews?: BlockId[]
}

export interface Chapter {
  id: string
  title: string
  subtitle: string
  /** The story the chapter tells, shown on the map banner. */
  story?: string
  /** Growth milestones on the map: the user count reached when `lesson` starts. */
  arc?: { lesson: string; label: string }[]
  lessons: Lesson[]
  /** Chapter id that must be finished (or tested out of) before this one opens. */
  requires?: string
  /** Optional review drills that appear on the map after their `due` lesson. */
  incidents?: Lesson[]
}

/** Recorded answer for a completed step. */
export type StepAnswer =
  | { t: 'reason'; optionId: string; attempts: number }
  | { t: 'fork'; optionId: string }
  | { t: 'requirements'; picks: boolean[]; attempts: number }
  | { t: 'estimate'; value: number; attempts: number }
  | { t: 'api'; attempts: number }
  | {
      t: 'simulate'
      passed: boolean
      errorRate: number
      p99Ms: number
      /** Node the learner predicted would break first. */
      predicted?: string
      predictedRight?: boolean
      diagnoseAttempts?: number
    }
