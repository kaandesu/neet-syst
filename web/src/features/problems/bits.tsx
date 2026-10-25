import { Star } from 'lucide-react'
import type { Difficulty } from '@/engine/problems/types'

export const DIFFICULTY: Record<Difficulty, { label: string; className: string }> = {
  easy: { label: 'Easy', className: 'text-good' },
  medium: { label: 'Medium', className: 'text-warn' },
  hard: { label: 'Hard', className: 'text-bad' },
}

export function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < n ? 'fill-accent text-accent' : 'text-line'} />
      ))}
    </span>
  )
}
