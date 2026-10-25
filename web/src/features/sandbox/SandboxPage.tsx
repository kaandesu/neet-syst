import { Eraser, HeartPulse, Link2, Monitor, ScanSearch, Skull, Sparkles, Trophy } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '@/app/AppHeader'
import { BLOCKS } from '@/content/blocks'
import { CHAPTERS } from '@/content'
import { SANDBOX_CHALLENGES, type SandboxChallenge } from '@/content/sandbox'
import { lintDesign } from '@/engine/mentor/lint'
import { breakingPoint } from '@/engine/sim/capacity'
import { allPass, evaluateGoals } from '@/engine/sim/goals'
import { findSpofs, runScenario, solvePhase } from '@/engine/sim/solver'
import type { BlockId, Design } from '@/engine/types'
import { DesignCanvas } from '@/features/canvas/DesignCanvas'
import { Inspector } from '@/features/canvas/Inspector'
import { removeNodes } from '@/engine/lesson/runner'
import { GoalBar, MetricsStrip } from '@/features/lesson/HUD'
import type { Callout } from '@/features/mentor/coach'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useProgress } from '@/store/progress'
import { useSandbox } from '@/store/sandbox'
import { Button } from '@/ui/Button'
import { BreakingPointCard, ChallengesCard, TrafficCard } from './panels'
import { shareFromHash, shareUrl, type Shared } from './share'
import { SANDBOX_ZONES, toPhase, trafficOf, usesZones } from './traffic'

const ALL_BLOCKS = Object.keys(BLOCKS) as BlockId[]

