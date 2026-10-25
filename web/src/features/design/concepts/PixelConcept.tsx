import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { BLOCKS, CHAOS, CHAPTER, LEARNER, LESSONS, LESSONS_DONE, LESSONS_TOTAL, MENTOR, QUIZ } from '../mock'
import { useLiveMetrics, useTick } from '../useLive'
import type { ConceptProps } from '../useDesignParams'

/* ── Sprites: one char per pixel, mapped through PALETTE ─────────────────────────── */

const PALETTE: Record<string, string> = {
  '#': '#e8e6ff',
  g: '#7cff6b',
  a: '#ffb000',
  m: '#ff4fd8',
  c: '#4fd8ff',
  k: '#1b1d33',
}

const SPRITES = {
  server: ['##########', '#kkkkkkkk#', '#kggkkkkk#', '##########', '#kkkkkkkk#', '#kaakkkkk#', '##########', '#kkkkkkkk#', '#kggkkmmk#', '##########'],
  db: ['..######..', '.#cccccc#.', '#cccccccc#', '##cccccc##', '#k######k#', '#cccccccc#', '##cccccc##', '#k######k#', '#cccccccc#', '.########.'],
  bolt: ['.....aaaa.', '....aaaa..', '...aaaa...', '..aaaa....', '.aaaaaaaa.', '....aaaa..', '...aaaa...', '..aaa.....', '.aa.......', 'a.........'],
  globe: ['..######..', '.#cc#ccc#.', '#cc##cccc#', '#c####cc##', '##cc#cc###', '#cccc#cc##', '#ccc###cc#', '#cccc#ccc#', '.#ccccc##.', '..######..'],
  star: ['....aa....', '....aa....', '...aaaa...', 'aaaaaaaaaa', '.aaaaaaaa.', '..aaaaaa..', '..aa..aa..', '.aa....aa.', 'aa......aa', '..........'],
  lock: ['...####...', '..#....#..', '..#....#..', '.########.', '.#kkkkkk#.', '.#kk##kk#.', '.#kk##kk#.', '.#kkkkkk#.', '.########.', '..........'],
  heart: ['.mm...mm..', 'mmmm.mmmm.', 'mmmmmmmmm.', 'mmmmmmmmm.', '.mmmmmmm..', '..mmmmm...', '...mmm....', '....m.....', '..........', '..........'],
}

function Sprite({ name, px = 3, dim }: { name: keyof typeof SPRITES; px?: number; dim?: boolean }) {
  const rows = SPRITES[name]
  return (
    <span
      className="inline-grid shrink-0"
      style={{ gridTemplateColumns: `repeat(${rows[0].length}, ${px}px)`, gridAutoRows: px, filter: dim ? 'grayscale(1) brightness(.45)' : undefined }}
      aria-hidden
    >
      {rows.flatMap((row, y) => [...row].map((ch, x) => <span key={`${x}-${y}`} style={{ background: PALETTE[ch] ?? 'transparent' }} />))}
    </span>
  )
}

const BLOCK_SPRITE: Record<string, keyof typeof SPRITES> = {
  'Web server': 'server',
  Database: 'db',
  'Load balancer': 'server',
  Replica: 'db',
  Cache: 'bolt',
  CDN: 'globe',
  Queue: 'server',
  Shard: 'db',
}

/* ── ASCII architecture with a packet walking the main line ─────────────────────── */

const ASCII = [
  '┌────────┐    ┌──────┐    ┌────────┐    ┌───────┐',
  '│ CLIENT ├───▶│  LB  ├─┬─▶│ APP 01 ├─┬─▶│ CACHE │',
  '└────────┘    └──────┘ │  └────────┘ │  └───────┘',
  '                       │  ┌────────┐ │',
  '                       ├─▶│ APP 02 ├─┤',
  '                       │  └────────┘ │  ┌───────┐',
  '                       │  ┌────────┐ └─▶│  DB   │',
  '                       └─▶│ APP 03 ├───▶│ (pg)  │',
  '                          └────────┘    └───────┘',
]
const PACKET_PATH = [10, 11, 12, 22, 24, 36, 38]

function AsciiDiagram() {
  const t = useTick(160)
  const pos = PACKET_PATH[t % PACKET_PATH.length]
  return (
    <pre className="px-ascii overflow-x-auto">
      {ASCII.map((line, i) =>
        i === 1 ? (
          <div key={i}>
            {line.slice(0, pos)}
            <span className="px-packet">■</span>
            {line.slice(pos + 1)}
          </div>
        ) : (
          <div key={i}>{line || ' '}</div>
        ),
      )}
    </pre>
  )
}

const ROUTES = ['/learn/05', '/api/progress', '/collection', '/api/sim/run', '/learn/05/drill', '/api/timeline']

