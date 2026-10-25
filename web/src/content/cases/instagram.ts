import { N, design, free, phase, scenario } from '../chapters/ch1/_kit'
import type { CaseStudy } from './types'

const SOURCES = {
  powers: { label: 'What Powers Instagram (2011)', url: 'https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad' },
  ids: { label: 'Sharding & IDs at Instagram', url: 'https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c' },
  hs: { label: 'High Scalability: Instagram architecture', url: 'https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/' },
}

const evening = (extra = {}) => phase('Evening peak', 2000, { staticRatio: 0.5, writeRatio: 0.02, ...extra })

const DJANGO = 'Django App'

/** Roughly what Instagram ran in late 2011, one box per tier. */
const expert2011 = design(
  [
    N('client', 'client', 0, 240),
    N('cdn', 'cdn', 240, 60, { label: 'CloudFront' }),
    N('s3', 'object-storage', 500, 60, { label: 'S3 photos' }),
    N('lb', 'load-balancer', 240, 300, { label: 'ELB' }),
    N('app1', 'service', 500, 220, { label: DJANGO, tier: 'm' }),
    N('app2', 'service', 500, 380, { label: DJANGO, tier: 'm' }),
    N('cache', 'cache', 760, 200, { label: 'memcached' }),
    N('db', 'sql-db', 760, 380, { label: 'Postgres' }),
    N('replica', 'read-replica', 1000, 380, { label: 'Postgres replica' }),
  ],
  [
    ['client', 'cdn'],
    ['cdn', 's3'],
    ['client', 'lb'],
    ['lb', 'app1'],
    ['lb', 'app2'],
    ['app1', 'cache'],
    ['app2', 'cache'],
    ['app1', 'db'],
    ['app2', 'db'],
    ['db', 'replica'],
  ],
)

const sharded = design(
  [
    ...expert2011.nodes,
    N('router', 'shard-router', 760, 560, { label: 'Shard map' }),
    N('db2', 'sql-db', 1000, 560, { label: 'Postgres 2' }),
    N('db3', 'sql-db', 1000, 720, { label: 'Postgres 3' }),
  ],
  [
    ...expert2011.edges.filter((e) => !(e.to === 'db' && e.from.startsWith('app'))).map((e) => [e.from, e.to] as [string, string]),
    ['app1', 'router'],
    ['app2', 'router'],
    ['router', 'db'],
    ['router', 'db2'],
    ['router', 'db3'],
  ],
)