export function SandboxPage() {
  const unlocked = useProgress((s) => s.unlocked)
  const devMode = useProgress((s) => s.devMode)
  const sb = useSandbox()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [inspected, setInspected] = useState<string | null>(null)
  const [pulse, setPulse] = useState<string[]>([])
  const [review, setReview] = useState(false)
  const [toast, setToast] = useState<{ text: string; tone: 'good' | 'info' } | null>(null)
  const [visiting, setVisiting] = useState<Shared | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  // Bumped when a whole new design arrives, so the canvas re-fits its view.
  const [canvasKey, setCanvasKey] = useState(0)

  const available = useMemo(() => new Set<BlockId>(devMode ? ALL_BLOCKS : ['client', ...unlocked]), [devMode, unlocked])
  const palette = useMemo(() => ALL_BLOCKS.filter((b) => b !== 'client' && available.has(b)), [available])

  // A shared link replaces the canvas, but the learner's own design is one click away.
  const loadedHash = useRef(false)
  useEffect(() => {
    if (loadedHash.current) return
    loadedHash.current = true
    if (!location.hash) return
    const shared = shareFromHash(location.hash)
    history.replaceState(null, '', location.pathname)
    if (!shared) {
      flash('That share link is broken or from a newer version.')
      return
    }
    const own = useSandbox.getState()
    setVisiting({ design: own.design, traffic: own.traffic })
    own.load(shared.design, shared.traffic)
    own.setActive(null)
    setCanvasKey((k) => k + 1)
  }, [])

  function flash(text: string, tone: 'good' | 'info' = 'info') {
    setToast({ text, tone })
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3200)
  }

  const { design, traffic, killed } = sb
  const zones = usesZones(traffic, available) ? SANDBOX_ZONES : undefined
  const phase = useMemo(() => toPhase(traffic, available, killed), [traffic, available, killed])
  const result = useMemo(() => solvePhase(design, phase, { zones }), [design, phase, zones])
  const bp = useMemo(() => breakingPoint(design, phase, { zones }), [design, phase, zones])
  const liveRun = useMemo(() => ({ phases: [result], spofs: [] }), [result])

  const challenge = SANDBOX_CHALLENGES.find((c) => c.id === sb.active && c.needs.every((b) => available.has(b)))
  const graded = useMemo(() => {
    if (!challenge) return undefined
    return evaluateGoals(design, runScenario(design, { phases: [challenge.phase] }, { zones }), challenge.goals)
  }, [challenge, design, zones])
  const passed = !!graded && allPass(graded)

  const clearChallenge = sb.clear
  useEffect(() => {
    if (!challenge || !passed || sb.cleared.includes(challenge.id)) return
    clearChallenge(challenge.id)
    flash(`Challenge cleared: ${challenge.title}`, 'good')
  }, [challenge, passed, sb.cleared, clearChallenge])

  const callouts = useMemo<Callout[]>(() => {
    if (!review) return []
    const out: Callout[] = lintDesign(design).map((f) => ({ nodeId: f.nodeId, text: f.text, tone: 'warn' }))
    const calm = { ...phase, failures: [] }
    const base = solvePhase(design, calm, { zones }).errorRate
    for (const id of findSpofs(design, calm, { zones })) {
      if (out.some((c) => c.nodeId === id)) continue
      const hurt = solvePhase(design, { ...calm, failures: [{ id }] }, { zones }).errorRate - base
      out.push({ nodeId: id, text: `Single point of failure: if this dies, ${Math.round(hurt * 100)}% of requests fail.`, tone: 'bad' })
    }
    if (!out.length) {
      const first = design.nodes.find((n) => n.block !== 'client') ?? design.nodes[0]
      if (first) out.push({ nodeId: first.id, text: 'No wiring mistakes and nothing irreplaceable. Nice.', tone: 'good' })
    }
    return out
  }, [review, design, phase, zones])

  const inspectedNode = design.nodes.find((n) => n.id === inspected)
  const weakNode = design.nodes.find((n) => n.id === bp.firstToFail)

  function show(id: string) {
    setInspected(id)
    setPulse([id])
    setTimeout(() => setPulse([]), 2400)
  }

  function pick(id: string | null) {
    sb.setActive(id)
    const c = SANDBOX_CHALLENGES.find((x) => x.id === id)
    if (c) matchTraffic(c)
  }

  function matchTraffic(c: SandboxChallenge) {
    sb.setTraffic(trafficOf(c.phase, traffic))
    sb.revive()
  }

  async function share() {
    const url = shareUrl({ design, traffic })
    try {
      await navigator.clipboard.writeText(url)
      flash('Link copied. Anyone with it can open this design.', 'good')
    } catch {
      // No clipboard access (insecure origin, denied permission): put the link where it can be copied by hand.
      history.replaceState(null, '', url.slice(location.origin.length))
      flash('Couldn’t reach the clipboard. The link is in your address bar.')
    }
  }

  function clearCanvas() {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    setConfirmClear(false)
    sb.reset()
    setInspected(null)
    setCanvasKey((k) => k + 1)
  }

  const firstLesson = CHAPTERS[0]?.lessons[0]
  const empty = palette.length === 0

  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="scrollbar-thin flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line bg-bg p-3">
          <div className="px-1 pt-1">
            <h1 className="text-xl font-extrabold tracking-tight">Sandbox</h1>
            <p className="text-[13px] text-muted">
              Free build with the {palette.length} block{palette.length === 1 ? '' : 's'} you’ve earned{devMode ? ' (dev mode: all of them)' : ''}. Click a block to inspect it or kill it.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={share} title="Copy a link to this design">
                <Link2 size={14} /> Share
              </Button>
              <Button size="sm" variant={review ? 'primary' : 'secondary'} onClick={() => setReview(!review)} aria-pressed={review} title="Point out wiring mistakes and single points of failure">
                <ScanSearch size={14} /> Review
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCanvas}>
                <Eraser size={14} /> {confirmClear ? 'Sure? Click again' : 'Clear'}
              </Button>
            </div>
          </div>
          <BreakingPointCard bp={bp} rps={traffic.rps} killed={killed.length} weakNode={weakNode} onShow={show} onPush={(rps) => sb.setTraffic({ rps })} />
          <TrafficCard traffic={traffic} available={available} onChange={sb.setTraffic} />
          <ChallengesCard
            challenges={SANDBOX_CHALLENGES}
            available={available}
            active={challenge?.id ?? null}
            cleared={sb.cleared}
            results={graded}
            onPick={pick}
            onRetest={matchTraffic}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-canvas">
          {visiting && (
            <div className="z-30 flex shrink-0 items-center gap-3 bg-accent px-4 py-2 text-[13px] text-accent-ink shadow-card">
              <Sparkles size={16} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="font-bold">You’re looking at a shared design.</span> Poke at it, break it, then keep it or go back to yours.
              </span>
              <Button size="sm" variant="secondary" onClick={() => setVisiting(null)}>
                Keep it
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  sb.load(visiting.design, visiting.traffic)
                  setVisiting(null)
                  setInspected(null)
                  setCanvasKey((k) => k + 1)
                }}
              >
                Back to mine
              </Button>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            <div className="pointer-events-none absolute top-3 right-14 left-3 z-10 flex flex-wrap items-start gap-2 [&>*]:pointer-events-auto">
              {challenge && <GoalBar goals={challenge.goals} results={graded} />}
              <MetricsStrip run={liveRun} phaseIndex={0} playing blind={false} />
              {killed.length > 0 && (
                <Button size="sm" variant="secondary" onClick={sb.revive} className="self-center">
                  <HeartPulse size={14} /> Revive {killed.length}
                </Button>
              )}
            </div>
            <DesignCanvas
              key={canvasKey}
              design={design}
              onChange={(d: Design) => sb.setDesign(d)}
              result={result}
              palette={palette}
              zones={zones}
              pulseIds={pulse}
              inspected={inspected}
              callouts={callouts}
              onNodeClick={setInspected}
              onPaneClick={() => setInspected(null)}
            />
            {empty && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/80 p-8 backdrop-blur-sm">
                <div className="max-w-sm rounded-2xl bg-surface p-6 text-center shadow-card ring-1 ring-line">
                  <Trophy size={32} className="mx-auto text-accent" />
                  <h2 className="mt-2 text-lg font-extrabold">Nothing to build with yet</h2>
                  <p className="mt-1 text-sm text-muted">The sandbox only offers blocks you’ve earned. Finish the first lesson to unlock your first ones.</p>
                  {firstLesson && (
                    <Link to={`/learn/${firstLesson.id}`} className="mt-4 inline-block font-semibold text-accent">
                      Start “{firstLesson.title}” →
                    </Link>
                  )}
                </div>
              </div>
            )}
            {inspectedNode && (
              <Inspector
                node={inspectedNode}
                result={result.nodes[inspectedNode.id]}
                phaseLabel={phase.label}
                onClose={() => setInspected(null)}
                onDelete={() => {
                  sb.setDesign(removeNodes(design, [inspectedNode.id]))
                  setInspected(null)
                }}
                actions={
                  inspectedNode.block !== 'client' && (
                    <Button size="sm" variant={killed.includes(inspectedNode.id) ? 'good' : 'secondary'} className="flex-1" onClick={() => sb.toggleKill(inspectedNode.id)}>
                      {killed.includes(inspectedNode.id) ? (
                        <>
                          <HeartPulse size={14} /> Bring it back
                        </>
                      ) : (
                        <>
                          <Skull size={14} /> Kill it
                        </>
                      )}
                    </Button>
                  )
                }
              />
            )}
            <AnimatePresence>
              {toast && (
                <motion.div
                  key={toast.text}
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8 }}
                  role="status"
                  className={`absolute bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-bold shadow-card ${toast.tone === 'good' ? 'bg-good text-white' : 'bg-ink text-bg'}`}
                >
                  {toast.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
      {narrow && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/95 p-8 text-center backdrop-blur">
          <Monitor size={40} className="text-accent" />
          <h2 className="text-lg font-extrabold">The sandbox needs a bigger screen</h2>
          <p className="max-w-xs text-sm text-muted">Building systems needs room for the canvas. Open it on a tablet or desktop.</p>
          <Link to="/" className="font-semibold text-accent">
            Back to the map
          </Link>
        </div>
      )}
    </div>
  )
}
