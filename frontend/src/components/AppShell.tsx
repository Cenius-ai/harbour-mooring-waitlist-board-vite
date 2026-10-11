import { Link, NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from '../auth/AuthContext'
import { AnchorIcon, ClipboardIcon, GaugeIcon, QueueIcon, SignOutIcon } from './icons'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: <GaugeIcon />, end: true },
  { to: '/buoys', label: 'Buoys', icon: <AnchorIcon />, end: false },
  { to: '/waitlist', label: 'Waitlist', icon: <QueueIcon />, end: false },
  { to: '/inspections', label: 'Inspections', icon: <ClipboardIcon />, end: false },
]

interface AppShellProps {
  /** Rendered instead of the router outlet (used by the signed-in home route). */
  children?: ReactNode
}

/** The signed-in chrome: sidebar navigation, identity and sign-out. */
export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell" data-testid="app-shell">
      <nav className="app-nav" aria-label="Sections">
        <Link to="/dashboard" className="app-nav__brand">
          <AnchorIcon className="app-nav__mark" />
          <span>
            <span className="app-nav__name">Harbour Mooring Board</span>
            <span className="app-nav__tag">Waitlist &amp; inspections</span>
          </span>
        </Link>

        <ul className="app-nav__links">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className="app-nav__link">
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="app-nav__foot">
          <span className="app-nav__user">
            <strong>{user?.full_name ?? 'Signed in'}</strong>
            <span>{user?.email ?? ''}</span>
          </span>
          <button type="button" className="btn btn--sm" onClick={() => void signOut()}>
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </nav>

      <main className="app-main">
        <div className="app-main__inner">{children ?? <Outlet />}</div>
      </main>
    </div>
  )
}
