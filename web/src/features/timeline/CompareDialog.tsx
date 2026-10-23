import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Section, Step } from '@/engine/lesson/types'
import { runScenario } from '@/engine/sim/solver'
import { leaves, pathTo, type DecisionNode, type RunTree } from '@/engine/timeline/tree'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/Button'
import { describeStep } from './describe'
import { MiniDiagram } from './MiniDiagram'

function lastScenario(section: Section) {
  const sims = section.steps.filter((s): s is Extract<Step, { t: 'simulate' }> => s.t === 'simulate')
  return sims[sims.length - 1]?.scenario
}

export function CompareDialog({
  tree,
  section,
  onClose,
  onRewind,
}: {
  tree: RunTree
  section: Section
  onClose: () => void
  onRewind: (id: string) => void
}) {
  const tips = useMemo(() => leaves(tree).sort((a, b) => b.at - a.at), [tree])
  const [pick, setPick] = useState<[string, string]>([tips[0]?.id, tips[1]?.id])
  const scenario = lastScenario(section)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const column = (id: string, side: 0 | 1) => {
    const node = tree.nodes[id]
    if (!node) return null
    const path = pathTo(tree, id)
    const decisions = path.filter((n) => {
      const s = section.steps[n.stepIndex]
      return s && (s.t === 'fork' || s.t === 'reason' || n.note)
    })
    const run = scenario ? runScenario(node.design, scenario, { zones: section.zones }) : null
    const worst = run ? run.phases.reduce((a, p) => (p.errorRate > a.errorRate ? p : a), run.phases[0]) : null
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-line bg-bg p-4">
        <select
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          value={id}
          onChange={(e) => setPick((p) => (side === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]))}
        >
          {tips.map((t, i) => (
            <option key={t.id} value={t.id}>
              Branch {tips.length - i}: {branchName(section, tree, t)}
            </option>
          ))}
        </select>
        <div className="rounded-xl bg-canvas ring-1 ring-line">
          <MiniDiagram design={node.design} result={worst ?? undefined} />
        </div>
        {run && worst && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="worst errors" value={`${(worst.errorRate * 100).toFixed(1)}%`} bad={worst.errorRate > 0} />
            <Metric label="worst p99" value={`${Math.max(...run.phases.map((p) => p.p99Ms))} ms`} />
            <Metric label="fragile parts" value={String(run.spofs.length)} bad={run.spofs.length > 0} />
          </div>
        )}
        <div className="space-y-1.5 text-[13px]">
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">Decisions on this branch</div>
          {decisions.length === 0 && <div className="text-muted">No decisions yet.</div>}
          {decisions.map((n) => (
            <div key={n.id} className="rounded-lg bg-surface px-2.5 py-1.5 ring-1 ring-line">
              {describeStep(section.steps[n.stepIndex], n.answer)}
              {n.note && <div className="mt-0.5 text-muted italic">“{n.note}”</div>}
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onRewind(id)
            onClose()
          }}
        >
          Continue on this branch
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Compare branches</h2>
            <p className="text-sm text-muted">Same lesson, different decisions. Metrics come from replaying this section’s final traffic on each design.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          {pick[0] && column(pick[0], 0)}
          {pick[1] && column(pick[1], 1)}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-surface px-2 py-2 ring-1 ring-line', bad && 'bg-bad-soft ring-bad/40')}>
      <div className="font-mono text-base font-bold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  )
}

function branchName(section: Section, tree: RunTree, tip: DecisionNode) {
  const forks = pathTo(tree, tip.id).filter((n) => section.steps[n.stepIndex]?.t === 'fork')
  const label = forks.map((n) => describeStep(section.steps[n.stepIndex], n.answer)).join(', ')
  return label || `step ${tip.stepIndex + 1}`
}
