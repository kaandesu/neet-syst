import type {
  Design,
  DNode,
  NodeResult,
  NodeSelector,
  NodeStatus,
  PhaseResult,
  RegionId,
  RegionZone,
  Scenario,
  ScenarioPhase,
  SimRun,
} from '../types'
import {
  APP_COST,
  CDN_HIT,
  CROSS_REGION_MS,
  DB_WRITE_COST,
  DEFAULT_CACHE_HIT,
  INLINE_TASK_LATENCY_MS,
  SPECS,
  SPOF_EXEMPT,
  roleOf,
  type Role,
} from './specs'

/**
 * A steady-state flow solver. Each phase is solved independently (except for
 * worker backlogs, which carry over), which is enough to show *why* a design
 * breaks without simulating individual requests.
 */

type Cls = 'read' | 'write' | 'static' | 'task' | 'session'
const USER_CLASSES: Cls[] = ['read', 'write', 'static', 'task']
const REGIONS: RegionId[] = ['na', 'eu']

/** Flow keyed by `${region}:${class}`, in requests per second. */
type Flow = Record<string, number>
const key = (r: RegionId, c: Cls) => `${r}:${c}`
const clsOf = (k: string) => k.split(':')[1] as Cls
const regionOfKey = (k: string) => k.split(':')[0] as RegionId

function addFlow(into: Flow, k: string, v: number) {
  if (v <= 0) return
  into[k] = (into[k] ?? 0) + v
}
const total = (f: Flow, userOnly = false) =>
  Object.entries(f).reduce((s, [k, v]) => (userOnly && clsOf(k) === 'session' ? s : s + v), 0)

export interface SimOptions {
  zones?: RegionZone[]
}

export function regionOfNode(n: DNode, zones: RegionZone[] = []): RegionId {
  for (const z of zones) {
    if (n.x >= z.x && n.x <= z.x + z.w && n.y >= z.y && n.y <= z.y + z.h) return z.id
  }
  return 'na'
}

export function selectNodes(design: Design, sel: NodeSelector, zones: RegionZone[] = []): string[] {
  if ('id' in sel) return design.nodes.some((n) => n.id === sel.id) ? [sel.id] : []
  if ('region' in sel) return design.nodes.filter((n) => regionOfNode(n, zones) === sel.region).map((n) => n.id)
  const matching = design.nodes.filter((n) => n.block === sel.block)
  if (sel.nth === undefined) return matching.slice(0, 1).map((n) => n.id)
  return matching[sel.nth] ? [matching[sel.nth].id] : []
}

interface Graph {
  byId: Map<string, DNode>
  children: Map<string, string[]>
  parents: Map<string, string[]>
  edgeId: Map<string, string>
  order: string[]
}

function buildGraph(design: Design): Graph {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  const edgeId = new Map<string, string>()
  for (const n of design.nodes) {
    children.set(n.id, [])
    parents.set(n.id, [])
  }
  for (const e of design.edges) {
    if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to) continue
    if (edgeId.has(`${e.from}>${e.to}`)) continue
    children.get(e.from)!.push(e.to)
    parents.get(e.to)!.push(e.from)
    edgeId.set(`${e.from}>${e.to}`, e.id)
  }
  // Kahn's algorithm; nodes caught in a cycle are left out of the order.
  const indeg = new Map(design.nodes.map((n) => [n.id, parents.get(n.id)!.length]))
  const queue = design.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const c of children.get(id)!) {
      indeg.set(c, indeg.get(c)! - 1)
      if (indeg.get(c) === 0) queue.push(c)
    }
  }
  return { byId, children, parents, edgeId, order }
}

export function wouldCreateCycle(design: Design, from: string, to: string): boolean {
  if (from === to) return true
  const g = buildGraph(design)
  const stack = [to]
  const seen = new Set<string>()
  while (stack.length) {
    const id = stack.pop()!
    if (id === from) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(g.children.get(id) ?? []))
  }
  return false
}

/** Which request classes a node can handle, itself or through its children. */
function computeAccepts(g: Graph): Map<string, Set<Cls>> {
  const acc = new Map<string, Set<Cls>>()
  const own: Partial<Record<Role, Cls[]>> = {
    app: ['read', 'write', 'static', 'task'],
    cache: ['read'],
    cdn: ['static'],
    db: ['read', 'write'],
    replica: ['read'],
    store: ['static'],
    queue: ['task'],
    worker: ['task'],
    session: ['session'],
  }
  const forwards: Role[] = ['entry', 'dns', 'geo', 'lb', 'shard', 'cache', 'cdn', 'queue', 'db']
  for (const id of [...g.order].reverse()) {
    const role = roleOf(g.byId.get(id)!.block)
    const set = new Set<Cls>(own[role] ?? [])
    if (forwards.includes(role)) {
      for (const c of g.children.get(id)!) for (const cls of acc.get(c) ?? []) set.add(cls)
    }
    acc.set(id, set)
  }
  return acc
}

