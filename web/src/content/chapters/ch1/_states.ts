import type { Design } from '@/engine/types'
import { N, all, design } from './_kit'

/** Canonical end-states of each level: the next level starts from these. */

const webs = ['web1', 'web2', 'web3', 'web4']
const webNodes = () => webs.map((id, i) => N(id, 'web-server', 600, 20 + i * 120))

export const lbEnd: Design = design(
  [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 380, 200), ...webNodes(), N('db', 'sql-db', 860, 200)],
  [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], webs), ...all(webs, ['db'])],
)

export const replicaEnd: Design = design(
  [...lbEnd.nodes, N('rep1', 'read-replica', 1100, 120), N('rep2', 'read-replica', 1100, 280)],
  [...lbEnd.edges.map((e) => [e.from, e.to] as [string, string]), ['db', 'rep1'], ['db', 'rep2']],
)

export const cacheEnd: Design = design(
  [...replicaEnd.nodes, N('cache', 'cache', 860, 20)],
  [...replicaEnd.edges.map((e) => [e.from, e.to] as [string, string]), ...all(webs, ['cache'])],
)

export const cdnEnd: Design = design(
  [...cacheEnd.nodes, N('cdn', 'cdn', 180, 440), N('store', 'object-storage', 380, 520)],
  [...cacheEnd.edges.map((e) => [e.from, e.to] as [string, string]), ['client', 'cdn'], ['cdn', 'store']],
)

export const WEBS = webs
