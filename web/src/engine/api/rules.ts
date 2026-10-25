import type { Design, Endpoint, HttpMethod } from '../types'

/** A check on a service's endpoints. Paths match with or without a `/v1` prefix, and any `{param}` name. */
export type ApiRule =
  | { kind: 'has'; method: HttpMethod; path: string; why?: string }
  | { kind: 'nouns'; why?: string }
  | { kind: 'plural'; why?: string }
  | { kind: 'versioned'; why?: string }
  | { kind: 'idempotent'; method: HttpMethod; path: string; why?: string }
  | { kind: 'paginated'; path: string; why?: string }
  | { kind: 'auth'; method: HttpMethod; path: string; why?: string }
  | { kind: 'rateLimited'; why?: string }

export interface ApiRuleResult {
  rule: ApiRule
  pass: boolean
  label: string
  /** Why it failed, written for the learner. */
  why?: string
}

export const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const VERBS = ['get', 'create', 'delete', 'remove', 'update', 'add', 'fetch', 'make', 'list', 'new', 'set', 'edit', 'save', 'post', 'put', 'do']
const VERB_RE = new RegExp(`^(${VERBS.join('|')})([A-Z_-]|$)`)
/** Singular segments that are fine as the first resource. */
const SINGULAR_OK = new Set(['me', 'search', 'health', 'auth', 'login', 'logout', 'feed', 'timeline', 'status', 'checkout', 'cart'])

const isParam = (seg: string) => /^\{.*\}$/.test(seg) || seg.startsWith(':')
const isVersion = (seg: string) => /^v\d+$/i.test(seg)

/** Path segments as typed, without empty pieces. */
export const segments = (path: string) => path.trim().split('/').filter(Boolean)

/** `/V1/URLs/{code}/` → `/urls/{}`: lower case, params anonymised, version dropped. */
export function normPath(path: string) {
  const segs = segments(path)
    .filter((s, i) => !(i === 0 && isVersion(s)))
    .map((s) => (isParam(s) ? '{}' : s.toLowerCase()))
  return `/${segs.join('/')}`
}

export const sameRoute = (e: Endpoint, method: HttpMethod, path: string) => e.method === method && normPath(e.path) === normPath(path)

const find = (api: Endpoint[], method: HttpMethod, path: string) => api.find((e) => sameRoute(e, method, path))

export function ruleLabel(rule: ApiRule): string {
  switch (rule.kind) {
    case 'has':
      return `Has \`${rule.method} ${rule.path}\``
    case 'nouns':
      return 'Paths name things (nouns), not actions (verbs)'
    case 'plural':
      return 'Collections are plural (`/urls`, not `/url`)'
    case 'versioned':
      return 'Every path starts with a version (`/v1/…`)'
    case 'idempotent':
      return `\`${rule.method} ${rule.path}\` takes an Idempotency-Key`
    case 'paginated':
      return `\`GET ${rule.path}\` returns pages`
    case 'auth':
      return `\`${rule.method} ${rule.path}\` requires login`
    case 'rateLimited':
      return 'Every endpoint is rate limited'
  }
}

function check(rule: ApiRule, api: Endpoint[]): string | undefined {
  switch (rule.kind) {
    case 'has': {
      if (find(api, rule.method, rule.path)) return
      const other = api.find((e) => normPath(e.path) === normPath(rule.path))
      return other ? `\`${rule.path}\` is there, but as \`${other.method}\`. Is that the right verb for this action?` : `Nothing handles \`${rule.method} ${rule.path}\` yet.`
    }
    case 'nouns': {
      const bad = api.find((e) => segments(e.path).some((s) => !isParam(s) && (VERB_RE.test(s) || VERBS.includes(s.toLowerCase()))))
      return bad && `\`${bad.path}\` has a verb in it. The HTTP method is the verb; the path should only name the thing.`
    }
    case 'plural': {
      for (const e of api) {
        const segs = segments(e.path).filter((s, i) => !(i === 0 && isVersion(s)))
        const bad = segs.find((s, i) => !isParam(s) && (i === 0 || isParam(segs[i + 1] ?? '')) && !s.toLowerCase().endsWith('s') && !SINGULAR_OK.has(s.toLowerCase()))
        if (bad) return `\`${bad}\` in \`${e.path}\` should be plural: it names a collection, and \`{id}\` picks one item out of it.`
      }
      return
    }
    case 'versioned': {
      const bad = api.find((e) => !isVersion(segments(e.path)[0] ?? ''))
      return bad && `\`${bad.path}\` has no version. Without one, any breaking change breaks every app already out there.`
    }
    case 'idempotent': {
      const e = find(api, rule.method, rule.path)
      if (!e) return `Add \`${rule.method} ${rule.path}\` first.`
      return e.idempotencyKey ? undefined : `A retried \`${rule.method} ${rule.path}\` would run twice. Turn on its Idempotency-Key.`
    }
    case 'paginated': {
      const e = find(api, 'GET', rule.path)
      if (!e) return `Add \`GET ${rule.path}\` first.`
      return e.paginated ? undefined : `\`GET ${rule.path}\` returns everything at once. One busy user and the response is megabytes.`
    }
    case 'auth': {
      const e = find(api, rule.method, rule.path)
      if (!e) return `Add \`${rule.method} ${rule.path}\` first.`
      return e.auth ? undefined : `Anyone could call \`${rule.method} ${rule.path}\`. It needs a logged-in caller.`
    }
    case 'rateLimited': {
      if (!api.length) return 'There are no endpoints to limit yet.'
      const bad = api.find((e) => !e.rateLimited)
      return bad && `\`${bad.method} ${bad.path}\` has no rate limit, so one script can call it as fast as it likes.`
    }
  }
}

export function evaluateApi(api: Endpoint[], rules: ApiRule[]): ApiRuleResult[] {
  return rules.map((rule) => {
    const why = check(rule, api)
    return { rule, label: ruleLabel(rule), pass: !why, why: why && (rule.why ?? why) }
  })
}

/** Every endpoint across the design, for design-wide checks. */
const allEndpoints = (design: Design) => design.nodes.flatMap((n) => n.api ?? [])

/** Bots get turned away only when every published endpoint is rate limited. */
export const isRateLimited = (design: Design) => {
  const api = allEndpoints(design)
  return api.length > 0 && api.every((e) => e.rateLimited)
}

/** Retried writes are safe only when every POST takes an idempotency key (PUT and DELETE are idempotent by nature). */
export const retriesAreSafe = (design: Design) => {
  const posts = allEndpoints(design).filter((e) => e.method === 'POST')
  return posts.length > 0 && posts.every((e) => e.idempotencyKey)
}
