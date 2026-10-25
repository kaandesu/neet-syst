import { N, design, free, phase, scenario } from '../chapters/ch1/_kit'
import type { CaseStudy } from './types'

const SOURCES = {
  hs: { label: 'High Scalability: Twitter at 150M users', url: 'https://highscalability.com/the-architecture-twitter-uses-to-deal-with-150m-active-users/' },
  qcon: { label: 'Raffi Krikorian, “Timelines at Scale” (QCon 2012)', url: 'https://www.infoq.com/presentations/Twitter-Timeline-Scalability/' },
}

/** Numbers are scaled down 100× so one box can stand for a fleet. */
const peak = (extra = {}) => phase('Peak (÷100)', 3000, { writeRatio: 0.02, taskRatio: 0.02, queryCost: 10, cacheHitRate: 0.95, ...extra })
const celebrity = () => peak({ label: 'A celebrity tweets', taskRatio: 0.15, writeRatio: 0.02 })

/** Building every timeline from the follow graph at read time. */
const naive = design(
  [
    N('client', 'client', 0, 240),
    N('lb', 'load-balancer', 220, 240),
    N('timeline', 'service', 460, 240, { label: 'Timeline Service', tier: 'l' }),
    N('db', 'sql-db', 720, 240, { label: 'Tweets + follows' }),
  ],
  [
    ['client', 'lb'],
    ['lb', 'timeline'],
    ['timeline', 'db'],
  ],
)

/** Fan-out on write: tweets are pushed into every follower's cached timeline. */
const fanout = design(
  [
    N('client', 'client', 0, 240),
    N('lb', 'load-balancer', 220, 240),
    N('timeline', 'service', 460, 160, { label: 'Timeline Service', tier: 'l' }),
    N('timeline2', 'service', 460, 340, { label: 'Timeline Service', tier: 'l' }),
    N('redis', 'cache', 740, 80, { label: 'Redis timelines' }),
    N('db', 'sql-db', 740, 240, { label: 'Tweets + follows' }),
    N('queue', 'message-queue', 740, 420, { label: 'Fanout queue' }),
    N('fan1', 'worker', 1000, 360, { label: 'Fanout Service' }),
    N('fan2', 'worker', 1000, 480, { label: 'Fanout Service' }),
  ],
  [
    ['client', 'lb'],
    ['lb', 'timeline'],
    ['lb', 'timeline2'],
    ['timeline', 'redis'],
    ['timeline2', 'redis'],
    ['timeline', 'db'],
    ['timeline2', 'db'],
    ['timeline', 'queue'],
    ['timeline2', 'queue'],
    ['queue', 'fan1'],
    ['queue', 'fan2'],
  ],
)

