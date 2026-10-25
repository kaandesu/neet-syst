import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'
import { writeHeavyReplicas } from './_whatifs'
import { lbEnd } from './_states'

const busy = (extra = {}) => phase('Busy day', 2000, { writeRatio: 0.1, ...extra })

export const replication: Lesson = {
  id: 'replication',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Database replication',
  concern: 'Every request needs the one database. It’s overloaded, and if it dies, everything dies.',
  unlocks: ['read-replica'],
  sections: [
    {
      kind: 'concept',
      title: 'Copies that share the reading',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        { t: 'say', text: 'Remember your estimate: **10 reads for every write**. That ratio is a gift. Reads can be served from copies.' },
        { t: 'concept', block: 'read-replica' },
        {
          t: 'reason',
          question: 'Why does adding replicas help *so much* for a typical app?',
          options: [
            {
              id: 'reads',
              text: 'Replicas take the reads (~90% of queries), so the primary only handles writes',
              correct: true,
              why: 'Exactly. The primary’s workload shrinks to just writes, and you can keep adding replicas as reads grow.',
            },
            {
              id: 'writes',
              tryIt: writeHeavyReplicas,
              text: 'Replicas make writes faster',
              why: 'Every write still goes to the primary, and then gets copied to every replica. Replication helps reads, not writes.',
            },
            {
              id: 'backup',
              text: 'Replicas mean you no longer need backups',
              why: 'A replica faithfully copies mistakes too: `DELETE FROM users` hits every replica within milliseconds. You still need backups.',
            },
          ],
        },
        {
          t: 'reason',
          question: 'A user edits their profile, reloads the page instantly, and sees the **old** name. What happened?',
          options: [
            {
              id: 'lag',
              text: 'The read went to a replica that hadn’t received the change yet (replication lag)',
              correct: true,
              why: 'Right. Replicas are *eventually* consistent. A common fix: read-your-own-writes, i.e. route a user’s reads to the primary for a few seconds after they write.',
            },
            { id: 'cache', text: 'The browser cached the page', why: 'Possible in general, but here the data really was stale on the server side.' },
            { id: 'lost', text: 'The write was lost', why: 'The write is safe on the primary. The replica is just a little behind.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Add a replica',
      startDesign: design(
        [N('client', 'client', 0, 200), N('web', 'web-server', 240, 200), N('db', 'sql-db', 500, 200)],
        [
          ['client', 'web'],
          ['web', 'db'],
        ],
      ),
      palette: ['read-replica'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'read-replica', count: 1, slot: { x: 760, y: 200 }, text: 'Place a **Read Replica** next to the database.' },
        {
          t: 'connect',
          from: 'sql-db',
          to: 'read-replica',
          text: 'Connect **database → replica**. That arrow is the replication stream: changes flow from primary to copy.',
        },
        {
          t: 'simulate',
          text: 'Run 900 req/s and compare the two databases’ load bars.',
          expect: 'pass',
          scenario: scenario(phase('Normal', 900, { writeRatio: 0.1 })),
          explainPass: 'The primary now only handles writes; the replica serves the reads.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Take the load off the primary',
      startDesign: lbEnd,
      palette: ['read-replica'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'Business is good. You now run **four** web servers, and every one of them hammers the same database.' },
        {
          t: 'simulate',
          text: 'Run a busy day: 2,000 req/s.',
          expect: 'fail',
          scenario: scenario(busy()),
          explainFail: 'The web tier is fine, but the database is overloaded. Adding web servers can’t fix that: they all share it.',
        },
        { t: 'place', block: 'read-replica', count: 1, slot: { x: 1100, y: 120 }, text: 'Add a **Read Replica**.' },
        { t: 'place', block: 'read-replica', count: 2, slot: { x: 1100, y: 280 }, text: 'Add a second one, so no single copy becomes critical.' },
        { t: 'connect', from: 'sql-db', to: 'read-replica', count: 2, text: 'Connect the **database** to both replicas.' },
        {
          t: 'simulate',
          text: 'Run the busy day again.',
          expect: 'pass',
          scenario: scenario(busy()),
          explainPass: 'Reads split across the replicas; the primary only handles writes.',
        },
        {
          t: 'simulate',
          text: 'Now pull the plug on the primary.',
          expect: 'pass',
          chaos: { title: 'Primary database down', body: 'The primary’s host failed a hardware check and rebooted.' },
          scenario: scenario(busy({ label: 'Primary fails', failures: [{ block: 'sql-db' }] })),
          explainPass:
            'A replica was **promoted** to primary and took over writes. In real systems this failover takes seconds to a minute, and recent writes can be lost if replication was behind.',
        },
        {
          t: 'simulate',
          text: 'Final check: is there any single box whose failure would take you down?',
          expect: 'pass',
          goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'noSPOF' }],
          scenario: scenario(busy()),
          explainPass: 'No single point of failure left in the web or data tier. 🎯',
        },
      ],
    },
  ],
}
