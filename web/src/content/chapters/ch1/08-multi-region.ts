import type { Lesson } from '@/engine/lesson/types'
import type { RegionZone } from '@/engine/types'
import { EMPTY, N, all, design, phase, scenario } from './_kit'

const zones: RegionZone[] = [
  { id: 'na', label: 'North America (us-east)', x: 380, y: 30, w: 640, h: 280 },
  { id: 'eu', label: 'Europe (eu-central)', x: 380, y: 360, w: 640, h: 280 },
]

const global = (extra = {}) => phase('Global traffic', 1600, { writeRatio: 0.1, euShare: 0.5, ...extra })

export const multiRegion: Lesson = {
  id: 'multi-region',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Multiple data centers',
  concern: 'Half your users are in Europe, and every click pays a trans-Atlantic round trip.',
  unlocks: ['geo-dns'],
  sections: [
    {
      kind: 'concept',
      title: 'Bring the servers to the users',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'The CDN fixed *static* files for distant users. But every **dynamic** request (search, cart, checkout) still travels to the US and back: ~120 ms you can’t optimize away. Light in fiber is only so fast.',
        },
        { t: 'concept', block: 'geo-dns' },
        {
          t: 'reason',
          question: 'What’s the **hardest** part of running in two regions?',
          options: [
            {
              id: 'data',
              text: 'Keeping the data in sync between regions',
              correct: true,
              why: 'Yes. Servers are easy to copy; data isn’t. You need cross-region replication and a plan for conflicts (e.g. a user edits on both sides), or you pin each user’s data to a home region.',
            },
            { id: 'dns', text: 'Configuring DNS', why: 'Geo routing is a checkbox in most managed DNS services.' },
            { id: 'servers', text: 'Buying more servers', why: 'That’s just money. Consistency across an ocean is the real engineering problem.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Route by geography',
      startDesign: design([
        N('client', 'client', 0, 330),
        N('web-na', 'web-server', 600, 120),
        N('web-eu', 'web-server', 600, 450),
      ]),
      zones,
      palette: ['geo-dns'],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'maxP99', value: 100 }],
      steps: [
        { t: 'say', text: 'The shaded areas are **regions**. Anything you place inside one runs in that data center.' },
        { t: 'place', block: 'geo-dns', count: 1, slot: { x: 180, y: 330 }, text: 'Place **Geo DNS** outside both regions.' },
        { t: 'connect', from: 'client', to: 'geo-dns', text: 'Connect **Users → Geo DNS**.' },
        { t: 'connect', from: 'geo-dns', to: 'web-server', count: 2, text: 'Connect **Geo DNS** to the server in each region.' },
        {
          t: 'simulate',
          text: 'Run half-US, half-EU traffic.',
          expect: 'pass',
          scenario: scenario(phase('Global', 600, { euShare: 0.5 })),
          explainPass: 'Every user is served by their own region. No ocean crossings.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Open the Frankfurt region',
      startDesign: design(
        [
          N('client', 'client', 0, 330),
          N('dns', 'dns', 180, 150),
          N('lb-na', 'load-balancer', 420, 150),
          N('na1', 'web-server', 640, 80),
          N('na2', 'web-server', 640, 220),
          N('db-na', 'sql-db', 860, 150),
          N('lb-eu', 'load-balancer', 420, 480),
          N('eu1', 'web-server', 640, 410),
          N('eu2', 'web-server', 640, 550),
          N('db-eu', 'sql-db', 860, 480),
        ],
        [
          ['client', 'dns'],
          ['dns', 'lb-na'],
          ...all(['lb-na'], ['na1', 'na2']),
          ...all(['na1', 'na2'], ['db-na']),
          ...all(['lb-eu'], ['eu1', 'eu2']),
          ...all(['eu1', 'eu2'], ['db-eu']),
        ],
      ),
      zones,
      palette: ['geo-dns'],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'maxP99', value: 150 }],
      steps: [
        {
          t: 'say',
          text: 'The infra team has racked a full stack in **Frankfurt**, replicating data with the US. But DNS still sends everyone to the US.',
        },
        {
          t: 'simulate',
          text: 'Run global traffic (50% European).',
          expect: 'fail',
          scenario: scenario(global()),
          explainFail: 'The US stack is hot, and European users pay ~120 ms extra on every request. The Frankfurt servers sit idle.',
        },
        { t: 'place', block: 'geo-dns', count: 1, slot: { x: 180, y: 330 }, text: 'Place **Geo DNS**.' },
        {
          t: 'disconnect',
          from: 'client',
          to: 'dns',
          text: 'Remove the old **Users → DNS** arrow (select it, press Delete).',
        },
        { t: 'connect', from: 'client', to: 'geo-dns', text: 'Connect **Users → Geo DNS**.' },
        {
          t: 'connect',
          from: 'geo-dns',
          to: 'load-balancer',
          count: 2,
          text: 'Connect **Geo DNS** to the load balancer in **each** region.',
        },
        {
          t: 'simulate',
          text: 'Run global traffic again.',
          expect: 'pass',
          scenario: scenario(global()),
          explainPass: 'Each user lands in their own region. Latency is down and the load is split in half.',
        },
        {
          t: 'simulate',
          text: 'Now the nightmare scenario: the entire European region goes dark.',
          expect: 'pass',
          goals: [{ kind: 'maxErrorRate', value: 0 }],
          chaos: { title: 'Region outage', body: 'A power failure takes down all of eu-central.' },
          scenario: scenario(global({ label: 'EU outage', failures: [{ region: 'eu' }] })),
          explainPass:
            'Geo DNS failed everyone over to the US. Europeans are slower, but **online**. That’s graceful degradation. (In reality, DNS failover takes a few minutes because of TTLs.)',
        },
      ],
    },
  ],
}
