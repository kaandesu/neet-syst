import { BookOpenText, Gauge, GitBranch, KeyRound, Layers, type LucideIcon } from 'lucide-react'

export type IdeaId = 'rest' | 'versioning' | 'idempotency-key' | 'cursor-pagination' | 'rate-limit'

/** A concept that isn't a box on the canvas: an API rule, a protocol trick, a habit. */
export interface IdeaInfo {
  id: IdeaId
  name: string
  icon: LucideIcon
  hue: number
  tagline: string
  what: string
  why: string
  analogy: string
  tradeoffs: string[]
  examples: string
  /** A step-by-step picture of how it works, drawn by the idea card. */
  diagram?: 'idempotency-key'
}

export const IDEAS: Record<IdeaId, IdeaInfo> = {
  rest: {
    id: 'rest',
    name: 'REST resources',
    icon: BookOpenText,
    hue: 200,
    tagline: 'Paths name things, methods say what to do',
    what: 'Every *thing* in your system gets a path (`/orders`, `/orders/42`). The HTTP method is the action: `GET` reads, `POST` creates, `PUT`/`PATCH` change, `DELETE` removes.',
    why: 'Anyone who knows HTTP can guess your API without reading the docs, and caches, proxies and browsers already know which methods are safe to repeat.',
    analogy: 'A library: books have shelf numbers (paths), and you borrow, return or renew them (methods). You don’t get a new counter for every action.',
    tradeoffs: ['Some actions don’t fit a noun neatly (“send a password reset”); model them as a resource (`POST /password-resets`).', 'Fetching a page that needs five resources means five calls, unless you add a combined endpoint.'],
    examples: 'Stripe, GitHub REST API, Twilio',
  },
  versioning: {
    id: 'versioning',
    name: 'API versioning',
    icon: GitBranch,
    hue: 280,
    tagline: 'Change the API without breaking old apps',
    what: 'Put a version in every path (`/v1/orders`). Adding fields is always fine. A *breaking* change (renaming or removing something) goes to `/v2`, and `/v1` keeps working until its traffic dies down.',
    why: 'Phone apps live for years. People skip updates, and app store reviews take days, so you can never change the server and every client at the same moment.',
    analogy: 'A power socket standard: new devices can use a new plug, but the old sockets stay in the wall until nobody uses them.',
    tradeoffs: ['Every live version is code you maintain and test.', 'Some teams version with a header or a date (Stripe) instead of the path; the idea is the same.'],
    examples: '/v1 paths (Twitter, Instagram), Stripe-Version header',
  },
  'idempotency-key': {
    id: 'idempotency-key',
    name: 'Idempotency key',
    icon: KeyRound,
    hue: 40,
    tagline: 'A retry that can’t charge you twice',
    what: 'The client makes up a unique key for one *intended* action and sends it with the request (`Idempotency-Key: k_7f3a…`). The server stores each key with the result of the first try. If the same key comes back, it replays that saved result instead of doing the work again.',
    why: 'Networks lose replies. The client can’t tell “it failed” from “it worked and the answer got lost”, so it must retry, and only a key makes that retry safe for actions like payments and orders.',
    analogy: 'A cloakroom ticket: hand in the same ticket twice and you get the same coat back, not a second coat.',
    tradeoffs: [
      'The server has to store keys (usually ~24 hours) and look them up on every write.',
      'The key must be made *once per action* and reused on every retry. A fresh key per retry protects nothing.',
      '`GET`, `PUT` and `DELETE` are naturally idempotent; keys are for `POST` (and sometimes `PATCH`).',
    ],
    examples: 'Stripe’s Idempotency-Key header, PayPal-Request-Id, AWS ClientToken',
    diagram: 'idempotency-key',
  },
  'cursor-pagination': {
    id: 'cursor-pagination',
    name: 'Cursor pagination',
    icon: Layers,
    hue: 160,
    tagline: 'Return lists one page at a time',
    what: 'A list endpoint returns a page (say 50 items) plus a **cursor**, an opaque marker for where the page ended. The client asks for the next page with `?after=<cursor>`.',
    why: 'Lists grow without limit. A cursor lets the database jump straight to the right spot with an index, and new items arriving at the top don’t shift the pages under the reader.',
    analogy: 'A bookmark, not a page number: it stays in the right place even if someone inserts pages earlier in the book.',
    tradeoffs: ['You can’t jump to “page 37” directly.', 'Offset pagination (`?page=37`) is simpler but gets slow and skips or repeats items on busy lists.'],
    examples: 'Twitter max_id/since_id, Slack cursors, Stripe starting_after',
  },
  'rate-limit': {
    id: 'rate-limit',
    name: 'Rate limit',
    icon: Gauge,
    hue: 0,
    tagline: 'Every caller gets a budget',
    what: 'Each caller (an API key, a user or an IP) may make N requests per window, like 100 a minute. Past that, the server answers `429 Too Many Requests` with a `Retry-After` header, without doing any real work.',
    why: 'One buggy script or scraper can otherwise use up the capacity everyone shares. A 429 costs almost nothing to send.',
    analogy: 'A buffet that lets everyone take one plate at a time, so one hungry person can’t empty the trays.',
    tradeoffs: ['Limits set too low annoy real users; set them from real traffic.', 'Limits need shared counters (often Redis) when you run many servers.'],
    examples: 'GitHub API (5,000/hour), Twitter API windows, Cloudflare rate limiting',
  },
}

export const IDEA_IDS = Object.keys(IDEAS) as IdeaId[]
