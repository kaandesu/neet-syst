import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useProgress } from '@/store/progress'

export function useResolvedTheme() {
  const theme = useProgress((s) => s.theme)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
}

/** Applies the theme to <html>. Mount once at the root. */
export function ThemeSync() {
  const resolved = useResolvedTheme()
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])
  return null
}

export function ThemeToggle() {
  const resolved = useResolvedTheme()
  const setTheme = useProgress((s) => s.setTheme)
  return (
    <button
      onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
      title="Toggle dark mode"
      aria-label="Toggle dark mode"
    >
      {resolved === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
