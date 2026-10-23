import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'
import { lbEnd } from './_states'

const uploads = (extra = {}) => phase('Photo uploads', 1600, { writeRatio: 0.05, taskRatio: 0.08, ...extra })
const surge = () => uploads({ label: 'Holiday photo surge', taskRatio: 0.2 })

export const queue: Lesson = {
  id: 'queue',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Do slow work later',
  concern: 'Users upload photos, and resizing each one ties up a web server for over a second.',
  unlocks: ['message-queue', 'worker'],
  sections: [
    {
      kind: 'concept',
      title: 'Decouple with a queue',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        { t: 'concept', block: 'message-queue' },
        { t: 'concept', block: 'worker' },
        {
          t: 'reason',
          question: 'An upload triggers a 1.5 s thumbnail job. Why not just do it inside the request?',
          options: [
            {
              id: 'block',
              text: 'The user waits, and the server is tied up on slow work instead of answering other requests',
              correct: true,
              why: 'Exactly. With a queue, the server says “got it!” in milliseconds and a worker does the heavy lifting in the background.',
            },
            { id: 'cpu', text: 'Web servers can’t resize images', why: 'They can. It’s just a terrible use of the machines that answer users.' },
            { id: 'lost', text: 'The image would be lost', why: 'Not necessarily. The problem is time and capacity, not data loss.' },
          ],
        },
        {
          t: 'reason',
          question: 'Workers fall behind and the queue grows to 10,000 jobs. What happens to users?',
          options: [
            {
              id: 'later',
              text: 'Nothing breaks: thumbnails just appear later. Add workers to catch up',
              correct: true,
              why: 'That’s the beauty of async: the queue absorbs bursts. Scale workers based on **queue depth**.',
            },
            { id: 'errors', text: 'Uploads start failing', why: 'Uploads only need to enqueue a message, which is cheap. The queue keeps accepting.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Hand off a job',
      startDesign: design(
        [N('client', 'client', 0, 200), N('web', 'web-server', 240, 200), N('db', 'sql-db', 500, 100)],
        [
          ['client', 'web'],
          ['web', 'db'],
        ],
      ),
      palette: ['message-queue', 'worker'],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'queueStable' }],
      steps: [
        { t: 'place', block: 'message-queue', count: 1, slot: { x: 500, y: 300 }, text: 'Place a **Message Queue**.' },
        { t: 'place', block: 'worker', count: 1, slot: { x: 740, y: 300 }, text: 'Place a **Worker** to consume it.' },
        { t: 'connect', from: 'web-server', to: 'message-queue', text: 'Connect **Server → Queue** (the server *produces* jobs).' },
        { t: 'connect', from: 'message-queue', to: 'worker', text: 'Connect **Queue → Worker** (the worker *consumes* them).' },
        {
          t: 'simulate',
          text: 'Run 300 req/s where 10% are uploads.',
          expect: 'pass',
          scenario: scenario(phase('Uploads', 300, { taskRatio: 0.1 })),
          explainPass: 'The arrow into the queue is **async**: it doesn’t add to the user’s wait at all.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Thumbnail meltdown',
      startDesign: lbEnd,
      palette: ['message-queue', 'worker'],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'queueStable' }],
      steps: [
        { t: 'say', text: 'You launched photo uploads. Each one needs a thumbnail, and right now the web servers make it during the request.' },
        {
          t: 'simulate',
          text: 'Run upload traffic.',
          expect: 'fail',
          scenario: scenario(uploads()),
          explainFail: 'Only 8% of requests are uploads, but they eat most of the servers’ time. Upload p99 is past 2 seconds.',
        },
        { t: 'place', block: 'message-queue', count: 1, slot: { x: 860, y: 440 }, text: 'Place a **Message Queue**.' },
        { t: 'connect', from: 'web-server', to: 'message-queue', count: 4, text: 'Connect every server to the queue.' },
        { t: 'place', block: 'worker', count: 1, slot: { x: 1100, y: 380 }, text: 'Add a **Worker**.' },
        { t: 'place', block: 'worker', count: 2, slot: { x: 1100, y: 500 }, text: 'And another: each worker handles ~100 jobs/s.' },
        { t: 'connect', from: 'message-queue', to: 'worker', count: 2, text: 'Connect the queue to both workers.' },
        {
          t: 'simulate',
          text: 'Run upload traffic again.',
          expect: 'pass',
          scenario: scenario(uploads()),
          explainPass: 'Servers are calm, uploads return instantly, and the workers keep up with the queue.',
        },
        {
          t: 'simulate',
          text: 'Then the holidays hit: everyone uploads at once.',
          expect: 'observe',
          goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'queueStable' }],
          chaos: { title: 'Upload surge', body: 'New Year’s Eve: 2.5× more uploads than normal.' },
          scenario: scenario(surge()),
          explainFail:
            '**Zero errors**, even under a surge, because the queue absorbed it. But the backlog keeps growing, so thumbnails will be minutes late. Time to scale the consumers.',
          explainPass: 'Your workers had enough headroom for the surge.',
        },
        { t: 'place', block: 'worker', count: 3, slot: { x: 1100, y: 620 }, text: 'Add a third worker…' },
        { t: 'place', block: 'worker', count: 4, slot: { x: 1100, y: 740 }, text: '…and a fourth.' },
        { t: 'connect', from: 'message-queue', to: 'worker', count: 4, text: 'Connect the queue to all four workers.' },
        {
          t: 'simulate',
          text: 'Replay the surge.',
          expect: 'pass',
          scenario: scenario(surge()),
          explainPass: 'The backlog drains. In production you’d autoscale workers on queue depth, so this happens on its own.',
        },
      ],
    },
  ],
}
