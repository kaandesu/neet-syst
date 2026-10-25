import { describe, expect, it } from 'vitest'
import { runScenario } from '../sim/solver'
import type { Design, Endpoint } from '../types'
import { evaluateApi, normPath, type ApiRule } from './rules'

const pass = (api: Endpoint[], rule: ApiRule) => evaluateApi(api, [rule])[0].pass

describe('API rules', () => {
  it('match routes regardless of version, case and param names', () => {
    expect(normPath('/V1/URLs/{code}/')).toBe('/urls/{}')
    expect(normPath('/urls/:id')).toBe('/urls/{}')
    expect(pass([{ method: 'GET', path: '/v1/urls/{code}' }], { kind: 'has', method: 'GET', path: '/urls/{id}' })).toBe(true)
    expect(pass([{ method: 'POST', path: '/urls/{id}' }], { kind: 'has', method: 'GET', path: '/urls/{id}' })).toBe(false)
  })

  it('catch verbs in paths without flagging nouns that start like verbs', () => {
    const nouns: ApiRule = { kind: 'nouns' }
    expect(pass([{ method: 'POST', path: '/createUrl' }], nouns)).toBe(false)
    expect(pass([{ method: 'POST', path: '/urls/delete' }], nouns)).toBe(false)
    expect(pass([{ method: 'GET', path: '/v1/settings' }, { method: 'GET', path: '/posts/{id}' }], nouns)).toBe(true)
  })

  it('want plural collections but allow singular sub-resources', () => {
    const plural: ApiRule = { kind: 'plural' }
    expect(pass([{ method: 'GET', path: '/url/{id}' }], plural)).toBe(false)
    expect(pass([{ method: 'GET', path: '/v1/users/{id}/feed' }], plural)).toBe(true)
  })

  it('check promises on a specific route', () => {
    const api: Endpoint[] = [{ method: 'POST', path: '/v1/orders', idempotencyKey: true, rateLimited: true }, { method: 'GET', path: '/v1/orders' }]
    expect(pass(api, { kind: 'idempotent', method: 'POST', path: '/orders' })).toBe(true)
    expect(pass(api, { kind: 'paginated', path: '/orders' })).toBe(false)
    expect(pass(api, { kind: 'rateLimited' })).toBe(false)
    expect(pass(api, { kind: 'versioned' })).toBe(true)
  })
})

describe('API effects in the simulator', () => {
  const shop = (api: Endpoint[]): Design => ({
    nodes: [
      { id: 'client', block: 'client', x: 0, y: 0 },
      { id: 'svc', block: 'service', x: 200, y: 0, api },
      { id: 'db', block: 'sql-db', x: 400, y: 0 },
    ],
    edges: [
      { id: 'a', from: 'client', to: 'svc' },
      { id: 'b', from: 'svc', to: 'db' },
    ],
  })

  it('rate limits turn bots away, and without them bots eat capacity', () => {
    const phase = { label: 'scrape', seconds: 4, rps: 500, botRps: 2000 }
    const open = runScenario(shop([{ method: 'GET', path: '/v1/items' }]), { phases: [phase] }).phases[0]
    const limited = runScenario(shop([{ method: 'GET', path: '/v1/items', rateLimited: true }]), { phases: [phase] }).phases[0]
    expect(open.errorRate).toBeGreaterThan(0.3)
    expect(limited.errorRate).toBe(0)
    expect(limited.rejectedRps).toBe(2000)
  })

  it('retried POSTs run twice unless they take an idempotency key', () => {
    const phase = { label: 'flaky', seconds: 4, rps: 400, writeRatio: 0.5, retryShare: 0.1 }
    expect(runScenario(shop([{ method: 'POST', path: '/v1/orders' }]), { phases: [phase] }).phases[0].duplicateRps).toBeCloseTo(20)
    expect(runScenario(shop([{ method: 'POST', path: '/v1/orders', idempotencyKey: true }]), { phases: [phase] }).phases[0].duplicateRps).toBeUndefined()
  })
})
