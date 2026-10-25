import { BLOCKS } from '@/content/blocks'
import { MAX_LABEL, nextEdgeId } from '@/engine/lesson/runner'
import { wouldCreateCycle } from '@/engine/sim/solver'
import { METHODS } from '@/engine/api/rules'
import type { BlockId, Design, Endpoint, HttpMethod, Tier } from '@/engine/types'
import { DEFAULT_TRAFFIC, type Traffic } from './traffic'

/** What a share link carries. Kills and challenge progress stay with the person who made it. */
export interface Shared {
  design: Design
  traffic: Traffic
}

type Packed = {
  v: 1
  n: [id: string, block: BlockId, x: number, y: number, flags?: number, label?: string, tier?: Tier][]
  e: [from: string, to: string][]
  t: Partial<Traffic>
  /** Service endpoints by node id: method, path, promise bits. */
  a?: Record<string, [method: HttpMethod, path: string, bits: number][]>
}

const API_FLAGS = ['idempotencyKey', 'paginated', 'auth', 'rateLimited'] as const
const MAX_ENDPOINTS = 12

const LOCKED = 1
const STICKY = 2
const MAX_NODES = 200
const TIERS: Tier[] = ['s', 'm', 'l']

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeShare({ design, traffic }: Shared): string {
  const packed: Packed = {
    v: 1,
    n: design.nodes.map((n) => {
      const flags = (n.locked ? LOCKED : 0) | (n.sticky ? STICKY : 0)
      if (n.tier) return [n.id, n.block, n.x, n.y, flags, n.label ?? '', n.tier]
      if (n.label) return [n.id, n.block, n.x, n.y, flags, n.label]
      return flags ? [n.id, n.block, n.x, n.y, flags] : [n.id, n.block, n.x, n.y]
    }),
    e: design.edges.map((e) => [e.from, e.to]),
    t: traffic,
  }
  const withApi = design.nodes.filter((n) => n.api?.length)
  if (withApi.length)
    packed.a = Object.fromEntries(
      withApi.map((n) => [n.id, n.api!.map((e) => [e.method, e.path, API_FLAGS.reduce((b, f, i) => (e[f] ? b | (1 << i) : b), 0)] as [HttpMethod, string, number])]),
    )
  return toBase64Url(JSON.stringify(packed))
}

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback)

/** Parses a share code. Anything malformed, unknown or cyclic is rejected rather than half-loaded. */
export function decodeShare(code: string): Shared | null {
  let p: Packed
  try {
    p = JSON.parse(fromBase64Url(code))
  } catch {
    return null
  }
  if (!p || p.v !== 1 || !Array.isArray(p.n) || !Array.isArray(p.e) || p.n.length > MAX_NODES) return null

  const design: Design = { nodes: [], edges: [] }
  const ids = new Set<string>()
  for (const row of p.n) {
    if (!Array.isArray(row)) return null
    const [id, block, x, y, flags = 0, label, tier] = row
    if (typeof id !== 'string' || !id || id.length > 64 || ids.has(id) || !Object.hasOwn(BLOCKS, block)) return null
    ids.add(id)
    design.nodes.push({
      id,
      block,
      x: num(x, -1e5, 1e5, 0),
      y: num(y, -1e5, 1e5, 0),
      ...(flags & LOCKED ? { locked: true } : {}),
      ...(flags & STICKY ? { sticky: true } : {}),
      ...(typeof label === 'string' && label.trim() ? { label: label.trim().slice(0, MAX_LABEL) } : {}),
      ...(block === 'service' && TIERS.includes(tier as Tier) ? { tier } : {}),
    })
  }
  for (const row of p.e) {
    if (!Array.isArray(row)) return null
    const [from, to] = row
    if (!ids.has(from) || !ids.has(to) || from === to) return null
    if (design.edges.some((e) => e.from === from && e.to === to) || wouldCreateCycle(design, from, to)) return null
    design.edges.push({ id: nextEdgeId(design, from, to), from, to })
  }

  for (const [id, rows] of Object.entries(p.a ?? {})) {
    const node = design.nodes.find((n) => n.id === id)
    if (!node || node.block !== 'service' || !Array.isArray(rows)) return null
    const api: Endpoint[] = []
    for (const row of rows.slice(0, MAX_ENDPOINTS)) {
      if (!Array.isArray(row)) return null
      const [method, path, bits] = row
      if (!METHODS.includes(method) || typeof path !== 'string' || path.length > 80) return null
      const e: Endpoint = { method, path }
      API_FLAGS.forEach((f, i) => {
        if (typeof bits === 'number' && bits & (1 << i)) e[f] = true
      })
      api.push(e)
    }
    if (api.length) node.api = api
  }

  const t = p.t ?? {}
  const traffic: Traffic = {
    rps: num(t.rps, 1, 1e6, DEFAULT_TRAFFIC.rps),
    writeRatio: num(t.writeRatio, 0, 1, DEFAULT_TRAFFIC.writeRatio),
    staticRatio: num(t.staticRatio, 0, 1, DEFAULT_TRAFFIC.staticRatio),
    taskRatio: num(t.taskRatio, 0, 1, DEFAULT_TRAFFIC.taskRatio),
    cacheHitRate: num(t.cacheHitRate, 0, 1, DEFAULT_TRAFFIC.cacheHitRate),
    euShare: num(t.euShare, 0, 1, DEFAULT_TRAFFIC.euShare),
    sessions: t.sessions === true,
  }
  return { design, traffic }
}

export const SHARE_PARAM = 'design'

export function shareUrl(s: Shared, origin = location.origin) {
  return `${origin}${import.meta.env.BASE_URL}sandbox#${SHARE_PARAM}=${encodeShare(s)}`
}

/** Reads a share code from a location hash like `#design=…`. */
export function shareFromHash(hash: string): Shared | null {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(SHARE_PARAM)
  return code ? decodeShare(code) : null
}
