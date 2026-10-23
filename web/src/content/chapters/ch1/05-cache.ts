import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'
import { replicaEnd } from './_states'

const sale = (extra = {}) => phase('Black Friday', 2000, { writeRatio: 0.05, queryCost: 3, ...extra })

export const cache: Lesson = {
  id: 'cache',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Cache the hot data',
  concern: 'The same product pages are read thousands of times a minute, and each one costs three DB queries.',
  unlocks: ['cache'],
  sections: [
    {
      kind: 'concept',
      title: 'Memory beats disk',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'Recall the latency ladder: memory is ~100× faster than a database query. And popular data is read **over and over**. Put those two facts together…',
        },
        { t: 'concept', block: 'cache' },
        {
          t: 'reason',
          question: 'Which data is the **best** fit for a cache?',
          options: [
            {
              id: 'product',
              text: 'Product pages: read thousands of times a minute, changed a few times a day',
              correct: true,
              why: 'Perfect: very high read-to-write ratio, and being a few seconds stale is harmless.',
            },
            {
              id: 'balance',
              text: 'A user’s bank balance in the middle of a transfer',
              why: 'This must be exactly right *right now*. A stale cached balance means wrong money. Read it from the database.',
            },
            {
              id: 'once',
              text: 'Log lines that are written once and almost never read',
              why: 'A cache only pays off if an item is read again before it expires. Write-once data just wastes memory.',
            },
          ],
        },
        {
          t: 'reason',
          question: 'The cache is full and a new item arrives. Under **LRU** eviction, what gets thrown out?',
          options: [
            {
              id: 'lru',
              text: 'The item nobody has read for the longest time',
              correct: true,
              why: 'Least Recently Used. It bets that what’s been ignored lately will keep being ignored, which is a great bet for most workloads.',
            },
            { id: 'oldest', text: 'The item that was added first', why: 'That’s FIFO. Simple, but it evicts popular old items too.' },
            { id: 'biggest', text: 'The biggest item', why: 'Some caches weigh size, but that’s not what LRU means.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Cache-aside in miniature',
      startDesign: design(
        [N('client', 'client', 0, 200), N('web', 'web-server', 240, 200), N('db', 'sql-db', 500, 280)],
        [
          ['client', 'web'],
          ['web', 'db'],
        ],
      ),
      palette: ['cache'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'cache', count: 1, slot: { x: 500, y: 100 }, text: 'Place a **Cache** beside the database.' },
        {
          t: 'connect',
          from: 'web-server',
          to: 'cache',
          text: 'Connect the **Server → Cache**. The server checks the cache first, and only misses go on to the DB.',
        },
        {
          t: 'simulate',
          text: 'Run 900 req/s of reads and watch where they go.',
          expect: 'pass',
          scenario: scenario(phase('Reads', 900, { queryCost: 3 })),
          explainPass: '80% of reads are **hits** and never touch the database. Only the 20% misses reach it.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Black Friday',
      startDesign: replicaEnd,
      palette: ['cache'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        {
          t: 'say',
          text: 'Black Friday. Product pages got richer: each one now needs **3 database queries** (product, price, reviews). Your replicas are about to feel it.',
        },
        {
          t: 'simulate',
          text: 'Run Black Friday traffic.',
          expect: 'fail',
          scenario: scenario(sale()),
          explainFail: 'Both replicas are overloaded. You could add more replicas, but most of these queries return the *same* answers again and again.',
        },
        { t: 'place', block: 'cache', count: 1, slot: { x: 860, y: 20 }, text: 'Place a **Cache**.' },
        { t: 'connect', from: 'web-server', to: 'cache', count: 4, text: 'Connect **every** web server to the cache.' },
        {
          t: 'simulate',
          text: 'Run Black Friday again.',
          expect: 'pass',
          scenario: scenario(sale()),
          explainPass: 'The cache absorbs ~80% of reads in about a millisecond each. The replicas relax.',
          hints: ['All four servers need an arrow to the cache. A server without one sends every read to the DB.'],
        },
        {
          t: 'reason',
          question: 'A product’s price changes, but shoppers see the old price for up to 5 minutes. Which knob controls that?',
          options: [
            {
              id: 'ttl',
              text: 'The cache entry’s TTL (time-to-live), or explicitly invalidating the key on update',
              correct: true,
              why: 'Yes. A shorter TTL gives fresher data but more DB load. For prices, invalidate the key whenever the price is written.',
            },
            { id: 'size', text: 'The cache’s memory size', why: 'Size affects how much fits, not how long a stale entry survives.' },
            { id: 'replicas', text: 'The number of DB replicas', why: 'The stale value is coming from the cache, not the database.' },
          ],
        },
        {
          t: 'simulate',
          text: 'One more thing: what if the cache restarts?',
          expect: 'observe',
          chaos: { title: 'Cache flushed', body: 'A deploy restarted the cache node. It comes back empty.' },
          scenario: scenario(sale({ label: 'Cold cache', failures: [{ block: 'cache' }] })),
          explainFail:
            '**Thundering herd**: with a cold cache, every request slams the database at once. Real systems run cache clusters with replicas, warm caches gradually, and coalesce duplicate requests. The lesson: a cache is a *performance layer*, so make sure the database underneath can survive without it for a while.',
          explainPass: 'You survived even a cold cache. Your database has real headroom.',
        },
      ],
    },
  ],
}
