import { useEffect, useRef } from 'react'

/** Size of one steel plate; the layer only ever shifts by less than this, so it never runs out. */
const PLATE = 112
/** How fast the floor drifts compared with the page. */
const RATE = 0.4

/**
 * The factory skin's background: steel plates that drift slower than the page (parallax), under a fixed lamp glow.
 * The transform is set straight from the scroll event, so it lands in the same frame as the scroll.
 */
export function FactoryFloor() {
  const floor = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = floor.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onScroll = () => {
      el.style.transform = `translate3d(0, ${-((window.scrollY * RATE) % PLATE)}px, 0)`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <>
      <div ref={floor} className="factory-floor" style={{ ['--plate' as string]: `${PLATE}px` }} aria-hidden />
      <div className="factory-light" aria-hidden />
    </>
  )
}
