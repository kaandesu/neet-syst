import type { Lesson } from '@/engine/lesson/types'
import type { Endpoint } from '@/engine/types'
import { EMPTY, N, design, phase, scenario } from '../ch1/_kit'

const flaky = (rps: number, writeRatio: number, retryShare: number, label = 'Flaky mobile networks') => phase(label, rps, { writeRatio, retryShare })

const CHECKOUT: Endpoint[] = [
  { method: 'POST', path: '/v1/orders' },
  { method: 'GET', path: '/v1/orders/{id}' },
  { method: 'POST', path: '/v1/payments' },
]

export const idempotency: Lesson = {
  id: 'api-idempotency',
  chapter: 'ch2',
  kind: 'unit',
  title: 'Safe retries',
  concern: 'Customers on bad Wi-Fi are getting charged twice.',
  unlocks: [],
  minutes: 12,
  sections: [
    {
      kind: 'concept',
      title: 'The response that never came back',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'A phone sends `POST /payments`. The server charges the card… and the reply gets lost in a tunnel. The app sees a timeout. It has no idea whether the payment happened.',
        },
        {
          t: 'reason',
          question: 'What should the app do after the timeout?',
          options: [
            {
              id: 'key',
              text: 'Retry, sending the same **Idempotency-Key** as the first try',
              correct: true,
              why: 'Yes. The server remembers each key: if it already did the work, it replays the saved answer instead of charging again.',
            },
            {
              id: 'retry',
              text: 'Just retry the request',
              why: 'If the first try went through, that’s a second charge. Retrying blindly is how double payments happen.',
            },
            {
              id: 'give-up',
              text: 'Show an error and don’t retry',
              why: 'Safe, but the customer might have paid with nothing to show for it, or walk away from a sale that would have worked.',
            },
          ],
        },
        {
          t: 'say',
          text: 'An operation is **idempotent** if doing it twice has the same effect as doing it once. `GET`, `PUT` and `DELETE` already are: deleting order 42 twice still leaves it deleted. `POST` creates something new each time, so it needs a key. Here’s how a key works, step by step.',
        },
        { t: 'idea', idea: 'idempotency-key' },
        {
          t: 'reason',
          question: 'When should the app make a new Idempotency-Key?',
          options: [
            {
              id: 'per-action',
              text: 'Once, when the user taps **Pay**, then reuse it for every retry of that payment',
              correct: true,
              why: 'Yes. One key per *intended* action. Every retry of that action carries the same key, so the server can recognise it.',
            },
            {
              id: 'per-request',
              text: 'A fresh key for every request, retries included',
              why: 'Then every retry looks brand new to the server, and you’re back to double charges. The key must survive the retry.',
            },
            {
              id: 'per-install',
              text: 'One key per app install, reused forever',
              why: 'Then the second, *different* payment would get the first payment’s saved answer. The user pays once and buys twice.',
            },
          ],
        },
        {
          t: 'reason',
          question: 'A retry arrives with key `k_7f3a`, but the amount changed from $20 to $200. What should the server do?',
          options: [
            {
              id: 'reject',
              text: 'Reject it (422): that key already belongs to a different request',
              correct: true,
              why: 'Right. A key stands for one exact request. Reusing it with a different body is a client bug, and guessing which one was meant could charge the wrong amount.',
            },
            {
              id: 'replay',
              text: 'Replay the saved $20 answer',
              why: 'The client asked for $200 and is told it succeeded. Now the two sides disagree about what happened.',
            },
            {
              id: 'charge',
              text: 'Charge the new $200',
              why: 'Then the key protects nothing: any retry with a slightly different body sneaks through as a second charge.',
            },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Stop the double charges',
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('payments', 'service', 260, 200, { label: 'Payments Service', tier: 'm', api: [{ method: 'POST', path: '/v1/payments' }] }),
          N('db', 'sql-db', 520, 200),
        ],
        [
          ['client', 'payments'],
          ['payments', 'db'],
        ],
      ),
      palette: [],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'noDuplicates' }],
      steps: [
        {
          t: 'simulate',
          text: 'Run a day of payments. One in ten replies gets lost, so the app retries.',
          expect: 'fail',
          predict: false,
          scenario: scenario(flaky(200, 0.5, 0.1)),
          explainFail: 'Ten payments a second ran twice. Every one is a customer charged double and a support ticket.',
        },
        {
          t: 'api',
          node: 'payments',
          text: 'Make `POST /v1/payments` safe to retry.',
          rules: [{ kind: 'idempotent', method: 'POST', path: '/payments' }],
          solution: [{ method: 'POST', path: '/v1/payments', idempotencyKey: true }],
          hints: ['Each endpoint row has an **Idem-Key** toggle.'],
        },
        {
          t: 'simulate',
          text: 'Same day, same lost replies.',
          expect: 'pass',
          scenario: scenario(flaky(200, 0.5, 0.1)),
          explainPass: 'The retries still happen, but the server recognises each key and replays the first answer. Nobody pays twice.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Checkout on a bad network',
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('lb', 'load-balancer', 220, 200),
          N('checkout', 'service', 460, 200, { label: 'Checkout Service', tier: 'm', api: CHECKOUT }),
          N('db', 'sql-db', 720, 200),
        ],
        [
          ['client', 'lb'],
          ['lb', 'checkout'],
          ['checkout', 'db'],
        ],
      ),
      palette: [],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'noDuplicates' }],
      steps: [
        {
          t: 'say',
          speaker: 'oncall',
          mood: 'worried',
          text: 'Support has 40 tickets about duplicate orders since the app launched. It’s worst on trains.',
        },
        {
          t: 'simulate',
          text: 'Replay a sale with flaky mobile networks.',
          expect: 'fail',
          predict: false,
          scenario: scenario(flaky(800, 0.3, 0.05)),
          explainFail: 'A dozen orders and payments a second ran twice. The servers are fine; the API just can’t tell a retry from a new request.',
        },
        {
          t: 'api',
          node: 'checkout',
          text: 'Make checkout safe to retry. Only add keys where they’re needed.',
          rules: [
            { kind: 'idempotent', method: 'POST', path: '/orders' },
            { kind: 'idempotent', method: 'POST', path: '/payments' },
            { kind: 'has', method: 'GET', path: '/orders/{id}' },
          ],
          solution: CHECKOUT.map((e) => (e.method === 'POST' ? { ...e, idempotencyKey: true } : e)),
          hints: ['Which rows *create* something each time they run? Those are the ones a retry can duplicate.'],
        },
        {
          t: 'simulate',
          text: 'Run the sale again, and then a network blip where a third of writes get retried.',
          expect: 'pass',
          chaos: { title: 'Network blip', body: 'A mobile carrier is dropping packets. Retries spike.' },
          scenario: scenario(flaky(800, 0.3, 0.05), flaky(800, 0.3, 0.3, 'Carrier blip')),
          explainPass: 'Even with a third of writes retried, every order exists exactly once.',
        },
        {
          t: 'reason',
          question: 'Why doesn’t `GET /v1/orders/{id}` need an Idempotency-Key?',
          options: [
            {
              id: 'safe',
              text: 'Reading changes nothing, so reading twice is harmless',
              correct: true,
              why: 'Exactly. `GET` is *safe*: no side effects at all. Keys only matter where a repeat would change something.',
            },
            {
              id: 'cached',
              text: 'Because the response is cached',
              why: 'Caching may or may not happen. Even uncached, a second read does no harm.',
            },
            {
              id: 'fast',
              text: 'Because reads are too fast to time out',
              why: 'Reads time out too. They’re just harmless to repeat.',
            },
          ],
        },
      ],
    },
  ],
}
