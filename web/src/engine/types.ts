import type { ApiRule } from './api/rules'

// Core domain types shared by the simulator, lesson runner, timeline and UI.

export type BlockId =
  | 'client'
  | 'dns'
  | 'web-server'
  | 'sql-db'
  | 'nosql-db'
  | 'load-balancer'
  | 'read-replica'
  | 'cache'
  | 'cdn'
  | 'object-storage'
  | 'session-store'
  | 'geo-dns'
  | 'message-queue'
  | 'worker'
  | 'monitoring'
  | 'shard-router'
  | 'service'

/** Size of a service box: small, medium or large. */
export type Tier = 's' | 'm' | 'l'

export type RegionId = 'na' | 'eu'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** One route a service exposes, with the promises it makes to callers. */
export interface Endpoint {
  method: HttpMethod
  /** Path with `{param}` placeholders, e.g. `/v1/urls/{code}`. */
  path: string
  /** Accepts an Idempotency-Key header, so a retried call runs only once. */
  idempotencyKey?: boolean
  /** Returns one page at a time (cursor or limit). */
  paginated?: boolean
  /** Caller must be logged in. */
  auth?: boolean
  /** Each caller gets a request budget; extra calls get 429 Too Many Requests. */
  rateLimited?: boolean
}

/** A node placed on the canvas. */
export interface DNode {
  id: string
  block: BlockId
  x: number
  y: number
  /** Nodes that came with the level can be moved but not deleted. */
  locked?: boolean
  /** Load balancer only: route a user to the same server every time. */
  sticky?: boolean
  /** A name the learner gave this block ("Auth Service"). */
  label?: string
  /** Service only: how big a machine it runs on. */
  tier?: Tier
  /** Service only: the endpoints it exposes. */
  api?: Endpoint[]
}

export interface DEdge {
  id: string
  from: string
  to: string
}

export interface Design {
  nodes: DNode[]
  edges: DEdge[]
}

/** A rectangular zone on the canvas; nodes inside it live in that region. */
export interface RegionZone {
  id: RegionId
  label: string
  x: number
  y: number
  w: number
  h: number
}

/** Picks nodes to fail during a chaos phase. */
export type NodeSelector =
  | { block: BlockId; nth?: number }
  | { region: RegionId }
  | { id: string }

export interface ScenarioPhase {
  label: string
  seconds: number
  rps: number
  /** Fractions of traffic by request class. Whatever is left over is reads. */
  writeRatio?: number
  staticRatio?: number
  taskRatio?: number
  /** Fraction of users coming from Europe (the rest are in North America). */
  euShare?: number
  /** Total stored data, in GB. */
  dataGB?: number
  /** Share of database traffic that hits one hot key (celebrity problem). */
  hotKeyShare?: number
  cacheHitRate?: number
  /** Database work per read (a product page might need 3 queries). Default 1. */
  queryCost?: number
  /** Users are logged in, so web servers need to know their session. */
  sessions?: boolean
  failures?: NodeSelector[]
  /** Scraper/bot requests per second on top of `rps`. Rate limits turn them away at the door. */
  botRps?: number
  /** Share of writes that clients retry after a timeout. Without idempotency keys they run twice. */
  retryShare?: number
}

export interface Scenario {
  phases: ScenarioPhase[]
}

export type Goal =
  | { kind: 'maxErrorRate'; value: number }
  | { kind: 'maxP99'; value: number }
  | { kind: 'noSPOF' }
  | { kind: 'hasBlock'; block: BlockId; count?: number }
  | { kind: 'stateless' }
  | { kind: 'queueStable' }
  /** Box budget: at most this many blocks, not counting the users. */
  | { kind: 'maxBlocks'; value: number }
  /** No write ran twice because a client retried it. */
  | { kind: 'noDuplicates' }
  /** A rule about the endpoints on one service, e.g. "POST /urls takes an Idempotency-Key". */
  | { kind: 'api'; node: string; rule: ApiRule }

export type NodeStatus = 'idle' | 'ok' | 'warm' | 'hot' | 'down'

export interface NodeResult {
  load: number
  capacity: number
  utilization: number
  status: NodeStatus
  /** Requests that arrived at this node (per second). */
  inRps: number
  /** Requests this node had to drop (per second). */
  droppedRps: number
  /** Worker only: tasks waiting in the queue at the end of the phase. */
  backlog?: number
  note?: string
}

export interface PhaseResult {
  label: string
  seconds: number
  offeredRps: number
  servedRps: number
  errorRate: number
  p99Ms: number
  nodes: Record<string, NodeResult>
  edges: Record<string, number>
  warnings: string[]
  /** Writes per second that ran twice because a retry wasn't idempotent. */
  duplicateRps?: number
  /** Bot requests per second turned away by rate limits. */
  rejectedRps?: number
}

export interface SimRun {
  phases: PhaseResult[]
  /** Nodes whose failure alone breaks the system. */
  spofs: string[]
}
