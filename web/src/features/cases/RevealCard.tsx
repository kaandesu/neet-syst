import { ChevronRight, ExternalLink } from 'lucide-react'
import { useMemo } from 'react'
import { runScenario } from '@/engine/sim/solver'
import { allPass, evaluateGoals } from '@/engine/sim/goals'
import type { Section, Step } from '@/engine/lesson/types'
import type { Design } from '@/engine/types'
import { Bubble } from '@/features/mentor/cards'
import { MiniDiagram } from '@/features/timeline/MiniDiagram'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'

/** The test a reveal is judged by: the nearest simulate step before it. */
export function testBefore(section: Section, stepIndex: number) {
  for (let i = stepIndex - 1; i >= 0; i--) {
    const s = section.steps[i]
    if (s.t === 'simulate') return { scenario: s.scenario, goals: s.goals ?? section.goals }
  }
  return undefined
}

function score(design: Design, section: Section, stepIndex: number, zones = section.zones) {
  const test = testBefore(section, stepIndex)
  const blocks = design.nodes.filter((n) => n.block !== 'client').length
  if (!test) return { blocks }
  const run = runScenario(design, test.scenario, { zones })
  const worst = run.phases.reduce((a, p) => (p.errorRate > a.errorRate ? p : a), run.phases[0])
  return {
    blocks,
    passed: allPass(evaluateGoals(design, run, test.goals)),
    errorRate: Math.max(...run.phases.map((p) => p.errorRate)),
    p99: Math.max(...run.phases.map((p) => p.p99Ms)),
    result: worst,
  }
}

/** Your design next to the one the experts shipped, with their reasoning. */
export function RevealCard({
  step,
  section,
  stepIndex,
  design,
  onDone,
}: {
  step: Extract<Step, { t: 'reveal' }>
  section: Section
  stepIndex: number
  design: Design
  onDone: () => void
}) {
  const mine = useMemo(() => score(design, section, stepIndex), [design, section, stepIndex])
  const theirs = useMemo(() => (step.expert ? score(step.expert, section, stepIndex) : undefined), [step.expert, section, stepIndex])
  return (
    <Bubble tone="task" className="w-full">
      <div className="mb-2 text-[11px] font-bold tracking-wider text-accent uppercase">{step.title}</div>
      {step.expert && theirs && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Column title="Yours" design={design} stats={mine} />
          <Column title="What they built" design={step.expert} stats={theirs} />
        </div>
      )}
      <div className="space-y-2 text-[14px] leading-relaxed">
        {step.text.split('\n\n').map((p, i) => (
          <p key={i}>
            <RichText text={p} />
          </p>
        ))}
      </div>
      {step.sources?.length ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
          <span className="font-bold text-muted">Sources:</span>
          {step.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent hover:underline">
              {s.label} <ExternalLink size={11} />
            </a>
          ))}
        </div>
      ) : null}
      <Button size="sm" className="mt-3" autoFocus onClick={onDone}>
        Continue <ChevronRight size={16} />
      </Button>
    </Bubble>
  )
}

function Column({ title, design, stats }: { title: string; design: Design; stats: ReturnType<typeof score> }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-2">
      <div className="mb-1 flex items-center justify-between px-1 text-[12px]">
        <span className="font-bold">{title}</span>
        <span className="font-mono text-muted">
          {stats.blocks} blocks
          {stats.errorRate !== undefined && ` · ${(stats.errorRate * 100).toFixed(stats.errorRate > 0 && stats.errorRate < 0.01 ? 1 : 0)}% err · ${stats.p99} ms`}
        </span>
      </div>
      <div className="rounded-xl bg-surface">
        <MiniDiagram design={design} result={stats.result} height={170} />
      </div>
      {stats.passed !== undefined && (
        <div className={stats.passed ? 'mt-1 px-1 text-[12px] font-bold text-good' : 'mt-1 px-1 text-[12px] font-bold text-bad'}>
          {stats.passed ? 'Passes the test' : 'Fails the test'}
        </div>
      )}
    </div>
  )
}
