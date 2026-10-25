import { useRef, useState, type MouseEvent } from 'react'
import { cn } from '@/lib/cn'
import { CHAOS, CHAPTER, EDGES, LEARNER, LESSONS, LESSONS_DONE, LESSONS_TOTAL, MENTOR, NODE_H, NODE_W, NODES, QUIZ, edgePath } from '../mock'
import { useLiveMetrics } from '../useLive'
import type { ConceptProps } from '../useDesignParams'

const LATENCY: Record<string, string> = { 'client-lb': '40 ms', 'lb-app2': '1 ms', 'app3-db': '4 ms', 'db-replica': 'async' }

function Stamp({ text, tone = 'red', className }: { text: string; tone?: 'red' | 'pencil'; className?: string }) {
  return <span className={cn('bp-stamp', tone === 'pencil' && 'bp-stamp-pencil', className)}>{text}</span>
}

function Drawing() {
  const db = NODES.find((n) => n.id === 'db')!
  return (
    <svg viewBox="-20 20 690 280" className="w-full">
      <defs>
        <pattern id="bp-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(255 255 255 / .35)" strokeWidth="1" />
        </pattern>
        <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9" fill="none" stroke="#fff" strokeWidth="1.2" />
        </marker>
        <marker id="bp-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M2,8 L8,2" stroke="#fff" strokeWidth="1.2" />
        </marker>
      </defs>

      {/* edges */}
      {EDGES.map(([a, b]) => (
        <path key={a + b} id={`bp-${a}-${b}`} d={edgePath(a, b)} fill="none" stroke="#fff" strokeWidth="1.2" markerEnd="url(#bp-arrow)" strokeDasharray={b === 'replica' ? '5 4' : undefined} />
      ))}
      {EDGES.map(([a, b], i) => (
        <rect key={`k${a}${b}`} x="-3" y="-3" width="6" height="6" fill="#fff">
          <animateMotion dur="2.4s" begin={`-${i * 0.31}s`} repeatCount="indefinite" path={edgePath(a, b)} />
        </rect>
      ))}

      {/* nodes */}
      {NODES.map((n, i) => (
        <g key={n.id} transform={`translate(${n.x - NODE_W / 2} ${n.y - NODE_H / 2})`}>
          <rect width={NODE_W} height={NODE_H} fill="#174a92" stroke="#fff" strokeWidth="1.4" />
          <rect width="14" height={NODE_H} fill="url(#bp-hatch)" stroke="#fff" strokeWidth="1" />
          <text x={NODE_W / 2 + 7} y={NODE_H / 2 + 4} textAnchor="middle" fontSize={n.label.length > 10 ? 8.5 : 10.5} fill="#fff" fontFamily="IBM Plex Mono" letterSpacing=".04em">
            {n.label.toUpperCase()}
          </text>
          <text x={NODE_W} y={-5} textAnchor="end" fontSize="8" fill="rgb(255 255 255 / .6)" fontFamily="IBM Plex Mono">
            {String.fromCharCode(65 + i)}-{String(i + 1).padStart(2, '0')}
          </text>
        </g>
      ))}

      {/* dimension lines */}
      {Object.entries(LATENCY).map(([k, label]) => {
        const [a, b] = k.split('-')
        const s = NODES.find((n) => n.id === a)!
        const t = NODES.find((n) => n.id === b)!
        const x1 = s.x + NODE_W / 2
        const x2 = t.x - NODE_W / 2
        const y = Math.max(s.y, t.y) + 34
        return (
          <g key={k} stroke="rgb(255 255 255 / .7)" strokeWidth=".8">
            <line x1={x1} y1={Math.max(s.y, t.y) + 20} x2={x1} y2={y + 5} />
            <line x1={x2} y1={t.y + 20} x2={x2} y2={y + 5} />
            <line x1={x1} y1={y} x2={x2} y2={y} markerStart="url(#bp-tick)" markerEnd="url(#bp-tick)" />
            <text x={(x1 + x2) / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#fff" stroke="none" fontFamily="IBM Plex Mono">
              {label}
            </text>
          </g>
        )
      })}

      {/* reviewer's pencil */}
      <ellipse cx={db.x} cy={db.y} rx="66" ry="30" fill="none" stroke="var(--bp-pencil)" strokeWidth="2" className="bp-draw" transform={`rotate(-6 ${db.x} ${db.y})`} />
      <path d={`M${db.x - 70},${db.y + 48} q-30,20 -70,24`} fill="none" stroke="var(--bp-pencil)" strokeWidth="1.8" className="bp-draw" />
      <text x={db.x - 290} y={db.y + 80} fill="var(--bp-pencil)" fontSize="22" fontFamily="Caveat" className="bp-write">
        92% reads, bottleneck!
      </text>
    </svg>
  )
}

export function BlueprintConcept({ onPlay }: ConceptProps) {
  const m = useLiveMetrics(1100)
  const [pick, setPick] = useState<number | null>(null)
  const [chaos, setChaos] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const xRef = useRef<HTMLDivElement>(null)
  const yRef = useRef<HTMLDivElement>(null)
  const readRef = useRef<HTMLDivElement>(null)

  // Crosshair is moved through refs so the page doesn't re-render on every mouse move.
  const onMove = (e: MouseEvent) => {
    const r = rootRef.current!.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    xRef.current!.style.transform = `translateX(${x}px)`
    yRef.current!.style.transform = `translateY(${y}px)`
    readRef.current!.style.transform = `translate(${x + 12}px, ${y + 12}px)`
    readRef.current!.textContent = `X ${String(Math.round(x)).padStart(4, '0')}  Y ${String(Math.round(y)).padStart(4, '0')}`
  }

  const spec = [
    ['THROUGHPUT', `${m.rps.toLocaleString()} req/s`, '≥ 10,000', m.rps >= 10000],
    ['LATENCY p99', `${m.p99} ms`, '≤ 250 ms', m.p99 <= 250],
    ['ERROR RATE', `${m.errors} %`, '≤ 1.0 %', m.errors <= 1],
    ['CACHE HIT', `${m.cacheHit} %`, '≥ 80 %', m.cacheHit >= 80],
  ] as const

  return (
    <div ref={rootRef} onMouseMove={onMove} className="bp-root relative min-h-full overflow-hidden">
      <div ref={xRef} className="bp-cross-x" />
      <div ref={yRef} className="bp-cross-y" />
      <div ref={readRef} className="bp-readout" />

      <header className="bp-line-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-stretch text-[11px] tracking-[0.14em] uppercase">
          <div className="bp-line-r flex items-center gap-3 py-3 pr-5 pl-4">
            <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
              <rect x="1" y="1" width="20" height="20" fill="none" stroke="#fff" />
              <circle cx="11" cy="11" r="5" fill="none" stroke="#fff" />
              <path d="M11 0v22M0 11h22" stroke="#fff" strokeWidth=".6" />
            </svg>
            <span className="font-semibold">neet/syst — drafting office</span>
          </div>
          <nav className="flex">
            {['Sheets', 'Inventory', 'Credits'].map((t, i) => (
              <a key={t} className={cn('bp-line-r flex items-center px-5 py-3', i === 0 ? 'bg-white/10' : 'text-white/60')}>
                {t}
              </a>
            ))}
          </nav>
          <div className="ml-auto hidden items-center px-4 text-white/60 sm:flex">DWG NS-01-05 · REV C</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-12 pb-32">
        {/* Hero */}
        <section className="grid items-end gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative">
            <div className="text-[11px] tracking-[0.3em] text-white/60 uppercase">
              Sheet 05 of {LESSONS_TOTAL} · Chapter {CHAPTER.number}: {CHAPTER.title}
            </div>
            <h1 className="bp-heading mt-4 text-[40px] leading-[1.02] md:text-[64px]">
              Learn system
              <br />
              design by
              <br />
              <span className="bp-outline">drafting one.</span>
            </h1>
            <div className="bp-hand pointer-events-none absolute top-6 right-0 hidden rotate-[-4deg] text-[26px] md:block">
              start here, {LEARNER.name} ↓
            </div>
            <p className="mt-6 max-w-lg text-[14px] leading-relaxed text-white/75">
              {CHAPTER.subtitle} Every decision goes into the revision history, so you can roll back to rev A and try the other path.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button onClick={onPlay} className="bp-btn bp-btn-solid">
                Open the drafting table →
              </button>
              <button className="bp-btn">View revisions</button>
            </div>
          </div>

          {/* Title block */}
          <table className="bp-table w-full text-[11px] uppercase">
            <tbody>
              <tr>
                <td colSpan={2} className="text-[15px] font-semibold tracking-[0.12em]">
                  Database replication
                </td>
              </tr>
              <tr>
                <td>
                  <span className="bp-k">Drawn by</span>
                  {LEARNER.name}
                </td>
                <td>
                  <span className="bp-k">Grade</span>LV {LEARNER.level} · {LEARNER.xp} XP
                </td>
              </tr>
              <tr>
                <td>
                  <span className="bp-k">Approved</span>
                  {LESSONS_DONE} / {LESSONS_TOTAL} sheets
                </td>
                <td>
                  <span className="bp-k">Streak</span>
                  {LEARNER.streak} days
                </td>
              </tr>
              <tr>
                <td>
                  <span className="bp-k">Scale</span>1 : 10,000,000 users
                </td>
                <td>
                  <span className="bp-k">Date</span>2026-10-24
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Drawing */}
        <section className="bp-frame relative p-6 pt-8">
          <div className="bp-zones-x">
            {['A', 'B', 'C', 'D', 'E', 'F'].map((z) => (
              <span key={z}>{z}</span>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] tracking-[0.14em] uppercase">
            <span>Fig. 5 — Read path, primary + replica</span>
            <span className="text-white/60">Simulated · live</span>
          </div>
          <Drawing />
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] tracking-[0.12em] uppercase">
            <span className="text-white/60">Load case:</span>
            {CHAOS.map((c) => (
              <button key={c.id} onClick={() => setChaos(chaos === c.id ? null : c.id)} className={cn('bp-btn bp-btn-sm', chaos === c.id && 'bp-btn-solid')}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-2">
          {/* Sheet index */}
          <div>
            <div className="mb-3 text-[11px] tracking-[0.3em] uppercase">Sheet index</div>
            <table className="bp-table w-full text-[12px]">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {LESSONS.map((l) => (
                  <tr key={l.id} className={cn(l.state === 'current' && 'bg-white/10', l.state === 'locked' && 'text-white/45')}>
                    <td className="w-12">{l.id}</td>
                    <td>{l.title}</td>
                    <td className="w-32">
                      {l.state === 'done' ? <Stamp text="Approved" /> : l.state === 'current' ? <Stamp text="In review" tone="pencil" /> : '— pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-10">
            {/* Spec sheet */}
            <div>
              <div className="mb-3 text-[11px] tracking-[0.3em] uppercase">Spec sheet</div>
              <table className="bp-table w-full text-[12px]">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Measured</th>
                    <th>Tolerance</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {spec.map(([k, v, tol, ok]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="tabular-nums">{v}</td>
                      <td className="text-white/60">{tol}</td>
                      <td className={cn('w-10 text-center', ok ? 'text-white' : 'text-[var(--bp-red)]')}>{ok ? '✓' : '✕'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Reviewer note */}
            <div className="bp-note relative">
              <div className="mb-1 text-[11px] tracking-[0.2em] text-white/60 uppercase">Reviewer: {MENTOR.name}</div>
              <p className="bp-hand text-[23px] leading-[1.15]">{MENTOR.text}</p>
            </div>
          </div>
        </section>

        {/* Change request */}
        <section className="bp-frame relative p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] tracking-[0.2em] uppercase">
            <span>Engineering change request · ECR-0517</span>
            <span className="text-white/60">Tick one</span>
          </div>
          <div className="mt-3 mb-5 text-[18px]">{QUIZ.question}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUIZ.options.map((o, i) => (
              <button key={o} onClick={() => setPick(i)} className="flex items-center gap-3 text-left text-[14px]">
                <span className="bp-check flex h-5 w-5 shrink-0 items-center justify-center">
                  {pick === i && <span className="bp-hand text-[26px] leading-none text-[var(--bp-pencil)]">✗</span>}
                </span>
                <span className={cn(pick !== null && i === QUIZ.correct && 'underline decoration-[var(--bp-pencil)] decoration-2 underline-offset-4')}>{o}</span>
              </button>
            ))}
          </div>
          {pick !== null && (
            <>
              <p className="bp-hand mt-5 text-[22px] text-[var(--bp-pencil)]">{QUIZ.why}</p>
              <Stamp
                key={pick}
                text={pick === QUIZ.correct ? 'Approved' : 'Rejected'}
                className="bp-stamp-big absolute top-16 right-8 text-[22px]"
              />
            </>
          )}
        </section>
      </main>
    </div>
  )
}