export const instagram: CaseStudy = {
  company: 'Instagram',
  era: '2010 – 2012',
  difficulty: 'medium',
  tags: ['photos', 'feed', 'CDN', 'sharding'],
  recommended: 'ch1',
  lesson: {
    id: 'case-instagram',
    chapter: 'cases',
    kind: 'case',
    title: 'Instagram’s photo feed',
    concern: '14 million users, terabytes of photos, three engineers. Design what they built.',
    unlocks: [],
    minutes: 30,
    sections: [
      {
        kind: 'concept',
        tab: 'Scope',
        title: 'Requirements, numbers and the API',
        startDesign: design([N('client', 'client', 0, 200), N('api', 'service', 280, 200, { label: 'Photo API', tier: 'm' })], [['client', 'api']]),
        palette: [],
        goals: [],
        steps: [
          {
            t: 'say',
            speaker: 'pm',
            text: '“Design Instagram as it was at the end of 2011: people post square photos, follow friends and scroll a feed of their photos. About **14 million users**, run by **three engineers**.”',
          },
          {
            t: 'requirements',
            text: 'First, scope it. Which of these do you design in the next 45 minutes?',
            items: [
              { text: 'Upload a photo with a caption', inScope: true, why: 'The core write path.' },
              { text: 'Follow other users', inScope: true, why: 'The feed is built from who you follow.' },
              { text: 'A home feed of followed users’ photos, newest first', inScope: true, why: 'The core read path and most of the traffic.' },
              { text: 'Like a photo', inScope: true, why: 'Small, very frequent writes. Worth showing how they’re stored.' },
              { text: 'Video and Stories', inScope: false, why: 'Didn’t exist yet, and they’re a different storage problem.' },
              { text: 'Direct messages', inScope: false, why: 'A separate chat system. Mention it, then park it.' },
              { text: 'The photo filters themselves', inScope: false, why: 'They ran on the phone, not the servers.' },
            ],
          },
          {
            t: 'estimate',
            question: 'Users upload about **2 million photos a day**. Roughly how many uploads per second is that?',
            unit: 'photos/s',
            answer: 25,
            tolerance: 2,
            working: '2,000,000 ÷ 86,400 s ≈ **23/s** on average. Instagram reported about **25 photos and 90 likes per second** at the time. Writes are tiny; reads are the real load.',
          },
          {
            t: 'estimate',
            question: 'Each of 14M users opens the feed about **10 times a day**. Feed loads per second, on average?',
            unit: 'loads/s',
            answer: 1600,
            tolerance: 2,
            working: '14M × 10 = 140M a day ÷ 86,400 ≈ **1,600/s**, and evening peaks run higher. Every load pulls a page of photos, so most bytes are images.',
          },
          {
            t: 'api',
            node: 'api',
            text: 'Write the API the iPhone app needs: **upload** a photo, read **your feed** in pages, and **like** a photo. Phones retry on bad networks, and only logged-in users can post.',
            rules: [
              { kind: 'has', method: 'POST', path: '/photos' },
              { kind: 'idempotent', method: 'POST', path: '/photos' },
              { kind: 'auth', method: 'POST', path: '/photos' },
              { kind: 'has', method: 'GET', path: '/feed' },
              { kind: 'paginated', path: '/feed' },
              { kind: 'has', method: 'POST', path: '/photos/{id}/likes' },
              { kind: 'versioned' },
              { kind: 'nouns' },
            ],
            solution: [
              { method: 'POST', path: '/v1/photos', idempotencyKey: true, auth: true },
              { method: 'GET', path: '/v1/feed', paginated: true, auth: true },
              { method: 'POST', path: '/v1/photos/{id}/likes', idempotencyKey: true, auth: true },
            ],
            hints: ['A like is a new thing *under* a photo: `/photos/{id}/likes`.', 'The feed is “mine”, so `/v1/feed` with Login on is fine.'],
          },
          {
            t: 'reveal',
            title: 'Their API',
            text: 'Instagram’s public API (v1, 2011) looked much like yours: `GET /v1/users/self/feed` for the feed, `POST /v1/media/{id}/likes` to like, and lists paged with a cursor (`max_id`), never page numbers.\n\nThe big lesson: a like is its own resource under the photo, not a `likePhoto` action.',
          },
        ],
      },
      {
        kind: 'drill',
        tab: 'High-level design',
        title: 'Serve the evening peak',
        startDesign: design([N('client', 'client', 0, 240)]),
        palette: ['load-balancer', 'service', 'sql-db', 'read-replica', 'cache', 'cdn', 'object-storage'],
        goals: [{ kind: 'maxErrorRate', value: 0.01 }, { kind: 'noSPOF' }],
        steps: [
          {
            t: 'say',
            text: 'Now the boxes. Evening peak is **2,000 requests/s**: half are photo downloads, almost all the rest are feed reads, and 2% are uploads and likes. Nothing may be a single point of failure. Rename your services so the design reads like a diagram.',
          },
          {
            t: 'simulate',
            text: 'Build it, then run the evening peak.',
            expect: 'pass',
            scenario: scenario(evening()),
            explainPass: 'It holds. Now see what they actually ran.',
            explainFail: 'Not yet. Photos are static files, feed reads repeat a lot, and every tier needs a spare.',
            hints: [
              'Photos shouldn’t touch your app servers at all.',
              'Users → CDN → Object Storage for photos; Users → Load Balancer → two app services → cache + database for everything else.',
            ],
            solution: free(expert2011.nodes, expert2011.edges.map((e) => [e.from, e.to])),
          },
          {
            t: 'reveal',
            title: 'What Instagram ran in 2011',
            expert: expert2011,
            text: 'Photos went straight to **Amazon S3** and were served through **CloudFront**, so app servers never touched image bytes. Requests hit an **Elastic Load Balancer**, then a fleet of stateless **Django** servers. Data lived in **PostgreSQL** with streaming replicas, and **memcached** sat in front of it for feeds and counts.\n\nNothing exotic: boring, proven parts, so three engineers could keep it running.',
            sources: [SOURCES.powers, SOURCES.hs],
          },
          {
            t: 'reason',
            question: 'Why serve photos from S3 + CloudFront instead of from the Django servers?',
            options: [
              {
                id: 'bytes',
                text: 'Images are most of the bytes. A CDN serves them from near the user, and app servers stay free for feed logic',
                correct: true,
                why: 'Yes. Moving static bytes out of the app tier is usually the single biggest win in a read-heavy system.',
              },
              {
                id: 'cheaper-db',
                text: 'So the photos don’t have to be stored anywhere',
                why: 'They still have to be stored, in S3. The CDN is a cache in front of it.',
              },
              {
                id: 'security',
                text: 'Because Django can’t send binary files',
                why: 'It can; it’s just a waste of an app server to do it.',
              },
            ],
          },
        ],
      },
      {
        kind: 'level',
        tab: 'Deep dives',
        title: 'When one Postgres isn’t enough',
        startDesign: expert2011,
        palette: ['shard-router', 'sql-db', 'nosql-db', 'read-replica'],
        goals: [{ kind: 'maxErrorRate', value: 0.01 }],
        steps: [
          {
            t: 'say',
            speaker: 'oncall',
            mood: 'worried',
            text: '2012. Likes and comments grow faster than photos. The main Postgres box holds **3 TB** of data and has room for 1 TB. Writes are starting to fail.',
          },
          {
            t: 'simulate',
            text: 'Run the evening peak with today’s data.',
            expect: 'fail',
            predict: false,
            scenario: scenario(evening({ writeRatio: 0.05, dataGB: 3000 })),
            explainFail: 'The database is full, so every new photo, like and follow fails. A bigger box only buys a few months.',
          },
          {
            t: 'fork',
            question: 'Where does the data go?',
            options: [
              {
                id: 'shard',
                label: 'Shard Postgres by user',
                pitch: 'Split the data by user ID across three Postgres servers, behind a shard map.',
                consequence: 'Each server holds a third. Queries for one user stay on one shard; queries across users get harder.',
                patch: {
                  removeEdges: [
                    { from: 'app1', to: 'db' },
                    { from: 'app2', to: 'db' },
                  ],
                  addNodes: sharded.nodes.filter((n) => ['router', 'db2', 'db3'].includes(n.id)),
                  addEdges: [
                    { from: 'app1', to: 'router' },
                    { from: 'app2', to: 'router' },
                    { from: 'router', to: 'db' },
                    { from: 'router', to: 'db2' },
                    { from: 'router', to: 'db3' },
                  ],
                },
              },
              {
                id: 'nosql',
                label: 'Move to a NoSQL store',
                pitch: 'Migrate to a distributed NoSQL database that spreads data on its own.',
                consequence: 'Lots of room, but you lose joins and transactions, and you migrate everything while it’s live.',
                patch: {
                  removeEdges: [
                    { from: 'app1', to: 'db' },
                    { from: 'app2', to: 'db' },
                  ],
                  addNodes: [N('nosql', 'nosql-db', 760, 560, { label: 'NoSQL cluster' })],
                  addEdges: [
                    { from: 'app1', to: 'nosql' },
                    { from: 'app2', to: 'nosql' },
                  ],
                },
              },
            ],
          },
          {
            t: 'simulate',
            text: 'Same evening, same 3 TB.',
            expect: 'pass',
            scenario: scenario(evening({ writeRatio: 0.05, dataGB: 3000 })),
            explainPass: 'Writes flow again. Now compare with what Instagram did.',
            hints: ['If you went another way, rewind on the timeline and try sharding.'],
          },
          {
            t: 'reveal',
            title: 'Instagram’s sharding',
            expert: sharded,
            text: 'Instagram kept Postgres and sharded it by user ID, with a twist: they made **thousands of logical shards** (Postgres schemas) and mapped them onto a **handful of physical servers**. When a server filled up, they moved some logical shards to a new machine: no re-splitting of data, no change in which shard a user belongs to.\n\nEven IDs carried the shard: 41 bits of time, 13 bits of logical shard, 10 bits of sequence. Any ID tells you where its row lives.',
            sources: [SOURCES.ids],
          },
          {
            t: 'reason',
            question: 'Why thousands of *logical* shards instead of one shard per server?',
            options: [
              {
                id: 'move',
                text: 'Adding a server means moving whole logical shards, not re-hashing every row',
                correct: true,
                why: 'Exactly. The user → shard mapping never changes; only shard → server does, and that’s a copy plus a config change.',
              },
              {
                id: 'faster',
                text: 'Many small shards make each query faster',
                why: 'Not by itself. A query still runs on one server; the win is in operations, not speed.',
              },
              {
                id: 'replicas',
                text: 'Logical shards don’t need replicas',
                why: 'They still live on servers that need replicas. Logical shards are about moving data, not durability.',
              },
            ],
          },
        ],
      },
    ],
  },
}