interface Out {
  to: string
  key: string
  v: number
}

interface PhaseCtx {
  g: Graph
  accepts: Map<string, Set<Cls>>
  down: Set<string>
  region: Map<string, RegionId>
  phase: ScenarioPhase
  dataScale: Map<string, number>
  warnings: Set<string>
}

const role = (ctx: PhaseCtx, id: string) => roleOf(ctx.g.byId.get(id)!.block)
const kidsWithRole = (ctx: PhaseCtx, id: string, roles: Role[]) =>
  ctx.g.children.get(id)!.filter((c) => roles.includes(role(ctx, c)))
const healthy = (ctx: PhaseCtx, ids: string[]) => ids.filter((i) => !ctx.down.has(i))

/** A cache that is down acts like it is not there at all. */
const liveCaches = (ctx: PhaseCtx, id: string) => healthy(ctx, kidsWithRole(ctx, id, ['cache']))

function split(outs: Out[], targets: string[], k: string, v: number, weights?: number[]) {
  if (!targets.length || v <= 0) return
  targets.forEach((t, i) => {
    const w = weights ? weights[i] : 1 / targets.length
    outs.push({ to: t, key: k, v: v * w })
  })
}

/** Web servers that keep sessions in their own memory. */
function isStatefulApp(ctx: PhaseCtx, id: string) {
  return role(ctx, id) === 'app' && kidsWithRole(ctx, id, ['session']).length === 0
}

interface Routed {
  load: number
  outs: Out[]
  dropped: Flow
  extraLatency: Partial<Record<Cls, number>>
  backlogIn?: number
}

function routeRouter(ctx: PhaseCtx, id: string, f: Flow): Routed {
  const r: Routed = { load: total(f), outs: [], dropped: {}, extraLatency: {} }
  const node = ctx.g.byId.get(id)!
  const kids = ctx.g.children.get(id)!
  const myRole = role(ctx, id)
  for (const [k, v] of Object.entries(f)) {
    const cls = clsOf(k)
    let cands = kids.filter((c) => ctx.accepts.get(c)?.has(cls))
    // Down caches are bypassed by whoever sits above them.
    cands = cands.filter((c) => !(role(ctx, c) === 'cache' && ctx.down.has(c) && !ctx.g.children.get(c)!.length))
    if (cls === 'static') {
      const cdns = cands.filter((c) => role(ctx, c) === 'cdn')
      if (cdns.length) cands = cdns
    } else {
      const nonCdn = cands.filter((c) => role(ctx, c) !== 'cdn')
      if (nonCdn.length) cands = nonCdn
    }
    if (!cands.length) {
      addFlow(r.dropped, k, v)
      if (cls !== 'session') ctx.warnings.add(`Nothing behind ${node.id} can handle ${cls} requests.`)
      continue
    }
    let targets = healthy(ctx, cands)
    if (myRole === 'geo' && targets.length) {
      const local = targets.filter((t) => ctx.region.get(t) === regionOfKey(k))
      if (local.length) targets = local
    }
    if (!targets.length) targets = cands // everything is down: send it anyway and let it fail
    if (myRole === 'shard' && (cls === 'read' || cls === 'write')) {
      const hot = ctx.phase.hotKeyShare ?? 0
      const n = targets.length
      split(r.outs, targets, k, v, targets.map((_, i) => (1 - hot) / n + (i === 0 ? hot : 0)))
      continue
    }
    split(r.outs, targets, k, v)
  }

  if (myRole === 'lb') applySessionRules(ctx, id, node, r)
  return r
}

