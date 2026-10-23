import { Fragment } from 'react'

/** Renders the tiny markdown subset used in lesson text: **bold**, *italic*, `code`. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
        if (p.startsWith('`') && p.endsWith('`'))
          return (
            <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">
              {p.slice(1, -1)}
            </code>
          )
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>
        return <Fragment key={i}>{p}</Fragment>
      })}
    </>
  )
}
