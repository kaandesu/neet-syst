import { Braces, X } from 'lucide-react'
import { motion } from 'motion/react'
import { createPortal } from 'react-dom'
import type { Endpoint } from '@/engine/types'
import { EndpointEditor } from './EndpointEditor'

/** A service's endpoints, opened from the Inspector. Read-only when `onChange` is left out. */
export function ApiDialog({ name, api, onChange, onClose }: { name: string; api: Endpoint[]; onChange?: (api: Endpoint[]) => void; onClose: () => void }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-label={`${name} API`}
    >
      <div className="vn-modal max-h-full w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-4 shadow-card scrollbar-thin" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <Braces size={18} className="text-accent" />
          <h2 className="flex-1 text-[15px] font-extrabold">{name} · API</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <EndpointEditor value={api} readOnly={!onChange} onChange={(next) => onChange?.(next)} />
        <p className="mt-3 text-[12px] text-muted">
          Name the thing in the path, let the method say what happens. The toggles are promises: an idempotency key makes retries safe, pages keep lists small, limits stop scripts.
        </p>
      </div>
    </motion.div>,
    document.body,
  )
}
