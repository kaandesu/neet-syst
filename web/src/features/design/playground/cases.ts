import type { BlockId, Design } from '@/engine/types'

/** Logical canvas size; the canvas scales uniformly to fit, so geometry stays in these units. */
export const CANVAS_W = 1000
export const CANVAS_H = 560
export const NODE_W = 140
export const NODE_H = 62

export const PALETTE: BlockId[] = ['web-server', 'load-balancer', 'sql-db', 'nosql-db', 'read-replica', 'cache']

export interface PlayCase {
  id: string
  title: string
  brief: string
  rps: number
  writePct: number
  maxErrorPct: number
  maxP99: number
  start: Design
}

const n = (id: string, block: BlockId, x: number, y: number) => ({ id, block, x, y })
const e = (from: string, to: string) => ({ id: `${from}>${to}`, from, to })

export const CASES: PlayCase[] = [
  {
    id: 'launch',
    title: 'Launch day',
    brief: 'A newsletter sends 600 req/s. Your one server keeps data on its own disk, and that doubles its work.',
    rps: 600,
    writePct: 10,
    maxErrorPct: 1,
    maxP99: 300,
    start: { nodes: [n('client', 'client', 110, 280), n('web-1', 'web-server', 380, 280)], edges: [e('client', 'web-1')] },
  },
  {
    id: 'flash',
    title: 'Flash sale',
    brief: '3,000 req/s for an hour. A server tops out at 1,000, and the database at 2,000.',
    rps: 3000,
    writePct: 5,
    maxErrorPct: 1,
    maxP99: 300,
    start: {
      nodes: [n('client', 'client', 110, 280), n('web-1', 'web-server', 380, 280), n('sql-1', 'sql-db', 650, 280)],
      edges: [e('client', 'web-1'), e('web-1', 'sql-1')],
    },
  },
  {
    id: 'reads',
    title: 'Read storm',
    brief: '4,000 req/s and almost all of them are reads. The servers can take it; the single database cannot.',
    rps: 4000,
    writePct: 3,
    maxErrorPct: 1,
    maxP99: 250,
    start: {
      nodes: [
        n('client', 'client', 90, 280),
        n('lb-1', 'load-balancer', 280, 280),
        ...Array.from({ length: 6 }, (_, i) => n(`web-${i + 1}`, 'web-server', 490, 65 + i * 86)),
        n('sql-1', 'sql-db', 720, 280),
      ],
      edges: [
        e('client', 'lb-1'),
        ...Array.from({ length: 6 }, (_, i) => e('lb-1', `web-${i + 1}`)),
        ...Array.from({ length: 6 }, (_, i) => e(`web-${i + 1}`, 'sql-1')),
      ],
    },
  },
  {
    id: 'sandbox',
    title: 'Sandbox',
    brief: 'No rules. Set the traffic yourself and break whatever you like.',
    rps: 1000,
    writePct: 10,
    maxErrorPct: 1,
    maxP99: 300,
    start: { nodes: [n('client', 'client', 110, 280)], edges: [] },
  },
]
