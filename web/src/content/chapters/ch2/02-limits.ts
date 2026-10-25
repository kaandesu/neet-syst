import type { Lesson } from '@/engine/lesson/types'
import type { Endpoint } from '@/engine/types'
import { EMPTY, N, design, phase, scenario } from '../ch1/_kit'

const CATALOG: Endpoint[] = [
  { method: 'GET', path: '/v1/products', paginated: true },
  { method: 'GET', path: '/v1/products/{id}' },
]

const catalog = (api?: Endpoint[]) =>
  design(
    [
      N('client', 'client', 0, 200),
      N('lb', 'load-balancer', 220, 200),
      N('catalog', 'service', 460, 200, { label: 'Catalog Service', tier: 'm', ...(api && { api }) }),
      N('db', 'sql-db', 720, 200),
    ],
    [
      ['client', 'lb'],
      ['lb', 'catalog'],
      ['catalog', 'db'],
    ],
  )

const scrape = (bots: number) => phase('Shoppers + a price scraper', 600, { botRps: bots })

export const limits: Lesson = {
  id: 'api-limits',
  chapter: 'ch2',
  kind: 'unit',
  title: 'Pages and rate limits',
  concern: 'A competitor’s scraper is hammering the catalog, and one list call returns 50,000 products.',
  unlocks: [],
  minutes: 12,
  sections: [
    {
      kind: 'concept',
      title: 'Never return everything',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: '`GET /v1/products` worked great with 40 products. Now there are 50,000, and every call ships megabytes and makes the database scan the whole table. Lists must come back **one page at a time**.',
        },
        {
          t: 'reason',
          question: 'The product list changes constantly. Which way of paging holds up?',
          options: [
            {
              id: 'cursor',
              text: 'A **cursor**: “give me 50 after product `p_9182`”',
              correct: true,
              why: 'Yes. The database jumps straight to that spot using an index, and new products don’t shift the pages under the reader.',
            },
            {
              id: 'offset',
              text: 'An **offset**: “skip 40,000, give me 50”',
              why: 'Easy to build, but the database still walks past 40,000 rows, and items inserted meanwhile make pages repeat or skip.',
            },
            {
              id: 'all',
              text: 'Return everything, gzip it',
              why: 'Compression shrinks the bytes, not the database work or the phone’s memory. It only delays the problem.',
            },
          ],
        },
        { t: 'idea', idea: 'cursor-pagination' },
        {
          t: 'say',
          text: 'Second rule: one caller must never use up what everyone shares.',
        },
        { t: 'idea', idea: 'rate-limit' },
      ],
    },
    {
      kind: 'drill',
      title: 'Page the catalog',
      startDesign: catalog(),
      palette: [],
      goals: [],
      steps: [
        {
          t: 'api',
          node: 'catalog',
          text: 'The app shows a product list and product pages. Write the catalog API, and make sure the list comes back in pages.',
          rules: [
            { kind: 'has', method: 'GET', path: '/products' },
            { kind: 'paginated', path: '/products' },
            { kind: 'has', method: 'GET', path: '/products/{id}' },
            { kind: 'versioned' },
            { kind: 'plural' },
          ],
          solution: CATALOG,
          hints: ['Two `GET`s: the collection and one item. Turn on **Pages** for the collection.'],
        },
      ],
    },
    {
      kind: 'level',
      title: 'The scraper',
      startDesign: catalog(CATALOG),
      palette: [],
      goals: [{ kind: 'maxErrorRate', value: 0.01 }],
      steps: [
        {
          t: 'say',
          speaker: 'oncall',
          mood: 'worried',
          text: 'Product pages are timing out. Traffic tripled overnight, but sales didn’t. It’s one IP range, calling the catalog nonstop.',
        },
        {
          t: 'simulate',
          text: 'Replay this morning: 600 real shoppers a second, plus the scraper.',
          expect: 'fail',
          scenario: scenario(scrape(1500)),
          explainFail: 'The scraper sends more than twice the traffic of every real shopper combined, and the catalog service can’t tell them apart.',
        },
        {
          t: 'reason',
          question: 'Cheapest fix that protects real shoppers?',
          options: [
            {
              id: 'limit',
              text: 'Rate limit the API, so each caller gets a fair budget',
              correct: true,
              why: 'Yes. A 429 costs almost nothing to send, and normal shoppers never come near the limit.',
            },
            {
              id: 'scale',
              text: 'Add more catalog servers',
              why: 'You’d be paying to serve the scraper faster. It will just send more.',
            },
            {
              id: 'block',
              text: 'Block that IP range in the firewall',
              why: 'Works until tomorrow, when the scraper rents new IPs. Limits work for every caller, known or not.',
            },
          ],
        },
        {
          t: 'api',
          node: 'catalog',
          text: 'Put a rate limit on **every** catalog endpoint.',
          rules: [{ kind: 'rateLimited' }, { kind: 'paginated', path: '/products' }],
          solution: CATALOG.map((e) => ({ ...e, rateLimited: true })),
          hints: ['Each row has a **Limit** toggle. A limit on just one endpoint sends the scraper to the other.'],
        },
        {
          t: 'simulate',
          text: 'Same morning, same scraper.',
          expect: 'pass',
          scenario: scenario(scrape(1500), scrape(5000)),
          explainPass: 'The scraper gets a wall of 429s; real shoppers don’t notice a thing. Even when it triples its rate.',
        },
      ],
    },
  ],
}
