import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { evaluateApi, ruleLabel, type ApiRuleResult } from '@/engine/api/rules'
import type { Step, StepAnswer } from '@/engine/lesson/types'
import type { Endpoint } from '@/engine/types'
import { Bubble } from '@/features/mentor/cards'
import type { MissKind } from '@/store/progress'
import { Button } from '@/ui/Button'
import { RichText } from '@/ui/RichText'
import { EndpointEditor } from './EndpointEditor'

/** Write a service's endpoints, then check them against the step's rules. */
export function ApiCard({
  step,
  api,
  serviceName,
  answer,
  active,
  onChange,
  onDone,
  onMiss,
}: {
  step: Extract<Step, { t: 'api' }>
  api: Endpoint[]
  serviceName: string
  answer?: StepAnswer
  active: boolean
  onChange: (api: Endpoint[]) => void
  onDone: (a: StepAnswer) => void
  onMiss?: (k: MissKind) => void
}) {
  const [attempts, setAttempts] = useState(answer?.t === 'api' ? answer.attempts : 0)
  const [results, setResults] = useState<ApiRuleResult[] | null>(null)
  const passed = !!results && results.every((r) => r.pass)

  const check = () => {
    const r = evaluateApi(api, step.rules)
    setResults(r)
    setAttempts(attempts + 1)
    if (!r.every((x) => x.pass)) onMiss?.('api')
  }

  return (
    <Bubble tone={active ? 'task' : 'mentor'} className="w-full">
      <div className="mb-2 text-[11px] font-bold tracking-wider text-accent uppercase">API · {serviceName}</div>
      <div className="font-semibold">
        <RichText text={step.text} />
      </div>
      <div className="mt-3">
        <EndpointEditor
          value={api}
          readOnly={!active || passed}
          onChange={(next) => {
            setResults(null)
            onChange(next)
          }}
        />
      </div>
      <ul className="mt-3 space-y-1 text-[13px]" aria-label="Checks">
        {step.rules.map((rule, i) => {
          const r = results?.[i]
          return (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0">
                {!r ? <span className="block h-3.5 w-3.5 rounded-full ring-2 ring-line" /> : r.pass ? <Check size={15} className="text-good" /> : <X size={15} className="text-bad" />}
              </span>
              <div className="min-w-0">
                <RichText text={ruleLabel(rule)} />
                {r && !r.pass && r.why && (
                  <div className="text-[12px] text-bad">
                    <RichText text={r.why} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {active && (
        <div className="mt-3 flex items-center gap-2">
          {passed ? (
            <Button size="sm" variant="good" autoFocus onClick={() => onDone({ t: 'api', attempts })}>
              <Check size={15} /> Ship it
            </Button>
          ) : (
            <Button size="sm" onClick={check} disabled={!api.length}>
              Check my API
            </Button>
          )}
          {passed && <span className="text-[13px] font-semibold text-good">Every check passes.</span>}
        </div>
      )}
    </Bubble>
  )
}
