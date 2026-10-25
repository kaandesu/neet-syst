import { BLOCKS } from '@/content/blocks'
import { nextEdgeId } from '@/engine/lesson/runner'
import { wouldCreateCycle } from '@/engine/sim/solver'
import type { BlockId, Design } from '@/engine/types'
import { DEFAULT_TRAFFIC, type Traffic } from './traffic'

/** What a share link carries. Kills and challenge progress stay with the person who made it. */
export interface Shared {
  design: Design
  traffic: Traffic
}

type Packed = {
  v: 1
  n: [id: string, block: BlockId, x: number, y: number, flags?: number][]
  e: [from: string, to: string][]
  t: Partial<Traffic>
}

const LOCKED = 1
const STICKY = 2
const MAX_NODES = 200

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
      return flags ? [n.id, n.block, n.x, n.y, flags] : [n.id, n.block, n.x, n.y]
    }),
    e: design.edges.map((e) => [e.from, e.to]),
    t: traffic,
  }
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
    const [id, block, x, y, flags = 0] = row
    if (typeof id !== 'string' || !id || id.length > 64 || ids.has(id) || !Object.hasOwn(BLOCKS, block)) return null
    ids.add(id)
    design.nodes.push({
      id,
      block,
      x: num(x, -1e5, 1e5, 0),
      y: num(y, -1e5, 1e5, 0),
      ...(flags & LOCKED ? { locked: true } : {}),
      ...(flags & STICKY ? { sticky: true } : {}),
    })
  }
  for (const row of p.e) {
    if (!Array.isArray(row)) return null
    const [from, to] = row
    if (!ids.has(from) || !ids.has(to) || from === to) return null
    if (design.edges.some((e) => e.from === from && e.to === to) || wouldCreateCycle(design, from, to)) return null
    design.edges.push({ id: nextEdgeId(design, from, to), from, to })
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
  return `${origin}/sandbox#${SHARE_PARAM}=${encodeShare(s)}`
}

/** Reads a share code from a location hash like `#design=…`. */
export function shareFromHash(hash: string): Shared | null {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(SHARE_PARAM)
  return code ? decodeShare(code) : null
}
