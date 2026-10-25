import { describe, expect, it } from 'vitest'
import type { Design } from '@/engine/types'
import { decodeShare, encodeShare, shareFromHash, shareUrl } from './share'
import { DEFAULT_TRAFFIC } from './traffic'

const design: Design = {
  nodes: [
    { id: 'client', block: 'client', x: 0, y: 200, locked: true },
    { id: 'lb', block: 'load-balancer', x: 200, y: 200, sticky: true },
    { id: 'web-server-1', block: 'web-server', x: 400, y: 120 },
    { id: 'web-server-2', block: 'web-server', x: 400, y: 280 },
  ],
  edges: [
    { id: 'client->lb', from: 'client', to: 'lb' },
    { id: 'lb->web-server-1', from: 'lb', to: 'web-server-1' },
    { id: 'lb->web-server-2', from: 'lb', to: 'web-server-2' },
  ],
}
const traffic = { ...DEFAULT_TRAFFIC, rps: 4200, writeRatio: 0.25, sessions: true }

const pack = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('share links', () => {
  it('round-trip a design and its traffic', () => {
    expect(decodeShare(encodeShare({ design, traffic }))).toEqual({ design, traffic })
  })

  it('keep custom names and service sizes', () => {
    const named: Design = {
      nodes: [...design.nodes.slice(0, 2), { id: 'svc', block: 'service', x: 400, y: 120, label: 'Auth Service', tier: 'l' }, { id: 'web', block: 'web-server', x: 400, y: 280, label: 'Café ✓' }],
      edges: [],
    }
    expect(decodeShare(encodeShare({ design: named, traffic }))?.design).toEqual(named)
  })

  it('keep a service API', () => {
    const withApi: Design = {
      nodes: [{ id: 'svc', block: 'service', x: 0, y: 0, api: [{ method: 'POST', path: '/v1/urls', idempotencyKey: true, rateLimited: true }, { method: 'GET', path: '/v1/urls/{code}' }] }],
      edges: [],
    }
    expect(decodeShare(encodeShare({ design: withApi, traffic }))?.design).toEqual(withApi)
    expect(decodeShare(pack({ v: 1, n: [['a', 'web-server', 0, 0]], e: [], t: {}, a: { a: [['GET', '/x', 0]] } }))).toBeNull()
  })

  it('drop a tier on anything but a service', () => {
    const d = decodeShare(pack({ v: 1, n: [['a', 'web-server', 0, 0, 0, '', 'l'], ['b', 'service', 0, 0, 0, '', 'xl']], e: [], t: {} }))
    expect(d?.design.nodes).toEqual([
      { id: 'a', block: 'web-server', x: 0, y: 0 },
      { id: 'b', block: 'service', x: 0, y: 0 },
    ])
  })

  it('survive the URL', () => {
    const url = shareUrl({ design, traffic }, 'https://neet.example')
    expect(url.startsWith('https://neet.example/sandbox#design=')).toBe(true)
    expect(shareFromHash(new URL(url).hash)).toEqual({ design, traffic })
  })

  it('reject garbage', () => {
    expect(decodeShare('not base64 at all!!')).toBeNull()
    expect(decodeShare(pack({ v: 2, n: [], e: [], t: {} }))).toBeNull()
    expect(shareFromHash('#other=1')).toBeNull()
  })

  it('reject unknown blocks, dangling and cyclic edges', () => {
    expect(decodeShare(pack({ v: 1, n: [['a', 'toString', 0, 0]], e: [], t: {} }))).toBeNull()
    expect(decodeShare(pack({ v: 1, n: [['a', 'web-server', 0, 0]], e: [['a', 'ghost']], t: {} }))).toBeNull()
    const two = [
      ['a', 'web-server', 0, 0],
      ['b', 'web-server', 0, 0],
    ]
    expect(decodeShare(pack({ v: 1, n: two, e: [['a', 'b'], ['b', 'a']], t: {} }))).toBeNull()
  })

  it('clamp traffic into range', () => {
    const s = decodeShare(pack({ v: 1, n: [], e: [], t: { rps: -5, writeRatio: 9, cacheHitRate: 'lots' } }))
    expect(s?.traffic.rps).toBe(1)
    expect(s?.traffic.writeRatio).toBe(1)
    expect(s?.traffic.cacheHitRate).toBe(DEFAULT_TRAFFIC.cacheHitRate)
  })
})
