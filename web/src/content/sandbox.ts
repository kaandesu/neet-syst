import type { BlockId, Goal, ScenarioPhase } from '@/engine/types'

/** An open-ended target for the sandbox: no script, no ghost slots, just a load and some goals. */
export interface SandboxChallenge {
  id: string
  title: string
  brief: string
  /** Blocks that must be unlocked before the challenge opens. */
  needs: BlockId[]
  phase: ScenarioPhase
  goals: Goal[]
  /** One nudge, shown on request. */
  hint: string
}

const p = (label: string, rps: number, extra: Partial<ScenarioPhase> = {}): ScenarioPhase => ({ label, seconds: 4, rps, ...extra })

export const SANDBOX_CHALLENGES: SandboxChallenge[] = [
  {
    id: 'hello',
    title: 'Hello, world',
    brief: 'Your first 100 users. Get every request answered.',
    needs: ['web-server'],
    phase: p('Hello, world', 100),
    goals: [{ kind: 'maxErrorRate', value: 0 }],
    hint: 'Users → DNS → a server is all it takes.',
  },
  {
    id: 'launch',
    title: 'Launch day',
    brief: 'You hit the front page: 1,500 req/s, 10% of them writes.',
    needs: ['load-balancer', 'sql-db'],
    phase: p('Launch day', 1500, { writeRatio: 0.1 }),
    goals: [
      { kind: 'maxErrorRate', value: 0.01 },
      { kind: 'maxP99', value: 300 },
    ],
    hint: 'One server does about 1,000 req/s. Put a load balancer in front of a few, and give them a real database.',
  },
  {
    id: 'read-storm',
    title: 'Read storm',
    brief: '6,000 req/s and almost all of them are reads. Keep it fast.',
    needs: ['load-balancer', 'cache'],
    phase: p('Read storm', 6000, { writeRatio: 0.05 }),
    goals: [
      { kind: 'maxErrorRate', value: 0.01 },
      { kind: 'maxP99', value: 200 },
    ],
    hint: 'The database tops out near 2,000 req/s. A cache in front of it absorbs most reads.',
  },
  {
    id: 'no-spof',
    title: 'Nothing is irreplaceable',
    brief: 'Any one part can die and users shouldn’t notice. 2,000 req/s.',
    needs: ['load-balancer', 'read-replica'],
    phase: p('Steady traffic', 2000, { writeRatio: 0.1 }),
    goals: [
      { kind: 'maxErrorRate', value: 0.01 },
      { kind: 'noSPOF' },
    ],
    hint: 'Click a block and kill it to test. Every server needs a twin, and the database needs a replica to fail over to.',
  },
  {
    id: 'media',
    title: 'Picture heavy',
    brief: '4,000 req/s, and 60% of them are images and scripts.',
    needs: ['load-balancer', 'cdn'],
    phase: p('Picture heavy', 4000, { writeRatio: 0.05, staticRatio: 0.6 }),
    goals: [
      { kind: 'maxErrorRate', value: 0.01 },
      { kind: 'maxP99', value: 150 },
    ],
    hint: 'Static files don’t need your servers at all. Serve them from the edge.',
  },
  {
    id: 'jobs',
    title: 'Slow jobs',
    brief: '20% of requests resize a photo. Don’t make users wait for it.',
    needs: ['load-balancer', 'message-queue'],
    phase: p('Uploads', 500, { writeRatio: 0.2, taskRatio: 0.2 }),
    goals: [
      { kind: 'maxErrorRate', value: 0.01 },
      { kind: 'maxP99', value: 300 },
      { kind: 'queueStable' },
    ],
    hint: 'Hand the slow work to a queue and let enough workers drain it in the background.',
  },
  {
    id: 'ten-k',
    title: 'The 10k club',
    brief: '10,000 req/s, fast, and nothing is a single point of failure.',
    needs: ['load-balancer', 'cache', 'read-replica'],
    phase: p('10k req/s', 10_000, { writeRatio: 0.05 }),
    goals: [
      { kind: 'maxErrorRate', value: 0.01 },
      { kind: 'maxP99', value: 300 },
      { kind: 'noSPOF' },
    ],
    hint: 'Count it out: how many servers for 10k? What does the database still see after the cache?',
  },
]
