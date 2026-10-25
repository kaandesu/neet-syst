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
