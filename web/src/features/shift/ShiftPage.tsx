import { ArrowLeft, Check, ChevronRight, Lightbulb, Lock, Play, RotateCcw, Skull, Star, Swords, Undo2, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { BLOCKS } from '@/content/blocks'
import { shiftById } from '@/content/shifts'
import { lintDesign } from '@/engine/mentor/lint'
import { blockCount } from '@/engine/problems/judge'
import { runShift, waveHeld, type ShiftResult } from '@/engine/shifts/score'
import type { Shift } from '@/engine/shifts/types'
import type { Design } from '@/engine/types'
import { DesignCanvas } from '@/features/canvas/DesignCanvas'
import { Inspector } from '@/features/canvas/Inspector'
import { Dock, Metrics, Panel, type FeedItem } from '@/features/lesson/Stage'
import { designKey, useSimPlayback } from '@/features/lesson/useSimPlayback'
import type { Callout } from '@/features/mentor/coach'
import { removeNodes, setNodeProps } from '@/engine/lesson/runner'
import { cn } from '@/lib/cn'
import { useProgress } from '@/store/progress'
import { shiftProgressOf, useShifts } from '@/store/shifts'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'

export function ShiftPage() {
  const { shiftId = '' } = useParams()
  const shift = shiftById(shiftId)
  if (!shift) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-muted">That shift doesn’t exist.</p>
        <Link to="/" className="font-semibold text-accent">
          Back to the story
        </Link>
      </div>
    )
  }
  return <ShiftView key={shift.id} shift={shift} />
}

const fmt = (n: number) => n.toLocaleString('en-US')

