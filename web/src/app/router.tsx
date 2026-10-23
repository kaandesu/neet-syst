import { createBrowserRouter, Outlet } from 'react-router'
import { CollectionPage } from '@/features/collection/CollectionPage'
import { LessonPage } from '@/features/lesson/LessonPage'
import { MapPage } from '@/features/map/MapPage'
import { UnlockOverlay } from '@/features/unlock/UnlockOverlay'
import { ThemeSync } from '@/ui/ThemeToggle'
import { CreditsPage } from './CreditsPage'

function Root() {
  return (
    <>
      <ThemeSync />
      <Outlet />
      <UnlockOverlay />
    </>
  )
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <MapPage /> },
      { path: '/learn/:lessonId/:section?', element: <LessonPage /> },
      { path: '/collection', element: <CollectionPage /> },
      { path: '/credits', element: <CreditsPage /> },
      { path: '*', element: <MapPage /> },
    ],
  },
])