function LogTail() {
  const t = useTick(700)
  const lines = Array.from({ length: 6 }, (_, i) => {
    const n = t + i
    const ms = 8 + ((n * 37) % 90)
    const slow = ms > 80
    return { n, text: `GET ${ROUTES[n % ROUTES.length].padEnd(16)} → APP 0${(n % 3) + 1}  ${slow ? 'SLOW' : '200 '}  ${String(ms).padStart(3)}ms`, slow }
  })
  return (
    <div className="px-log">
      {lines.map((l) => (
        <div key={l.n} className={cn(l.slow && 'text-[var(--px-amber)]')}>
          <span className="opacity-50">#{String(4200 + l.n).padStart(5, '0')}</span> {l.text}
        </div>
      ))}
    </div>
  )
}

/* ── Bits ───────────────────────────────────────────────────────────────────────── */

function Segments({ value, max, n = 16, color }: { value: number; max: number; n?: number; color: string }) {
  const filled = Math.round((value / max) * n)
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-3 w-2.5" style={{ background: i < filled ? color : '#2a2d4a' }} />
      ))}
    </div>
  )
}

function useTypewriter(text: string, ms = 28) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), ms)
    return () => clearInterval(id)
  }, [text, ms])
  return { shown: text.slice(0, n), done: n >= text.length }
}

/* ── Concept ────────────────────────────────────────────────────────────────────── */

