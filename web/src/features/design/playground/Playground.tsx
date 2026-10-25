import { HeartPulse, RotateCcw, Skull, Trash2, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as RPointerEvent } from 'react'
import { BLOCKS } from '@/content/blocks'
import { explainNode } from '@/engine/sim/explain'
import { findSpofs, solvePhase, wouldCreateCycle } from '@/engine/sim/solver'
import type { BlockId, DEdge, Design, ScenarioPhase } from '@/engine/types'
import { cn } from '@/lib/cn'
import { BlockIcon } from '@/ui/BlockIcon'
import { CANVAS_H, CANVAS_W, CASES, NODE_H, NODE_W, PALETTE, type PlayCase } from './cases'
import { ASCII, SKINS, type Skin, type SkinId } from './skins'
import { blip, useHum } from './sound'

export type { SkinId }

type Pt = { x: number; y: number }
type PNode = { id: string; block: BlockId }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const pct = (v: number, of: number) => `${(v / of) * 100}%`
const fmtRps = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v)))

const outPort = (a: Pt): Pt => ({ x: a.x + NODE_W / 2, y: a.y })
const inPort = (b: Pt): Pt => ({ x: b.x - NODE_W / 2, y: b.y })

/** Where a patch cable's lowest point wants to hang. */
const sagTarget = (a: Pt, b: Pt): Pt => {
  const p = outPort(a)
  const q = inPort(b)
  const dist = Math.hypot(q.x - p.x, q.y - p.y)
  return { x: (p.x + q.x) / 2, y: Math.max(p.y, q.y) + 24 + dist * 0.22 }
}

