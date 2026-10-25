import type { Problem } from '@/engine/problems/types'
import { N, all, design, free, phase } from '../chapters/ch1/_kit'

const tuesday = (extra = {}) => phase('Tuesday traffic', 500, { writeRatio: 0.1, ...extra })

export const oneServer: Problem = {
  id: 'one-server',
  number: 2,
  title: 'One Server to Rule Them All',
  difficulty: 'easy',
  tags: ['Load balancer', 'Redundancy'],
  speaker: 'oncall',
  story: [
    'Ledgerly sells invoicing software to small businesses. Last week their only server rebooted for a kernel patch and the whole product was gone for *40 minutes*.',
    'A customer’s CFO called the CEO directly. The CEO’s instruction to you is short: “Never again. A single machine dying must not take us down.”',
  ],
  asks: ['Any one web server can die without users noticing', 'Keep serving normal traffic'],
  outOfScope: ['Database failover (that’s next quarter)'],
  numbers: [
    { label: 'Traffic', value: '500 req/s' },
    { label: 'Writes', value: '10%' },
    { label: 'One server handles', value: '~1,000 req/s' },
  ],
  skeleton: design(
    [N('client', 'client', 0, 200), N('dns', 'dns', 180, 200), N('web1', 'web-server', 560, 200), N('db', 'sql-db', 780, 200)],
    [['client', 'dns'], ['dns', 'web1'], ['web1', 'db']],
  ),
  palette: ['dns', 'load-balancer', 'web-server', 'sql-db'],
  goals: [
    { kind: 'maxErrorRate', value: 0.01 },
    { kind: 'maxP99', value: 300 },
  ],
  par: 5,
  tests: [
    { label: 'A normal Tuesday', phases: [tuesday()] },
    { label: 'The server reboots for a patch', hidden: true, phases: [tuesday({ label: 'web1 reboots', failures: [{ id: 'web1' }] })] },
    {
      label: 'The *other* server reboots',
      hidden: true,
      phases: [tuesday({ label: 'Second server reboots', failures: [{ block: 'web-server', nth: 1 }] })],
    },
  ],
  hints: [
    { text: 'If there is exactly one of something, its failure is the system’s failure.' },
    { text: 'You need a second web server, and something in front that only sends traffic to servers that are alive.' },
    { text: 'Put a **load balancer** between DNS and the servers, and connect it to **two** web servers.', ghost: { block: 'load-balancer', x: 360, y: 200 } },
  ],
  solution: free(
    [
      N('client', 'client', 0, 200),
      N('dns', 'dns', 180, 200),
      N('lb', 'load-balancer', 360, 200),
      N('web1', 'web-server', 560, 120),
      N('web2', 'web-server', 560, 280),
      N('db', 'sql-db', 780, 200),
    ],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], ['web1', 'web2']), ...all(['web1', 'web2'], ['db'])],
  ),
  editorial: [
    'Two servers behind a load balancer. The balancer health-checks both and stops sending traffic to one that dies. Each server alone can carry all 500 req/s, so losing either is invisible.',
    'Why is the load balancer itself OK? In the real world it’s a managed, multi-machine service (AWS ELB, GCP LB), so the sim treats it as redundant.',
    '**Interview takeaway:** “N+1” capacity: size the tier so it still copes with one machine gone.',
  ],
}
