import type { Lesson } from '@/engine/lesson/types'
import type { Endpoint } from '@/engine/types'
import { EMPTY, N, design } from '../ch1/_kit'

const ORDERS = 'Orders Service'

const shop = (api?: Endpoint[]) =>
  design(
    [N('client', 'client', 0, 200), N('orders', 'service', 260, 200, { label: ORDERS, tier: 'm', ...(api && { api }) }), N('db', 'sql-db', 520, 200)],
    [
      ['client', 'orders'],
      ['orders', 'db'],
    ],
  )

const BASIC: Endpoint[] = [
  { method: 'POST', path: '/orders' },
  { method: 'GET', path: '/orders/{id}' },
  { method: 'DELETE', path: '/orders/{id}' },
]

export const resources: Lesson = {
  id: 'api-resources',
  chapter: 'ch2',
  kind: 'unit',
  title: 'Resources, not actions',
  concern: 'The mobile team wants to build on your shop. They need an API they can’t misuse.',
  unlocks: [],
  minutes: 10,
  sections: [
    {
      kind: 'concept',
      title: 'Nouns in the path, verbs in the method',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          speaker: 'pm',
          text: 'Big news: we’re launching an iPhone app, and two partner stores want to sell our products. They all need to talk to our servers.',
        },
        {
          t: 'say',
          text: 'An **API** is the contract they code against. The common style on the web is **REST**: every *thing* gets a path (`/orders/42`), and the HTTP **method** says what to do with it: `GET` reads, `POST` creates, `PUT`/`PATCH` change, `DELETE` removes.',
        },
        {
          t: 'reason',
          question: 'Which endpoint should cancel order 42?',
          options: [
            {
              id: 'delete',
              text: '`DELETE /orders/42`',
              correct: true,
              why: 'Right. The path names the order, the method says what happens to it. Anyone who knows REST can guess this without reading your docs.',
            },
            {
              id: 'rpc',
              text: '`POST /cancelOrder?id=42`',
              why: 'It works, but every action becomes its own made-up URL. With fifty of those, nobody can guess your API anymore.',
            },
            {
              id: 'get',
              text: '`GET /orders/42/cancel`',
              why: 'Dangerous. `GET` must never change anything: browsers prefetch links, crawlers follow them, and caches replay them. A crawler could cancel every order.',
            },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Write the orders API',
      startDesign: shop(),
      palette: [],
      goals: [],
      steps: [
        {
          t: 'api',
          node: 'orders',
          text: 'The app needs to **place** an order, **look one up** and **cancel** one. Write those three endpoints.',
          rules: [
            { kind: 'has', method: 'POST', path: '/orders' },
            { kind: 'has', method: 'GET', path: '/orders/{id}' },
            { kind: 'has', method: 'DELETE', path: '/orders/{id}' },
            { kind: 'nouns' },
            { kind: 'plural' },
          ],
          solution: BASIC,
          hints: ['Every path starts with `/orders`. One order is `/orders/{id}`.'],
        },
        {
          t: 'say',
          text: 'Three endpoints, one resource. Notice you never wrote “create”, “get” or “cancel”: the methods already say it.',
        },
      ],
    },
    {
      kind: 'level',
      title: 'Ship it without breaking it',
      startDesign: shop(BASIC),
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          speaker: 'oncall',
          mood: 'worried',
          text: 'We renamed `total` to `amount` in the order response last night. Every app version from last month crashed on launch. People can’t update an app instantly.',
        },
        {
          t: 'reason',
          question: 'How do you change an API that already has users?',
          options: [
            {
              id: 'version',
              text: 'Put a version in the path (`/v1/orders`). Breaking changes go to `/v2`, and `/v1` keeps working until old apps are gone',
              correct: true,
              why: 'Yes. Old apps keep calling `/v1`, new ones move to `/v2`, and you retire `/v1` when the traffic dies down.',
            },
            {
              id: 'coordinate',
              text: 'Ship the server and the app at the same time',
              why: 'You can’t: app store reviews take days, and plenty of people never update. Old clients live for years.',
            },
            {
              id: 'never',
              text: 'Never change a response again',
              why: 'Adding fields is fine forever. But sometimes you must *change* one, and then you need a way to keep the old shape alive.',
            },
          ],
        },
        {
          t: 'api',
          node: 'orders',
          text: 'Version every endpoint under `/v1`, and add **listing** a user’s orders so the app can show an order history.',
          rules: [
            { kind: 'versioned' },
            { kind: 'has', method: 'GET', path: '/orders' },
            { kind: 'has', method: 'POST', path: '/orders' },
            { kind: 'has', method: 'GET', path: '/orders/{id}' },
            { kind: 'has', method: 'DELETE', path: '/orders/{id}' },
            { kind: 'nouns' },
            { kind: 'plural' },
          ],
          solution: [{ method: 'GET', path: '/v1/orders' }, ...BASIC.map((e) => ({ ...e, path: `/v1${e.path}` }))],
          hints: ['Change `/orders` to `/v1/orders` on every row, then add a `GET` on the collection itself.'],
        },
      ],
    },
  ],
}
