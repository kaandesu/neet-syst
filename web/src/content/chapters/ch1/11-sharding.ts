import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, all, design, phase, scenario } from './_kit'
import { shardByCountry, moreShards } from './_whatifs'

const webs = ['web1', 'web2', 'web3']
const bigData = (extra = {}) => phase('Big data day', 1500, { writeRatio: 0.3, dataGB: 2600, ...extra })

export const sharding: Lesson = {
  id: 'sharding',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Shard the database',
  concern: 'Your data has outgrown the biggest database you can buy.',
  unlocks: ['shard-router'],
  sections: [
    {
      kind: 'concept',
      title: 'Split the data',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'Replicas copy *all* the data and only help reads. When the data itself, or the write volume, outgrows one machine, you have to **split** it.',
        },
        { t: 'concept', block: 'shard-router' },
        {
          t: 'reason',
          question: 'You’re sharding a social app’s posts. Which shard key is best?',
          options: [
            {
              id: 'user',
              text: 'user_id: spreads users evenly and keeps each user’s posts together',
              correct: true,
              why: 'Good: high cardinality, even spread, and the most common query (“posts by this user”) hits one shard.',
            },
            { id: 'country', text: 'country', why: 'Hotspot! One country can hold half your users, and that shard melts.', tryIt: shardByCountry },
            { id: 'month', text: 'created_at month', why: 'Every new post lands on the latest shard. One hot shard, many idle ones.' },
          ],
        },
        {
          t: 'reason',
          question: 'What do you give up when you shard?',
          options: [
            {
              id: 'joins',
              text: 'Easy joins and transactions across shards',
              correct: true,
              why: 'Yes. Data that used to be one JOIN away may now live on different machines. Teams often **denormalize** to avoid cross-shard queries.',
            },
            { id: 'reads', text: 'Fast reads', why: 'Single-shard reads are just as fast. It’s *cross*-shard work that hurts.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Two shards',
      startDesign: design(
        [N('client', 'client', 0, 200), N('web', 'web-server', 220, 200), N('router', 'shard-router', 460, 200)],
        [
          ['client', 'web'],
          ['web', 'router'],
        ],
      ),
      palette: ['sql-db'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'sql-db', count: 1, slot: { x: 700, y: 110 }, text: 'Place a database for shard A.' },
        { t: 'place', block: 'sql-db', count: 2, slot: { x: 700, y: 290 }, text: 'And one for shard B.' },
        { t: 'connect', from: 'shard-router', to: 'sql-db', count: 2, text: 'Connect the **router** to both shards.' },
        {
          t: 'simulate',
          text: 'Store 1,500 GB of data. No single database could hold that.',
          expect: 'pass',
          scenario: scenario(phase('Lots of data', 500, { writeRatio: 0.3, dataGB: 1500 })),
          explainPass: 'Each shard holds half the data and takes half the writes.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'The database is full',
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('dns', 'dns', 180, 200),
          N('lb', 'load-balancer', 380, 200),
          ...webs.map((id, i) => N(id, 'web-server', 600, 60 + i * 140)),
          N('db', 'sql-db', 1100, 200),
        ],
        [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], webs), ...all(webs, ['db'])],
      ),
      palette: ['shard-router', 'sql-db'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'Your app now stores **2.6 TB**, and writes are 30% of traffic. The database is a 1 TB machine.' },
        {
          t: 'simulate',
          text: 'Run today’s traffic.',
          expect: 'fail',
          scenario: scenario(bigData()),
          explainFail: 'The disk is full, so every write fails. Read replicas wouldn’t help: they’d be just as full.',
        },
        { t: 'place', block: 'shard-router', count: 1, slot: { x: 860, y: 200 }, text: 'Place a **Shard Router** between the servers and the database.' },
        {
          t: 'disconnect',
          from: 'web-server',
          to: 'sql-db',
          text: 'Remove the three arrows from the servers straight to the database.',
          hints: ['Click an arrow, press Delete. Repeat for all three.'],
        },
        { t: 'connect', from: 'web-server', to: 'shard-router', count: 3, text: 'Connect every server to the **router**.' },
        { t: 'place', block: 'sql-db', count: 2, slot: { x: 1100, y: 40 }, text: 'Add a second shard…' },
        { t: 'place', block: 'sql-db', count: 3, slot: { x: 1100, y: 360 }, text: '…and a third.' },
        { t: 'connect', from: 'shard-router', to: 'sql-db', count: 3, text: 'Connect the router to all three shards.' },
        {
          t: 'simulate',
          text: 'Run the traffic again.',
          expect: 'pass',
          scenario: scenario(bigData()),
          explainPass: '~870 GB per shard, and writes spread three ways.',
        },
        {
          t: 'simulate',
          text: 'Then a celebrity joins and posts. Everyone wants their profile.',
          expect: 'observe',
          chaos: { title: 'Celebrity hotspot', body: '60% of all database traffic is now about one user, who lives on shard 1.' },
          scenario: scenario(bigData({ label: 'Celebrity', rps: 2500, hotKeyShare: 0.6 })),
          explainFail:
            'One shard melts while the others idle. Sharding spreads *keys*, not *traffic*: a single hot key always lands on one shard.',
          explainPass: 'Your shards survived the hotspot.',
        },
        {
          t: 'reason',
          question: 'How do you handle a celebrity hotspot?',
          options: [
            {
              id: 'cache',
              text: 'Cache the hot data aggressively, and give very hot keys special treatment (replicas, or splitting the key)',
              correct: true,
              why: 'Yes. Celebrity reads are perfect for a cache (same data, read millions of times). Some systems also give top users dedicated shards.',
            },
            { id: 'more', text: 'Add more shards', why: 'The celebrity is still one key on one shard. More shards just add more idle ones.', tryIt: moreShards },
            { id: 'ban', text: 'Rate-limit the celebrity’s fans', why: 'That’s rejecting your most engaged users. A last resort, not a design.' },
          ],
        },
      ],
    },
  ],
}
