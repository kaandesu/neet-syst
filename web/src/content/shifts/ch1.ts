import type { Shift } from '@/engine/shifts/types'
import { N, all, column, design, free, ids, phase } from '../chapters/ch1/_kit'

const shop = (label: string, rps: number, extra = {}) => phase(label, rps, { writeRatio: 0.1, ...extra })

const mondayWebs = column('web', 'web-server', 5, 440, 200, 100)

/** Boss 1: everything from the first five episodes at once. */
export const mondayRush: Shift = {
  id: 'monday-rush',
  chapter: 'ch1',
  after: 'replication',
  title: 'Monday Rush',
  concern: 'A TV spot airs Monday morning. Keep the shop up all day, with whatever you’ve built so far.',
  speaker: 'oncall',
  briefing: [
    { speaker: 'pm', mood: 'happy', text: 'Big news: our ad runs on morning TV **Monday**. Marketing expects traffic to roughly **triple** by lunch.' },
    { speaker: 'oncall', mood: 'worried', text: 'And I’m on call. Last time we had one server and one database, and you remember how that went.' },
    { speaker: 'oncall', text: 'Here’s the shop as it is today. You can use **every block you’ve earned**. No step-by-step this time. Build what you think survives, then start the shift.' },
    { speaker: 'mentor', text: 'Four waves are coming, and one of them takes a server down mid-rush. If it falls over, you get hints and another go. Fewer boxes and lower latency earn extra stars.' },
  ],
  start: design(
    [N('client', 'client', 0, 200), N('dns', 'dns', 200, 200), N('web1', 'web-server', 440, 200, { locked: false }), N('db', 'sql-db', 700, 200, { locked: false })],
    [
      ['client', 'dns'],
      ['dns', 'web1'],
      ['web1', 'db'],
    ],
  ),
  waves: [
    { phase: shop('Coffee break', 1200), line: 'Morning traffic is building. Nothing scary yet.' },
    { phase: shop('Lunch rush', 3000), line: 'The ad just aired. **3,000 requests a second** and climbing.', speaker: 'pm', mood: 'happy' },
    {
      phase: shop('Server down', 3000, { failures: [{ block: 'web-server', nth: 0 }] }),
      line: 'One of the web servers just **died**. Mid-rush, of course.',
    },
    { phase: shop('Evening peak', 4000), line: 'Everyone’s home from work: **4,000 req/s**. Last wave. Hold on.', speaker: 'pm' },
  ],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 300 },
  ],
  par: 10,
  fastMs: 140,
  hints: [
    { text: 'Count the peak first. 4,000 req/s, and one web server does about 1,000. Then ask what happens when one of them dies.' },
    { text: 'Servers need a **load balancer** in front of them. 90% of traffic is reads, and reads can be spread over **read replicas**.' },
    { text: 'DNS → load balancer → five web servers → one primary with two read replicas. Five servers is enough to lose one at peak.' },
  ],
  solution: free(
    [
      N('client', 'client', 0, 200),
      N('dns', 'dns', 200, 200),
      N('lb', 'load-balancer', 260, 200),
      ...mondayWebs,
      N('db', 'sql-db', 700, 200),
      N('rep1', 'read-replica', 920, 140),
      N('rep2', 'read-replica', 920, 260),
    ],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(mondayWebs)), ...all(ids(mondayWebs), ['db']), ['db', 'rep1'], ['db', 'rep2']],
  ),
  debrief: [
    'The peak is 4,000 req/s and a web server handles ~1,000, so four servers would run flat out. Five leaves room to lose one: after a crash, four servers share 3,000 req/s at 75%.',
    'Reads are 90% of traffic. One primary can’t take ~3,600 reads plus the writes, so two read replicas take the reads and the primary keeps the writes.',
    'Interview habit: say the numbers out loud. “Peak is X, one box does Y, so I need X/Y plus one for failures.”',
  ],
}

const launchWebs = column('web', 'web-server', 5, 640, 220, 100)

