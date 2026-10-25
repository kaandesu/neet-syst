import { ChevronRight, FastForward } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { SPEAKERS } from '@/content/voices'
import { RichText } from '@/ui/RichText'

const CHARS_PER_SECOND = 45

/** Types `text` out a few characters at a time; `finish` jumps to the end. */
function useTypewriter(text: string) {
  const plain = text.replace(/\*\*|\*|`/g, '')
  // Progress is stored with the text it belongs to, so a new line starts from zero without a reset.
  const [progress, setProgress] = useState({ of: plain, n: 0 })
  const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const shown = instant ? plain.length : progress.of === plain ? progress.n : 0
  useEffect(() => {
    if (instant) return
    const t = setInterval(() => setProgress((p) => (p.of !== plain ? { of: plain, n: 1 } : { of: plain, n: Math.min(p.n + 1, plain.length) })), 1000 / CHARS_PER_SECOND)
    return () => clearInterval(t)
  }, [plain, instant])
  return { typed: plain.slice(0, shown), done: shown >= plain.length, finish: () => setProgress({ of: plain, n: plain.length }) }
}

/**
 * A story moment: Ada stands over the whole stage and talks in a big speech bubble. The board
 * behind her is dimmed and can't be touched until she's done.
 */
export function Scene({ line, text, pose, onNext, onSkip }: { line: number; text: string; pose: string; onNext: () => void; onSkip: () => void }) {
  const { typed, done, finish } = useTypewriter(text)
  const advance = () => (done ? onNext() : finish())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      else if (e.key === 'Enter' || e.key === ' ') advance()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={advance}
      className="vn-scene fixed inset-x-0 top-14 bottom-0 z-[45] cursor-pointer overflow-hidden bg-black/45"
      role="dialog"
      aria-label={`${SPEAKERS.mentor.name} is talking`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSkip()
        }}
        className="vn-scene-skip absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-surface/90 px-2.5 py-1.5 text-[12.5px] font-semibold text-muted transition hover:text-ink"
      >
        <FastForward size={14} /> Skip intro
      </button>

      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="pointer-events-none absolute bottom-0 left-2 h-[min(82%,640px)] w-[clamp(240px,30vw,440px)]"
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={pose}
            src={pose}
            alt=""
            draggable={false}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 h-full w-full object-contain object-[0%_100%] drop-shadow-[6px_6px_0_rgb(0_0_0/0.35)]"
          />
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.08 }}
        className="vn-bubble absolute right-6 bottom-8 left-[calc(clamp(240px,30vw,440px)-4px)] min-h-40 rounded-3xl px-8 pt-5 pb-10"
        aria-live="polite"
      >
        <span className="vn-bubble-tail" aria-hidden />
        <div className="flex items-center gap-2">
          <span className="vn-nameplate rounded-md bg-accent px-2.5 py-0.5 text-[13px] font-bold text-accent-ink">{SPEAKERS.mentor.name}</span>
          <span className="text-[13px] opacity-60">{SPEAKERS.mentor.role}</span>
        </div>
        <p key={line} className="vn-bubble-line mt-3 text-[22px] leading-snug font-semibold" aria-hidden>
          {done ? <RichText text={text} /> : typed}
        </p>
        <p className="sr-only">{text}</p>
        <button
          autoFocus
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          className="vn-bubble-next absolute right-5 bottom-3 flex items-center gap-1 text-[13px] font-bold tracking-wide uppercase opacity-70 transition hover:opacity-100"
        >
          Continue <ChevronRight size={16} className={done ? 'animate-bounce' : 'opacity-40'} />
        </button>
      </motion.div>
    </motion.div>
  )
}
