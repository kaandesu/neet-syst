import type { Problem } from '@/engine/problems/types'
import { N, all, design, free, phase } from '../chapters/ch1/_kit'

const monday = (extra = {}) => phase('Monday', 800, { writeRatio: 0.2, sessions: true, ...extra })
const front = [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('lb', 'load-balancer', 360, 200)]
const webs = [N('web1', 'web-server', 560, 120), N('web2', 'web-server', 560, 280)]

export const loggedOut: Problem = {
  id: 'logged-out',
  number: 4,
  title: 'Logged Out Again?',
  difficulty: 'easy',
  tags: ['Sessions', 'Stateless'],
  speaker: 'oncall',
  story: [
    'Support is drowning in tickets for TaskNest, a to-do app: *“I log in, click one page, and I’m logged out.”* Saving a task fails about half the time.',
    'It started the day ops added a second web server. Each server keeps logged-in users in its own memory.',
  ],
  asks: ['Users stay logged in', 'A server can be patched without logging anyone out'],
  numbers: [
    { label: 'Traffic', value: '800 req/s' },
    { label: 'Writes (need a session)', value: '20%' },
  ],
  skeleton: design(
    [...front, ...webs, N('db', 'sql-db', 780, 200)],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ['web1', 'web2']), ...all(['web1', 'web2'], ['db'])],
  ),
  palette: ['web-server', 'sql-db', 'session-store'],
  goals: [{ kind: 'maxErrorRate', value: 0.01 }],
  par: 6,
  tests: [
    { label: 'Monday morning logins', phases: [monday()] },
    { label: 'web1 gets patched', hidden: true, phases: [monday({ label: 'web1 patched', failures: [{ id: 'web1' }] })] },
  ],
  hints: [
    { text: 'The load balancer sends each click to *any* server. Does the server it picked know who you are?' },
    { text: 'Making the balancer always pick the same server (sticky sessions) works… until that server goes away.' },
    { text: 'Move sessions out of the servers: add a **session store** and connect both web servers to it.', ghost: { block: 'session-store', x: 780, y: 40 } },
  ],
  solution: free(
    [...front, ...webs, N('db', 'sql-db', 780, 200), N('sess', 'session-store', 780, 40)],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ['web1', 'web2']), ...all(['web1', 'web2'], ['db']), ...all(['web1', 'web2'], ['sess'])],
  ),
  trap: {
    design: design(
      [...front.map((n) => (n.id === 'lb' ? { ...n, sticky: true } : n)), ...webs, N('db', 'sql-db', 780, 200)],
      [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ['web1', 'web2']), ...all(['web1', 'web2'], ['db'])],
    ),
    why: 'Sticky sessions: every user is pinned to one server, so they stay logged in until that server goes away.',
  },
  editorial: [
    'Sessions in server memory make the servers *stateful*: a user only works on the one server that remembers them.',
    'Sticky sessions pass the first test, but the hidden patch test logs out everyone who was pinned to web1. A shared session store (think Redis) makes every server interchangeable.',
    '**Interview takeaway:** keep the web tier stateless. That is what makes autoscaling, rolling deploys, and failover boring.',
  ],
}
