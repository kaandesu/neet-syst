import type { Lesson } from '@/engine/lesson/types'
import { N, all, design, free, phase, scenario } from './_kit'

const webs = ['w1', 'w2', 'w3', 'w4']
const mix = { writeRatio: 0.1, staticRatio: 0.3, sessions: true }

const solution = free(
  [
    N('client', 'client', 0, 260),
    N('dns', 'dns', 180, 260),
    N('lb', 'load-balancer', 380, 260),
    N('cdn', 'cdn', 180, 520),
    N('store', 'object-storage', 380, 600),
    ...webs.map((id, i) => N(id, 'web-server', 600, 40 + i * 130)),
    N('cache', 'cache', 860, 40),
    N('sessions', 'session-store', 860, 480),
    N('db', 'sql-db', 860, 260),
    N('r1', 'read-replica', 1100, 180),
    N('r2', 'read-replica', 1100, 340),
  ],
  [
    ['client', 'dns'],
    ['dns', 'lb'],
    ['client', 'cdn'],
    ['cdn', 'store'],
    ...all(['lb'], webs),
    ...all(webs, ['cache', 'db', 'sessions']),
    ['db', 'r1'],
    ['db', 'r2'],
  ],
)

export const checkpoint: Lesson = {
  id: 'ch1-checkpoint',
  chapter: 'ch1',
  kind: 'checkpoint',
  title: 'Test out of Chapter 1',
  concern: 'Already know this? Prove it and unlock the whole chapter.',
  unlocks: [
    'client',
    'dns',
    'web-server',
    'sql-db',
    'nosql-db',
    'load-balancer',
    'read-replica',
    'cache',
    'cdn',
    'object-storage',
    'session-store',
    'geo-dns',
    'message-queue',
    'worker',
    'monitoring',
    'shard-router',
  ],
  sections: [
    {
      kind: 'level',
      title: 'The test-out challenge',
      startDesign: design([N('client', 'client', 0, 260)]),
      palette: ['dns', 'load-balancer', 'web-server', 'sql-db', 'nosql-db', 'read-replica', 'cache', 'cdn', 'object-storage', 'session-store'],
      goals: [{ kind: 'maxErrorRate', value: 0.01 }, { kind: 'maxP99', value: 200 }, { kind: 'noSPOF' }, { kind: 'stateless' }],
      steps: [
        {
          t: 'say',
          text: 'No guidance here. A shop with **logged-in users**, 3,000 req/s, 30% static files. It must survive a web server **and** the primary database dying at the same time. Pass and the whole chapter unlocks.',
        },
        {
          t: 'simulate',
          text: 'Build it and run it.',
          expect: 'pass',
          scenario: scenario(
            phase('Normal', 3000, mix),
            phase('Double failure', 3000, { ...mix, failures: [{ block: 'web-server', nth: 0 }, { block: 'sql-db' }] }),
          ),
          explainPass: 'Impressive. Chapter 1 unlocked. You can still replay any lesson from the map.',
          hints: ['Stateless servers, a cache, replicas, and a CDN. Every lesson in one design.'],
          solution,
        },
      ],
    },
  ],
}
