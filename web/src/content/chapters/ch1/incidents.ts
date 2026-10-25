import { autoPlay } from '@/engine/lesson/runner'
import type { Lesson, Section } from '@/engine/lesson/types'
import type { BlockId, Design, Goal, RegionZone, Scenario } from '@/engine/types'
import { N, all, design, phase, scenario } from './_kit'
import { cdnEnd, cacheEnd, lbEnd, replicaEnd } from './_states'
import { multiRegion } from './08-multi-region'
import { queue } from './09-queue'

/**
 * Incident drills: short "you got paged" puzzles that bring an old concept back a few lessons later,
 * with no ghost slots or step-by-step guidance. They don't gate progress.
 */

interface IncidentSpec {
  id: string
  title: string
  /** The page you get woken up by. */
  page: string
  due: string
  reviews: BlockId[]
  start: Design
  palette: BlockId[]
  scenario: Scenario
  solution: Design
  goals?: Goal[]
  zones?: RegionZone[]
  explainFail: string
  explainPass: string
  hints: string[]
}

const incident = (s: IncidentSpec): Lesson => ({
  id: s.id,
  chapter: 'ch1',
  kind: 'incident',
  title: s.title,
  concern: s.page,
  unlocks: [],
  due: s.due,
  reviews: s.reviews,
  sections: [
    {
      kind: 'level',
      title: 'Incident',
      startDesign: s.start,
      palette: s.palette,
      zones: s.zones,
      goals: s.goals ?? [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', speaker: 'oncall', mood: 'worried', text: `🔔 **Paged:** ${s.page}` },
        { t: 'simulate', text: 'Replay the traffic from the incident.', expect: 'fail', scenario: s.scenario, explainFail: s.explainFail },
        {
          t: 'simulate',
          text: 'Fix it with what’s in your palette, then replay. No step-by-step this time.',
          expect: 'pass',
          scenario: s.scenario,
          solution: s.solution,
          explainPass: s.explainPass,
          hints: s.hints,
        },
      ],
    },
  ],
})

/** The design a guided level reaches at its first passing run. */
const solvedDesign = (section: Section) => autoPlay(section).find((e) => e.step.t === 'simulate' && e.step.expect === 'pass')!.design

const edgesOf = (d: Design) => d.edges.map((e) => [e.from, e.to] as [string, string])

const lonely = design(
  [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('web1', 'web-server', 420, 200), N('db', 'sql-db', 700, 200)],
  [
    ['client', 'dns'],
    ['dns', 'web1'],
    ['web1', 'db'],
  ],
)

const lbWebs = ['web1', 'web2', 'web3', 'web4']
const lbPlusCache = design(
  [...lbEnd.nodes, N('cache', 'cache', 860, 20)],
  [...edgesOf(lbEnd), ...all(lbWebs, ['cache'])],
)

const multiLevel = multiRegion.sections[multiRegion.sections.length - 1]
const queueLevel = queue.sections[queue.sections.length - 1]

