import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, UNAUTHORIZED_EVENT } from '../api/client'
import type { StaffUser } from '../api/types'

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  user: StaffUser | null
  signIn: (email: string, password: string) => Promise<StaffUser>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<StaffUser | null>(null)

  // Resolve the session once on mount: a surviving HttpOnly cookie means a hard
  // reload of any route stays signed in.
  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then((staff) => {
        if (cancelled) return
        setUser(staff)
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A 401 from any request means the session is gone: drop straight back to the
  // sign-in screen instead of leaving stale data on screen.
  useEffect(() => {
    const handle = () => {
      setUser(null)
      setStatus('anonymous')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handle)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handle)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const staff = await api.login(email, password)
    setUser(staff)
    setStatus('authenticated')
    return staff
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Clearing the local state is the important half; the cleared cookie is
      // re-sent on the next launch.
    }
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
