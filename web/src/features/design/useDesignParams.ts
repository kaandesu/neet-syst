import { useSearchParams } from 'react-router'

/** /design view state lives in the URL so any combination can be shared or reloaded. */
export function useDesignParams() {
  const [params, setParams] = useSearchParams()
  const set = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  return {
    concept: params.get('v'),
    setConcept: (id: string) => set('v', id),
    playing: params.get('mode') === 'play',
    setPlaying: (on: boolean) => set('mode', on ? 'play' : null),
  }
}

export type ConceptProps = { onPlay: () => void }
