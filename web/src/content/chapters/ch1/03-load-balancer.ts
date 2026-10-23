import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'

const spike = (extra = {}) => phase('Flash sale', 1500, { writeRatio: 0.1, ...extra })

export const loadBalancer: Lesson = {
  id: 'load-balancer',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Scale out with a load balancer',
  concern: 'One server can’t handle your peak, and if it dies, you’re offline.',
  unlocks: ['load-balancer'],
  sections: [
    {
      kind: 'concept',
      title: 'Scale up or scale out?',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'There are two ways to grow. **Scale up** (vertical): buy a bigger machine. **Scale out** (horizontal): add more machines.',
        },
        {
          t: 'reason',
          question: 'Why not just keep buying a bigger server?',
          options: [
            {
              id: 'ceiling',
              text: 'Machine size has a hard ceiling, cost grows faster than power, and it’s still one machine that can fail',
              correct: true,
              why: 'Right. Scaling up is a fine *first* move because it’s simple. But eventually you hit the biggest box money can buy, and you still have a single point of failure.',
            },
            {
              id: 'slower',
              text: 'Bigger servers are slower',
              why: 'They’re genuinely faster, up to a limit. The problem is the limit, the price, and the lack of redundancy.',
            },
            {
              id: 'db',
              text: 'Databases can’t run on big servers',
              why: 'They can, and databases are often scaled up first for exactly that reason.',
            },
          ],
        },
        { t: 'say', text: 'Scaling out needs one new piece: something that sits in front of many servers and shares the work.' },
        { t: 'concept', block: 'load-balancer' },
        {
          t: 'reason',
          question: 'Users now connect to the load balancer, never to a server directly. What does that buy you?',
          options: [
            {
              id: 'pool',
              text: 'You can add, remove or lose servers without users noticing',
              correct: true,
              why: 'Yes. Servers get private addresses and the LB health-checks them. A dead server just stops receiving traffic.',
            },
            {
              id: 'sessions',
              text: 'It remembers who is logged in',
              why: 'A load balancer routes traffic; it doesn’t hold application state. (Where sessions live becomes a problem later!)',
            },
            {
              id: 'faster',
              text: 'Each individual request gets faster',
              why: 'It actually adds a millisecond or two. Its job is spreading load and surviving failures, not speeding up a single request.',
            },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Build a server pool',
      startDesign: design(
        [N('client', 'client', 0, 200), N('lb', 'load-balancer', 220, 200), N('db', 'nosql-db', 700, 200)],
        [['client', 'lb']],
      ),
      palette: ['web-server'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'web-server', count: 1, slot: { x: 460, y: 120 }, text: 'Place a **Web Server** in the top slot.' },
        { t: 'place', block: 'web-server', count: 2, slot: { x: 460, y: 280 }, text: 'And a second one in the bottom slot.' },
        { t: 'connect', from: 'load-balancer', to: 'web-server', count: 2, text: 'Connect the **LB** to **both** servers.' },
        { t: 'connect', from: 'web-server', to: 'nosql-db', count: 2, text: 'Connect **both** servers to the database.' },
        {
          t: 'simulate',
          text: 'Run 1,500 req/s. One server alone would melt.',
          expect: 'pass',
          scenario: scenario(phase('Busy', 1500)),
          explainPass: 'Each server takes about half. Need more capacity? Add another server. That’s horizontal scaling.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Survive the flash sale',
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('dns', 'dns', 180, 200),
          N('web', 'web-server', 600, 200),
          N('db', 'sql-db', 860, 200),
        ],
        [
          ['client', 'dns'],
          ['dns', 'web'],
          ['web', 'db'],
        ],
      ),
      palette: ['load-balancer', 'web-server'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'Marketing is planning a **flash sale**: 1,500 req/s at peak. Your estimate says that’s well past one server.' },
        {
          t: 'simulate',
          text: 'See what happens with today’s design.',
          expect: 'fail',
          scenario: scenario(spike()),
          explainFail: 'One server, 1,500 req/s: it’s drowning. Time to scale out.',
        },
        { t: 'place', block: 'load-balancer', count: 1, slot: { x: 380, y: 200 }, text: 'Place a **Load Balancer** between DNS and the server.' },
        {
          t: 'disconnect',
          from: 'dns',
          to: 'web-server',
          text: 'DNS should point at the load balancer, not at a server. Click the **DNS → Server** arrow and press **Delete** (or its ✕).',
          hints: ['Click right on the arrow line to select it.'],
        },
        { t: 'connect', from: 'dns', to: 'load-balancer', text: 'Connect **DNS → Load Balancer**.' },
        { t: 'place', block: 'web-server', count: 2, slot: { x: 600, y: 60 }, text: 'Add a second **Web Server**.' },
        { t: 'place', block: 'web-server', count: 3, slot: { x: 600, y: 340 }, text: 'And a third. Your estimate said you need room to spare.' },
        { t: 'connect', from: 'load-balancer', to: 'web-server', count: 3, text: 'Connect the **LB** to all three servers.' },
        { t: 'connect', from: 'web-server', to: 'sql-db', count: 3, text: 'Connect all three servers to the **database**.' },
        {
          t: 'simulate',
          text: 'Run the flash sale.',
          expect: 'pass',
          scenario: scenario(spike()),
          explainPass: 'About 500 req/s per server. Comfortable.',
          hints: ['Every server needs an arrow from the LB *and* an arrow to the database.'],
        },
        {
          t: 'simulate',
          text: 'Now the real test: a server crashes in the middle of the sale.',
          expect: 'pass',
          chaos: { title: 'Server down', body: 'web-1’s disk just died. Mid-sale.' },
          scenario: scenario(spike({ label: 'Sale + crash', failures: [{ block: 'web-server', nth: 0 }] })),
          explainPass: 'Zero errors. The LB’s health check noticed and sent traffic to the two survivors. That’s **redundancy**.',
        },
        {
          t: 'reason',
          question: 'Which part of the system is now the biggest risk?',
          options: [
            {
              id: 'db',
              text: 'The single database',
              correct: true,
              why: 'Yes. It’s at ~80% load, and if it dies there’s no backup. Every request needs it. That’s the next lesson.',
            },
            {
              id: 'lb',
              text: 'The load balancer',
              why: 'In real life, managed load balancers run as redundant fleets, so they’re rarely the weak point.',
            },
            { id: 'web', text: 'The web servers', why: 'You just proved they survive a crash. The pool is redundant now.' },
          ],
        },
      ],
    },
  ],
}