/** Sessions stored on individual web servers break once there is more than one. */
function applySessionRules(ctx: PhaseCtx, id: string, node: DNode, r: Routed) {
  const apps = kidsWithRole(ctx, id, ['app'])
  if (!ctx.phase.sessions) return
  if (apps.length < 2 || !apps.some((a) => isStatefulApp(ctx, a))) return
  const live = healthy(ctx, apps)
  const writes = REGIONS.map((reg) => key(reg, 'write'))
  if (!node.sticky) {
    // Each request lands on a random server that has never seen this user.
    const lost = live.length > 1 ? (live.length - 1) / live.length : 0
    if (lost > 0) {
      ctx.warnings.add('Users get logged out: their session lives on a different server than the one the load balancer picked.')
      dropFromOuts(r, writes, lost)
    }
  } else if (live.length < apps.length) {
    // Sticky users of a dead server lose their session when rerouted.
    const lost = (apps.length - live.length) / apps.length
    ctx.warnings.add('A server died and took its users’ sessions with it (sticky sessions).')
    dropFromOuts(r, writes, lost)
  }
}

function dropFromOuts(r: Routed, keys: string[], frac: number) {
  for (const o of r.outs) {
    if (!keys.includes(o.key)) continue
    const d = o.v * frac
    o.v -= d
    addFlow(r.dropped, o.key, d)
  }
}

function routeApp(ctx: PhaseCtx, id: string, f: Flow): Routed {
  const r: Routed = { load: 0, outs: [], dropped: {}, extraLatency: {} }
  const caches = liveCaches(ctx, id)
  const readThrough = caches.filter((c) => ctx.g.children.get(c)!.length > 0)
  const asideCaches = caches.filter((c) => !readThrough.includes(c))
  const primaries = kidsWithRole(ctx, id, ['db', 'shard'])
  const replicas = kidsWithRole(ctx, id, ['replica'])
  const stores = healthy(ctx, kidsWithRole(ctx, id, ['store', 'cdn']))
  const queues = healthy(ctx, kidsWithRole(ctx, id, ['queue']))
  const sessions = kidsWithRole(ctx, id, ['session'])
  const hit = ctx.phase.cacheHitRate ?? DEFAULT_CACHE_HIT
  const hasData = primaries.length + replicas.length + readThrough.length > 0

  for (const reg of REGIONS) {
    const read = f[key(reg, 'read')] ?? 0
    const write = f[key(reg, 'write')] ?? 0
    const stat = f[key(reg, 'static')] ?? 0
    const task = f[key(reg, 'task')] ?? 0
    r.load += (read + write) * APP_COST.request

    // Reads: cache first, then replicas, then the primary.
    if (read > 0) {
      if (readThrough.length) {
        split(r.outs, readThrough, key(reg, 'read'), read)
      } else {
        let miss = read
        if (asideCaches.length) {
          split(r.outs, asideCaches, key(reg, 'read'), read * hit)
          miss = read * (1 - hit)
        }
        const liveReplicas = healthy(ctx, replicas)
        if (liveReplicas.length) split(r.outs, liveReplicas, key(reg, 'read'), miss)
        else if (primaries.length) split(r.outs, pickLive(ctx, primaries), key(reg, 'read'), miss)
        else if (replicas.length) split(r.outs, replicas, key(reg, 'read'), miss)
        else if (!hasData) r.load += miss * APP_COST.localRead
      }
    }

    // Writes: the primary; promote a replica if the primary is gone.
    if (write > 0) {
      const livePrimaries = healthy(ctx, primaries)
      const liveReplicas = healthy(ctx, replicas)
      if (livePrimaries.length) split(r.outs, livePrimaries, key(reg, 'write'), write)
      else if (primaries.length && liveReplicas.length) {
        ctx.warnings.add('The primary database failed; a replica was promoted to take writes.')
        split(r.outs, liveReplicas.slice(0, 1), key(reg, 'write'), write)
      } else if (primaries.length) split(r.outs, primaries, key(reg, 'write'), write)
      else if (readThrough.length) split(r.outs, readThrough, key(reg, 'write'), write)
      else if (replicas.length) {
        addFlow(r.dropped, key(reg, 'write'), write)
        ctx.warnings.add('Replicas are read-only: writes need a primary database.')
      } else r.load += write * APP_COST.localWrite
    }

    if (stat > 0) {
      if (stores.length) split(r.outs, stores, key(reg, 'static'), stat)
      else r.load += stat * APP_COST.localStatic
    }

    if (task > 0) {
      if (queues.length) {
        split(r.outs, queues, key(reg, 'task'), task)
        r.load += task * APP_COST.enqueueTask
      } else {
        r.load += task * APP_COST.inlineTask
        r.extraLatency.task = INLINE_TASK_LATENCY_MS
      }
    }

    if (sessions.length) split(r.outs, sessions, key(reg, 'session'), read + write)
  }
  return r
}

