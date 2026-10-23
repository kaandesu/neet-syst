import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'

const spike = scenario(
  phase('Newsletter lands', 400, { writeRatio: 0.1 }),
  phase('Peak', 700, { writeRatio: 0.1 }),
  phase('Still peaking', 800, { writeRatio: 0.1 }),
)

export const database: Lesson = {
  id: 'database',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Give data its own home',
  concern: 'Your server melts because code and storage fight over one machine.',
  unlocks: ['sql-db', 'nosql-db'],
  sections: [
    {
      kind: 'concept',
      title: 'Web tier vs data tier',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'The fix for yesterday’s meltdown: split the **web tier** (your code) from the **data tier** (your storage). Each lives on its own machine and can grow on its own.',
        },
        { t: 'say', text: 'There are two big families of databases, and choosing between them is one of the most common interview questions.' },
        { t: 'concept', block: 'sql-db' },
        { t: 'concept', block: 'nosql-db' },
        {
          t: 'reason',
          question: 'Your shop needs orders where *charging the card* and *reducing stock* happen together or not at all. Which property matters most?',
          options: [
            {
              id: 'acid',
              text: 'ACID transactions',
              correct: true,
              why: 'Right. A transaction makes several changes atomic: either all of them happen or none do. Relational databases give you this out of the box.',
            },
            {
              id: 'schemaless',
              text: 'A flexible, schemaless data model',
              why: 'Handy when your data’s shape keeps changing, but it does nothing to keep two changes in sync.',
            },
            {
              id: 'writes',
              text: 'Massive write throughput',
              why: 'A small shop’s write volume is tiny. Correctness is the hard requirement here, not speed.',
            },
          ],
        },
        {
          t: 'say',
          text: 'Rule of thumb: **start with SQL** unless you have a clear reason not to (huge scale of simple key lookups, very flexible data, or massive write rates). Interviewers love hearing that reasoning out loud.',
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Connect a database',
      startDesign: design(
        [N('client', 'client', 0, 200), N('web', 'web-server', 240, 200)],
        [['client', 'web']],
      ),
      palette: ['sql-db'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'sql-db', count: 1, slot: { x: 500, y: 200 }, text: 'Place a **SQL Database** next to the server.' },
        { t: 'connect', from: 'web-server', to: 'sql-db', text: 'Connect the **Server** to the **Database**.' },
        {
          t: 'simulate',
          text: 'Run 300 req/s with lots of writes (20%).',
          expect: 'pass',
          scenario: scenario(phase('Busy', 300, { writeRatio: 0.2 })),
          explainPass: 'Look at the load bars. The server only runs code now, and the database handles the storing.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Rescue the launch',
      startDesign: design(
        [N('client', 'client', 0, 200), N('dns', 'dns', 220, 200), N('web', 'web-server', 440, 200)],
        [
          ['client', 'dns'],
          ['dns', 'web'],
        ],
      ),
      palette: [],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'The newsletter is sending another wave tomorrow. Let’s move the data out before it hits.' },
        {
          t: 'fork',
          question: 'Which database should hold your users, products and orders?',
          options: [
            {
              id: 'sql',
              label: 'Relational (SQL)',
              pitch: 'Tables, joins, transactions. PostgreSQL, MySQL.',
              consequence:
                'A solid default. Orders and payments get real transactions, and you can still add a NoSQL store later for a specific need.',
              patch: { addNodes: [N('db', 'sql-db', 700, 200)] },
            },
            {
              id: 'nosql',
              label: 'NoSQL (key-value / document)',
              pitch: 'Flexible schema, simple lookups, scales out easily. DynamoDB, MongoDB.',
              consequence:
                'Faster per request and easier to scale later, but no joins or multi-item transactions. “Charge and reduce stock together” now lives in your application code.',
              patch: { addNodes: [N('db', 'nosql-db', 700, 200)] },
            },
          ],
        },
        {
          t: 'connect',
          from: 'web-server',
          to: ['sql-db', 'nosql-db'],
          text: 'Connect the **Server** to its new database.',
        },
        {
          t: 'simulate',
          text: 'Here comes the wave. Run the same spike that broke you yesterday.',
          expect: 'pass',
          chaos: { title: 'Traffic spike (again)', body: 'The newsletter’s second issue just went out.' },
          scenario: spike,
          explainPass: 'Survived! With the storage work gone, the same server handles 800 req/s.',
          hints: ['Is the server connected to the database?'],
        },
        {
          t: 'reason',
          question: 'The server is now at ~80% load. If traffic doubles again, what breaks first?',
          options: [
            {
              id: 'web',
              text: 'The web server: it’s the bottleneck now',
              correct: true,
              why: 'Yes. Fixing one bottleneck always reveals the next. And because it’s the *only* server, a crash still takes everything down.',
            },
            {
              id: 'db',
              text: 'The database',
              why: 'Check its load bar: it still has plenty of headroom.',
            },
            { id: 'dns', text: 'DNS', why: 'DNS isn’t doing any per-request work. It just pointed users at your server once.' },
          ],
        },
        {
          t: 'say',
          text: 'Before we add more servers, you need a skill every interviewer tests: **estimating how many you need**. That’s next.',
        },
      ],
    },
  ],
}
