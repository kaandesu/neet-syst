import { AnimatePresence, motion } from 'motion/react'
import { Sparkles } from 'lucide-react'
import { ConceptCard } from '@/features/mentor/ConceptCard'
import { useProgress } from '@/store/progress'
import { Button } from '@/ui/Button'

/** The "new block unlocked!" moment, shown once per block. */
export function UnlockOverlay() {
  const pending = useProgress((s) => s.pendingUnlocks)
  const ack = useProgress((s) => s.ackUnlock)
  const block = pending[0]
  return (
    <AnimatePresence>
      {block && (
        <motion.div
          key={block}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -6, y: 40 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="w-full max-w-sm"
          >
            <div className="mb-3 flex items-center justify-center gap-2 text-lg font-extrabold text-white">
              <Sparkles size={20} /> New block unlocked!
            </div>
            <ConceptCard block={block} compact />
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <Button onClick={ack} autoFocus>
                {pending.length > 1 ? `Nice! (${pending.length - 1} more)` : 'Add to my collection'}
              </Button>
              <span className="text-xs text-white/70">It will now appear in your palette when a level calls for it.</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