function pickLive(ctx: PhaseCtx, ids: string[]) {
  const live = healthy(ctx, ids)
  return live.length ? live : ids
}

function routeCache(ctx: PhaseCtx, id: string, f: Flow): Routed {
  const isDown = ctx.down.has(id)
  const hit = isDown ? 0 : (ctx.phase.cacheHitRate ?? DEFAULT_CACHE_HIT)
  const r: Routed = { load: isDown ? 0 : total(f), outs: [], dropped: {}, extraLatency: {} }
  const kids = ctx.g.children.get(id)!
  for (const [k, v] of Object.entries(f)) {
    const cls = clsOf(k)
    const pass = cls === 'read' ? v * (1 - hit) : v
    if (pass <= 0) continue
    let cands = kids.filter((c) => ctx.accepts.get(c)?.has(cls))
    if (cls === 'read') {
      const reps = healthy(ctx, cands.filter((c) => role(ctx, c) === 'replica'))
      if (reps.length) cands = reps
    } else {
      cands = cands.filter((c) => role(ctx, c) !== 'replica')
    }
    if (!kids.length) continue // cache-aside: misses were already sent to the DB by the app
    if (!cands.length) addFlow(r.dropped, k, pass)
    else split(r.outs, pickLive(ctx, cands), k, pass)
  }
  return r
}

function routeCdn(ctx: PhaseCtx, id: string, f: Flow): Routed {
  const r: Routed = { load: 0, outs: [], dropped: {}, extraLatency: {} }
  const kids = ctx.g.children.get(id)!
  for (const [k, v] of Object.entries(f)) {
    const cls = clsOf(k)
    const pass = cls === 'static' ? v * (1 - CDN_HIT) : v
    if (pass <= 0) continue
    const cands = kids.filter((c) => ctx.accepts.get(c)?.has(cls))
    if (!cands.length) {
      if (cls === 'static') continue // edge cache serves it; origin assumed elsewhere
      addFlow(r.dropped, k, pass)
      ctx.warnings.add('A CDN only serves static files; dynamic requests need a path to your servers.')
    } else split(r.outs, pickLive(ctx, cands), k, pass)
  }
  return r
}

function routeTerminal(ctx: PhaseCtx, id: string, f: Flow, myRole: Role): Routed {
  const r: Routed = { load: 0, outs: [], dropped: {}, extraLatency: {} }
  const node = ctx.g.byId.get(id)!
  for (const [k, v] of Object.entries(f)) {
    const cls = clsOf(k)
    if (myRole === 'db' || myRole === 'replica') {
      const replicas = myRole === 'db' ? healthy(ctx, kidsWithRole(ctx, id, ['replica'])) : []
      if (cls === 'write') r.load += v * DB_WRITE_COST
      else if (cls === 'read' && replicas.length) split(r.outs, replicas, k, v)
      else if (cls === 'read') r.load += v * (ctx.phase.queryCost ?? 1)
      else addFlow(r.dropped, k, v)
    } else if (myRole === 'queue') {
      r.load += v * 0.01
      const workers = healthy(ctx, kidsWithRole(ctx, id, ['worker']))
      if (workers.length) split(r.outs, workers, k, v)
      else ctx.warnings.add('Tasks pile up in the queue: no workers are consuming it.')
    } else if (myRole === 'worker') {
      r.load += v
      r.backlogIn = (r.backlogIn ?? 0) + v
    } else {
      r.load += v
    }
  }
  if (myRole === 'db' || myRole === 'replica') {
    const cap = SPECS[node.block].storageGB ?? Infinity
    const data = (ctx.phase.dataGB ?? 0) * (ctx.dataScale.get(id) ?? 1)
    if (data > cap) {
      ctx.warnings.add(`${node.id} is full: ${Math.round(data)} GB of data, room for ${cap} GB.`)
      for (const reg of REGIONS) {
        const k = key(reg, 'write')
        if (f[k]) {
          addFlow(r.dropped, k, f[k])
          r.load -= f[k] * DB_WRITE_COST
        }
      }
    }
  }
  return r
}

function effectiveLatency(base: number, u: number) {
  if (u <= 0.6) return base
  if (u <= 1) return base * (1 + 4 * (u - 0.6))
  return base * 2.6 + 250
}

function statusOf(u: number, inRps: number, down: boolean): NodeStatus {
  if (down) return 'down'
  if (inRps <= 0) return 'idle'
  if (u < 0.6) return 'ok'
  if (u < 0.85) return 'warm'
  return 'hot'
}