export function PixelConcept({ onPlay }: ConceptProps) {
  const m = useLiveMetrics(900)
  const [pick, setPick] = useState<number | null>(null)
  const [chaos, setChaos] = useState<string | null>(null)
  const mentor = useTypewriter(MENTOR.text)

  return (
    <div className="px-root min-h-full">
      <header className="px-bar">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <Sprite name="server" px={3} />
            <span className="px-title text-[14px]">NEET.SYS</span>
          </div>
          <nav className="px-h flex gap-4 text-[10px]">
            <a className="px-nav-on">▸MAP</a>
            <a>COLLECTION</a>
            <a>CREDITS</a>
          </nav>
          <div className="px-h ml-auto flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-2">
              <Sprite name="heart" px={2} /> ×{LEARNER.streak}
            </span>
            <span className="text-[var(--px-green)]">LV{String(LEARNER.level).padStart(2, '0')}</span>
            <span>P1 {LEARNER.name.toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-10 pb-32">
        {/* Hero */}
        <section className="grid items-end gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="px-h mb-4 text-[10px] text-[var(--px-magenta)]">
              WORLD {CHAPTER.number} · {CHAPTER.title.toUpperCase()}
            </div>
            <h1 className="px-title text-[22px] leading-[1.6] md:text-[30px]">
              LEARN SYSTEM DESIGN
              <br />
              BY BUILDING ONE<span className="px-cursor">_</span>
            </h1>
            <p className="mt-5 max-w-xl text-[22px] leading-tight text-[var(--px-dim)]">
              Every level starts with a problem your system can&apos;t handle. Unlock one block, beat the boss, keep the timeline.
            </p>
            <div className="mt-7 flex flex-wrap gap-5">
              <button onClick={onPlay} className="px-btn px-blink-slow">
                ▶ PRESS START
              </button>
              <button className="px-btn px-btn-ghost">CONTINUE · LV05</button>
            </div>
          </div>
          <div className="px-frame space-y-4 p-5">
            <div className="px-h flex justify-between text-[10px]">
              <span>EXP</span>
              <span>
                {LEARNER.xp}/{LEARNER.xpNext}
              </span>
            </div>
            <Segments value={LEARNER.xp} max={LEARNER.xpNext} color="var(--px-green)" />
            <div className="px-h flex justify-between text-[10px]">
              <span>WORLD 1</span>
              <span>
                {LESSONS_DONE}/{LESSONS_TOTAL} CLEAR
              </span>
            </div>
            <Segments value={LESSONS_DONE} max={LESSONS_TOTAL} n={12} color="var(--px-amber)" />
            <div className="text-[20px] text-[var(--px-dim)]">
              [{'█'.repeat(LESSONS_DONE * 2)}
              {'░'.repeat((LESSONS_TOTAL - LESSONS_DONE) * 2)}] {Math.round((LESSONS_DONE / LESSONS_TOTAL) * 100)}%
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
          {/* Level select */}
          <div className="px-frame p-5">
            <div className="px-h mb-4 text-[11px]">SELECT LEVEL</div>
            <ul className="space-y-1">
              {LESSONS.map((l) => (
                <li
                  key={l.id}
                  className={cn('px-level flex items-center gap-3 px-2 py-1.5', l.state === 'current' && 'px-level-on', l.state === 'locked' && 'opacity-45')}
                >
                  <Sprite name={l.state === 'done' ? 'star' : l.state === 'locked' ? 'lock' : 'bolt'} px={2} />
                  <span className="px-h w-12 text-[10px]">LV{l.id}</span>
                  <span className="flex-1 truncate text-[21px] leading-none">{l.title}</span>
                  <span className="px-h text-[8px]">{l.state === 'done' ? 'CLEAR' : l.state === 'current' ? 'GO!' : '----'}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sim window */}
          <div className="px-frame overflow-hidden">
            <div className="px-titlebar flex items-center justify-between px-4 py-2">
              <span className="px-h text-[10px]">SIM.EXE — LV05 BOSS: READ STORM</span>
              <span className="px-h text-[10px]">[_][□][X]</span>
            </div>
            <div className="space-y-4 p-5">
              <AsciiDiagram />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['REQ/S', m.rps.toLocaleString(), 'var(--px-green)'],
                  ['P99', `${m.p99}ms`, m.p99 > 250 ? 'var(--px-red)' : 'var(--px-cyan)'],
                  ['ERR', `${m.errors}%`, m.errors > 1.5 ? 'var(--px-red)' : 'var(--px-amber)'],
                  ['HIT', `${m.cacheHit}%`, 'var(--px-magenta)'],
                ].map(([k, v, c]) => (
                  <div key={k} className="px-stat p-2">
                    <div className="px-h text-[8px] text-[var(--px-dim)]">{k}</div>
                    <div className="text-[28px] leading-none" style={{ color: c }}>
                      {v}
                    </div>
                  </div>
                ))}
              </div>
              <LogTail />
              <div className="flex flex-wrap gap-3">
                {CHAOS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChaos(chaos === c.id ? null : c.id)}
                    className={cn('px-chip px-h text-[9px]', chaos === c.id && 'px-chip-on')}
                  >
                    {chaos === c.id ? '■' : '□'} {c.label.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mentor + quiz */}
        <section className="grid gap-8 lg:grid-cols-2">
          <div className="px-dialog relative flex flex-col justify-between gap-6 p-5">
            <div className="px-h absolute -top-3 left-4 bg-[var(--px-bg)] px-2 text-[10px] text-[var(--px-cyan)]">{MENTOR.name.toUpperCase()}</div>
            <p className="min-h-[5.5em] text-[24px] leading-[1.15]">
              {mentor.shown}
              {mentor.done && <span className="px-cursor ml-2">▼</span>}
            </p>
            <div className="px-h flex gap-8 text-[10px]">
              <span className="text-[var(--px-amber)]">▶ SHOW ME</span>
              <span className="text-[var(--px-dim)]">WHY?</span>
              <span className="text-[var(--px-dim)]">SKIP</span>
            </div>
          </div>
          <div className="px-frame p-5">
            <div className="px-h mb-3 text-[10px] text-[var(--px-amber)]">? QUESTION</div>
            <p className="mb-4 text-[24px] leading-[1.1]">{QUIZ.question}</p>
            <ul>
              {QUIZ.options.map((o, i) => {
                const result = pick === null ? null : i === QUIZ.correct ? 'ok' : i === pick ? 'bad' : null
                return (
                  <li key={o}>
                    <button
                      onClick={() => setPick(i)}
                      className={cn('px-option group flex w-full items-center gap-3 py-1 text-left text-[22px]', result === 'ok' && 'text-[var(--px-green)]', result === 'bad' && 'text-[var(--px-red)] line-through')}
                    >
                      <span className={cn('px-h w-4 text-[10px]', pick === i ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>▶</span>
                      {o}
                    </button>
                  </li>
                )
              })}
            </ul>
            {pick !== null && (
              <div className="px-h mt-4 text-[10px] leading-[1.8]">
                {pick === QUIZ.correct ? <span className="text-[var(--px-green)]">★ CRITICAL HIT! +50 EXP</span> : <span className="text-[var(--px-red)]">✕ MISS! TRY AGAIN</span>}
              </div>
            )}
          </div>
        </section>

        {/* Inventory */}
        <section className="px-frame p-5">
          <div className="px-h mb-4 flex justify-between text-[11px]">
            <span>INVENTORY</span>
            <span className="text-[var(--px-dim)]">
              {LESSONS_DONE}/{BLOCKS.length}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            {BLOCKS.map((b, i) => (
              <div key={b} className="px-slot flex flex-col items-center gap-2 p-3">
                <Sprite name={BLOCK_SPRITE[b]} px={4} dim={i >= LESSONS_DONE} />
                <span className="px-h text-center text-[7px] leading-[1.4]">{i < LESSONS_DONE ? b.toUpperCase() : '???'}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