function ShiftView({ shift }: { shift: Shift }) {
  const store = useShifts()
  const prog = shiftProgressOf(store.byId, shift.id)
  const design = prog.design ?? shift.start
  const unlocked = useProgress((s) => s.unlocked)
  const palette = unlocked.filter((b) => b !== 'client')

  const [line, setLine] = useState(prog.briefed ? shift.briefing.length : 0)
  const briefing = line < shift.briefing.length

  const { pb, start, clear } = useSimPlayback()
  const [result, setResult] = useState<ShiftResult | null>(null)
  const dk = designKey(design)
  const showing = pb && pb.designKey === dk ? pb : null
  const playing = !!showing?.playing
  const outcome = result && showing && !playing ? result : null

  const [reply, setReply] = useState<FeedItem | undefined>()
  const [inspected, setInspected] = useState<string | null>(null)
  const [reference, setReference] = useState(false)
  // The victory card shows once per winning run, until it's closed.
  const [dismissed, setDismissed] = useState<ShiftResult | null>(null)
  const victoryOpen = !!outcome?.survived && dismissed !== outcome

  const edit = (d: Design) => {
    store.setDesign(shift.id, d)
    setReply(undefined)
  }

  const go = () => {
    setInspected(null)
    setReference(false)
    const r = runShift(shift, design)
    setResult(r)
    store.attempted(shift.id, r.survived ? { stars: r.stars, blocks: r.blocks, p99Ms: r.p99Ms } : undefined)
    start(r.run, r.goals, r.survived, design, 0)
    setReply(undefined)
  }

  const revealed = shift.hints.slice(0, prog.hintsUsed)
  const hintsOpen = prog.attempts > 0
  const onStuck = () => {
    if (!hintsOpen) return
    if (prog.hintsUsed >= shift.hints.length) {
      setReply({ stepIndex: 0, speaker: 'mentor', text: 'That’s every hint I have. The last one is basically the answer.' })
      return
    }
    store.revealHint(shift.id)
    setReply({ stepIndex: 0, speaker: 'mentor', text: shift.hints[prog.hintsUsed].text })
  }
  const ghost = [...revealed].reverse().find((h) => h.ghost)?.ghost ?? null

  const label = (id: string) => {
    const n = design.nodes.find((x) => x.id === id)
    return n ? `${n.label || BLOCKS[n.block].short} (${id})` : id
  }
  const lint = lintDesign(design)
  const callouts: Callout[] = outcome && !outcome.survived
    ? [
        ...(outcome.culprit ? [{ nodeId: outcome.culprit.nodeId, text: outcome.culprit.why, tone: 'bad' as const }] : []),
        ...lint.slice(0, 2).map((f) => ({ nodeId: f.nodeId, text: f.text, tone: 'warn' as const })),
      ]
    : []

  const canvasDesign = reference ? shift.solution : design
  const inspectedNode = inspected ? canvasDesign.nodes.find((n) => n.id === inspected) : undefined
  const peak = Math.max(...shift.waves.map((w) => w.phase.rps))
  const wave = showing ? shift.waves[showing.phase] : undefined

  const dock = (() => {
    if (briefing) {
      const b = shift.briefing[line]
      const last = line === shift.briefing.length - 1
      return {
        speaker: b.speaker ?? shift.speaker,
        mood: b.mood,
        kicker: 'Briefing',
        body: (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <RichText text={b.text} />
            </div>
            <Button
              size="sm"
              autoFocus
              className="shrink-0"
              onClick={() => {
                if (last) store.briefed(shift.id)
                setLine(line + 1)
              }}
            >
              {last ? 'Start building' : 'Continue'} <ChevronRight size={16} />
            </Button>
          </div>
        ),
      }
    }
    if (playing && wave && showing) {
      return { speaker: wave.speaker ?? shift.speaker, mood: wave.mood ?? (wave.phase.failures?.length ? 'worried' : undefined), kicker: `Wave ${showing.phase + 1} of ${shift.waves.length}`, body: <RichText text={wave.line} /> }
    }
    if (outcome && !outcome.survived) {
      const fell = outcome.fellAt ?? shift.waves.length - 1
      return {
        speaker: 'oncall' as const,
        mood: 'worried' as const,
        kicker: 'Shift lost',
        body: (
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <p>
                Wave {fell + 1}, <span className="font-bold">{shift.waves[fell].phase.label}</span>, took us down.
                {outcome.culprit && (
                  <>
                    {' '}
                    <span className="font-bold">{label(outcome.culprit.nodeId)}</span>: {outcome.culprit.why}
                  </>
                )}
              </p>
              <p className="mt-1 text-[13px] text-muted">Fix it on the floor and run the shift again. Hints are open now if you want one.</p>
            </div>
            <Button size="sm" onClick={go} className="shrink-0">
              <RotateCcw size={15} /> Run again
            </Button>
          </div>
        ),
      }
    }
    return {
      speaker: shift.speaker,
      mood: outcome?.survived ? ('happy' as const) : undefined,
      kicker: outcome?.survived ? 'Shift survived' : 'Build',
      body: (
        <div className="flex items-end gap-3">
          <p className="min-w-0 flex-1">
            {outcome?.survived
              ? 'You held. Trim boxes or latency for more stars, then run it again.'
              : `${shift.waves.length} waves incoming, peaking at ${fmt(peak)} req/s. Build your version, then start the shift.`}
          </p>
          <Button onClick={go} disabled={playing} className="shrink-0">
            <Swords size={16} /> {outcome ? 'Run the shift again' : 'Start the shift'}
          </Button>
        </div>
      ),
    }
  })()

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <Link to="/" className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={16} /> Map
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-bad uppercase">
            <Skull size={12} /> Shift · boss fight
          </div>
          <div className="truncate text-[15px] leading-tight font-extrabold">{shift.title}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {prog.best && <StarRow stars={prog.best.stars} size={16} title={`Best: ${prog.best.stars}★`} />}
          <button
            title="Reset to the starting design"
            onClick={() => {
              clear()
              setResult(null)
              setReference(false)
              store.reset(shift.id)
            }}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </header>

      <div data-testid="stage" className="flex min-h-0 flex-1">
        <aside className="vn-side flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-bg p-3 scrollbar-thin">
          <Panel title="Waves">
            <ol className="space-y-1">
              {shift.waves.map((w, i) => {
                const seen = showing && i <= showing.phase && result
                const held = seen ? waveHeld(shift, result.run, i) : undefined
                const live = playing && showing?.phase === i
                return (
                  <li key={i} className={cn('flex items-center gap-2 rounded-lg px-2 py-1 text-[13px]', live && 'bg-accent-soft')}>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                        held === true && 'bg-good text-white',
                        held === false && 'bg-bad text-white',
                        held === undefined && 'bg-surface-2 text-muted',
                      )}
                    >
                      {held === true ? <Check size={12} strokeWidth={3} /> : held === false ? <X size={12} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{w.phase.label}</span>
                    <span className="font-mono text-[11px] text-muted">{fmt(w.phase.rps)}/s</span>
                    {w.phase.failures?.length ? <Skull size={12} className="text-bad" aria-label="chaos" /> : null}
                  </li>
                )
              })}
            </ol>
          </Panel>

          <Panel title="Stars">
            <ul className="space-y-1 text-[13px]">
              <Criterion ok={outcome ? outcome.survived : undefined} text="Survive every wave" />
              <Criterion ok={blockCount(design) <= shift.par} text={`${shift.par} blocks or fewer (now ${blockCount(design)})`} />
              <Criterion ok={outcome ? outcome.p99Ms <= shift.fastMs : undefined} text={`Worst p99 ≤ ${shift.fastMs} ms`} />
            </ul>
          </Panel>

          {showing && <Metrics run={showing.run} phase={showing.phase} playing={playing} blind={false} />}

          <Panel title="Hints" icon={<Lightbulb size={13} />}>
            {!hintsOpen ? (
              <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <Lock size={12} /> Open after your first run. Try it your way first.
              </p>
            ) : (
              <>
                {revealed.length > 0 && (
                  <ol className="mb-2 space-y-1.5 text-[12.5px] leading-snug">
                    {revealed.map((h, i) => (
                      <li key={i} className="rounded-lg bg-surface-2 px-2 py-1.5">
                        <RichText text={h.text} />
                      </li>
                    ))}
                  </ol>
                )}
                {prog.hintsUsed < shift.hints.length && (
                  <button onClick={onStuck} className="text-[12.5px] font-semibold text-accent hover:underline">
                    Show hint {prog.hintsUsed + 1} of {shift.hints.length}
                  </button>
                )}
              </>
            )}
          </Panel>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1 bg-canvas">
            {reference && (
              <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-accent px-4 py-2 text-[13px] text-accent-ink shadow-card">
                <span className="min-w-0 flex-1">
                  <span className="font-bold">Reference design.</span> One way to survive with {shift.par} blocks. Yours may be different and still good.
                </span>
                <Button size="sm" variant="secondary" onClick={() => setReference(false)}>
                  <Undo2 size={15} /> Back to mine
                </Button>
              </div>
            )}
            <DesignCanvas
              key={reference ? 'reference' : 'mine'}
              design={canvasDesign}
              onChange={reference || playing || briefing ? undefined : edit}
              readOnly={reference || briefing}
              result={!reference && showing ? showing.run.phases[showing.phase] : null}
              palette={palette}
              ghost={reference ? null : ghost}
              inspected={inspected}
              callouts={reference ? [] : callouts}
              onNodeClick={setInspected}
              onPaneClick={() => setInspected(null)}
              trayAt="top"
            />
            {inspectedNode && (
              <Inspector
                node={inspectedNode}
                result={!reference && showing ? showing.run.phases[showing.phase].nodes[inspectedNode.id] : undefined}
                phaseLabel={!reference && showing ? showing.run.phases[showing.phase].label : undefined}
                onClose={() => setInspected(null)}
                onEdit={reference || playing ? undefined : (p) => edit(setNodeProps(design, inspectedNode.id, p))}
                onDelete={
                  reference || playing
                    ? undefined
                    : () => {
                        edit(removeNodes(design, [inspectedNode.id]))
                        setInspected(null)
                      }
                }
              />
            )}
            {victoryOpen && outcome && (
              <Victory
                shift={shift}
                result={outcome}
                onClose={() => setDismissed(outcome)}
                onReference={() => {
                  setDismissed(outcome)
                  setReference(true)
                  setInspected(null)
                }}
              />
            )}
          </main>
          <Dock speaker={dock.speaker} mood={dock.mood} kicker={dock.kicker} reply={reply} chips={hintsOpen && !briefing && !playing ? ['stuck'] : []} onChip={onStuck}>
            {dock.body}
          </Dock>
        </div>
      </div>
    </div>
  )
}