/** Boss 2: caching and the edge, under a launch-day spike. */
export const launchDay: Shift = {
  id: 'launch-day',
  chapter: 'ch1',
  after: 'cdn',
  title: 'Front Page',
  concern: 'You hit #1 on a launch site. Ten times the traffic, mostly images, and the cache picks today to restart.',
  speaker: 'pm',
  briefing: [
    { speaker: 'pm', mood: 'happy', text: 'We’re **#1 on the launch site**. Traffic is about to go up ten times, and most of it is people looking at product photos.' },
    { speaker: 'oncall', mood: 'worried', text: 'Our setup from last month is on the canvas. It won’t survive this as it is.' },
    { speaker: 'mentor', text: 'Think about *what kind* of traffic this is before adding boxes. Images, repeated reads and writes each want a different path.' },
  ],
  start: design(
    [
      N('client', 'client', 0, 220),
      N('dns', 'dns', 200, 220),
      N('lb', 'load-balancer', 400, 220, { locked: false }),
      N('web1', 'web-server', 640, 170, { locked: false }),
      N('web2', 'web-server', 640, 270, { locked: false }),
      N('db', 'sql-db', 880, 220, { locked: false }),
    ],
    [
      ['client', 'dns'],
      ['dns', 'lb'],
      ['lb', 'web1'],
      ['lb', 'web2'],
      ['web1', 'db'],
      ['web2', 'db'],
    ],
  ),
  waves: [
    { phase: phase('Warm-up', 3000, { writeRatio: 0.05, staticRatio: 0.6 }), line: 'The post just went up. Early birds are arriving.' },
    { phase: phase('Front page', 10000, { writeRatio: 0.05, staticRatio: 0.6 }), line: 'We’re **#1**. Ten thousand requests a second, mostly photos.', speaker: 'pm', mood: 'happy' },
    {
      phase: phase('Cache restart', 8000, { writeRatio: 0.05, staticRatio: 0.6, failures: [{ block: 'cache' }] }),
      line: 'The cache node is **restarting**. Every read is about to hit the database for a minute.',
    },
    { phase: phase('Second wave', 12000, { writeRatio: 0.05, staticRatio: 0.6 }), line: 'The US just woke up. **12,000 req/s.** Final wave.', speaker: 'pm' },
  ],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 300 },
  ],
  par: 13,
  fastMs: 150,
  hints: [
    { text: '60% of requests are images. Those shouldn’t reach your web servers at all.' },
    { text: 'A **CDN** with **object storage** takes the images. A **cache** takes repeated reads, but plan for the moment it restarts.' },
    { text: 'Users → CDN → object storage for images. DNS → LB → five web servers → cache and a primary with two read replicas, so the database tier survives the cache restart.' },
  ],
  solution: free(
    [
      N('client', 'client', 0, 220),
      N('dns', 'dns', 200, 220),
      N('cdn', 'cdn', 200, 460),
      N('store', 'object-storage', 400, 520),
      N('lb', 'load-balancer', 400, 220),
      ...launchWebs,
      N('cache', 'cache', 880, 120),
      N('db', 'sql-db', 880, 280),
      N('rep1', 'read-replica', 1100, 220),
      N('rep2', 'read-replica', 1100, 340),
    ],
    [
      ['client', 'dns'],
      ['dns', 'lb'],
      ['client', 'cdn'],
      ['cdn', 'store'],
      ...all(['lb'], ids(launchWebs)),
      ...all(ids(launchWebs), ['cache', 'db']),
      ['db', 'rep1'],
      ['db', 'rep2'],
    ],
  ),
  debrief: [
    'Images are 60% of requests, so a CDN backed by object storage takes them before they ever reach a server. At the 12,000 req/s peak the servers only see 4,800, so five of them run at about 96%.',
    'The cache absorbs most repeated reads, but a cache restart sends the raw read load to the database tier. A primary plus two replicas can carry that for a minute.',
    'The habit: classify traffic first (static, reads, writes), then give each class its own path.',
  ],
}