const FRONT_ROLES: Role[] = ['entry', 'dns', 'geo']

export function solvePhase(
  design: Design,
  phase: ScenarioPhase,
  opts: SimOptions = {},
  backlogs: Map<string, number> = new Map(),
): PhaseResult {
  const g = buildGraph(design)
  const zones = opts.zones ?? []
  const region = new Map(design.nodes.map((n) => [n.id, regionOfNode(n, zones)]))
  const down = new Set((phase.failures ?? []).flatMap((s) => selectNodes(design, s, zones)))
  const dataScale = new Map<string, number>()
  for (const id of g.order) {
    if (roleOf(g.byId.get(id)!.block) !== 'shard') continue
    const dbs = g.children.get(id)!.filter((c) => ['db', 'replica'].includes(roleOf(g.byId.get(c)!.block)))
    for (const d of dbs) dataScale.set(d, Math.min(dataScale.get(d) ?? 1, 1 / dbs.length))
  }
  for (const id of g.order) {
    if (roleOf(g.byId.get(id)!.block) !== 'db') continue
    for (const c of g.children.get(id)!) {
      if (roleOf(g.byId.get(c)!.block) === 'replica') dataScale.set(c, Math.min(dataScale.get(c) ?? 1, dataScale.get(id) ?? 1))
    }
  }
  const ctx: PhaseCtx = { g, accepts: computeAccepts(g), down, region, phase, dataScale, warnings: new Set() }

  // Offered traffic, split evenly across client nodes.
  const clients = design.nodes.filter((n) => n.block === 'client')
  const incoming = new Map<string, Flow>(design.nodes.map((n) => [n.id, {}]))
  const write = phase.writeRatio ?? 0
  const stat = phase.staticRatio ?? 0
  const task = phase.taskRatio ?? 0
  const read = Math.max(0, 1 - write - stat - task)
  const eu = phase.euShare ?? 0
  for (const c of clients) {
    const share = phase.rps / clients.length
    for (const [reg, rs] of [['na', 1 - eu], ['eu', eu]] as const) {
      const f = incoming.get(c.id)!
      addFlow(f, key(reg, 'read'), share * rs * read)
      addFlow(f, key(reg, 'write'), share * rs * write)
      addFlow(f, key(reg, 'static'), share * rs * stat)
      addFlow(f, key(reg, 'task'), share * rs * task)
    }
  }

  const nodes: Record<string, NodeResult> = {}
  const edges: Record<string, number> = {}
  const latencyOf = new Map<string, { own: number; extra: Partial<Record<Cls, number>> }>()
  const shares = new Map<string, Out[]>() // fraction of each key sent to each child
  let dropped = 0

  for (const id of g.order) {
    const node = g.byId.get(id)!
    const spec = SPECS[node.block]
    const myRole = spec.role
    const f = incoming.get(id)!
    const inRps = total(f, true)
    const isDown = down.has(id)

    let routed: Routed
    const promotable = myRole === 'db' && isDown ? healthy(ctx, kidsWithRole(ctx, id, ['replica'])) : []
    if (promotable.length) {
      ctx.warnings.add('The primary database failed; a replica was promoted to take writes.')
      routed = { load: 0, outs: [], dropped: {}, extraLatency: {} }
      for (const [k, v] of Object.entries(f)) {
        if (clsOf(k) === 'write') split(routed.outs, promotable.slice(0, 1), k, v)
        else if (clsOf(k) === 'read') split(routed.outs, promotable, k, v)
      }
    } else if (isDown && myRole !== 'cache') {
      routed = { load: 0, outs: [], dropped: { ...f }, extraLatency: {} }
    } else if (['entry', 'dns', 'geo', 'lb', 'shard'].includes(myRole)) routed = routeRouter(ctx, id, f)
    else if (myRole === 'app') routed = routeApp(ctx, id, f)
    else if (myRole === 'cache') routed = routeCache(ctx, id, f)
    else if (myRole === 'cdn') routed = routeCdn(ctx, id, f)
    else routed = routeTerminal(ctx, id, f, myRole)

    const capacity = spec.capacity
    const u = routed.load / capacity
    let backlog: number | undefined
    if (myRole === 'worker') {
      const prev = backlogs.get(id) ?? 0
      backlog = Math.max(0, prev + ((routed.backlogIn ?? 0) - capacity) * phase.seconds)
      backlogs.set(id, backlog)
    } else if (u > 1) {
      // Overloaded: only `1/u` of the work gets done, the rest fails.
      const s = 1 / u
      for (const [k, v] of Object.entries(f)) {
        const kept = v - (routed.dropped[k] ?? 0)
        if (kept > 0) addFlow(routed.dropped, k, kept * (1 - s))
      }
      for (const o of routed.outs) o.v *= s
    }

    for (const [k, v] of Object.entries(routed.dropped)) if (clsOf(k) !== 'session') dropped += v

    const droppedHere = total(routed.dropped, true)
    nodes[id] = {
      load: routed.load,
      capacity,
      utilization: isDown ? 0 : u,
      status: myRole === 'worker' && backlog ? 'hot' : statusOf(u, inRps, isDown),
      inRps,
      droppedRps: droppedHere,
      backlog,
      note: isDown ? 'Down' : undefined,
    }

    const sh: Out[] = []
    for (const o of routed.outs) {
      if (o.v <= 0) continue
      addFlow(incoming.get(o.to)!, o.key, o.v)
      const eid = g.edgeId.get(`${id}>${o.to}`)
      if (eid) edges[eid] = (edges[eid] ?? 0) + o.v
      const fin = f[o.key] ?? 0
      if (fin > 0) sh.push({ to: o.to, key: o.key, v: o.v / fin })
    }
    shares.set(id, sh)
    latencyOf.set(id, { own: effectiveLatency(spec.latencyMs, u), extra: routed.extraLatency })
  }

  // Latency per key, from the leaves back up to the clients.
  const lat = new Map<string, Record<string, number>>()
  for (const id of [...g.order].reverse()) {
    const node = g.byId.get(id)!
    const myRole = roleOf(node.block)
    const { own, extra } = latencyOf.get(id)!
    const perKey: Record<string, number> = {}
    const keys = new Set<string>(Object.keys(incoming.get(id)!))
    for (const k of keys) {
      let l = own + (extra[clsOf(k)] ?? 0)
      if (myRole !== 'queue') {
        for (const s of shares.get(id)!.filter((x) => x.key === k)) {
          let child = lat.get(s.to)?.[k] ?? 0
          const childRole = roleOf(g.byId.get(s.to)!.block)
          const crosses =
            FRONT_ROLES.includes(myRole) &&
            !FRONT_ROLES.includes(childRole) &&
            childRole !== 'cdn' &&
            region.get(s.to) !== regionOfKey(k)
          if (crosses) child += CROSS_REGION_MS
          l += s.v * child
        }
      }
      perKey[k] = l
    }
    lat.set(id, perKey)
  }

  const offered = phase.rps
  let p99 = 0
  for (const c of clients) {
    const f = incoming.get(c.id)!
    const tot = total(f, true)
    for (const [k, v] of Object.entries(f)) {
      if (tot <= 0 || v / tot < 0.02 || clsOf(k) === 'session') continue
      p99 = Math.max(p99, (lat.get(c.id)?.[k] ?? 0) * 1.5)
    }
  }
  if (!clients.length) ctx.warnings.add('There are no users yet: add a Client.')

  const errorRate = offered > 0 ? Math.min(1, dropped / offered) : 0
  return {
    label: phase.label,
    seconds: phase.seconds,
    offeredRps: offered,
    servedRps: Math.max(0, offered - dropped),
    errorRate,
    p99Ms: Math.round(p99),
    nodes,
    edges,
    warnings: [...ctx.warnings],
  }
}

export function runScenario(design: Design, scenario: Scenario, opts: SimOptions = {}): SimRun {
  const backlogs = new Map<string, number>()
  const phases = scenario.phases.map((p) => solvePhase(design, p, opts, backlogs))
  return { phases, spofs: findSpofs(design, scenario.phases[0], opts) }
}

/** A node is a single point of failure if killing it alone causes real errors. */
export function findSpofs(design: Design, phase: ScenarioPhase | undefined, opts: SimOptions = {}): string[] {
  if (!phase) return []
  const calm: ScenarioPhase = { ...phase, failures: [] }
  const base = solvePhase(design, calm, opts)
  return design.nodes
    .filter((n) => !SPOF_EXEMPT.includes(roleOf(n.block)) && base.nodes[n.id]?.inRps > 0)
    .filter((n) => solvePhase(design, { ...calm, failures: [{ id: n.id }] }, opts).errorRate - base.errorRate > 0.05)
    .map((n) => n.id)
}

export const USER_REQUEST_CLASSES = USER_CLASSES
