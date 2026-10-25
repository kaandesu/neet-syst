/** Mock data shared by every /design concept, so the directions can be compared like for like. */

export type LessonState = 'done' | 'current' | 'locked'

export const LEARNER = { name: 'kaan', level: 4, xp: 1240, xpNext: 1600, streak: 7 }

export const CHAPTER = {
  number: 1,
  title: 'Scale from Zero to Millions',
  subtitle: 'Grow one lonely server into a system that survives launch day.',
}

export const LESSONS: { id: string; title: string; block: string; state: LessonState; minutes: number }[] = [
  { id: '01', title: 'Your first request', block: 'Web server', state: 'done', minutes: 8 },
  { id: '02', title: 'Give data its own home', block: 'Database', state: 'done', minutes: 10 },
  { id: '03', title: 'Back-of-the-envelope math', block: 'Estimation', state: 'done', minutes: 12 },
  { id: '04', title: 'Scale out with a load balancer', block: 'Load balancer', state: 'done', minutes: 11 },
  { id: '05', title: 'Database replication', block: 'Replica', state: 'current', minutes: 12 },
  { id: '06', title: 'Cache the hot data', block: 'Cache', state: 'locked', minutes: 10 },
  { id: '07', title: 'Static files at the edge', block: 'CDN', state: 'locked', minutes: 9 },
  { id: '08', title: 'A stateless web tier', block: 'Session store', state: 'locked', minutes: 11 },
]

export const LESSONS_TOTAL = 12
export const LESSONS_DONE = LESSONS.filter((l) => l.state === 'done').length

export const MENTOR = {
  name: 'Ada',
  text: 'Your single database is now the bottleneck: 92% of its time goes to reads. What if we copied it and let the copies answer reads?',
}

export const QUIZ = {
  question: 'Writes go to the primary. Where should a “view profile” read go?',
  options: ['Always the primary', 'Any read replica', 'A random app server', 'The load balancer'],
  correct: 1,
  why: 'Replicas exist to absorb reads. Accept a few ms of replication lag in exchange for the headroom.',
}

export const CHAOS = [
  { id: 'spike', label: 'Traffic spike ×10' },
  { id: 'kill-db', label: 'Kill primary DB' },
  { id: 'slow-net', label: 'Slow network' },
] as const

export const BLOCKS = ['Web server', 'Database', 'Load balancer', 'Replica', 'Cache', 'CDN', 'Queue', 'Shard']

/** The architecture every concept draws. Coordinates live in a 640×260 box. */
export type DNode = { id: string; label: string; x: number; y: number }

export const NODES: DNode[] = [
  { id: 'client', label: 'Client', x: 50, y: 130 },
  { id: 'lb', label: 'Load balancer', x: 185, y: 130 },
  { id: 'app1', label: 'App 01', x: 320, y: 55 },
  { id: 'app2', label: 'App 02', x: 320, y: 130 },
  { id: 'app3', label: 'App 03', x: 320, y: 205 },
  { id: 'cache', label: 'Cache', x: 455, y: 70 },
  { id: 'db', label: 'Primary DB', x: 455, y: 190 },
  { id: 'replica', label: 'Replica', x: 585, y: 190 },
]

export const EDGES: [string, string][] = [
  ['client', 'lb'],
  ['lb', 'app1'],
  ['lb', 'app2'],
  ['lb', 'app3'],
  ['app1', 'cache'],
  ['app2', 'cache'],
  ['app2', 'db'],
  ['app3', 'db'],
  ['db', 'replica'],
]

export const NODE_W = 92
export const NODE_H = 34

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))

/** Horizontal S-curve from the right edge of `a` to the left edge of `b`. */
export function edgePath(a: string, b: string) {
  const s = byId[a]
  const t = byId[b]
  const x1 = s.x + NODE_W / 2
  const x2 = t.x - NODE_W / 2
  const mx = (x1 + x2) / 2
  return `M${x1},${s.y} C${mx},${s.y} ${mx},${t.y} ${x2},${t.y}`
}
