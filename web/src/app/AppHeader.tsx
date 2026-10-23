import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/ui/ThemeToggle'

export function AppHeader() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('rounded-xl px-3 py-1.5 text-sm font-semibold transition', isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink')
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <NavLink to="/" className="mr-3 flex items-center gap-2 text-[17px] font-extrabold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent font-mono text-sm text-accent-ink">ns</span>
          neet<span className="-mx-1.5 text-accent">·</span>syst
        </NavLink>
        <NavLink to="/" end className={link}>
          Learn
        </NavLink>
        <NavLink to="/collection" className={link}>
          Collection
        </NavLink>
        <NavLink to="/credits" className={link}>
          Credits
        </NavLink>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