function edgeD(a: Pt, b: Pt, kind: Skin['edge'], sag?: Pt) {
  const { x: x1, y: y1 } = outPort(a)
  const { x: x2, y: y2 } = inPort(b)
  if (kind === 'step') {
    const mx = Math.round((x1 + x2) / 2)
    return `M${x1},${y1} H${mx} V${y2} H${x2}`
  }
  if (kind === 'sag' && sag) return `M${x1},${y1} Q${sag.x},${sag.y} ${x2},${y2}`
  const dx = x2 - x1
  const dy = y2 - y1
  if (kind === 'octo' && dx > 0) {
    // Transit-map routing: horizontal runs joined by a single 45° diagonal.
    const s = Math.sign(dy)
    const ady = Math.abs(dy)
    if (ady < 1) return `M${x1},${y1} H${x2}`
    if (dx >= ady) {
      const run = (dx - ady) / 2
      return `M${x1},${y1} H${x1 + run} L${x1 + run + ady},${y2} H${x2}`
    }
    const xm = x1 + dx / 2
    return `M${x1},${y1} L${xm},${y1 + (s * dx) / 2} V${y2 - (s * dx) / 2} L${x2},${y2}`
  }
  const c = Math.max(40, Math.abs(dx) / 2)
  return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`
}

/** Damped springs that chase their targets, so cables swing when a module is dragged. */
function useSprings(targets: Record<string, Pt>, enabled: boolean) {
  const [points, setPoints] = useState<Record<string, Pt>>({})
  const targetsRef = useRef(targets)
  useEffect(() => {
    targetsRef.current = targets
  }, [targets])
  useEffect(() => {
    if (!enabled) return
    const state: Record<string, { p: Pt; v: Pt }> = {}
    let raf = 0
    let lastCount = -1
    const step = () => {
      let moving = false
      const out: Record<string, Pt> = {}
      for (const [id, t] of Object.entries(targetsRef.current)) {
        const s = (state[id] ??= { p: { ...t }, v: { x: 0, y: 0 } })
        s.v.x = (s.v.x + (t.x - s.p.x) * 0.09) * 0.86
        s.v.y = (s.v.y + (t.y - s.p.y) * 0.09) * 0.86
        s.p.x += s.v.x
        s.p.y += s.v.y
        if (Math.abs(s.v.x) + Math.abs(s.v.y) + Math.abs(t.x - s.p.x) + Math.abs(t.y - s.p.y) > 0.2) moving = true
        out[id] = { ...s.p }
      }
      const count = Object.keys(out).length
      if (moving || count !== lastCount) {
        lastCount = count
        setPoints(out)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
  return points
}

function split(d: Design) {
  return {
    nodes: d.nodes.map(({ id, block }) => ({ id, block })),
    edges: d.edges.map((e) => ({ ...e })),
    pos: Object.fromEntries(d.nodes.map((n) => [n.id, { x: n.x, y: n.y }])) as Record<string, Pt>,
  }
}

/** A small, real sandbox: the actual sim solver scores whatever you wire up, skinned per concept. */
export function Playground({ skin: skinId }: { skin: SkinId }) {
  const skin = SKINS[skinId]
  const [caseId, setCaseId] = useState(CASES[0].id)
  const pcase = CASES.find((c) => c.id === caseId)!
  const [nodes, setNodes] = useState<PNode[]>(() => split(CASES[0].start).nodes)
  const [edges, setEdges] = useState<DEdge[]>(() => split(CASES[0].start).edges)
  const [pos, setPos] = useState<Record<string, Pt>>(() => split(CASES[0].start).pos)
  const [rps, setRps] = useState(CASES[0].rps)
  const [writePct, setWritePct] = useState(CASES[0].writePct)
  const [cacheHit, setCacheHit] = useState(80)
  const [killed, setKilled] = useState<string[]>([])
  const [sel, setSel] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null)
  const [link, setLink] = useState<{ from: string; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const seq = useRef(100)

  const loadCase = (c: PlayCase) => {
    const s = split(c.start)
    setCaseId(c.id)
    setNodes(s.nodes)
    setEdges(s.edges)
    setPos(s.pos)
    setRps(c.rps)
    setWritePct(c.writePct)
    setCacheHit(80)
    setKilled([])
    setSel(null)
  }

  // Positions don't affect the solver, so dragging never re-runs it.
  const simDesign = useMemo<Design>(() => ({ nodes: nodes.map((n) => ({ ...n, x: 0, y: 0 })), edges }), [nodes, edges])
  const phase = useMemo<ScenarioPhase>(
    () => ({ label: pcase.title, seconds: 10, rps, writeRatio: writePct / 100, cacheHitRate: cacheHit / 100, failures: killed.map((id) => ({ id })) }),
    [pcase.title, rps, writePct, cacheHit, killed],
  )
  const run = useMemo(() => solvePhase(simDesign, phase), [simDesign, phase])
  const spofs = useMemo(() => findSpofs(simDesign, phase), [simDesign, phase])

  const errPct = run.errorRate * 100
  const goals = [
    { label: `Errors ≤ ${pcase.maxErrorPct}%`, pass: errPct <= pcase.maxErrorPct },
    { label: `p99 ≤ ${pcase.maxP99} ms`, pass: run.p99Ms <= pcase.maxP99 },
  ]
  const solved = goals.every((g) => g.pass) && run.servedRps > 0
  const [okWord, badWord] = skin.verdict ?? ['Holding up', 'Failing']

  const sagTargets = useMemo(() => {
    if (skin.edge !== 'sag') return {}
    const out: Record<string, Pt> = {}
    for (const e of edges) if (pos[e.from] && pos[e.to]) out[e.id] = sagTarget(pos[e.from], pos[e.to])
    return out
  }, [skin.edge, edges, pos])
  const sags = useSprings(sagTargets, skin.edge === 'sag')

  const peakLoad = Math.max(0, ...Object.values(run.nodes).map((r) => (r.status === 'idle' ? 0 : r.utilization)))
  const clipping = Object.values(run.nodes).some((r) => r.droppedRps > 0)
  useHum(!!skin.sound && soundOn, peakLoad, clipping)
  const sfx = (kind: 'plug' | 'unplug') => skin.sound && soundOn && blip(kind)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800)
  }

  const toLogical = (cx: number, cy: number): Pt => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: ((cx - r.left) / r.width) * CANVAS_W, y: ((cy - r.top) / r.height) * CANVAS_H }
  }

  const nodeAt = (p: Pt) =>
    nodes.find((n) => {
      const q = pos[n.id]
      return Math.abs(q.x - p.x) <= NODE_W / 2 && Math.abs(q.y - p.y) <= NODE_H / 2
    })

  const freeSpot = (): Pt => {
    for (const y of [280, 160, 400, 60, 500])
      for (const x of [520, 660, 380, 800, 240, 920]) {
        if (!Object.values(pos).some((q) => Math.abs(q.x - x) < NODE_W + 40 && Math.abs(q.y - y) < NODE_H + 30)) return { x, y }
      }
    return { x: 520, y: 280 }
  }

  const addBlock = (block: BlockId, at?: Pt) => {
    const id = `${block}-${seq.current++}`
    const p = at ?? freeSpot()
    setNodes((ns) => [...ns, { id, block }])
    setPos((ps) => ({ ...ps, [id]: { x: clamp(p.x, NODE_W / 2, CANVAS_W - NODE_W / 2), y: clamp(p.y, NODE_H / 2, CANVAS_H - NODE_H / 2) } }))
    setSel({ kind: 'node', id })
  }

  const connect = (from: string, to: string) => {
    if (from === to) return
    if (nodes.find((n) => n.id === to)?.block === 'client') return flash('Nothing can send requests to the users')
    if (edges.some((e) => e.from === from && e.to === to)) return flash('Already connected')
    if (wouldCreateCycle(simDesign, from, to)) return flash('That would make a loop')
    setEdges((es) => [...es, { id: `${from}>${to}`, from, to }])
    sfx('plug')
  }

  const removeNode = (id: string) => {
    if (nodes.find((n) => n.id === id)?.block === 'client') return flash('The users stay')
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id))
    setKilled((k) => k.filter((x) => x !== id))
    setSel(null)
    sfx('unplug')
  }

  const removeSelected = () => {
    if (!sel) return
    if (sel.kind === 'node') removeNode(sel.id)
    else {
      setEdges((es) => es.filter((e) => e.id !== sel.id))
      setSel(null)
      sfx('unplug')
    }
  }

  const toggleKill = (id: string) => setKilled((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') removeSelected()
      if (e.key === 'Escape') setSel(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  /** Pointer drags are tracked on window so they keep working outside the node. */
  const track = (onMove: (p: Pt) => void, onUp: (p: Pt) => void) => {
    const move = (ev: PointerEvent) => onMove(toLogical(ev.clientX, ev.clientY))
    const up = (ev: PointerEvent) => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      onUp(toLogical(ev.clientX, ev.clientY))
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  }

  const startDrag = (e: RPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSel({ kind: 'node', id })
    const start = toLogical(e.clientX, e.clientY)
    const origin = pos[id]
    track(
      (p) =>
        setPos((ps) => ({
          ...ps,
          [id]: {
            x: clamp(origin.x + p.x - start.x, NODE_W / 2, CANVAS_W - NODE_W / 2),
            y: clamp(origin.y + p.y - start.y, NODE_H / 2, CANVAS_H - NODE_H / 2),
          },
        })),
      () => {},
    )
  }

  const startLink = (e: RPointerEvent, from: string) => {
    e.stopPropagation()
    setLink({ from, ...toLogical(e.clientX, e.clientY) })
    track(
      (p) => setLink((l) => l && { ...l, ...p }),
      (p) => {
        setLink(null)
        const target = nodeAt(p)
        if (target) connect(from, target.id)
      },
    )
  }

  const onDrop = (e: DragEvent) => {
    const block = e.dataTransfer.getData('text/x-block') as BlockId
    if (!block) return
    e.preventDefault()
    addBlock(block, toLogical(e.clientX, e.clientY))
  }

  const icon = (b: BlockId, size: number) => {
    if (skin.icon === 'ascii') return <span className="pg-code">[{ASCII[b]}]</span>
    if (skin.icon === 'tile') return <BlockIcon block={b} size={size + 14} />
    if (skin.icon === 'lucide') {
      const Icon = BLOCKS[b].icon
      return <Icon size={size} className="pg-ico shrink-0" />
    }
    return null
  }

  const selNode = sel?.kind === 'node' ? nodes.find((n) => n.id === sel.id) : undefined
  const selEdge = sel?.kind === 'edge' ? edges.find((x) => x.id === sel.id) : undefined
  const selResult = selNode && run.nodes[selNode.id]
  const Deco = skin.Deco
  const CanvasDeco = skin.CanvasDeco

  return (
    <div className={cn(skin.root, 'relative min-h-full')}>
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pt-6 pb-24">
        {/* Header: cases */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn(skin.heading, 'pg-title mr-2 text-[13px]')}>{skin.title ?? 'Playground'}</span>
          {CASES.map((c) => (
            <button key={c.id} onClick={() => loadCase(c)} className={cn(skin.btn, c.id === caseId && skin.btnOn)}>
              {c.title}
            </button>
          ))}
          <div className="ml-auto flex gap-3">
            {skin.sound && (
              <button onClick={() => setSoundOn(!soundOn)} className={cn(skin.btn, 'flex items-center gap-1.5', soundOn && skin.btnOn)}>
                {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />} {soundOn ? 'Sound on' : 'Sound off'}
              </button>
            )}
            <button onClick={() => loadCase(pcase)} className={cn(skin.btn, 'flex items-center gap-1.5')}>
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>
        <p className="pg-brief max-w-3xl">{pcase.brief}</p>

        <div className="grid gap-5 lg:grid-cols-[150px_minmax(0,1fr)_300px]">
          {/* Palette */}
          <div className={cn(skin.panel, 'flex flex-col gap-2 self-start')}>
            <div className={cn(skin.heading, 'mb-1')}>Blocks</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-1">
              {PALETTE.map((b) => (
                <button
                  key={b}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/x-block', b)}
                  onClick={() => addBlock(b)}
                  className="pg-pal flex items-center gap-2 text-left"
                  title={BLOCKS[b].tagline}
                >
                  {icon(b, 16)}
                  <span className="truncate">{BLOCKS[b].short}</span>
                </button>
              ))}
            </div>
            <p className="pg-hint mt-2">Click or drag in. Drag from ● to connect. Del removes.</p>
          </div>

          {/* Canvas */}
          <div className={cn(skin.panel, 'min-w-0 self-start !p-2')}>
            <div ref={canvasRef} className="pg-canvas" onPointerDown={() => setSel(null)} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="absolute inset-0 h-full w-full">
                <defs>
                  <marker id={`pg-arrow-${skinId}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0,1 L9,5 L0,9" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  </marker>
                </defs>
                {CanvasDeco && <CanvasDeco />}
                {edges.map((ed, i) => {
                  const a = pos[ed.from]
                  const b = pos[ed.to]
                  if (!a || !b) return null
                  const d = edgeD(a, b, skin.edge, sags[ed.id] ?? sagTarget(a, b))
                  const flow = run.edges[ed.id] ?? 0
                  const target = run.nodes[ed.to]
                  const bad = !!target && (target.status === 'down' || target.droppedRps > 0)
                  const count = flow > 0 ? clamp(Math.round(Math.log10(flow)), 1, 4) : 0
                  const p = outPort(a)
                  const q = inPort(b)
                  const color = skin.edgeColors?.[i % skin.edgeColors.length]
                  const motion = (k: number, rotate?: boolean) => (
                    <animateMotion dur="1.8s" begin={`-${(k / count) * 1.8}s`} repeatCount="indefinite" path={d} rotate={rotate ? 'auto' : undefined} />
                  )
                  return (
                    <g
                      key={ed.id}
                      className={cn('pg-edge-g', flow > 0 && 'pg-live', bad && 'pg-bad', sel?.id === ed.id && 'pg-sel')}
                      style={color ? ({ '--edge-c': color } as CSSProperties) : undefined}
                    >
                      <path d={d} className="pg-edge-under" />
                      <path d={d} className="pg-edge" markerEnd={skin.arrow ? `url(#pg-arrow-${skinId})` : undefined} />
                      <path
                        d={d}
                        className="pg-edge-hit"
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          setSel({ kind: 'edge', id: ed.id })
                        }}
                      />
                      {Array.from({ length: count }, (_, k) =>
                        skin.packet === 'circle' ? (
                          <circle key={k} r="5" className="pg-packet">
                            {motion(k)}
                          </circle>
                        ) : skin.packet === 'train' ? (
                          <rect key={k} x="-14" y="-5" width="28" height="10" rx="4" className="pg-packet">
                            {motion(k, true)}
                          </rect>
                        ) : skin.packet === 'crate' ? (
                          <rect key={k} x="-7" y="-7" width="14" height="14" className="pg-packet">
                            {motion(k)}
                          </rect>
                        ) : (
                          <rect key={k} x="-4" y="-4" width="8" height="8" className="pg-packet">
                            {motion(k)}
                          </rect>
                        ),
                      )}
                      {skin.edge === 'sag' && (
                        <>
                          <circle cx={p.x} cy={p.y} r="6" className="pg-plug" />
                          <circle cx={q.x} cy={q.y} r="6" className="pg-plug" />
                        </>
                      )}
                      {flow > 0 && (edges.length <= 8 || sel?.id === ed.id) && (
                        <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 10} textAnchor="middle" className="pg-flow">
                          {fmtRps(flow)}/s
                        </text>
                      )}
                    </g>
                  )
                })}
                {link && pos[link.from] && (
                  <path d={`M${outPort(pos[link.from]).x},${pos[link.from].y} L${link.x},${link.y}`} className="pg-linking" />
                )}
              </svg>

              {nodes.map((nd) => {
                const p = pos[nd.id]
                const r = run.nodes[nd.id]
                const status = r?.status ?? 'idle'
                const info = BLOCKS[nd.block]
                return (
                  <div
                    key={nd.id}
                    data-status={status}
                    data-sel={sel?.id === nd.id || undefined}
                    className="pg-node"
                    style={{ left: pct(p.x - NODE_W / 2, CANVAS_W), top: pct(p.y - NODE_H / 2, CANVAS_H), width: pct(NODE_W, CANVAS_W), height: pct(NODE_H, CANVAS_H) }}
                    onPointerDown={(e) => startDrag(e, nd.id)}
                    title={r ? explainNode(r) : info.name}
                  >
                    {Deco && <Deco block={nd.block} status={status} util={r?.utilization ?? 0} dropped={r?.droppedRps ?? 0} />}
                    <span className="pg-node-main">
                      {icon(nd.block, 17)}
                      {skin.icon === 'tile' ? (
                        <span className="min-w-0 text-left">
                          <span className="pg-label block truncate">{info.short}</span>
                          <span className="block truncate font-mono text-[10px] text-muted">{nd.id}</span>
                        </span>
                      ) : (
                        <span className="pg-label">{info.short}</span>
                      )}
                    </span>
                    <span className="pg-util">
                      <i style={{ width: `${Math.min(1, r?.utilization ?? 0) * 100}%` }} />
                    </span>
                    {spofs.includes(nd.id) && <span className="pg-badge">SPOF</span>}
                    <span className="pg-port" onPointerDown={(e) => startLink(e, nd.id)} title="Drag to another block to connect" />
                  </div>
                )
              })}

              {toast && <div className="pg-toast">{toast}</div>}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-5">
            <div className={cn(skin.panel, 'space-y-3')}>
              <div className={skin.heading}>Traffic</div>
              <Slider label="Requests / s" value={rps} min={100} max={12000} step={100} onChange={setRps} display={rps.toLocaleString()} />
              <Slider label="Writes" value={writePct} min={0} max={50} step={1} onChange={setWritePct} display={`${writePct}%`} />
              <Slider label="Cache hit rate" value={cacheHit} min={0} max={99} step={1} onChange={setCacheHit} display={`${cacheHit}%`} />
            </div>

            <div className={cn(skin.panel, 'space-y-3')}>
              <div className="flex items-center justify-between">
                <span className={skin.heading}>Result</span>
                <span className={cn('pg-verdict', solved ? 'pg-verdict-ok' : 'pg-verdict-bad')}>{solved ? okWord : badWord}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Served" value={fmtRps(run.servedRps)} big={skin.big} />
                <Stat label="Errors" value={`${errPct < 10 ? errPct.toFixed(1) : Math.round(errPct)}%`} big={skin.big} bad={!goals[0].pass} />
                <Stat label="p99" value={`${run.p99Ms}`} unit="ms" big={skin.big} bad={!goals[1].pass} />
              </div>
              <ul className="space-y-1">
                {goals.map((g) => (
                  <li key={g.label} className={cn('pg-goal', g.pass ? 'pg-goal-ok' : 'pg-goal-bad')}>
                    {g.pass ? '✓' : '✕'} {g.label}
                  </li>
                ))}
              </ul>
              {(run.warnings.length > 0 || spofs.length > 0) && (
                <ul className="pg-warn space-y-1">
                  {run.warnings.slice(0, 3).map((w) => (
                    <li key={w}>! {w}</li>
                  ))}
                  {spofs.length > 0 && <li>! {spofs.length} single point(s) of failure. Kill one to see.</li>}
                </ul>
              )}
            </div>

            <div className={cn(skin.panel, 'space-y-3')}>
              <div className={skin.heading}>Inspector</div>
              {selNode ? (
                <>
                  <div>
                    <div className="pg-insp-title">{BLOCKS[selNode.block].name}</div>
                    <div className="pg-hint">{BLOCKS[selNode.block].tagline}</div>
                  </div>
                  {selResult && <p className="pg-insp-body">{explainNode(selResult)}</p>}
                  {selResult && (
                    <div className="pg-hint">
                      in {fmtRps(selResult.inRps)}/s · load {Math.round(selResult.utilization * 100)}%
                      {selResult.droppedRps > 0 && ` · dropping ${fmtRps(selResult.droppedRps)}/s`}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleKill(selNode.id)} className={cn(skin.btn, 'flex items-center gap-1.5', killed.includes(selNode.id) && skin.btnOn)}>
                      {killed.includes(selNode.id) ? <HeartPulse size={13} /> : <Skull size={13} />}
                      {killed.includes(selNode.id) ? 'Revive' : 'Kill it'}
                    </button>
                    {selNode.block !== 'client' && (
                      <button onClick={() => removeNode(selNode.id)} className={cn(skin.btn, 'flex items-center gap-1.5')}>
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>
                </>
              ) : selEdge ? (
                <>
                  <p className="pg-insp-body">
                    {BLOCKS[nodes.find((n) => n.id === selEdge.from)!.block].short} → {BLOCKS[nodes.find((n) => n.id === selEdge.to)!.block].short}:{' '}
                    {fmtRps(run.edges[selEdge.id] ?? 0)} req/s
                  </p>
                  <button onClick={removeSelected} className={cn(skin.btn, 'flex items-center gap-1.5')}>
                    <Trash2 size={13} /> Remove link
                  </button>
                </>
              ) : (
                <p className="pg-hint">Select a block to see why it’s green, hot or down. Kill one to test for single points of failure.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="pg-slider-label flex justify-between">
        <span>{props.label}</span>
        <b className="tabular-nums">{props.display}</b>
      </span>
      <input
        type="range"
        className="pg-range w-full"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  )
}

function Stat({ label, value, unit, big, bad }: { label: string; value: string; unit?: string; big: string; bad?: boolean }) {
  return (
    <div className={cn('pg-stat', bad && 'pg-stat-bad')}>
      <div className="pg-stat-label">{label}</div>
      <div className={cn(big, 'tabular-nums')}>
        {value}
        {unit && <span className="pg-stat-unit">{unit}</span>}
      </div>
    </div>
  )
}