export const incidents: Lesson[] = [
  incident({
    id: 'inc-dead-server',
    title: 'The 3 a.m. disk failure',
    page: '03:12: the site is down. The only web server’s disk died.',
    due: 'replication',
    reviews: ['load-balancer'],
    start: lonely,
    palette: ['load-balancer', 'web-server'],
    scenario: scenario(phase('Night traffic', 800, { writeRatio: 0.1, failures: [{ id: 'web1' }] })),
    solution: design(
      [...lonely.nodes, N('lb', 'load-balancer', 260, 320), N('web2', 'web-server', 420, 360)],
      [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ['web1', 'web2']), ...all(['web1', 'web2'], ['db'])],
    ),
    explainFail: 'One server, zero spares: when it dies, every request dies with it.',
    explainPass: 'The load balancer routes around the dead server. Nobody noticed the disk failure.',
    hints: ['A single machine is a single point of failure. You need a spare, and something to route around the dead one.'],
  }),
  incident({
    id: 'inc-db-reads',
    title: 'Morning rush',
    page: '08:45: the database is at 160% and pages are timing out. Writes look normal.',
    due: 'cache',
    reviews: ['read-replica'],
    start: lbEnd,
    palette: ['read-replica'],
    scenario: scenario(phase('Morning rush', 3000, { writeRatio: 0.05 })),
    solution: replicaEnd,
    explainFail: 'Almost all of that database load is reads, and one machine is answering every one of them.',
    explainPass: 'Replicas soak up the reads; the primary only handles writes.',
    hints: ['Look at the mix: 95% reads. Which block copies the data so more machines can answer reads?'],
  }),
  incident({
    id: 'inc-cold-cache',
    title: 'Cold cache stampede',
    page: '12:01: the cache node rebooted during the lunch peak, and the database fell over right after.',
    due: 'url-shortener',
    reviews: ['cache', 'read-replica'],
    start: lbPlusCache,
    palette: ['read-replica'],
    scenario: scenario(phase('Lunch peak, cache down', 1500, { writeRatio: 0.05, queryCost: 2, failures: [{ block: 'cache' }] })),
    solution: cacheEnd,
    explainFail: 'With the cache gone, every read lands on the one database at once: a thundering herd.',
    explainPass: 'The cache is still down, but replicas give the database tier enough headroom to survive it.',
    hints: ['A cache makes things fast; it shouldn’t be the only thing keeping the database alive. Add headroom behind it.'],
  }),
  incident({
    id: 'inc-logged-out',
    title: 'Random logouts',
    page: 'Support queue is on fire: users get logged out on every other click.',
    due: 'multi-region',
    reviews: ['session-store'],
    start: cdnEnd,
    palette: ['session-store'],
    scenario: scenario(phase('Logged-in shoppers', 2000, { writeRatio: 0.1, sessions: true })),
    solution: design(
      [...cdnEnd.nodes, N('sessions', 'session-store', 860, 420)],
      [...edgesOf(cdnEnd), ...all(lbWebs, ['sessions'])],
    ),
    explainFail: 'Each server keeps sessions in its own memory, and the load balancer sends the next click to a different server.',
    explainPass: 'Every server reads sessions from the shared store, so any server can handle any click.',
    hints: ['Where does “logged in” live right now? Move it somewhere every server can reach.'],
  }),
  incident({
    id: 'inc-slow-uploads',
    title: 'Uploads hang',
    page: 'Uploads take 3 seconds and the web tier is pegged, though only 8% of requests are uploads.',
    due: 'sharding',
    reviews: ['message-queue', 'worker'],
    start: queueLevel.startDesign,
    palette: queueLevel.palette,
    goals: queueLevel.goals,
    scenario: scenario(phase('Photo uploads', 1600, { writeRatio: 0.05, taskRatio: 0.08 })),
    solution: solvedDesign(queueLevel),
    explainFail: 'Thumbnails are made inside the request, so a small share of slow requests eats the servers’ time.',
    explainPass: 'The servers enqueue the job and answer right away; workers make thumbnails in the background.',
    hints: ['Does the user need the thumbnail *before* the upload request returns? Do the slow part later.'],
  }),
  incident({
    id: 'inc-eu-latency',
    title: 'Europe is slow',
    page: 'European p99 is over 250 ms, and the Frankfurt servers are idle.',
    due: 'pastebin',
    reviews: ['geo-dns'],
    start: multiLevel.startDesign,
    palette: multiLevel.palette,
    zones: multiLevel.zones,
    goals: multiLevel.goals,
    scenario: scenario(phase('Global traffic', 1600, { writeRatio: 0.1, euShare: 0.5 })),
    solution: solvedDesign(multiLevel),
    explainFail: 'Plain DNS sends everyone to the US, so Europeans cross the Atlantic on every request.',
    explainPass: 'Geo DNS sends each user to the nearest region.',
    hints: ['DNS can do more than map a name to one address. Which block answers based on where the user is?'],
  }),
]
