import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, all, design, free, phase, scenario } from './_kit'

const traffic = scenario(
  phase('Normal', 3000, { writeRatio: 0.05 }),
  phase('Viral tweet', 4500, { writeRatio: 0.05 }),
  phase('Server crash', 3000, { writeRatio: 0.05, failures: [{ block: 'web-server', nth: 0 }] }),
)

const webs = ['w1', 'w2', 'w3', 'w4', 'w5']
const solution = free(
  [
    N('client', 'client', 0, 260),
    N('dns', 'dns', 180, 260),
    N('lb', 'load-balancer', 380, 260),
    ...webs.map((id, i) => N(id, 'web-server', 600, 20 + i * 120)),
    N('cache', 'cache', 860, 60),
    N('db', 'sql-db', 860, 300),
    N('r1', 'read-replica', 1100, 220),
    N('r2', 'read-replica', 1100, 380),
  ],
  [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], webs), ...all(webs, ['cache', 'db']), ['db', 'r1'], ['db', 'r2']],
)

export const urlShortener: Lesson = {
  id: 'url-shortener',
  chapter: 'ch1',
  kind: 'capstone',
  title: 'Capstone: URL shortener',
  concern: 'Your first full interview question. Scope it, size it, and build it on your own.',
  unlocks: [],
  sections: [
    {
      kind: 'concept',
      title: 'Scope the problem',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: '“Design a URL shortener like bit.ly.” The most common mistake is to start drawing right away. First, **agree on scope** with your interviewer: what’s in, and what’s explicitly out.',
        },
        {
          t: 'requirements',
          text: 'You have ~45 minutes. Sort each feature: **in scope** for this interview, or **out** (mention it, then park it)?',
          items: [
            { text: 'Create a short link from a long URL', inScope: true, why: 'The core write path. Without it there’s no product.' },
            { text: 'Redirect a short link to the original URL', inScope: true, why: 'The core read path, and ~99% of all traffic.' },
            {
              text: 'Redirects keep working if a server or database dies',
              inScope: true,
              why: 'A non-functional requirement, but a crucial one: broken links break other people’s sites.',
            },
            {
              text: 'Two different URLs never get the same short code',
              inScope: true,
              why: 'Correctness. A collision would send users to the wrong site.',
            },
            { text: 'Custom vanity aliases (sho.rt/my-brand)', inScope: false, why: 'Nice-to-have. Mention it as an extension; it’s mostly a uniqueness check.' },
            {
              text: 'A per-link click analytics dashboard',
              inScope: false,
              why: 'A whole separate system (event pipeline + OLAP store). Park it unless the interviewer asks.',
            },
            { text: 'User accounts and teams', inScope: false, why: 'Doesn’t change the core architecture. Out for now.' },
          ],
        },
        {
          t: 'say',
          text: 'Notice what you just did: **functional** requirements (create, redirect) plus **non-functional** ones (availability, no collisions). Always cover both.',
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Size it and design the key',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'estimate',
          question: 'Users create **100 million** links per month. Writes per second?',
          unit: 'writes/s',
          answer: 40,
          tolerance: 2,
          working: 'A month ≈ 2.5M seconds → 100M ÷ 2.5M ≈ **40 writes/s**. Tiny!',
          hints: ['A month has about 2.5 million seconds.'],
        },
        {
          t: 'estimate',
          question: 'Each link is clicked about **100×** on average. Redirects per second?',
          unit: 'reads/s',
          answer: 4000,
          tolerance: 2,
          working: '40 × 100 = **4,000 reads/s**. This system is read-heavy: design for the redirect path.',
        },
        {
          t: 'estimate',
          question: 'Each link takes ~500 bytes. Storage for **5 years**, in GB?',
          unit: 'GB',
          answer: 3000,
          tolerance: 2,
          working: '100M × 12 × 5 = 6 billion links × 500 B ≈ **3 TB**. It fits on one big database, so sharding isn’t needed yet.',
        },
        {
          t: 'reason',
          question: 'How should you generate the 7-character short code?',
          options: [
            {
              id: 'base62',
              text: 'Take a unique ID (from a counter or ID service) and Base62-encode it',
              correct: true,
              why: '62⁷ ≈ 3.5 trillion codes, more than enough, and unique by construction. (Hashing the URL and truncating also works, but needs collision checks.)',
            },
            {
              id: 'random-words',
              text: 'Pick a random English word',
              why: 'There are only ~100k usable words, so you’d collide constantly within days.',
            },
            {
              id: 'md5',
              text: 'Use the full MD5 hash of the URL',
              why: 'Unique enough, but it’s 32 hex characters. Not exactly “short”.',
            },
          ],
        },
        {
          t: 'reason',
          question: 'Your redirect returns HTTP **301** (permanent) or **302** (temporary). Which one if you might want click analytics later?',
          options: [
            {
              id: '302',
              text: '302: browsers don’t cache it, so every click reaches your servers',
              correct: true,
              why: 'Right. 301 is cheaper for you (browsers remember it), but then you never see repeat clicks. A classic trade-off to mention.',
            },
            { id: '301', text: '301: it’s faster for users', why: 'It is faster on repeat visits, but you lose visibility into every repeat click.' },
          ],
        },
      ],
    },
    {
      kind: 'level',
      title: 'Build it yourself',
      startDesign: design([N('client', 'client', 0, 260)]),
      palette: ['dns', 'load-balancer', 'web-server', 'sql-db', 'nosql-db', 'read-replica', 'cache'],
      goals: [{ kind: 'maxErrorRate', value: 0.01 }, { kind: 'maxP99', value: 200 }, { kind: 'noSPOF' }],
      steps: [
        {
          t: 'say',
          text: 'Your turn. **No slots, no arrows.** Just the blocks you’ve earned. Requirements: ~3,000 redirects/s normally, 4,500 when a link goes viral, and survive any single server or database failure. Watch the goals at the top.',
        },
        {
          t: 'simulate',
          text: 'Build your design, then press **Run traffic**. Run as often as you like.',
          expect: 'pass',
          scenario: traffic,
          explainPass:
            'That’s a design you could defend in an interview: **stateless servers behind an LB, a cache for hot links, replicas for reads and failover.** Notice how every box traces back to a number you estimated.',
          hints: [
            'Start with the request path: Users → DNS → Load Balancer → Servers.',
            'At 4,500 req/s you need at least 5 servers (1,000 req/s each, with headroom).',
            'Redirects are read-heavy: a cache plus read replicas removes the database as a bottleneck *and* a single point of failure.',
          ],
          solution,
        },
      ],
    },
  ],
}
