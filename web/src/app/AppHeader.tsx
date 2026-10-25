import { FlaskConical } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'
import { useProgress } from '@/store/progress'
import { ThemeToggle } from '@/ui/ThemeToggle'

export function AppHeader() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition', isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink')
  return (
    <header className="app-header sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <NavLink to="/" className="app-brand mr-3 flex shrink-0 items-center gap-2 text-[17px] font-extrabold tracking-tight">
          <img src="/neetsyst-logo.webp" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <span className="hidden sm:inline">
            neet<span className="mx-1 text-accent">·</span>syst
          </span>
        </NavLink>
        {/* On narrow screens the links scroll sideways instead of widening the page. */}
        <nav className="flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          <NavLink to="/" end className={link}>
            Story
          </NavLink>
          <NavLink to="/problems" className={link}>
            Problems
          </NavLink>
          <NavLink to="/collection" className={link}>
            Collection
          </NavLink>
          <NavLink to="/sandbox" className={link}>
            Sandbox
          </NavLink>
          <NavLink to="/credits" className={link}>
            Credits
          </NavLink>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <DevToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

/** Testing aid: unlocks every lesson and section. Shown in dev builds, or in any build after visiting `/?dev=1`. */
function DevToggle() {
  const devMode = useProgress((s) => s.devMode)
  const setDevMode = useProgress((s) => s.setDevMode)
  useEffect(() => {
    const flag = new URLSearchParams(location.search).get('dev')
    if (flag !== null) setDevMode(flag !== '0')
  }, [setDevMode])
  if (!import.meta.env.DEV && !devMode) return null
  return (
    <button
      role="switch"
      aria-checked={devMode}
      onClick={() => setDevMode(!devMode)}
      title="Dev mode: unlock every lesson and section, show “Skip section”"
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition',
        devMode ? 'bg-warn text-accent-ink' : 'text-muted ring-1 ring-warn/50 ring-inset hover:text-warn',
      )}
    >
      <FlaskConical size={14} /> Dev
    </button>
  )
}
