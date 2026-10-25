import type { Problem } from '@/engine/problems/types'
import { N, all, design, free, phase } from '../chapters/ch1/_kit'

const checkout = (label: string, rps: number, extra = {}) => phase(label, rps, { writeRatio: 0.2, taskRatio: 0.1, ...extra })
const front = [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 360, 200)]
const webs = [N('web1', 'web-server', 560, 120), N('web2', 'web-server', 560, 280)]
const base: [string, string][] = [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ['web1', 'web2']), ...all(['web1', 'web2'], ['db'])]

export const receipts: Problem = {
  id: 'receipts',
  number: 5,
  title: 'Receipts Are Slow',
  difficulty: 'medium',
  tags: ['Message queue', 'Async work'],
  speaker: 'pm',
  story: [
    'ThreadCo sells T-shirts. Checkout takes *three seconds*, and during last month’s sale it started failing outright.',
    'The culprit: after payment, the server renders a PDF receipt and emails it, all *before* responding. One in ten requests is a checkout like that. Customers don’t need the PDF in the next second; they need to see “Order confirmed”.',
  ],
  asks: ['Checkout responds in under 300 ms', 'Every receipt still gets sent', 'Survive the flash sale'],
  outOfScope: ['Payment provider integration', 'Inventory'],
  numbers: [
    { label: 'Normal', value: '400 req/s' },
    { label: 'Flash sale', value: '1,200 req/s' },
    { label: 'Receipts', value: '10% of requests' },
    { label: 'One worker', value: '~100 jobs/s' },
  ],
  skeleton: design([...front, ...webs, N('db', 'sql-db', 780, 200)], base),
  palette: ['web-server', 'sql-db', 'message-queue', 'worker'],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 300 },
    { kind: 'queueStable' },
  ],
  par: 9,
  tests: [
    { label: 'A normal afternoon', phases: [checkout('Normal', 400)] },
    { label: 'Flash sale starts', phases: [checkout('Flash sale', 1200)] },
    { label: 'A worker crashes mid-sale', hidden: true, phases: [checkout('Worker down', 1200, { failures: [{ block: 'worker', nth: 0 }] })] },
  ],
  hints: [
    { text: 'Which part of checkout must happen before the user sees “Order confirmed”, and which part could happen a few seconds later?' },
    { text: 'Hand the slow job to someone else: write it down somewhere durable, respond immediately, and let a background process pick it up.' },
    { text: 'Add a **message queue** behind the web servers and **workers** behind the queue. Count: 120 receipts/s at peak, ~100 per worker, and one may crash.', ghost: { block: 'message-queue', x: 780, y: 380 } },
  ],
  solution: free(
    [
      ...front,
      ...webs,
      N('db', 'sql-db', 780, 120),
      N('q', 'message-queue', 780, 320),
      N('k1', 'worker', 980, 220),
      N('k2', 'worker', 980, 340),
      N('k3', 'worker', 980, 460),
    ],
    [...base, ...all(['web1', 'web2'], ['q']), ...all(['q'], ['k1', 'k2', 'k3'])],
  ),
  editorial: [
    'Doing the receipt inline costs a web server ~25× a normal request and 1.5 s of wall-clock time. Enqueueing it is nearly free, so checkout returns immediately.',
    'Size the workers from the peak: 1,200 req/s × 10% = 120 jobs/s. Two workers just cover it; a third covers one crashing. Otherwise the queue grows forever.',
    '**Interview takeaway:** queues decouple *accepting* work from *doing* it. Always mention what happens when the consumers fall behind (backlog, retries, dead-letter queue).',
  ],
}
