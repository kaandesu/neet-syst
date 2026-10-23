import type { BlockId } from '../types'

export type Role =
  | 'entry'
  | 'dns'
  | 'geo'
  | 'lb'
  | 'shard'
  | 'app'
  | 'cache'
  | 'cdn'
  | 'db'
  | 'replica'
  | 'store'
  | 'queue'
  | 'worker'
  | 'session'
  | 'monitor'

export interface BlockSpec {
  role: Role
  /** Work units per second this block can do. */
  capacity: number
  latencyMs: number
  storageGB?: number
}

const INF = 1e9

/** Numbers are deliberately round so lessons can reason about them. */
export const SPECS: Record<BlockId, BlockSpec> = {
  client: { role: 'entry', capacity: INF, latencyMs: 0 },
  dns: { role: 'dns', capacity: INF, latencyMs: 0 },
  'geo-dns': { role: 'geo', capacity: INF, latencyMs: 0 },
  'load-balancer': { role: 'lb', capacity: 20_000, latencyMs: 2 },
  'shard-router': { role: 'shard', capacity: 100_000, latencyMs: 1 },
  'web-server': { role: 'app', capacity: 1_000, latencyMs: 30 },
  cache: { role: 'cache', capacity: 20_000, latencyMs: 1 },
  cdn: { role: 'cdn', capacity: INF, latencyMs: 10 },
  'sql-db': { role: 'db', capacity: 2_000, latencyMs: 10, storageGB: 1_000 },
  'nosql-db': { role: 'db', capacity: 5_000, latencyMs: 5, storageGB: 4_000 },
  'read-replica': { role: 'replica', capacity: 2_000, latencyMs: 10, storageGB: 1_000 },
  'object-storage': { role: 'store', capacity: 1_000_000, latencyMs: 40 },
  'message-queue': { role: 'queue', capacity: 100_000, latencyMs: 2 },
  worker: { role: 'worker', capacity: 100, latencyMs: 0 },
  'session-store': { role: 'session', capacity: 20_000, latencyMs: 1 },
  monitoring: { role: 'monitor', capacity: INF, latencyMs: 0 },
}

/** Work units a web server spends per request. */
export const APP_COST = {
  request: 1,
  /** Extra cost when the server stores data on its own disk (no database). */
  localRead: 1,
  localWrite: 2,
  /** Serving an image or script from the server itself. */
  localStatic: 1,
  /** Doing a slow job (e.g. resizing a photo) inside the request. */
  inlineTask: 25,
  enqueueTask: 0.2,
}

export const DB_WRITE_COST = 2
export const INLINE_TASK_LATENCY_MS = 1500
export const CROSS_REGION_MS = 120
export const DEFAULT_CACHE_HIT = 0.8
export const CDN_HIT = 0.95

export const roleOf = (block: BlockId): Role => SPECS[block].role

/** Roles that are assumed to be managed and redundant behind the scenes. */
export const SPOF_EXEMPT: Role[] = [
  'entry',
  'dns',
  'geo',
  'lb',
  'cdn',
  'store',
  'monitor',
  'queue',
  'shard',
  'session',
]
