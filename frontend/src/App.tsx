import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './auth/AuthContext'
import { AppShell } from './components/AppShell'
import { BuoyDetailScreen } from './screens/BuoyDetailScreen'
import { BuoyRegisterScreen } from './screens/BuoyRegisterScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { InspectionsScreen } from './screens/InspectionsScreen'
import { LandingScreen } from './screens/LandingScreen'
import { LoginScreen } from './screens/LoginScreen'
import { NotFoundScreen } from './screens/NotFoundScreen'
import { WaitlistScreen } from './screens/WaitlistScreen'

const TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/login/, title: 'Staff sign in' },
  { pattern: /^\/buoys\/\d+/, title: 'Mooring detail' },
  { pattern: /^\/buoys/, title: 'Buoy register' },
  { pattern: /^\/waitlist/, title: 'Owner waitlist' },
  { pattern: /^\/inspections/, title: 'Inspections ledger' },
  { pattern: /^\/dashboard/, title: 'Harbour overview' },
]

function RouteTitle() {
  const location = useLocation()
  useEffect(() => {
    const match = TITLES.find((entry) => entry.pattern.test(location.pathname))
    const section = match ? match.title : 'Harbour overview'
    document.title = `${section} · Harbour Mooring Board`
  }, [location.pathname])
  return null
}

/** First paint while the session cookie is being resolved. */
function SessionSplash() {
  return (
    <div className="auth">
      <div className="auth__card">
        <div className="skeleton-stack" role="status" aria-live="polite">
          <span className="visually-hidden">Checking your session</span>
          <span className="skeleton" style={{ height: '2rem', width: '60%' }} />
          <span className="skeleton" style={{ height: '4rem', width: '100%' }} />
        </div>
      </div>
    </div>
  )
}

/** Every signed-in route sits behind the session; anonymous visitors go to /login
 * and are returned to what they originally asked for once they are in. */
function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <SessionSplash />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}

/** `/` is the public landing for visitors and the harbour overview when signed in. */
function HomeRoute() {
  const { status } = useAuth()

  if (status === 'checking') return <SessionSplash />
  if (status === 'anonymous') return <LandingScreen />
  return (
    <AppShell>
      <DashboardScreen />
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteTitle />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<HomeRoute />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/buoys" element={<BuoyRegisterScreen />} />
              <Route path="/buoys/:buoyId" element={<BuoyDetailScreen />} />
              <Route path="/waitlist" element={<WaitlistScreen />} />
              <Route path="/inspections" element={<InspectionsScreen />} />
              <Route path="*" element={<NotFoundScreen />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
