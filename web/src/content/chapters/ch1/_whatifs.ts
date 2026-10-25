import type { WhatIf } from '@/engine/lesson/types'
import type { Goal } from '@/engine/types'
import { N, all, design, phase, scenario } from './_kit'
import { cacheEnd, replicaEnd } from './_states'

/** "Simulate it anyway" scenarios for tempting wrong answers. Each must fail (content tests check). */

const NO_ERRORS: Goal[] = [{ kind: 'maxErrorRate', value: 0 }]

export const writeHeavyReplicas: WhatIf = {
  label: 'add replicas to a write-heavy app (70% writes) and hope writes get faster',
  design: replicaEnd,
  scenario: scenario(phase('Write storm', 1500, { writeRatio: 0.7 })),
  goals: NO_ERRORS,
}

export const cacheWriteOnce: WhatIf = {
  label: 'put a cache in front of a log table that is 90% writes',
  design: cacheEnd,
  scenario: scenario(phase('Logging firehose', 1500, { writeRatio: 0.9 })),
  goals: NO_ERRORS,
}

export const cdnTtlZero: WhatIf = {
  label: 'CDN TTL set to zero, so every file goes back to your servers (same as no CDN)',
  design: cacheEnd,
  scenario: scenario(phase('Video goes viral', 4500, { staticRatio: 0.6, writeRatio: 0.05, queryCost: 3, euShare: 0.3 })),
  goals: NO_ERRORS,
}

const shardWebs = ['web1', 'web2', 'web3']
const sharded = (count: number) => {
  const shards = Array.from({ length: count }, (_, i) => `shard${i + 1}`)
  return design(
    [
      N('client', 'client', 0, 200),
      N('dns', 'dns', 180, 200),
      N('lb', 'load-balancer', 380, 200),
      ...shardWebs.map((id, i) => N(id, 'web-server', 600, 60 + i * 140)),
      N('router', 'shard-router', 860, 200),
      ...shards.map((id, i) => N(id, 'sql-db', 1100, 200 + (i - (count - 1) / 2) * 120)),
    ],
    [['client', 'dns'], ['dns', 'lb'], ...all(['lb'], shardWebs), ...all(shardWebs, ['router']), ...all(['router'], shards)],
  )
}

export const shardByCountry: WhatIf = {
  label: 'shard by country, so the US (half your users) all lands on one shard',
  design: sharded(3),
  scenario: scenario(phase('US launch day', 2500, { writeRatio: 0.3, dataGB: 2600, hotKeyShare: 0.5 })),
  goals: NO_ERRORS,
}

export const moreShards: WhatIf = {
  label: 'double the shards (3 → 6) during the celebrity hotspot',
  design: sharded(6),
  scenario: scenario(phase('Celebrity', 2500, { writeRatio: 0.3, dataGB: 2600, hotKeyShare: 0.6 })),
  goals: NO_ERRORS,
}
