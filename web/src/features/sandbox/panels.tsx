import { Check, ChevronRight, Crosshair, Gauge, Lightbulb, Lock, Target, Trophy, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { BLOCKS } from '@/content/blocks'
import { CHAPTERS } from '@/content'
import type { SandboxChallenge } from '@/content/sandbox'
import type { BreakingPoint } from '@/engine/sim/capacity'
import { goalLabel, type GoalResult } from '@/engine/sim/goals'
import type { BlockId, DNode } from '@/engine/types'
import { cn } from '@/lib/cn'
import { BlockIcon } from '@/ui/BlockIcon'
import { Button } from '@/ui/Button'
import { KNOBS, knobOn, rpsToSlider, sessionsOn, sliderToRps, type Traffic } from './traffic'

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (n: number) => `${Math.round(n * 100)}%`

export function Card({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line', className)}>
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-muted uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

/* ── Breaking point ─────────────────────────────────────────────────────────── */

export function BreakingPointCard({
  bp,
  rps,
  killed,
  weakNode,
  onShow,
  onPush,
}: {
  bp: BreakingPoint
  rps: number
  killed: number
  weakNode?: DNode
  onShow: (id: string) => void
  onPush: (rps: number) => void
}) {
  const finite = Number.isFinite(bp.rps)
  const ratio = finite && bp.rps > 0 ? rps / bp.rps : 0
  const over = finite && rps > bp.rps
  return (
    <Card title={killed ? `Breaking point · ${killed} down` : 'Breaking point'} icon={<Gauge size={13} />}>
      {bp.rps === 0 ? (
        <>
          <div className="text-2xl leading-none font-extrabold text-bad">Nothing gets through</div>
          <p className="mt-2 text-[13px] text-muted">No request makes it to something that can answer it. Wire Users to a server to start.</p>
        </>
      ) : !finite ? (
        <>
          <div className="text-3xl leading-none font-extrabold text-good">1M+ req/s</div>
          <p className="mt-2 text-[13px] text-muted">Nothing here gives out before a million requests a second.</p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('font-mono text-3xl leading-none font-extrabold', over ? 'text-bad' : 'text-ink')} data-testid="breaking-point">
              {fmt(bp.rps)}
            </span>
            <span className="text-sm font-semibold text-muted">req/s</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">The most traffic this design takes before more than 1% of requests fail.</p>
          <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
            <motion.div
              className={cn('h-full rounded-full', over ? 'bg-bad' : ratio > 0.8 ? 'bg-warn' : 'bg-good')}
              animate={{ width: `${Math.min(100, ratio * 100)}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 26 }}
            />
          </div>
          <div className={cn('mt-1.5 text-[12px] font-semibold', over ? 'text-bad' : 'text-muted')}>
            {over ? `Your traffic is ${ratio.toFixed(ratio < 10 ? 1 : 0)}× past it. Requests are failing.` : `Your traffic is at ${pct(ratio)} of it.`}
          </div>
          {weakNode && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-2">
              <BlockIcon block={weakNode.block} size={26} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[11px] text-muted">First to give out</div>
                <div className="truncate text-[13px] font-bold">
                  {BLOCKS[weakNode.block].short} <span className="font-mono text-[11px] font-normal text-muted">{weakNode.id}</span>
                </div>
              </div>
              <button onClick={() => onShow(weakNode.id)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" title="Show it on the canvas" aria-label="Show it on the canvas">
                <Crosshair size={16} />
              </button>
            </div>
          )}
          {!over && (
            <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => onPush(bp.rps)}>
              Push traffic to the limit
            </Button>
          )}
        </>
      )}
    </Card>
  )
}

/* ── Traffic ────────────────────────────────────────────────────────────────── */

export function TrafficCard({ traffic, available, onChange }: { traffic: Traffic; available: Set<BlockId>; onChange: (patch: Partial<Traffic>) => void }) {
  return (
    <Card title="Traffic" icon={<Target size={13} />}>
      <label className="block">
        <div className="mb-1 flex items-baseline justify-between text-[13px]">
          <span className="font-semibold">Requests / s</span>
          <span className="font-mono font-bold">{fmt(traffic.rps)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={rpsToSlider(traffic.rps)}
          onChange={(e) => onChange({ rps: sliderToRps(Number(e.target.value)) })}
          className="w-full accent-[var(--accent)]"
          aria-label="Requests per second"
        />
      </label>
      {KNOBS.filter((k) => knobOn(k, available)).map((k) => (
        <label key={k.key} className="mt-2.5 block" title={k.hint}>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="font-semibold">{k.label}</span>
            <span className="font-mono font-bold">{pct(traffic[k.key])}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.round(k.max * 100)}
            value={Math.round(traffic[k.key] * 100)}
            onChange={(e) => onChange({ [k.key]: Number(e.target.value) / 100 })}
            className="w-full accent-[var(--accent)]"
            aria-label={k.label}
          />
        </label>
      ))}
      {sessionsOn(available) && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={traffic.sessions} onChange={(e) => onChange({ sessions: e.target.checked })} className="accent-[var(--accent)]" />
          Users are logged in
        </label>
      )}
      {available.size < Object.keys(BLOCKS).length && <p className="mt-3 text-[11px] text-muted">More dials appear as you unlock blocks.</p>}
    </Card>
  )
}

/* ── Challenges ─────────────────────────────────────────────────────────────── */

const unlockedBy = (b: BlockId) => CHAPTERS.flatMap((c) => c.lessons).find((l) => l.unlocks.includes(b))

export function ChallengesCard({
  challenges,
  available,
  active,
  cleared,
  results,
  onPick,
  onRetest,
}: {
  challenges: SandboxChallenge[]
  available: Set<BlockId>
  active: string | null
  cleared: string[]
  results?: GoalResult[]
  onPick: (id: string | null) => void
  onRetest: (c: SandboxChallenge) => void
}) {
  const [hint, setHint] = useState<string | null>(null)
  const done = challenges.filter((c) => cleared.includes(c.id)).length
  return (
    <Card title={`Challenges · ${done}/${challenges.length}`} icon={<Trophy size={13} />}>
      <ul className="space-y-1.5">
        {challenges.map((c) => {
          const missing = c.needs.filter((b) => !available.has(b))
          const isOn = active === c.id
          const isDone = cleared.includes(c.id)
          if (missing.length) {
            const lesson = unlockedBy(missing[0])
            return (
              <li key={c.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-muted opacity-70">
                <Lock size={15} className="shrink-0" />
                <div className="min-w-0 leading-tight">
                  <div className="text-[13px] font-semibold">{c.title}</div>
                  <div className="text-[11px]">Needs {BLOCKS[missing[0]].short}{lesson ? ` from “${lesson.title}”` : ''}</div>
                </div>
              </li>
            )
          }
          return (
            <li key={c.id}>
              <button
                onClick={() => onPick(isOn ? null : c.id)}
                aria-expanded={isOn}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition',
                  isOn ? 'bg-accent-soft text-ink ring-1 ring-accent/40' : 'hover:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    isDone ? 'bg-good text-white' : 'ring-2 ring-line',
                  )}
                >
                  {isDone && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13px] font-bold">{c.title}</span>
                  <span className="block text-[11px] text-muted">{c.brief}</span>
                </span>
                <ChevronRight size={15} className={cn('shrink-0 text-muted transition', isOn && 'rotate-90')} />
              </button>
              {isOn && (
                <div className="mt-1.5 space-y-1.5 px-2.5 pb-1">
                  {c.goals.map((g, i) => {
                    const r = results?.[i]
                    return (
                      <div key={i} className={cn('flex items-start gap-1.5 text-[12px] font-semibold', r?.pass ? 'text-good' : 'text-bad')} title={r?.detail}>
                        {r?.pass ? <Check size={13} className="mt-0.5 shrink-0" /> : <X size={13} className="mt-0.5 shrink-0" />}
                        <span className="min-w-0 flex-1 leading-snug">
                          {goalLabel(g)}
                          {r && <span className="block truncate text-[11px] font-normal text-muted">{r.detail}</span>}
                        </span>
                      </div>
                    )
                  })}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => onRetest(c)} title="Set the traffic dials to this challenge's load">
                      <Target size={14} /> Use its traffic
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setHint(hint === c.id ? null : c.id)}>
                      <Lightbulb size={14} /> Hint
                    </Button>
                  </div>
                  {hint === c.id && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12px] leading-snug">{c.hint}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
