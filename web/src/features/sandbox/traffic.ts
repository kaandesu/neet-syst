import type { BlockId, RegionZone, ScenarioPhase } from '@/engine/types'

/** The sandbox's traffic knobs. Knobs for blocks you haven't unlocked stay hidden and neutral. */
export interface Traffic {
  rps: number
  writeRatio: number
  staticRatio: number
  taskRatio: number
  cacheHitRate: number
  euShare: number
  sessions: boolean
}

export const DEFAULT_TRAFFIC: Traffic = {
  rps: 300,
  writeRatio: 0.1,
  staticRatio: 0,
  taskRatio: 0,
  cacheHitRate: 0.8,
  euShare: 0,
  sessions: false,
}

export type RatioKnob = 'writeRatio' | 'staticRatio' | 'taskRatio' | 'cacheHitRate' | 'euShare'

export interface Knob {
  key: RatioKnob
  label: string
  hint: string
  /** Shown once any of these blocks is available. */
  needs?: BlockId[]
  max: number
}

export const KNOBS: Knob[] = [
  { key: 'writeRatio', label: 'Writes', hint: 'Share of requests that change data.', max: 0.6 },
  { key: 'cacheHitRate', label: 'Cache hit rate', hint: 'How often the cache already has the answer.', needs: ['cache'], max: 0.99 },
  { key: 'staticRatio', label: 'Images & scripts', hint: 'Static files a CDN could serve instead.', needs: ['cdn', 'object-storage'], max: 0.8 },
  { key: 'taskRatio', label: 'Slow jobs', hint: 'Requests that kick off heavy work, like resizing a photo.', needs: ['message-queue'], max: 0.4 },
  { key: 'euShare', label: 'Users in Europe', hint: 'They pay a trans-Atlantic round trip unless you serve them locally.', needs: ['geo-dns'], max: 1 },
]

export const knobOn = (k: Knob, available: Set<BlockId>) => !k.needs || k.needs.some((b) => available.has(b))
export const sessionsOn = (available: Set<BlockId>) => available.has('session-store')

/** Two regions, side by side, for when part of the traffic comes from Europe. */
export const SANDBOX_ZONES: RegionZone[] = [
  { id: 'na', label: 'North America (us-east)', x: -40, y: -80, w: 1400, h: 520 },
  { id: 'eu', label: 'Europe (eu-central)', x: -40, y: 500, w: 1400, h: 520 },
]

export const usesZones = (t: Traffic, available: Set<BlockId>) => available.has('geo-dns') && t.euShare > 0

export function toPhase(t: Traffic, available: Set<BlockId>, killed: string[] = []): ScenarioPhase {
  const on = (key: RatioKnob) => {
    const k = KNOBS.find((x) => x.key === key)!
    return knobOn(k, available)
  }
  return {
    label: killed.length ? `Your traffic · ${killed.length} down` : 'Your traffic',
    seconds: 4,
    rps: t.rps,
    writeRatio: t.writeRatio,
    staticRatio: on('staticRatio') ? t.staticRatio : 0,
    taskRatio: on('taskRatio') ? t.taskRatio : 0,
    cacheHitRate: t.cacheHitRate,
    euShare: on('euShare') ? t.euShare : 0,
    sessions: sessionsOn(available) && t.sessions,
    failures: killed.map((id) => ({ id })),
  }
}

/** Traffic that matches a challenge's load, so the sliders show what's being tested. */
export function trafficOf(p: ScenarioPhase, base: Traffic): Traffic {
  return {
    ...base,
    rps: p.rps,
    writeRatio: p.writeRatio ?? 0,
    staticRatio: p.staticRatio ?? 0,
    taskRatio: p.taskRatio ?? 0,
    euShare: p.euShare ?? 0,
    sessions: p.sessions ?? false,
    cacheHitRate: p.cacheHitRate ?? DEFAULT_TRAFFIC.cacheHitRate,
  }
}

/** Log-scale slider: position 0..1000 ↔ 10..100,000 req/s. */
export const RPS_MIN = 10
export const RPS_MAX = 100_000
export const rpsToSlider = (rps: number) => Math.round((Math.log10(rps / RPS_MIN) / Math.log10(RPS_MAX / RPS_MIN)) * 1000)
export function sliderToRps(v: number) {
  const raw = RPS_MIN * (RPS_MAX / RPS_MIN) ** (v / 1000)
  // Snap to friendly numbers: 2 significant figures.
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1)
  return Math.round(raw / mag) * mag
}