function Criterion({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <li className={cn('flex items-center gap-2', ok === true && 'text-good', ok === false && 'text-bad', ok === undefined && 'text-muted')}>
      <Star size={14} className={cn(ok && 'fill-current')} />
      {text}
    </li>
  )
}

/** `ink` draws the stars in the text colour, for coloured headers where the accent wouldn't show. */
function StarRow({ stars, size = 28, title, ink }: { stars: number; size?: number; title?: string; ink?: boolean }) {
  return (
    <span className="flex items-center gap-0.5" title={title} aria-label={`${stars} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < stars ? (ink ? 'fill-current' : 'fill-accent text-accent') : ink ? 'opacity-30' : 'text-line'} />
      ))}
    </span>
  )
}

/** The "you survived" card: stars, the numbers behind them, and what the reference design did. */
function Victory({ shift, result, onClose, onReference }: { shift: Shift; result: ShiftResult; onClose: () => void; onReference: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6" role="dialog" aria-label="Shift survived">
      <motion.div
        initial={{ scale: 0.9, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="vn-modal flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-surface shadow-card"
      >
        <div className="vn-modal-head flex flex-col items-center gap-2 bg-good-soft px-5 py-5 text-center">
          <div className="text-[12px] font-bold tracking-wider uppercase">Shift survived</div>
          <h2 className="text-xl font-extrabold">{shift.title}</h2>
          <StarRow stars={result.stars} size={36} ink />
        </div>
        <div className="space-y-3 overflow-y-auto p-5 scrollbar-thin">
          <ul className="space-y-1 text-[13.5px]">
            <Criterion ok text="Survived every wave" />
            <Criterion ok={result.blocks <= shift.par} text={`${result.blocks} blocks (par ${shift.par})`} />
            <Criterion ok={result.p99Ms <= shift.fastMs} text={`Worst p99 ${result.p99Ms} ms (target ${shift.fastMs} ms)`} />
          </ul>
          <div className="rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed">
            <div className="mb-1 text-[11px] font-bold tracking-wider text-muted uppercase">Debrief</div>
            <div className="space-y-1.5">
              {shift.debrief.map((t, i) => (
                <p key={i}>
                  <RichText text={t} />
                </p>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onReference} variant="secondary">
              Compare with the reference
            </Button>
            <Button onClick={onClose} variant="secondary">
              <Play size={15} /> Keep improving
            </Button>
            <Link to="/" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
              Back to the story
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