export const twitter: CaseStudy = {
  company: 'Twitter',
  era: '2010 – 2013',
  difficulty: 'hard',
  tags: ['timeline', 'fan-out', 'queues', 'caching'],
  recommended: 'ch2',
  lesson: {
    id: 'case-twitter',
    chapter: 'cases',
    kind: 'case',
    title: 'Twitter’s home timeline',
    concern: '300,000 timeline reads a second, and one celebrity tweet has 30 million readers.',
    unlocks: [],
    minutes: 35,
    sections: [
      {
        kind: 'concept',
        tab: 'Scope',
        title: 'Requirements, numbers and the API',
        startDesign: design([N('client', 'client', 0, 200), N('api', 'service', 280, 200, { label: 'Twitter API', tier: 'm' })], [['client', 'api']]),
        palette: [],
        goals: [],
        steps: [
          {
            t: 'say',
            speaker: 'pm',
            text: '“Design the Twitter home timeline: you post short tweets, you follow people, and your home page shows their latest tweets. Around **150M active users**.”',
          },
          {
            t: 'requirements',
            text: 'Scope it. What’s in?',
            items: [
              { text: 'Post a tweet', inScope: true, why: 'The write path.' },
              { text: 'Follow and unfollow', inScope: true, why: 'Decides whose tweets land in your timeline.' },
              { text: 'Home timeline: tweets from people you follow, newest first', inScope: true, why: 'The read path, and the hard part.' },
              { text: 'Search', inScope: false, why: 'A separate index and system entirely.' },
              { text: 'Trends', inScope: false, why: 'Stream processing; a different interview.' },
              { text: 'Direct messages', inScope: false, why: 'Private messaging; park it.' },
            ],
          },
          {
            t: 'estimate',
            question: 'Twitter reported about **300,000 timeline reads/s** against about **6,000 tweets/s**. How many reads per write?',
            unit: 'reads per write',
            answer: 50,
            tolerance: 1.5,
            working: '300,000 ÷ 6,000 = **50**. A system that reads 50× more than it writes should do the expensive work at *write* time, once, rather than on every read.',
          },
          {
            t: 'api',
            node: 'api',
            text: 'Write the API: **post a tweet** and **read your home timeline**. Both need a logged-in user, phones retry, and timelines are endless.',
            rules: [
              { kind: 'has', method: 'POST', path: '/tweets' },
              { kind: 'idempotent', method: 'POST', path: '/tweets' },
              { kind: 'auth', method: 'POST', path: '/tweets' },
              { kind: 'has', method: 'GET', path: '/timeline' },
              { kind: 'paginated', path: '/timeline' },
              { kind: 'auth', method: 'GET', path: '/timeline' },
              { kind: 'versioned' },
              { kind: 'nouns' },
            ],
            solution: [
              { method: 'POST', path: '/v1/tweets', idempotencyKey: true, auth: true },
              { method: 'GET', path: '/v1/timeline', paginated: true, auth: true },
            ],
          },
          {
            t: 'reveal',
            title: 'Their API',
            text: 'Twitter’s API 1.1 had `POST statuses/update` and `GET statuses/home_timeline`. The timeline was paged by tweet ID with `since_id` and `max_id`, a cursor that stays correct while new tweets keep arriving.\n\nTheir paths were older RPC style. Your resource-style paths are what most APIs look like today.',
          },
        ],
      },
      {
        kind: 'drill',
        tab: 'High-level design',
        title: 'The fail whale',
        startDesign: naive,
        palette: ['load-balancer', 'service', 'cache', 'sql-db', 'read-replica', 'message-queue', 'worker'],
        goals: [{ kind: 'maxErrorRate', value: 0.01 }, { kind: 'queueStable' }],
        steps: [
          {
            t: 'say',
            text: 'Numbers here are **scaled down 100×**, so one box stands for a fleet: 3,000 timeline reads/s, 60 tweets/s. Today, every timeline read queries the follow graph and merges tweets: about **10 queries per read**.',
          },
          {
            t: 'simulate',
            text: 'Run the peak on today’s design.',
            expect: 'fail',
            scenario: scenario(peak()),
            explainFail: 'The database drowns: 3,000 reads × 10 queries each. This is the fail whale.',
          },
          {
            t: 'simulate',
            text: 'Redesign it so the peak holds and the work keeps up. Name your services.',
            expect: 'pass',
            scenario: scenario(peak()),
            explainPass: 'It holds. See how Twitter did it.',
            hints: [
              'Reads repeat: the same timeline is read over and over. Keep it ready in a cache.',
              'Building a timeline is slow work. Do it once per tweet, in the background: a queue and workers.',
              'Two big Timeline Services → Redis cache + database; both → a queue → fanout workers.',
            ],
            solution: free(fanout.nodes, fanout.edges.map((e) => [e.from, e.to])),
          },
          {
            t: 'reveal',
            title: 'Fan-out on write',
            expert: fanout,
            text: 'Twitter flipped the work around. When you tweet, a **Fanout Service** looks up your followers and inserts the tweet ID into each follower’s timeline, a list kept in **Redis**. Reading your timeline is then one cache lookup, no joins.\n\nWrites got much more expensive (one tweet, thousands of inserts), but there are 50× fewer of them, and they happen in the background.',
            sources: [SOURCES.qcon, SOURCES.hs],
          },
          {
            t: 'reason',
            question: 'What does fan-out on write trade away?',
            options: [
              {
                id: 'write-amp',
                text: 'Each tweet becomes thousands of writes, and timelines show it a little later',
                correct: true,
                why: 'Yes. You pay a lot at write time, in the background, so the far more common read is nearly free.',
              },
              {
                id: 'consistency',
                text: 'Timelines can never be correct',
                why: 'They’re correct, just eventually: a tweet shows up after the fanout finishes, usually within seconds.',
              },
              {
                id: 'nothing',
                text: 'Nothing; it’s strictly better',
                why: 'Look at the next deep dive.',
              },
            ],
          },
        ],
      },
      {
        kind: 'level',
        tab: 'Deep dives',
        title: 'The celebrity problem',
        startDesign: fanout,
        palette: ['worker', 'message-queue', 'cache'],
        goals: [{ kind: 'maxErrorRate', value: 0.01 }, { kind: 'queueStable' }],
        steps: [
          {
            t: 'say',
            speaker: 'oncall',
            mood: 'worried',
            text: 'A pop star with **30 million followers** just tweeted. That’s 30M timeline inserts for one tweet, and the fanout queue is climbing.',
          },
          {
            t: 'simulate',
            text: 'Replay the celebrity tweet.',
            expect: 'fail',
            scenario: scenario(celebrity()),
            explainFail: 'Fanout work jumped 7×. The workers fall behind and the backlog grows every second: followers see the tweet minutes late.',
          },
          { t: 'place', block: 'worker', count: 5, text: 'Add fanout workers until there are **5**.' },
          { t: 'connect', from: 'message-queue', to: 'worker', count: 5, text: 'Connect the **queue** to every worker.' },
          {
            t: 'simulate',
            text: 'Replay it.',
            expect: 'pass',
            scenario: scenario(celebrity()),
            explainPass: 'The queue keeps up… today. The next celebrity has 100M followers.',
          },
          {
            t: 'reveal',
            title: 'Twitter’s hybrid',
            text: 'More workers only moves the line. Twitter’s real fix was a **hybrid**: accounts with huge followings *skip* fanout. Their tweets are fetched at read time and merged into your cached timeline when you open it.\n\nSo most tweets are pushed (cheap reads), a few celebrity tweets are pulled (cheap writes), and nobody waits minutes for a pop star’s tweet.',
            sources: [SOURCES.qcon],
          },
          {
            t: 'reason',
            question: 'Why not just keep adding workers?',
            options: [
              {
                id: 'waste',
                text: 'Most of those 30M inserts go to timelines nobody opens soon; it’s huge work for little value, and still slow',
                correct: true,
                why: 'Right. Pushing to inactive users is wasted work. Pulling celebrity tweets on read costs a small merge only for people who actually look.',
              },
              {
                id: 'cost',
                text: 'Workers are expensive',
                why: 'They are, but the deeper issue is that the work itself is wasteful and arrives in bursts.',
              },
              {
                id: 'queue',
                text: 'Queues can’t hold 30M messages',
                why: 'They can. The problem is how long it takes to drain them, and whether that work was needed.',
              },
            ],
          },
        ],
      },
    ],
  },
}
