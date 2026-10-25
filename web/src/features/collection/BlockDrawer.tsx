import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { BLOCKS } from '@/content/blocks'
import type { BlockId } from '@/engine/types'
import { ConceptCard } from '@/features/mentor/ConceptCard'
import { cn } from '@/lib/cn'

/** The full trading card: a side drawer on wide screens, a bottom sheet on narrow ones. */
export function BlockDrawer({ block, onClose }: { block: BlockId | null; onClose: () => void }) {
  return (
    <Drawer label={block ? BLOCKS[block].name : ''} open={!!block} onClose={onClose}>
      {block && <ConceptCard block={block} />}
    </Drawer>
  )
}

export function Drawer({ label, open, onClose, children, wide }: { label: string; open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="drawer" className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-bg/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label={label}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            className={cn(
              'absolute overflow-y-auto bg-bg p-4 shadow-card scrollbar-thin',
              'inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl',
              'sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:rounded-none sm:border-l sm:border-line',
              wide ? 'sm:w-[560px]' : 'sm:w-[420px]',
            )}
          >
            <div className="mb-2 flex justify-end">
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
