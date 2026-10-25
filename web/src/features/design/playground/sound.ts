import { useEffect, useRef } from 'react'

let shared: AudioContext | null = null
const ctx = () => (shared ??= new AudioContext())

/** A short "thunk" for plugging a cable in, or a higher click for pulling one out. */
export function blip(kind: 'plug' | 'unplug') {
  const ac = ctx()
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(kind === 'plug' ? 140 : 420, t)
  osc.frequency.exponentialRampToValueAtTime(kind === 'plug' ? 55 : 180, t + 0.08)
  g.gain.setValueAtTime(0.25, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.connect(g).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.13)
}

function distortion(amount: number) {
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  return curve
}
const CLEAN = distortion(0)
const DIRTY = distortion(40)

type Hum = { osc: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; shaper: WaveShaperNode; out: GainNode }

/** A drone whose pitch and brightness follow load, and which distorts when anything is dropping work. */
export function useHum(on: boolean, load: number, clipping: boolean) {
  const hum = useRef<Hum | null>(null)

  useEffect(() => {
    if (!on) return
    const ac = ctx()
    void ac.resume()
    const osc = ac.createOscillator()
    const sub = ac.createOscillator()
    const filter = ac.createBiquadFilter()
    const shaper = ac.createWaveShaper()
    const out = ac.createGain()
    osc.type = 'sawtooth'
    sub.type = 'square'
    filter.type = 'lowpass'
    filter.Q.value = 6
    out.gain.setValueAtTime(0, ac.currentTime)
    out.gain.linearRampToValueAtTime(0.06, ac.currentTime + 0.4)
    osc.connect(filter)
    sub.connect(filter)
    filter.connect(shaper).connect(out).connect(ac.destination)
    osc.start()
    sub.start()
    hum.current = { osc, sub, filter, shaper, out }
    return () => {
      const t = ac.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setTargetAtTime(0, t, 0.08)
      osc.stop(t + 0.4)
      sub.stop(t + 0.4)
      hum.current = null
    }
  }, [on])

  useEffect(() => {
    const h = hum.current
    if (!h) return
    const t = ctx().currentTime
    const l = Math.min(1.4, load)
    h.osc.frequency.setTargetAtTime(55 + l * 70, t, 0.25)
    h.sub.frequency.setTargetAtTime(27.5 + l * 35, t, 0.25)
    h.sub.detune.setTargetAtTime(clipping ? 35 : 0, t, 0.2)
    h.filter.frequency.setTargetAtTime(180 + l * 1600, t, 0.25)
    h.shaper.curve = clipping ? DIRTY : CLEAN
  }, [on, load, clipping])
}
