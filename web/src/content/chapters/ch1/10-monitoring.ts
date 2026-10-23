import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, all, design, phase, scenario } from './_kit'

const webs = ['web1', 'web2', 'web3']
const incident = () => phase('Incident', 2400, { writeRatio: 0.05, failures: [{ block: 'read-replica', nth: 0 }] })

export const monitoring: Lesson = {
  id: 'monitoring',
  chapter: 'ch1',
  kind: 'unit',
  title: 'See what’s happening',
  concern: 'Users say the site is “broken sometimes”. Which of your boxes is the problem?',
  unlocks: ['monitoring'],
  sections: [
    {
      kind: 'concept',
      title: 'You can’t fix what you can’t see',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'So far you’ve had x-ray vision: load bars, colors, live metrics. **Real systems don’t give you that for free.** You have to build it.',
        },
        { t: 'concept', block: 'monitoring' },
        {
          t: 'reason',
          question: 'Which signal best tells you that **users** are suffering right now?',
          options: [
            {
              id: 'golden',
              text: 'Error rate and p99 latency of user-facing requests',
              correct: true,
              why: 'Yes. Measure what users feel. CPU and memory explain *why*; errors and latency tell you *that* something is wrong.',
            },
            { id: 'cpu', text: 'Average CPU across all servers', why: 'Averages hide problems: one dead box barely moves the average.' },
            { id: 'logs', text: 'Number of log lines per minute', why: 'Noisy and indirect. More logs might mean more errors, or just more traffic.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Turn on the lights',
      blind: true,
      startDesign: design(
        [N('client', 'client', 0, 200), N('web', 'web-server', 240, 200), N('db', 'sql-db', 500, 200)],
        [
          ['client', 'web'],
          ['web', 'db'],
        ],
      ),
      palette: ['monitoring'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'Notice something? The canvas went dark. No load bars, no colors. This is what production looks like without monitoring.' },
        { t: 'place', block: 'monitoring', count: 1, slot: { x: 240, y: 380 }, text: 'Place **Monitoring**.' },
        { t: 'connect', from: 'web-server', to: 'monitoring', text: 'Connect **Server → Monitoring** to ship its logs and metrics.' },
        {
          t: 'simulate',
          text: 'Run traffic and enjoy the view.',
          expect: 'pass',
          scenario: scenario(phase('Normal', 500)),
          explainPass: 'Lights on. Every component now reports its health.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Find the broken box',
      blind: true,
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('dns', 'dns', 180, 200),
          N('lb', 'load-balancer', 380, 200),
          ...webs.map((id, i) => N(id, 'web-server', 600, 60 + i * 140)),
          N('db', 'sql-db', 860, 200),
          N('rep1', 'read-replica', 1100, 100),
          N('rep2', 'read-replica', 1100, 300),
        ],
        [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], webs), ...all(webs, ['db']), ['db', 'rep1'], ['db', 'rep2']],
      ),
      palette: ['monitoring', 'read-replica'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'Support is flooded: “the site errors every few clicks.” Your system has no monitoring yet.' },
        {
          t: 'simulate',
          text: 'Run today’s traffic and try to figure out what’s wrong.',
          expect: 'observe',
          scenario: scenario(incident()),
          explainFail: 'Requests are failing, but every box looks the same from the outside. You’re debugging blind.',
          explainPass: 'Hmm, nothing failed this time.',
        },
        { t: 'place', block: 'monitoring', count: 1, slot: { x: 380, y: 440 }, text: 'Place **Monitoring**.' },
        { t: 'connect', from: 'web-server', to: 'monitoring', count: 3, text: 'Connect every server to Monitoring.' },
        {
          t: 'simulate',
          text: 'Run it again. This time, look closely.',
          expect: 'observe',
          scenario: scenario(incident()),
          explainFail: 'Now it’s obvious: **one replica is down** and the other is overloaded, carrying all the reads alone.',
          explainPass: 'All clear.',
        },
        {
          t: 'reason',
          question: 'What’s the right move?',
          options: [
            {
              id: 'replace',
              text: 'Restore read capacity now (add a replica), then add an alert on replica health',
              correct: true,
              why: 'Mitigate first, then prevent. The alert means next time you hear about it before your users do.',
            },
            { id: 'web', text: 'Add more web servers', why: 'The servers are fine; monitoring shows the bottleneck is in the data tier.' },
            { id: 'restart', text: 'Restart everything', why: 'The classic panic move. Without knowing the cause, it might not help, and it causes its own outage.' },
          ],
        },
        { t: 'place', block: 'read-replica', count: 3, slot: { x: 1100, y: 500 }, text: 'Add a new **Read Replica**.' },
        { t: 'connect', from: 'sql-db', to: 'read-replica', count: 3, text: 'Connect the database to it.' },
        {
          t: 'simulate',
          text: 'Run traffic with the broken replica still down.',
          expect: 'pass',
          scenario: scenario(incident()),
          explainPass: 'Errors gone, even with the dead replica. Now you can repair it calmly, without the pressure.',
        },
      ],
    },
  ],
}
