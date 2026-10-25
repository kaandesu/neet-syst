import type { CSSProperties } from 'react'
import type { NodeStatus } from '@/engine/types'
import type { DecoProps } from './skins'

/* ── Decorations ─────────────────────────────────────────────────────────────── */

/** One knob that turns with load, and a scrolling waveform that clips when overloaded. */
export function SynthDeco({ status, util }: DecoProps) {
  const rot = -135 + (Math.min(1.25, util) / 1.25) * 270
  const silent = status === 'down' || status === 'idle'
  const amp = silent ? 0 : 2 + Math.min(1, util) * 7
  const ceiling = util > 1 ? amp * 0.45 : Infinity
  const pts = Array.from({ length: 49 }, (_, i) => {
    const y = clampAbs(Math.sin((i / 48) * Math.PI * 8) * amp, ceiling)
    return `${i * 5},${(10 - y).toFixed(1)}`
  }).join(' ')
  return (
    <>
      <span className="syn-knob" style={{ '--rot': `${rot}deg` } as CSSProperties} />
      <span className="syn-jack-in" />
      <span className="syn-wave-win">
        <svg className="syn-wave" viewBox="0 0 240 20" preserveAspectRatio="none">
          <polyline points={pts} />
        </svg>
      </span>
    </>
  )
}
const clampAbs = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v))

/** A chimney that smokes when the machine runs hot, and crates spilling off when it drops work. */
export function FactoryDeco({ status, dropped }: DecoProps) {
  const smoking = status === 'warm' || status === 'hot'
  return (
    <>
      <span className="fac-chimney">
        {smoking && (
          <>
            <i />
            <i />
            <i />
          </>
        )}
      </span>
      {dropped > 0 && (
        <span className="fac-spill">
          <i />
          <i />
          <i />
        </span>
      )}
    </>
  )
}

const TRANSIT_STATUS: Partial<Record<NodeStatus, string>> = { warm: 'Minor delays', hot: 'Severe delays', down: 'Station closed' }

export function TransitDeco({ status }: DecoProps) {
  return (
    <>
      <span className="tr-roundel" />
      {TRANSIT_STATUS[status] && <span className="tr-status">{TRANSIT_STATUS[status]}</span>}
    </>
  )
}

export function TransitCanvas() {
  return (
    <>
      <path className="tr-park" d="M640,40 q90,-20 150,30 q40,50 -20,80 q-90,30 -150,-20 q-40,-60 20,-90z" />
      <path className="tr-river" d="M-30,505 C120,450 240,540 400,500 S640,410 780,455 S930,530 1040,490" />
    </>
  )
}
