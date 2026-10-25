import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'

const launched = design(
  [N('client', 'client', 0, 200), N('dns', 'dns', 240, 200), N('web', 'web-server', 480, 200)],
  [
    ['client', 'dns'],
    ['dns', 'web'],
  ],
)

export const firstRequest: Lesson = {
  id: 'first-request',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Your first request',
  concern: 'You have an idea and zero users. What happens when the first person shows up?',
  unlocks: ['client', 'dns', 'web-server'],
  sections: [
    {
      kind: 'concept',
      title: 'What happens when you open a website',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          mood: 'happy',
          text: 'Hi! I’m your mentor. Over this chapter we’ll grow **one** system from a single box to millions of users. Every time something breaks, you’ll unlock exactly one new building block to fix it.',
        },
        { t: 'say', text: 'No boxes and arrows yet. First: what actually happens when someone opens your app? Three pieces are involved.' },
        { t: 'concept', block: 'client' },
        { t: 'concept', block: 'dns' },
        { t: 'concept', block: 'web-server' },
        {
          t: 'reason',
          question: 'A user types **shop.example.com**. What does DNS hand back to their browser?',
          options: [
            {
              id: 'ip',
              text: 'The IP address of your server',
              correct: true,
              why: 'Exactly. DNS is a lookup: a name goes in, an address comes out. The browser then connects to that address directly, and that’s where the real request happens.',
            },
            {
              id: 'html',
              text: 'The HTML of your homepage',
              why: 'Tempting, but DNS never sees your content. It only maps names to addresses; your web server sends the HTML.',
            },
            {
              id: 'tls',
              text: 'A secure connection to the server',
              why: 'HTTPS is negotiated with the server itself, after the lookup. DNS just points the way.',
            },
          ],
        },
        {
          t: 'say',
          text: 'In an interview, **always start with this request path**: client → DNS → server. Everything we add later is a detour along this path.',
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Wire up the request path',
      startDesign: design([N('client', 'client', 0, 200)]),
      palette: ['dns', 'web-server'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'say', text: 'This is the canvas. On the left are your users. The tray at the bottom only holds blocks you’ve unlocked, so right now that’s just two.' },
        {
          t: 'place',
          block: 'dns',
          count: 1,
          slot: { x: 240, y: 200 },
          text: 'Drag **DNS** from the tray onto the dashed slot.',
          hints: ['Look at the bottom of the canvas for the tray.', 'You can also click a block in the tray to drop it on the slot.'],
        },
        {
          t: 'place',
          block: 'web-server',
          count: 1,
          slot: { x: 480, y: 200 },
          text: 'Now place a **Web Server** where your code will run.',
        },
        {
          t: 'connect',
          from: 'client',
          to: 'dns',
          text: 'Drag from the dot on the right edge of **Users** to **DNS**. That arrow is the lookup.',
          hints: ['Hover a block to see its connection dots.', 'Start the drag on the right-hand dot, release on the other block.'],
        },
        { t: 'connect', from: 'dns', to: 'web-server', text: 'Then connect **DNS** to your **Server**.' },
        {
          t: 'simulate',
          text: 'Press **Run traffic** to send 50 requests per second through your system.',
          expect: 'pass',
          scenario: scenario(phase('A quiet afternoon', 50)),
          explainPass: 'Every moving dot is a batch of requests. Green means healthy. Your app is live! 🎉',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Launch day',
      startDesign: launched,
      palette: [],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        {
          t: 'say',
          text: 'Launch day. Your single server does **everything**: it runs your code, keeps your data on its own disk, and serves every page.',
        },
        {
          t: 'simulate',
          text: 'Run the morning traffic: 100, then 250 requests per second (10% of them are writes, like sign-ups and orders).',
          expect: 'pass',
          scenario: scenario(phase('Morning', 100, { writeRatio: 0.1 }), phase('Lunch rush', 250, { writeRatio: 0.1 })),
          explainPass: 'Comfortable. Notice the server’s load bar: storage work counts against the same CPU and disk as your code.',
        },
        { t: 'say', text: 'Then a popular newsletter links to you…' },
        {
          t: 'simulate',
          text: 'Run the spike.',
          expect: 'fail',
          chaos: { title: 'Traffic spike', body: 'A newsletter with 200,000 readers just featured you.' },
          scenario: scenario(
            phase('Newsletter lands', 400, { writeRatio: 0.1 }),
            phase('Peak', 700, { writeRatio: 0.1 }),
            phase('Still peaking', 800, { writeRatio: 0.1 }),
          ),
          explainFail:
            'The server turned red. Past ~500 req/s it spends as much effort reading and writing its own disk as running your code. Requests queue up, latency explodes, and some fail outright.',
        },
        {
          t: 'reason',
          question: 'What’s the **core** problem here?',
          options: [
            {
              id: 'two-jobs',
              text: 'One machine is doing two very different jobs (compute and storage) and they fight over the same resources',
              correct: true,
              why: 'Yes. Code and data have different needs and grow at different rates. Splitting them lets each scale on its own.',
            },
            {
              id: 'dns',
              text: 'DNS is too slow to keep up',
              why: 'DNS answers are cached by browsers and resolvers. It’s barely involved after the first lookup.',
            },
            {
              id: 'network',
              text: 'The users’ internet connections are slow',
              why: 'Latency spiked because the server is saturated, not because of the network. It was fine at 250 req/s.',
            },
          ],
        },
        { t: 'say', text: 'Hold that thought. In the next lesson we give your data a home of its own.' },
      ],
    },
  ],
}
