import { AppHeader } from './AppHeader'
import { useProgress } from '@/store/progress'
import { Button } from '@/ui/Button'

export function CreditsPage() {
  const reset = useProgress((s) => s.resetProgress)
  const devMode = useProgress((s) => s.devMode)
  const setDevMode = useProgress((s) => s.setDevMode)
  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-8 pb-24 text-[15px] leading-relaxed">
        <h1 className="text-2xl font-extrabold">Credits</h1>
        <section className="space-y-2">
          <h2 className="font-bold">System Design Primer</h2>
          <p className="text-muted">
            Parts of the lesson material (topic coverage, latency numbers, and the Pastebin and URL shortener breakdowns) are adapted from{' '}
            <a className="text-accent underline" href="https://github.com/donnemartin/system-design-primer" target="_blank" rel="noreferrer">
              The System Design Primer
            </a>{' '}
            by Donne Martin, licensed under{' '}
            <a className="text-accent underline" href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            . Changes: the material was rewritten as interactive, step-by-step lessons, condensed, and paired with original exercises and simulations.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-bold">Curriculum inspiration</h2>
          <p className="text-muted">
            The order of Chapter 1 follows the well-known “scale from zero to millions of users” progression popularized by Alex Xu’s{' '}
            <em>System Design Interview</em> (ByteByteGo). All lesson text here is original.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-bold">Open-source software</h2>
          <p className="text-muted">React, React Flow (MIT), Zustand (MIT), Motion (MIT), Tailwind CSS (MIT) and Lucide icons (ISC).</p>
        </section>
        <section className="space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <h2 className="font-bold">Your data</h2>
          <p className="text-sm text-muted">Progress and timelines are stored only in this browser.</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <input type="checkbox" checked={devMode} onChange={(e) => setDevMode(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
            <span>
              <span className="block text-sm font-bold">Debug mode</span>
              <span className="block text-[13px] text-muted">
                Opens every chapter, episode, section, shift and incident, offers every block, and adds a “Skip section” button. Your progress isn’t changed; turn it off to go back.
              </span>
            </span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              reset()
              localStorage.removeItem('neet-syst:runs')
              location.assign('/')
            }}
          >
            Reset all progress
          </Button>
        </section>
      </main>
    </div>
  )
}
