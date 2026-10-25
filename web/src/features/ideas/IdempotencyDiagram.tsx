import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { RichText } from '@/ui/RichText'

type Lane = 0 | 1 | 2
const LANES = ['Phone', 'Server', 'Key store']

interface Msg {
  from: Lane
  to: Lane
  text: string
  tone?: 'ok' | 'bad' | 'lost'
}

interface Scene {
  title: string
  msgs: Msg[]
  /** What the key store holds once the scene is over. */
  store: string[]
  note: string
  tone: 'ok' | 'bad' | 'info'
}

const SCENES: Scene[] = [
  {
    title: '1. The first try',
    msgs: [
      { from: 0, to: 0, text: 'Make a key for this payment: `k_7f3a`' },
      { from: 0, to: 1, text: '`POST /v1/payments` · key `k_7f3a` · $20' },
      { from: 1, to: 2, text: 'Seen `k_7f3a`? → no' },
      { from: 1, to: 1, text: 'Charge the card $20' },
      { from: 1, to: 2, text: 'Save `k_7f3a` → 201, payment `p_91`' },
      { from: 1, to: 0, text: '201 Created · `p_91`', tone: 'lost' },
    ],
    store: ['k_7f3a → 201 · p_91'],
    note: 'The card was charged, but the reply got lost in a tunnel. The phone only sees a **timeout**.',
    tone: 'info',
  },
  {
    title: '2. The retry, same key',
    msgs: [
      { from: 0, to: 1, text: '`POST /v1/payments` · key `k_7f3a` · $20 (retry)' },
      { from: 1, to: 2, text: 'Seen `k_7f3a`? → yes: 201 · `p_91`' },
      { from: 1, to: 0, text: '201 Created · `p_91` (replayed)', tone: 'ok' },
    ],
    store: ['k_7f3a → 201 · p_91'],
    note: 'The server skips the work and replays the saved answer. **Charged once**, and the phone gets the payment it asked for.',
    tone: 'ok',
  },
  {
    title: '3. The same story without a key',
    msgs: [
      { from: 0, to: 1, text: '`POST /v1/payments` · $20' },
      { from: 1, to: 1, text: 'Charge the card $20' },
      { from: 1, to: 0, text: '201 Created · `p_91`', tone: 'lost' },
      { from: 0, to: 1, text: '`POST /v1/payments` · $20 (retry)' },
      { from: 1, to: 1, text: 'Charge the card $20 again' },
      { from: 1, to: 0, text: '201 Created · `p_92`', tone: 'bad' },
    ],
    store: [],
    note: 'The server can’t tell a retry from a new payment. **Charged twice.**',
    tone: 'bad',
  },
  {
    title: '4. The edge cases',
    msgs: [
      { from: 0, to: 1, text: 'Same key `k_7f3a`, but **$200**' },
      { from: 1, to: 0, text: '422: this key was used for a different request', tone: 'bad' },
      { from: 0, to: 1, text: 'Retry while the first try is still running' },
      { from: 1, to: 0, text: '409: still processing, try again shortly', tone: 'bad' },
    ],
    store: ['k_7f3a → 201 · p_91 (expires in 24 h)'],
    note: 'A key belongs to **one** request body. Servers lock a key while it’s in flight, and forget keys after a day or so.',
    tone: 'info',
  },
]

const TONE = { ok: 'text-good', bad: 'text-bad', lost: 'text-muted line-through' }
const NOTE_TONE = { ok: 'bg-good-soft', bad: 'bg-bad-soft', info: 'bg-surface-2' }

/** A click-through sequence diagram: phone, server and key store, one scene at a time. */
export function IdempotencyDiagram() {
  const [i, setI] = useState(0)
  const scene = SCENES[i]
  return (
    <div className="rounded-2xl bg-surface-2 p-3" aria-label="How an idempotency key works">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex-1 text-[13px] font-extrabold">{scene.title}</div>
        <button onClick={() => setI(i - 1)} disabled={i === 0} className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink disabled:opacity-30" aria-label="Previous scene">
          <ChevronLeft size={16} />
        </button>
        <span className="font-mono text-[11px] text-muted">
          {i + 1}/{SCENES.length}
        </span>
        <button onClick={() => setI(i + 1)} disabled={i === SCENES.length - 1} className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink disabled:opacity-30" aria-label="Next scene">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-x-2 text-center text-[11px] font-bold tracking-wider text-muted uppercase">
        {LANES.map((l) => (
          <div key={l} className="rounded-lg bg-surface py-1">
            {l}
          </div>
        ))}
      </div>
      <motion.div key={i} initial="hidden" animate="shown" transition={{ staggerChildren: 0.25 }} className="relative mt-1 grid grid-cols-3 gap-x-2 gap-y-1.5 py-1">
        {/* lifelines */}
        {[0, 1, 2].map((l) => (
          <div key={l} className="pointer-events-none absolute inset-y-0 w-px bg-line" style={{ left: `calc(${(l * 2 + 1) / 6} * 100%)` }} />
        ))}
        {scene.msgs.map((m, k) => (
          <motion.div
            key={k}
            variants={{ hidden: { opacity: 0, y: 4 }, shown: { opacity: 1, y: 0 } }}
            className="relative col-span-3 grid grid-cols-3 gap-x-2 text-[12px] leading-snug"
          >
            {m.from === m.to ? <SelfNote lane={m.from} msg={m} /> : <Arrow msg={m} />}
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-2 rounded-xl bg-surface px-3 py-1.5 font-mono text-[11.5px]">
        <span className="font-sans font-bold text-muted">Key store: </span>
        {scene.store.length ? scene.store.join(', ') : <span className="text-muted">nothing (no keys were sent)</span>}
      </div>
      <div className={cn('mt-2 rounded-xl px-3 py-2 text-[13px]', NOTE_TONE[scene.tone])}>
        <RichText text={scene.note} />
      </div>
    </div>
  )
}

function SelfNote({ lane, msg }: { lane: Lane; msg: Msg }) {
  return (
    <div className="relative z-10 rounded-lg bg-surface px-2 py-1 text-center ring-1 ring-line" style={{ gridColumn: lane + 1 }}>
      <RichText text={msg.text} />
    </div>
  )
}

function Arrow({ msg }: { msg: Msg }) {
  const lo = Math.min(msg.from, msg.to)
  const hi = Math.max(msg.from, msg.to)
  const right = msg.to > msg.from
  const colour = msg.tone === 'bad' ? 'var(--bad)' : msg.tone === 'ok' ? 'var(--good)' : 'var(--muted)'
  return (
    <div className="relative" style={{ gridColumn: `${lo + 1} / ${hi + 2}` }}>
      <div className={cn('relative z-10 mx-auto w-fit max-w-full rounded-md bg-surface-2 px-1.5 text-center', msg.tone && TONE[msg.tone])}>
        <RichText text={msg.text} />
        {msg.tone === 'lost' && <span className="ml-1 font-sans text-[11px] font-bold text-bad no-underline">✕ lost</span>}
      </div>
      <div className="relative mt-0.5 h-2" style={{ marginInline: `calc(100% / ${2 * (hi - lo + 1)})` }}>
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2" style={{ background: colour, opacity: msg.tone === 'lost' ? 0.4 : 1, borderTop: msg.tone === 'lost' ? `2px dashed ${colour}` : undefined }} />
        <div
          className="absolute top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-y-transparent"
          style={right ? { right: -2, borderLeft: `7px solid ${colour}` } : { left: -2, borderRight: `7px solid ${colour}` }}
        />
      </div>
    </div>
  )
}
