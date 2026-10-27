import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, useLocation } from 'react-router-dom'
import StudioPage from './features/studio/StudioPage'
const MentorPage = lazy(() => import('./features/mentor/MentorPage'))
function RoutedApp() {
  const location = useLocation()
  const knownRoute = location.pathname === '/' || location.pathname === '/mentor'
  return <>
    {knownRoute ? <StudioPage /> : <main className="p-8 text-center"><h1 className="text-2xl font-bold">Page not found</h1><Link className="mt-4 inline-block text-brand underline" to="/">Return to studio</Link></main>}
    {location.pathname === '/mentor' && <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f4f6fb] dark:bg-[#0b1020]"><Suspense fallback={<div className="p-6 text-center">Loading…</div>}><MentorPage /></Suspense></div>}
  </>
}
export default function App() { return <BrowserRouter><RoutedApp /></BrowserRouter> }
