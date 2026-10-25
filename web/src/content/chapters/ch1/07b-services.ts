import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'

const CHECKOUT = 'Checkout Service'
const checkout = (extra = {}) => phase('Checkout traffic', 900, { writeRatio: 0.2, ...extra })
const crash = () => checkout({ label: 'Checkout box dies', failures: [{ id: 'checkout' }] })

export const services: Lesson = {
  id: 'services',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Services and machine size',
  concern: 'Checkout keeps slowing the whole shop down. The team wants it running on its own.',
  unlocks: ['service'],
  sections: [
    {
      kind: 'concept',
      title: 'One job, one service',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'So far every server ran *all* of the shop: browsing, login, checkout. When checkout gets busy, browsing slows down too, because they share the same machines.',
        },
        { t: 'concept', block: 'service' },
        {
          t: 'say',
          text: 'A service gets a **name** (what job it does) and a **machine size**. Small, Medium and Large boxes handle 500, 1,000 and 4,000 units/s.',
        },
        {
          t: 'reason',
          question: 'One Large box handles all of checkout with room to spare. What’s the catch?',
          options: [
            {
              id: 'spof',
              text: 'It’s still one machine. When it dies, checkout is down',
              correct: true,
              why: 'Right. Sizing up buys capacity, not survival. One box is a single point of failure no matter how big it is.',
            },
            {
              id: 'slow',
              text: 'Big machines answer each request more slowly',
              why: 'Not really. A bigger box does more work per second at about the same speed per request.',
            },
            {
              id: 'writes',
              text: 'A Large service can’t send writes to the database',
              why: 'Size doesn’t change what a service can talk to. It just does more of it.',
            },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Name it, then size it',
      startDesign: design([N('client', 'client', 0, 200), N('db', 'sql-db', 520, 200)]),
      palette: ['service'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'service', count: 1, slot: { x: 260, y: 200 }, text: 'Place a **Service**.' },
        { t: 'connect', from: 'client', to: 'service', text: 'Connect **Users → Service**.' },
        { t: 'connect', from: 'service', to: 'sql-db', text: 'Connect **Service → SQL Database**.' },
        {
          t: 'configure',
          block: 'service',
          label: CHECKOUT,
          text: `Click the service and rename it to **${CHECKOUT}**. A name says what breaks when it goes down.`,
        },
        {
          t: 'simulate',
          text: 'Black Friday: 1,500 checkouts per second.',
          expect: 'fail',
          scenario: scenario(phase('Black Friday', 1500, { writeRatio: 0.2 })),
          explainFail: 'A Medium box does 1,000 units/s. A third of the checkouts were dropped.',
        },
        {
          t: 'configure',
          block: 'service',
          tier: 'l',
          text: 'Open the service again and set its **Machine size** to **Large**.',
        },
        {
          t: 'simulate',
          text: 'Run Black Friday again.',
          expect: 'pass',
          scenario: scenario(phase('Black Friday', 1500, { writeRatio: 0.2 })),
          explainPass: 'One bigger box, no new wiring. That’s **sizing up** (vertical scaling).',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Keep checkout alive',
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('lb', 'load-balancer', 220, 200),
          N('checkout', 'service', 460, 120, { label: CHECKOUT, tier: 's' }),
          N('db', 'sql-db', 720, 200),
        ],
        [
          ['client', 'lb'],
          ['lb', 'checkout'],
          ['checkout', 'db'],
        ],
      ),
      palette: ['service'],
      goals: [{ kind: 'maxErrorRate', value: 0.01 }],
      steps: [
        {
          t: 'say',
          speaker: 'pm',
          text: 'Checkout is its own service now, but it runs on one **Small** box. Marketing just sent the sale email.',
        },
        {
          t: 'simulate',
          text: 'Run the checkout rush.',
          expect: 'fail',
          scenario: scenario(checkout()),
          explainFail: '900 checkouts a second against a box that does 500. Almost half of them failed.',
        },
        {
          t: 'fork',
          question: 'Checkout needs more room. How do you give it some?',
          options: [
            {
              id: 'out',
              label: 'Scale out: two Medium boxes',
              pitch: 'Resize checkout to Medium and add a second Medium copy behind the load balancer.',
              consequence: 'Each box takes half the traffic. If one dies, the other carries all of it.',
              patch: {
                setProps: [{ id: 'checkout', props: { tier: 'm' } }],
                addNodes: [N('checkout-2', 'service', 460, 300, { label: CHECKOUT, tier: 'm' })],
                addEdges: [
                  { from: 'lb', to: 'checkout-2' },
                  { from: 'checkout-2', to: 'db' },
                ],
              },
            },
            {
              id: 'up',
              label: 'Size up: one Large box',
              pitch: 'Swap the Small box for a Large one. Same wiring, four times the capacity.',
              consequence: 'Huge headroom and nothing new to manage… as long as that one box stays up.',
              patch: { setProps: [{ id: 'checkout', props: { tier: 'l' } }] },
            },
          ],
        },
        {
          t: 'simulate',
          text: 'Run the rush with your fix.',
          expect: 'observe',
          scenario: scenario(checkout()),
          explainPass: 'Every checkout went through. Both fixes have the room. Now a bad day.',
          explainFail: 'Still dropping checkouts. Look at which box is red.',
        },
        {
          t: 'simulate',
          text: 'The original checkout box dies mid-sale.',
          expect: 'observe',
          chaos: { title: 'Box down', body: 'The checkout machine lost its disk.' },
          scenario: scenario(crash()),
          explainPass: 'The second copy took all 900 checkouts a second. Nobody noticed.',
          explainFail: 'Checkout went completely dark. A bigger box is still one box.',
        },
        {
          t: 'simulate',
          text: 'Final check: survive the rush **and** the crash.',
          expect: 'pass',
          scenario: scenario(checkout(), crash()),
          explainPass: 'Two copies, each big enough to carry the whole load alone. That’s **scaling out** (horizontal scaling).',
          hints: [
            'If you sized up, use the **timeline** below to rewind to the decision and try the other branch.',
            'Or place a second Service, connect **Load Balancer → Service → SQL Database**, and check it’s at least Medium.',
          ],
        },
        {
          t: 'reason',
          question: 'When is sizing up the right first move?',
          options: [
            {
              id: 'simple',
              text: 'When you need room fast and a short outage is acceptable',
              correct: true,
              why: 'Yes. Sizing up is quick and needs no code changes, so it’s a fine first step. For anything that must stay up, you add copies too.',
            },
            {
              id: 'never',
              text: 'Never. Always scale out',
              why: 'Too strict. Plenty of systems run happily on one bigger box with backups. Scaling out adds load balancers, stateless code and more to monitor.',
            },
            {
              id: 'always',
              text: 'Always. Big machines can’t fail',
              why: 'Any machine can fail. Size changes how much it can do, not whether it dies.',
            },
          ],
        },
      ],
    },
  ],
}
