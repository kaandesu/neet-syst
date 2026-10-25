import { Gauge, KeyRound, Layers, Lock, Plus, X, type LucideIcon } from 'lucide-react'
import { METHODS } from '@/engine/api/rules'
import type { Endpoint, HttpMethod } from '@/engine/types'
import { cn } from '@/lib/cn'

/** Method colours follow the usual API-docs convention so they read at a glance. */
const METHOD_TONE: Record<HttpMethod, string> = {
  GET: 'text-good',
  POST: 'text-accent',
  PUT: 'text-warn',
  PATCH: 'text-warn',
  DELETE: 'text-bad',
}

type Flag = 'idempotencyKey' | 'paginated' | 'auth' | 'rateLimited'

const FLAGS: { id: Flag; label: string; icon: LucideIcon; title: string }[] = [
  { id: 'idempotencyKey', label: 'Idem-Key', icon: KeyRound, title: 'Accepts an Idempotency-Key header: a retried call runs only once' },
  { id: 'paginated', label: 'Pages', icon: Layers, title: 'Returns one page at a time (cursor + limit)' },
  { id: 'auth', label: 'Login', icon: Lock, title: 'Caller must be logged in' },
  { id: 'rateLimited', label: 'Limit', icon: Gauge, title: 'Each caller gets a request budget; extra calls get 429' },
]

export const MAX_ENDPOINTS = 12

/** A small table of routes: method, path and the promises each one makes. */
export function EndpointEditor({ value, onChange, readOnly }: { value: Endpoint[]; onChange: (api: Endpoint[]) => void; readOnly?: boolean }) {
  const set = (i: number, patch: Partial<Endpoint>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <div className="space-y-1.5">
      {value.length === 0 && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">No endpoints yet.</p>}
      {value.map((e, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface-2 p-1.5" data-testid="endpoint-row">
          <select
            value={e.method}
            disabled={readOnly}
            onChange={(ev) => set(i, { method: ev.target.value as HttpMethod })}
            className={cn('h-8 rounded-lg border border-line bg-surface px-1.5 font-mono text-[12px] font-bold outline-none focus:border-accent', METHOD_TONE[e.method])}
            aria-label="HTTP method"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            value={e.path}
            readOnly={readOnly}
            onChange={(ev) => set(i, { path: ev.target.value.replace(/\s/g, '') })}
            placeholder="/v1/things/{id}"
            maxLength={80}
            spellCheck={false}
            className="h-8 min-w-0 flex-1 basis-40 rounded-lg border border-line bg-surface px-2 font-mono text-[12.5px] outline-none focus:border-accent"
            aria-label="Path"
          />
          <div className="flex items-center gap-1">
            {FLAGS.map((f) => {
              const on = !!e[f.id]
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={on}
                  title={f.title}
                  onClick={() => set(i, { [f.id]: !on || undefined })}
                  className={cn(
                    'flex h-7 items-center gap-1 rounded-lg px-1.5 text-[11px] font-bold transition',
                    on ? 'bg-accent text-accent-ink' : 'text-muted ring-1 ring-line hover:text-ink',
                  )}
                >
                  <f.icon size={11} /> {f.label}
                </button>
              )
            })}
            {!readOnly && (
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-lg p-1 text-muted hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${e.method} ${e.path}`}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {!readOnly && value.length < MAX_ENDPOINTS && (
        <button
          type="button"
          onClick={() => onChange([...value, { method: 'GET', path: '' }])}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-accent hover:bg-accent-soft"
        >
          <Plus size={13} /> Add endpoint
        </button>
      )}
    </div>
  )
}
