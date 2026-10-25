import { createBrowserRouter, Outlet } from 'react-router'
import { CollectionPage } from '@/features/collection/CollectionPage'
import { DesignPage } from '@/features/design/DesignPage'
import { LessonPage } from '@/features/lesson/LessonPage'
import { MapPage } from '@/features/map/MapPage'
import { ProblemListPage } from '@/features/problems/ProblemListPage'
import { ProblemPage } from '@/features/problems/ProblemPage'
import { SandboxPage } from '@/features/sandbox/SandboxPage'
import { ShiftPage } from '@/features/shift/ShiftPage'
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
      { path: '/shift/:shiftId', element: <ShiftPage /> },
      { path: '/problems', element: <ProblemListPage /> },
      { path: '/problems/:problemId', element: <ProblemPage /> },
      { path: '/collection', element: <CollectionPage /> },
      { path: '/sandbox', element: <SandboxPage /> },
      { path: '/credits', element: <CreditsPage /> },
      { path: '/design', element: <DesignPage /> },
      { path: '*', element: <MapPage /> },
    ],
  },
])
