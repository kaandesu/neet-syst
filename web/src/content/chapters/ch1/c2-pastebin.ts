import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, all, design, free, phase, scenario } from './_kit'

const mix = { writeRatio: 0.1, staticRatio: 0.2, taskRatio: 0.03, dataGB: 1800 }
const traffic = scenario(
  phase('Normal', 3000, mix),
  phase('Front page of HN', 4500, mix),
  phase('Server + cache down', 3000, { ...mix, failures: [{ block: 'web-server', nth: 0 }, { block: 'cache' }] }),
)

const webs = ['w1', 'w2', 'w3', 'w4', 'w5']
const solution = free(
  [
    N('client', 'client', 0, 300),
    N('dns', 'dns', 180, 300),
    N('lb', 'load-balancer', 380, 300),
    N('cdn', 'cdn', 180, 620),
    N('store', 'object-storage', 380, 700),
    ...webs.map((id, i) => N(id, 'web-server', 600, 40 + i * 130)),
    N('cache', 'cache', 860, 40),
    N('router', 'shard-router', 860, 260),
    N('s1', 'sql-db', 1100, 180),
    N('s2', 'sql-db', 1100, 360),
    N('r1', 'read-replica', 1340, 180),
    N('r2', 'read-replica', 1340, 360),
    N('queue', 'message-queue', 860, 520),
    N('k1', 'worker', 1100, 560),
    N('k2', 'worker', 1100, 680),
  ],
  [
    ['client', 'dns'],
    ['dns', 'lb'],
    ['client', 'cdn'],
    ['cdn', 'store'],
    ...all(['lb'], webs),
    ...all(webs, ['cache', 'router', 'queue']),
    ['router', 's1'],
    ['router', 's2'],
    ['s1', 'r1'],
    ['s2', 'r2'],
    ['queue', 'k1'],
    ['queue', 'k2'],
  ],
)

export const pastebin: Lesson = {
  id: 'pastebin',
  chapter: 'ch1',
  kind: 'capstone',
  title: 'Capstone: Pastebin at 10M users',
  concern: 'The chapter final. Every block you’ve earned, one big design.',
  unlocks: [],
  sections: [
    {
      kind: 'concept',
      title: 'Scope it',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: '“Design Pastebin”: users paste text, get a link, and anyone with the link can view it. Our target is **10 million users**. As always, scope first.',
        },
        {
          t: 'requirements',
          text: 'Sort these features for a 45-minute interview.',
          items: [
            { text: 'Create a paste and get a unique short link', inScope: true, why: 'The core write path.' },
            { text: 'View a paste by its link', inScope: true, why: 'The core read path: ~10× more common than creating.' },
            { text: 'Pastes expire after a chosen time', inScope: true, why: 'Cheap to support (a cleanup job) and it bounds storage growth.' },
            { text: 'The service survives the loss of any single machine', inScope: true, why: 'Non-functional, but expected at this scale.' },
            { text: 'Syntax highlighting in the editor', inScope: false, why: 'A front-end feature. It doesn’t change the backend design.' },
            { text: 'Editing a paste after creation', inScope: false, why: 'Adds versioning and cache invalidation. Leave it out unless asked.' },
            { text: 'Full-text search across all pastes', inScope: false, why: 'A separate search system (an inverted index). A great extension, not core.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Size it',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'estimate',
          question: '10M users create **10M pastes per month** in total. Writes per second?',
          unit: 'writes/s',
          answer: 4,
          tolerance: 2,
          working: '10M ÷ 2.5M seconds ≈ **4 writes/s**.',
        },
        {
          t: 'estimate',
          question: 'An average paste is **1 KB**, plus metadata. With 10M pastes a month, how much storage do you add per **year**, in GB?',
          unit: 'GB',
          answer: 120,
          tolerance: 2,
          working: '10M × 1 KB = 10 GB/month → **~120 GB/year**. Plus indexes, replicas and the occasional giant paste: plan for a few TB over several years.',
        },
        {
          t: 'say',
          text: 'Our raw numbers are modest, but the product team expects viral spikes (a leaked config on the front page of Hacker News) and wants to keep **years** of pastes, about 1.8 TB. That calls for every tool you have.',
        },
        {
          t: 'reason',
          question: 'Where should paste *content* live?',
          options: [
            {
              id: 'db-or-object',
              text: 'Metadata in the database; large paste bodies can go to object storage, served via the CDN',
              correct: true,
              why: 'A common pattern: the DB stays small and fast for lookups, and big blobs live in cheap, durable object storage.',
            },
            { id: 'web', text: 'On the web servers’ disks', why: 'Then the servers are stateful again, and a crash loses pastes.' },
            { id: 'cache', text: 'Only in the cache', why: 'A cache is not durable. Pastes would vanish on restart.' },
          ],
        },
      ],
    },
    {
      kind: 'level',
      title: 'Build Pastebin',
      startDesign: design([N('client', 'client', 0, 300)]),
      palette: [
        'dns',
        'load-balancer',
        'web-server',
        'sql-db',
        'nosql-db',
        'read-replica',
        'cache',
        'cdn',
        'object-storage',
        'session-store',
        'message-queue',
        'worker',
        'shard-router',
        'monitoring',
      ],
      goals: [
        { kind: 'maxErrorRate', value: 0.01 },
        { kind: 'maxP99', value: 200 },
        { kind: 'noSPOF' },
        { kind: 'queueStable' },
      ],
      steps: [
        {
          t: 'say',
          text: 'Everything is unlocked. The traffic mix: 10% creates, 20% static assets, 3% background jobs (expiring old pastes), and the rest are views. 1.8 TB of data. Survive a viral spike, plus a server **and** the cache failing together.',
        },
        {
          t: 'simulate',
          text: 'Build it, run it, iterate. The goals at the top tell you what’s missing.',
          expect: 'pass',
          scenario: traffic,
          explainPass:
            '🏆 **Chapter complete.** You just designed, from scratch, a system you can defend: every box justified by a requirement or a number. That’s the whole game.',
          hints: [
            'Static assets → CDN + object storage. Background jobs → queue + workers.',
            '1.8 TB doesn’t fit in a 1 TB SQL database: shard it, or pick a store that holds more.',
            'If the cache dies, can your database tier survive the full read load? Give every shard a replica.',
          ],
          solution,
        },
      ],
    },
  ],
}
