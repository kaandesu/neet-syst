import type { Problem } from '@/engine/problems/types'
import { N, design, free, phase } from '../chapters/ch1/_kit'

const morning = (rps: number, label: string) => phase(label, rps, { staticRatio: 0.9, writeRatio: 0.01 })

export const bakery: Problem = {
  id: 'bakery',
  number: 1,
  title: 'The Bakery Goes Viral',
  difficulty: 'easy',
  tags: ['CDN', 'Static files'],
  speaker: 'pm',
  story: [
    'Marta’s Bakery is on *morning TV* tomorrow. Their whole site is one server and a database, and it melted the last time a food blogger linked to it.',
    'Marta checked the logs: nine out of ten requests are photos of croissants, the menu PDF, and the site’s scripts. Almost nobody orders online; they just look.',
  ],
  asks: ['The site stays up while the segment airs', 'Pages load in under 200 ms'],
  outOfScope: ['Online ordering', 'A mobile app'],
  numbers: [
    { label: 'Normal morning', value: '200 req/s' },
    { label: 'During the segment', value: '4,000 req/s' },
    { label: 'Static share', value: '90%' },
    { label: 'Box budget', value: '6' },
  ],
  skeleton: design(
    [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('web', 'web-server', 380, 200), N('db', 'sql-db', 600, 200)],
    [['client', 'dns'], ['dns', 'web'], ['web', 'db']],
  ),
  palette: ['dns', 'load-balancer', 'web-server', 'sql-db', 'cdn', 'object-storage'],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 200 },
    { kind: 'maxBlocks', value: 6 },
  ],
  par: 5,
  tests: [
    { label: 'A normal morning', phases: [morning(200, 'Normal morning')] },
    { label: 'The TV segment airs', phases: [morning(4000, 'On air')] },
    { label: 'It gets re-shared on social media', hidden: true, phases: [morning(6000, 'Fan stampede')] },
  ],
  hints: [
    { text: 'Look at *what* people request, not just how many. Does a croissant photo need a web server at all?' },
    { text: 'Files that never change can be served from the **edge**, close to the user, without touching your server.' },
    { text: 'Add a **CDN** connected straight from the users, and give it **object storage** to pull the files from.', ghost: { block: 'cdn', x: 180, y: 380 } },
  ],
  solution: free(
    [
      N('client', 'client', 0, 200),
      N('dns', 'dns', 180, 200),
      N('web', 'web-server', 380, 200),
      N('db', 'sql-db', 600, 200),
      N('cdn', 'cdn', 180, 380),
      N('store', 'object-storage', 380, 380),
    ],
    [['client', 'dns'], ['dns', 'web'], ['web', 'db'], ['client', 'cdn'], ['cdn', 'store']],
  ),
  editorial: [
    'The trap is to add servers. At 4,000 req/s you’d need four or more, plus a load balancer, and you’d blow the box budget. And the hidden 6,000 req/s test would need even more.',
    'But 90% of the traffic is static. A CDN answers those requests from an edge location near the user. The one web server only sees the 10% that is dynamic: about 600 req/s at peak.',
    '**Interview takeaway:** before scaling a tier, ask what the traffic *is*. Splitting static from dynamic is often the cheapest 10× you’ll ever get.',
  ],
}
