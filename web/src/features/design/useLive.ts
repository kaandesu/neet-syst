import { useEffect, useState } from 'react'

export type Metrics = { rps: number; p99: number; errors: number; cacheHit: number; history: number[] }

const jitter = (v: number, spread: number, min: number, max: number) => Math.min(max, Math.max(min, v + (Math.random() - 0.5) * spread))

/** Fake live sim numbers that drift every `ms`, so each concept can show motion. */
export function useLiveMetrics(ms = 1000): Metrics {
  const [m, setM] = useState<Metrics>(() => ({
    rps: 12400,
    p99: 184,
    errors: 0.4,
    cacheHit: 87,
    history: [160, 172, 168, 190, 240, 310, 280, 210, 188, 176, 181, 170, 184, 179, 192, 186],
  }))
  useEffect(() => {
    const id = setInterval(() => {
      setM((p) => {
        const p99 = Math.round(jitter(p.p99, 40, 120, 320))
        return {
          rps: Math.round(jitter(p.rps, 1600, 8000, 18000)),
          p99,
          errors: +jitter(p.errors, 0.3, 0, 2.5).toFixed(2),
          cacheHit: Math.round(jitter(p.cacheHit, 4, 70, 98)),
          history: [...p.history.slice(1), p99],
        }
      })
    }, ms)
    return () => clearInterval(id)
  }, [ms])
  return m
}

/** A frame counter for cheap looping animations. */
export function useTick(ms: number) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return t
}

/** Turn a series into an SVG polyline `points` string inside a w×h box. */
export function sparkPoints(values: number[], w: number, h: number) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  return values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / span) * h).toFixed(1)}`).join(' ')
}
