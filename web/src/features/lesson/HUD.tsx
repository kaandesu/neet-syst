import { Check, CircleDashed, X } from 'lucide-react'
import { goalLabel, type GoalResult } from '@/engine/sim/goals'
import type { Goal, PhaseResult, SimRun } from '@/engine/types'
import { cn } from '@/lib/cn'

export function GoalBar({ goals, results }: { goals: Goal[]; results?: GoalResult[] }) {
  if (!goals.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-surface/95 p-1.5 shadow-card ring-1 ring-line backdrop-blur">
      <span className="px-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">Goals</span>
      {goals.map((g, i) => {
        const r = results?.[i]
        return (
          <span
            key={i}
            title={r?.detail}
            className={cn(
              'flex items-center gap-1 rounded-xl px-2 py-1 text-[12px] font-semibold',
              !r && 'bg-surface-2 text-muted',
              r?.pass && 'bg-good-soft text-good',
              r && !r.pass && 'bg-bad-soft text-bad',
            )}
          >
            {!r ? <CircleDashed size={13} /> : r.pass ? <Check size={13} /> : <X size={13} />}
            {goalLabel(g)}
          </span>
        )
      })}
    </div>
  )
}

const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`)

export function MetricsStrip({ run, phaseIndex, playing, blind }: { run: SimRun; phaseIndex: number; playing: boolean; blind: boolean }) {
  const p: PhaseResult = run.phases[phaseIndex]
  const hide = (v: string) => (blind ? '??' : v)
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface/95 px-3 py-2 shadow-card ring-1 ring-line backdrop-blur">
      <div className="min-w-0">
        <div className="text-[10px] font-bold tracking-wide text-muted uppercase">
          Phase {phaseIndex + 1}/{run.phases.length}
          {playing && <span className="ml-1 animate-pulse text-accent">● live</span>}
        </div>
        <div className="max-w-44 truncate text-[13px] font-bold">{p.label}</div>
      </div>
      <div className="flex gap-1">
        {run.phases.map((_, i) => (
          <span key={i} className={cn('h-1.5 w-4 rounded-full', i <= phaseIndex ? 'bg-accent' : 'bg-line')} />
        ))}
      </div>
      <Stat label="traffic" value={`${fmt(p.offeredRps)}/s`} />
      <Stat label="errors" value={hide(`${(p.errorRate * 100).toFixed(p.errorRate > 0 && p.errorRate < 0.01 ? 2 : 1)}%`)} tone={blind ? undefined : p.errorRate > 0.005 ? 'bad' : 'good'} />
      <Stat label="p99" value={hide(`${p.p99Ms} ms`)} tone={blind ? undefined : p.p99Ms > 300 ? 'bad' : p.p99Ms > 150 ? 'warn' : 'good'} />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="text-right">
      <div
        className={cn(
          'font-mono text-[15px] leading-tight font-bold',
          tone === 'good' && 'text-good',
          tone === 'warn' && 'text-warn',
          tone === 'bad' && 'text-bad',
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  )
}
