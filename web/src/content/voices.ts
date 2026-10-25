import { Briefcase, GraduationCap, Siren, type LucideIcon } from 'lucide-react'
import type { Mood, Reaction, SpeakerId } from '@/engine/mentor/reactions'

export interface Speaker {
  name: string
  role: string
  icon: LucideIcon
  hue: number
  /** Pixel-art faces in `public/avatars`, one per mood. */
  faces: Record<Mood, string>
}

const faces = (who: string, worried = 'worried'): Record<Mood, string> => ({
  neutral: `${import.meta.env.BASE_URL}avatars/${who}_mini_neutral.webp`,
  happy: `${import.meta.env.BASE_URL}avatars/${who}_mini_happy.webp`,
  worried: `${import.meta.env.BASE_URL}avatars/${who}_mini_${worried}.webp`,
})

/** The small cast that talks to the learner. All lines are authored; nothing is generated. */
export const SPEAKERS: Record<SpeakerId, Speaker> = {
  mentor: { name: 'Ada', role: 'Mentor', icon: GraduationCap, hue: 255, faces: faces('ada') },
  oncall: { name: 'Sam', role: 'On-call', icon: Siren, hue: 8, faces: faces('sam', 'anxious') },
  pm: { name: 'Priya', role: 'Product', icon: Briefcase, hue: 160, faces: faces('priya') },
}

/**
 * How the cast reacts to what just happened. Order matters: the first matching rule wins,
 * so specific rules (a block, a lesson kind, a past struggle) come before general ones.
 */
export const REACTIONS: Reaction[] = [
  // Predictions
  {
    on: 'predict-right',
    lines: [
      'Reading the load *before* running it is exactly the instinct interviewers look for.',
      'You’re starting to see traffic, not boxes.',
      'Keep doing that out loud in interviews: “this breaks first, because…”',
    ],
  },
  {
    on: 'predict-wrong',
    block: 'web-server',
    lines: [
      'Servers are usually first to sweat: every request costs them CPU, while the layers behind them only see what gets through.',
      'The server again. When in doubt, follow the arrows: whatever *every* request touches is the first suspect.',
    ],
  },
  {
    on: 'predict-wrong',
    block: ['sql-db', 'nosql-db'],
    lines: [
      'The database broke first. Everything funnels into it, and unlike servers you can’t just clone it. That’s why so much of this chapter protects it.',
      'Database again. Count how many requests end up there, and how much each one costs.',
    ],
  },
  {
    on: 'predict-wrong',
    block: 'read-replica',
    lines: ['A replica gave out: the reads were spread over too few copies.'],
  },
  {
    on: 'predict-wrong',
    block: 'worker',
    lines: ['The workers fell behind. Jobs arrived faster than they could finish them, so the queue grew.'],
  },
  {
    on: 'predict-wrong',
    lines: ['Not quite. {node} gave out first. Next time, follow the arrows and ask which box sees the most work.'],
  },

  // Failed fixes
  {
    on: 'fix-failed',
    kind: 'incident',
    speaker: 'oncall',
    lines: ['Still red on my dashboards. The loudest alert is {node}.', 'Nope, still paging. Customers are noticing.'],
  },
  {
    on: 'fix-failed',
    needsPast: true,
    lines: ['This is the same shape of problem you hit in **{past}**. What fixed it there?'],
  },
  {
    on: 'fix-failed',
    minAttempts: 3,
    lines: ['Step back. For the red part, ask: does it need **more copies**, **less work**, or a **different path**? Or tap **I’m stuck**.'],
  },
  {
    on: 'fix-failed',
    lines: ['Close. Not every failure lives in the part you just changed.', 'Not yet. Find the red part first, then fix that.'],
  },

  // Passing after a struggle
  {
    on: 'fix-passed',
    kind: 'incident',
    speaker: 'oncall',
    lines: ['Graphs are green. Writing this one up for the postmortem. Nice save.'],
  },
  {
    on: 'fix-passed',
    lines: ['Got there. The failed runs taught you more than a first-try pass would have.'],
  },

  // Idle on a hands-on step
  {
    on: 'stuck',
    lines: ['Take your time. If you’re stuck, tap **I’m stuck** below and I’ll nudge you.'],
  },
]
