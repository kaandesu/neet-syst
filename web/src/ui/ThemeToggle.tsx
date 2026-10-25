import { Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { cn } from '@/lib/cn'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useProgress, type Skin } from '@/store/progress'

/** Pixel fonts load only while a skin needs them. */
const SKIN_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap'

export const SKIN_OPTIONS: { id: Skin; name: string; swatch: string[] }[] = [
  { id: 'current', name: 'Current', swatch: ['#f7f5f0', '#5b4fe0', '#1f9d63'] },
  { id: 'pixel', name: 'NEET.SYS', swatch: ['#10121c', '#7cff6b', '#ffb000'] },
  { id: 'factory', name: 'Factory', swatch: ['#4a7c3a', '#74512f', '#ffb000'] },
]

/**
 * The one skin the app ships with for now. The others stay in the code (and in /design) but can't be
 * picked, so new UI only has to be designed for this one.
 */
export const APP_SKIN: Skin = 'factory'

/** The skin in effect. The /design lab previews skins itself, so the app skin stays off there. */
export function useSkin(): Skin {
  return useLocation().pathname.startsWith('/design') ? 'current' : APP_SKIN
}

export function useResolvedTheme() {
  const theme = useProgress((s) => s.theme)
  const skin = useSkin()
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  // The pixel skins are dark by design, so `dark:` styles and `light-dark()` follow them.
  if (skin !== 'current') return 'dark'
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
}

/** Applies the theme and skin to <html>. Mount once at the root. */
export function ThemeSync() {
  const resolved = useResolvedTheme()
  const skin = useSkin()
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])
  useEffect(() => {
    document.documentElement.dataset.skin = skin
    if (skin === 'current') return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = SKIN_FONTS_HREF
    document.head.appendChild(link)
    return () => link.remove()
  }, [skin])
  return null
}

export function ThemeToggle() {
  const resolved = useResolvedTheme()
  const setTheme = useProgress((s) => s.setTheme)
  const skin = useSkin()
  // Pixel skins have one fixed palette, so light/dark doesn't apply.
  if (skin !== 'current') return null
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

export function SkinPicker() {
  const skin = useProgress((s) => s.skin)
  const setSkin = useProgress((s) => s.setSkin)
  return (
    <div role="radiogroup" aria-label="App skin" className="skin-picker flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5">
      {SKIN_OPTIONS.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={skin === o.id}
          onClick={() => setSkin(o.id)}
          title={`${o.name} skin`}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition',
            skin === o.id ? 'skin-picker-on bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
          )}
        >
          <span className="flex overflow-hidden rounded-[3px] ring-1 ring-line">
            {o.swatch.map((c) => (
              <span key={c} className="h-3 w-1.5" style={{ background: c }} />
            ))}
          </span>
          <span className="hidden sm:inline">{o.name}</span>
        </button>
      ))}
    </div>
  )
}
