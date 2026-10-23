import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, all, design, phase, scenario } from './_kit'
import { WEBS, cdnEnd } from './_states'

const loggedIn = (extra = {}) => phase('Logged-in shoppers', 2000, { writeRatio: 0.1, sessions: true, ...extra })
const crash = () => loggedIn({ label: 'Server crash', failures: [{ block: 'web-server', nth: 1 }] })

export const stateless: Lesson = {
  id: 'stateless',
  chapter: 'ch1',
  kind: 'unit',
  title: 'A stateless web tier',
  concern: 'You added login and shopping carts. Users keep getting logged out at random.',
  unlocks: ['session-store'],
  sections: [
    {
      kind: 'concept',
      title: 'Where does “logged in” live?',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'When a user logs in, *something* has to remember it: who they are, what’s in their cart. That memory is called **session state**.',
        },
        {
          t: 'reason',
          question: 'In your current design, where does session state live?',
          options: [
            {
              id: 'memory',
              text: 'In the memory of whichever web server handled the login',
              correct: true,
              why: 'Right, and that’s the problem. The next request may go to a *different* server, which has never heard of this user.',
            },
            { id: 'lb', text: 'In the load balancer', why: 'Load balancers route requests; they don’t store application data.' },
            { id: 'db', text: 'In the database', why: 'It could be, but nobody built that. Right now it’s in each server’s RAM.' },
          ],
        },
        { t: 'concept', block: 'session-store' },
        {
          t: 'say',
          text: 'A server that keeps nothing between requests is **stateless**. Stateless servers are interchangeable: add them, remove them, lose them, and nobody notices. That’s what makes autoscaling possible.',
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Share the sessions',
      startDesign: design(
        [
          N('client', 'client', 0, 200),
          N('lb', 'load-balancer', 220, 200),
          N('web1', 'web-server', 460, 120),
          N('web2', 'web-server', 460, 280),
        ],
        [['client', 'lb'], ...all(['lb'], ['web1', 'web2'])],
      ),
      palette: ['session-store'],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'stateless' }],
      steps: [
        {
          t: 'simulate',
          text: 'First, run logged-in traffic as-is.',
          expect: 'fail',
          scenario: scenario(phase('Logged in', 600, { writeRatio: 0.3, sessions: true })),
          explainFail: 'Half the logged-in actions fail: the LB sent the user to the server that doesn’t know them.',
        },
        { t: 'place', block: 'session-store', count: 1, slot: { x: 700, y: 200 }, text: 'Place a **Session Store**.' },
        { t: 'connect', from: 'web-server', to: 'session-store', count: 2, text: 'Connect **both** servers to it.' },
        {
          t: 'simulate',
          text: 'Run it again.',
          expect: 'pass',
          scenario: scenario(phase('Logged in', 600, { writeRatio: 0.3, sessions: true })),
          explainPass: 'Any server can now handle any user. The web tier is stateless.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Stop the random logouts',
      startDesign: cdnEnd,
      palette: ['session-store'],
      goals: [{ kind: 'maxErrorRate', value: 0 }, { kind: 'stateless' }],
      steps: [
        {
          t: 'simulate',
          text: 'Run a day of logged-in shopping.',
          expect: 'fail',
          scenario: scenario(loggedIn()),
          explainFail: 'Carts vanish and users get bounced to the login page: their session lives on one server, but the LB keeps picking others.',
        },
        {
          t: 'fork',
          question: 'Two common fixes. Which do you choose?',
          options: [
            {
              id: 'store',
              label: 'Shared session store',
              pitch: 'Move sessions out of the servers into Redis. Every server reads from it.',
              consequence: 'Servers now remember nothing, so any one of them can serve any user. One extra ~1 ms hop per request.',
              patch: {
                addNodes: [N('sessions', 'session-store', 860, 420)],
                addEdges: WEBS.map((w) => ({ from: w, to: 'sessions' })),
              },
            },
            {
              id: 'sticky',
              label: 'Sticky sessions',
              pitch: 'Tell the load balancer to always send a user to the same server.',
              consequence: 'A one-line config change, and it works… as long as no server ever dies or gets replaced.',
              patch: { setProps: [{ id: 'lb', props: { sticky: true } }] },
            },
          ],
        },
        {
          t: 'simulate',
          text: 'Run a normal day with your fix.',
          expect: 'observe',
          scenario: scenario(loggedIn()),
          explainPass: 'Logouts stopped. Both fixes work on a calm day. Now let’s see a bad day.',
          explainFail: 'Still failing. Check that every server can reach your sessions.',
        },
        {
          t: 'simulate',
          text: 'A server crashes in the middle of the day.',
          expect: 'observe',
          chaos: { title: 'Server down', body: 'web-2 was killed by a bad deploy.' },
          scenario: scenario(crash()),
          explainPass: 'No one noticed. The crashed server held nothing that mattered.',
          explainFail:
            'Everyone “stuck” to the dead server just lost their cart and got logged out. Sticky sessions hide state; they don’t remove it. Autoscaling and deploys hit the same problem.',
        },
        {
          t: 'simulate',
          text: 'Final check: survive the crash **and** keep the web tier stateless.',
          expect: 'pass',
          scenario: scenario(loggedIn(), crash()),
          explainPass: 'Stateless web tier achieved. This is the foundation for autoscaling and safe deploys.',
          hints: [
            'If you chose sticky sessions, use the **timeline** below to rewind to the decision and try the other branch.',
            'Or add a Session Store now and connect every server to it.',
          ],
        },
      ],
    },
  ],
}
