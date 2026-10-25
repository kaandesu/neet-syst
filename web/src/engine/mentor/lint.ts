import type { BlockId, Design } from '../types'

/** Something on the canvas that is almost certainly a wiring mistake. */
export interface Finding {
  rule: string
  nodeId: string
  text: string
}

const DATA: BlockId[] = ['sql-db', 'nosql-db', 'shard-router', 'cache', 'read-replica']
const PRIMARY: BlockId[] = ['sql-db', 'nosql-db']

/**
 * Deterministic "design review": catches the classic beginner wiring mistakes.
 * Rules only flag things that are wrong in every lesson, so authored solutions never trip them.
 */
export function lintDesign(design: Design): Finding[] {
  const byId = new Map(design.nodes.map((n) => [n.id, n]))
  const out = new Map<string, string[]>()
  const into = new Map<string, string[]>()
  for (const n of design.nodes) {
    out.set(n.id, [])
    into.set(n.id, [])
  }
  for (const e of design.edges) {
    out.get(e.from)?.push(e.to)
    into.get(e.to)?.push(e.from)
  }
  const blockOf = (id: string) => byId.get(id)?.block
  const has = (blocks: BlockId[]) => design.nodes.some((n) => blocks.includes(n.block))
  const findings: Finding[] = []
  const add = (rule: string, nodeId: string, text: string) => findings.push({ rule, nodeId, text })

  // Reachability from the users.
  const clients = design.nodes.filter((n) => n.block === 'client').map((n) => n.id)
  const seen = new Set(clients)
  const queue = [...clients]
  while (queue.length) for (const next of out.get(queue.shift()!) ?? []) if (!seen.has(next) && (seen.add(next), true)) queue.push(next)

  for (const n of design.nodes) {
    const outs = out.get(n.id)!
    const ins = into.get(n.id)!
    // A retired DNS (e.g. replaced by Geo DNS) that nothing points at anymore is a harmless leftover.
    const retired = (n.block === 'dns' || n.block === 'geo-dns') && ins.length === 0
    if (clients.length && !seen.has(n.id) && n.block !== 'client' && n.block !== 'monitoring' && !retired) {
      add('unreachable', n.id, 'No request can reach this yet. Draw an arrow into it.')
      continue
    }
    switch (n.block) {
      case 'client':
        if (has(['dns', 'geo-dns']) && outs.some((t) => blockOf(t) === 'web-server' || blockOf(t) === 'load-balancer'))
          add('skips-dns', n.id, 'Users are wired straight past DNS. Point them at DNS and let it route.')
        break
      case 'web-server':
        if (has(DATA) && !outs.some((t) => DATA.includes(blockOf(t)!)))
          add('server-no-data', n.id, 'This server can’t reach your data. Connect it to the database tier.')
        break
      case 'load-balancer':
        if (outs.filter((t) => blockOf(t) === 'web-server').length === 1)
          add('lb-single', n.id, 'A load balancer with one server behind it has nothing to balance, and nowhere to fail over.')
        break
      case 'read-replica':
        if (!ins.some((s) => PRIMARY.includes(blockOf(s)!)))
          add('replica-orphan', n.id, 'Replicas copy a primary. Connect the database → this replica.')
        break
      case 'message-queue':
        if (!outs.some((t) => blockOf(t) === 'worker')) add('queue-no-worker', n.id, 'Jobs go in and nothing takes them out. Add a worker.')
        break
      case 'worker':
        if (!ins.some((s) => blockOf(s) === 'message-queue')) add('worker-orphan', n.id, 'Workers pull jobs from a queue. Connect the queue → this worker.')
        break
    }
  }
  return findings
}
