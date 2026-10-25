import type { Problem } from '@/engine/problems/types'
import { N, all, column, design, free, ids, phase } from '../chapters/ch1/_kit'

const webs = column('web', 'web-server', 3, 560)
const board = (label: string, rps: number) => phase(label, rps, { writeRatio: 0.02, queryCost: 3, cacheHitRate: 0.95 })

export const leaderboard: Problem = {
  id: 'leaderboard',
  number: 3,
  title: 'Leaderboard Lag',
  difficulty: 'easy',
  tags: ['Cache', 'Read-heavy'],
  speaker: 'pm',
  story: [
    'Pixel Pals is a mobile game with a daily challenge that resets at *8 pm*. The moment it resets, every player opens the leaderboard at once.',
    'The leaderboard is an expensive query: ranking, friends filter, and your own position. Three database queries per view. And it only changes when someone finishes a run.',
  ],
  asks: ['Survive the 8 pm reset', 'Leaderboard loads in under 250 ms'],
  numbers: [
    { label: 'Afternoon', value: '600 req/s' },
    { label: '8 pm reset', value: '2,400 req/s' },
    { label: 'DB queries per view', value: '3' },
    { label: 'Box budget', value: '8' },
  ],
  skeleton: design(
    [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 360, 200), ...webs, N('db', 'sql-db', 780, 200)],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(webs)), ...all(ids(webs), ['db'])],
  ),
  palette: ['web-server', 'sql-db', 'read-replica', 'cache'],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 250 },
    { kind: 'maxBlocks', value: 8 },
  ],
  par: 7,
  tests: [
    { label: 'A quiet afternoon', phases: [board('Afternoon', 600)] },
    { label: 'The 8 pm reset', phases: [board('8 pm reset', 2400)] },
    { label: 'Weekend tournament final', hidden: true, phases: [board('Tournament final', 2700)] },
  ],
  hints: [
    { text: 'The servers aren’t the problem. Click the database after a failed run: what is it being asked to do, over and over?' },
    { text: 'Everyone is asking for the *same* answer, and it barely changes. Remember it instead of recomputing it.' },
    { text: 'Add a **cache** and connect every web server to it (keep their arrows to the database too).', ghost: { block: 'cache', x: 780, y: 40 } },
  ],
  solution: free(
    [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 360, 200), ...webs, N('db', 'sql-db', 780, 200), N('cache', 'cache', 780, 40)],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ids(webs)), ...all(ids(webs), ['db']), ...all(ids(webs), ['cache'])],
  ),
  editorial: [
    'At 2,400 views/s × 3 queries, the database is asked for 7,200 queries/s against a ~2,000 limit. Read replicas could share that, but you’d need four of them and you’d blow the budget.',
    'A cache answers 95% of views from memory, so the database only sees ~360 queries/s. One box instead of four.',
    '**Interview takeaway:** read-heavy + rarely changing + same answer for everyone = cache it. Then talk about *invalidation*: when a run finishes, update or expire the cached board.',
  ],
}
