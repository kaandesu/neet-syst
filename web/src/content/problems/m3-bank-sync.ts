import type { Problem } from '@/engine/problems/types'
import { N, all, column, design, free, ids, phase } from '../chapters/ch1/_kit'

const webs = column('web', 'web-server', 4, 560, 200, 110)
const front = [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 360, 200)]
const sync = (label: string, rps: number, extra = {}) => phase(label, rps, { writeRatio: 0.85, ...extra })

export const bankSync: Problem = {
  id: 'bank-sync',
  number: 7,
  title: 'The 2 a.m. Bank Sync',
  difficulty: 'medium',
  tags: ['Sharding', 'Write-heavy'],
  speaker: 'oncall',
  story: [
    'Penny is a budgeting app in the spirit of Mint. Every night at *2 a.m.* it pulls the day’s transactions from every user’s bank and writes them down.',
    'For an hour, writes outnumber reads almost 6 to 1, and the database falls over. Someone already suggested read replicas. Sam is not convinced.',
  ],
  asks: ['The nightly sync finishes without errors', 'Daytime browsing stays fast'],
  outOfScope: ['Categorising transactions', 'Budget alerts'],
  numbers: [
    { label: 'Daytime', value: '800 req/s, 10% writes' },
    { label: '2 a.m. sync', value: '2,000 req/s, 85% writes' },
    { label: 'Data', value: '1.8 TB and growing' },
    { label: 'One SQL DB', value: '~2,000 ops/s, 1 TB' },
  ],
  skeleton: design([...front, ...webs, N('db', 'sql-db', 800, 200)], [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(webs)), ...all(ids(webs), ['db'])]),
  palette: ['web-server', 'sql-db', 'read-replica', 'shard-router'],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 300 },
  ],
  par: 10,
  tests: [
    { label: 'Daytime browsing', phases: [phase('Daytime', 800, { writeRatio: 0.1, dataGB: 600 })] },
    { label: 'The 2 a.m. sync', phases: [sync('2 a.m. sync', 2000, { dataGB: 1200 })] },
    { label: 'A year later: more users, more history', hidden: true, phases: [sync('A year later', 2400, { dataGB: 1800 })] },
  ],
  hints: [
    { text: 'Replicas copy *every* write. Do they reduce the write load on the primary, or add to it?' },
    { text: 'To scale writes and storage, you have to split the data itself so each database owns only part of it.' },
    { text: 'Put a **shard router** between the web servers and **two or three SQL databases**, each holding a slice of users.', ghost: { block: 'shard-router', x: 800, y: 200 } },
  ],
  solution: free(
    [...front, ...webs, N('router', 'shard-router', 800, 200), N('db', 'sql-db', 1000, 80), N('s2', 'sql-db', 1000, 200), N('s3', 'sql-db', 1000, 320)],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(webs)), ...all(ids(webs), ['router']), ...all(['router'], ['db', 's2', 's3'])],
  ),
  editorial: [
    'At 2 a.m. the database sees 1,700 writes/s, each costing about twice a read: ~3,600 ops/s on a box that does ~2,000. Replicas only help reads, and each one has to apply every write too.',
    'Sharding by user ID splits both the writes and the 1.8 TB across three databases. One user’s transactions all live on one shard, so the common query stays a single-shard query.',
    '**Interview takeaway:** say *why* you shard (write throughput or data size, not reads) and name your shard key and its hotspot risk.',
  ],
  sources: [{ label: 'System Design Primer: Mint.com', url: 'https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md' }],
}
