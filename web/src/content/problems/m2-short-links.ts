import type { Problem } from '@/engine/problems/types'
import { N, all, column, design, free, ids, phase } from '../chapters/ch1/_kit'

const webs = column('web', 'web-server', 5, 560, 200, 100)
const redirects = (label: string, rps: number, extra = {}) => phase(label, rps, { writeRatio: 0.01, queryCost: 2, cacheHitRate: 0.9, ...extra })

export const shortLinks: Problem = {
  id: 'short-links',
  number: 6,
  title: 'Short Links, Long Tail',
  difficulty: 'medium',
  tags: ['Cache', 'Replication', 'URL shortener'],
  speaker: 'pm',
  story: [
    'Snip.ly is a URL shortener for marketing teams. A client just bought a *Super Bowl ad* with a Snip.ly link on screen for 30 seconds.',
    'Each redirect does two database operations: look up the long URL, and bump its click counter. Links are created rarely and read constantly. And legal reminded everyone that if the database dies, every link on the internet that points to them dies too.',
  ],
  asks: ['Redirects keep working during the ad', 'Losing the database or the cache must not break redirects'],
  outOfScope: ['Custom aliases', 'The analytics dashboard'],
  numbers: [
    { label: 'Normal', value: '2,000 req/s' },
    { label: 'Ad airs', value: '4,500 req/s' },
    { label: 'DB ops per redirect', value: '2' },
    { label: 'Read : write', value: '100 : 1' },
    { label: 'Box budget', value: '12' },
  ],
  skeleton: design(
    [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('web1', 'web-server', 560, 200), N('db', 'nosql-db', 800, 200)],
    [['client', 'dns'], ['dns', 'web1']],
  ),
  palette: ['dns', 'load-balancer', 'web-server', 'nosql-db', 'read-replica', 'cache'],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 300 },
    { kind: 'maxBlocks', value: 12 },
  ],
  par: 11,
  tests: [
    { label: 'A normal day', phases: [redirects('Normal', 2000)] },
    { label: 'The ad airs', phases: [redirects('Ad airs', 4500)] },
    { label: 'Primary database dies during the ad', hidden: true, phases: [redirects('DB primary down', 4500, { failures: [{ block: 'nosql-db' }] })] },
    { label: 'Cache restarts overnight', hidden: true, phases: [redirects('Cache restarting', 1200, { failures: [{ block: 'cache' }] })] },
  ],
  hints: [
    { text: 'Start with the servers: how many does 4,500 req/s need at ~1,000 each? Then follow the arrows to the database: how many operations does it see?' },
    { text: 'The same few links get hit over and over. And a database with no copy is a single point of failure.' },
    { text: 'Put a **cache** next to the database for the hot links, and give the database **read replicas**: they take the reads the cache misses, and one can be promoted if the primary dies.', ghost: { block: 'cache', x: 800, y: 40 } },
  ],
  solution: free(
    [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 360, 200), ...webs, N('db', 'nosql-db', 800, 200), N('cache', 'cache', 800, 40), N('rep1', 'read-replica', 1000, 120), N('rep2', 'read-replica', 1000, 280)],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(webs)), ...all(ids(webs), ['db', 'cache']), ['db', 'rep1'], ['db', 'rep2']],
  ),
  editorial: [
    'Five servers behind a load balancer cover 4,500 req/s. The database would see 9,000 ops/s against ~5,000, so a cache in front takes 90% of the reads.',
    'The replicas do two jobs: they serve every read the cache misses, and if the primary dies one is promoted. When the cache restarts overnight, all reads hit the replicas, so one isn’t enough: 1,200 redirects × 2 ops is more than a single replica can take.',
    '**Interview takeaway:** URL shorteners are the classic read-heavy system. Mention 301 vs 302 redirects (a 301 lets browsers cache, but you lose click counts) and how you generate short codes.',
  ],
  sources: [{ label: 'System Design Primer: Pastebin / Bit.ly', url: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md' }],
}
