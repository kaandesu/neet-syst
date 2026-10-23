import type { Lesson } from '@/engine/lesson/types'
import { EMPTY, N, design, phase, scenario } from './_kit'
import { cacheEnd } from './_states'

const viral = (extra = {}) =>
  phase('Video goes viral', 4500, { staticRatio: 0.6, writeRatio: 0.05, queryCost: 3, euShare: 0.3, ...extra })

export const cdn: Lesson = {
  id: 'cdn',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Static files at the edge',
  concern: 'Images and scripts are most of your bytes, and your servers are wasting time pushing them across the planet.',
  unlocks: ['cdn', 'object-storage'],
  sections: [
    {
      kind: 'concept',
      title: 'Move bytes closer to people',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'A product page is one small HTML response… plus dozens of images, fonts and scripts. Those **static** files never change between users, so why are your web servers serving them?',
        },
        { t: 'concept', block: 'object-storage' },
        { t: 'concept', block: 'cdn' },
        {
          t: 'reason',
          question: 'Why do images load slowly for European users when your servers are in the US?',
          options: [
            {
              id: 'distance',
              text: 'Every file crosses the Atlantic (~150 ms per round trip), and pages load dozens of files',
              correct: true,
              why: 'Yes. Distance is latency, and it multiplies per file. A CDN edge in Frankfurt serves the same file in ~10 ms.',
            },
            { id: 'size', text: 'European browsers are slower', why: 'Browsers are the same everywhere. Physics isn’t.' },
            { id: 'db', text: 'The database is slow', why: 'Images don’t come from the database at all.' },
          ],
        },
        {
          t: 'reason',
          question: 'You deploy a new logo with the same file name. Users keep seeing the old one for a day. Best fix?',
          options: [
            {
              id: 'version',
              text: 'Version the file name (logo.v2.png) so the CDN sees a brand-new file',
              correct: true,
              why: 'Right. Build tools do this automatically with content hashes (app.3f9a.js). You get long TTLs *and* instant updates.',
            },
            { id: 'ttl0', text: 'Set the CDN’s TTL to zero', why: 'That turns the CDN into a slow proxy and defeats its whole purpose.' },
            { id: 'wait', text: 'Ask users to clear their cache', why: 'You can’t ask millions of users to do anything.' },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Serve files from the edge',
      startDesign: design([N('client', 'client', 0, 200), N('web', 'web-server', 260, 200)], [['client', 'web']]),
      palette: ['cdn', 'object-storage'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        { t: 'place', block: 'object-storage', count: 1, slot: { x: 500, y: 380 }, text: 'Place **Object Storage**: the home for your files.' },
        { t: 'place', block: 'cdn', count: 1, slot: { x: 260, y: 380 }, text: 'Place a **CDN** in front of it.' },
        { t: 'connect', from: 'client', to: 'cdn', text: 'Connect **Users → CDN**. Browsers fetch images straight from the edge.' },
        { t: 'connect', from: 'cdn', to: 'object-storage', text: 'Connect **CDN → Storage**: on a miss, the edge fetches from the origin.' },
        {
          t: 'simulate',
          text: 'Run 800 req/s where half are images.',
          expect: 'pass',
          scenario: scenario(phase('Image heavy', 800, { staticRatio: 0.5 })),
          explainPass: '95% of file requests are served at the edge; storage barely notices, and the server only sees dynamic requests.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Go viral (globally)',
      startDesign: cacheEnd,
      palette: ['cdn', 'object-storage'],
      goals: [{ kind: 'maxErrorRate', value: 0 }],
      steps: [
        {
          t: 'say',
          text: 'Your product video is trending, and 30% of visitors are now in **Europe**. 60% of all requests are for images and video chunks.',
        },
        {
          t: 'simulate',
          text: 'Run the viral wave.',
          expect: 'fail',
          scenario: scenario(viral()),
          explainFail: 'Your web servers are drowning in file downloads, the one kind of request they shouldn’t be handling at all.',
        },
        { t: 'place', block: 'object-storage', count: 1, slot: { x: 380, y: 520 }, text: 'Place **Object Storage** for your media.' },
        { t: 'place', block: 'cdn', count: 1, slot: { x: 180, y: 440 }, text: 'Place a **CDN**.' },
        { t: 'connect', from: 'client', to: 'cdn', text: 'Connect **Users → CDN**.' },
        { t: 'connect', from: 'cdn', to: 'object-storage', text: 'Connect **CDN → Object Storage**.' },
        {
          t: 'simulate',
          text: 'Run the viral wave again.',
          expect: 'pass',
          scenario: scenario(viral()),
          explainPass: 'Files fly from the edge, and your servers only handle the dynamic 40%.',
        },
        {
          t: 'say',
          text: 'Look at **p99 latency**, though: European users still wait an extra ~120 ms on every *dynamic* request, because your servers are all in the US. Keep that in mind for later.',
        },
      ],
    },
  ],
}
