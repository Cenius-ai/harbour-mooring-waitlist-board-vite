import { useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { ApiRequestError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PasswordField, TextField } from '../components/Field'
import { BrandMark } from '../components/icons'

export const DEMO_EMAIL = 'cenius@cenius.ai'
export const DEMO_PASSWORD = 'cenius'
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface LocationState {
  from?: string
}

function validateCredentials(email: string, password: string): Record<string, string> {
  const found: Record<string, string> = {}
  const trimmed = email.trim()
  if (!trimmed) {
    found.email = 'Email is required'
  } else if (!EMAIL_PATTERN.test(trimmed)) {
    found.email = 'Enter a valid email address'
  }
  if (!password) found.password = 'Password is required'
  return found
}

export function LoginScreen() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const state = (location.state ?? {}) as LocationState
  const requestedPath = state.from && state.from !== '/login' ? state.from : '/dashboard'

  if (status === 'authenticated') {
    return <Navigate to={requestedPath} replace />
  }

  const submit = async (
    event: React.FormEvent | null,
    credentials?: { email: string; password: string },
  ) => {
    event?.preventDefault()
    // Re-entrancy guard: a double click cannot fire two sign-in requests.
    if (submitting) return
    setFormError(null)

    const candidate = credentials ?? { email, password }
    const found = validateCredentials(candidate.email, candidate.password)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      // Nothing is sent - the rules are shown before a request is made.
      return
    }

    setSubmitting(true)
    try {
      await signIn(candidate.email.trim(), candidate.password)
      navigate(requestedPath, { replace: true })
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : 'Sign-in failed. Please try again.'
      setFormError(message)
      // Focus returns to the password field; nothing else on the card changes.
      passwordRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card ticked" data-active="true">
        <div className="auth__brand">
          <BrandMark />
          <div>
            <h1 className="auth__title">Harbour Mooring Board</h1>
            <p className="auth__purpose">
              Buoys by bay, the owner waitlist per mooring size, and annual inspections.
            </p>
          </div>
        </div>

        <form className="auth__form" onSubmit={(event) => void submit(event)} noValidate>
          {formError ? (
            <div className="error-banner" role="alert">
              <div className="error-banner__text">
                <span className="error-banner__title">{formError}</span>
              </div>
            </div>
          ) : null}

          <TextField
            id="login-email"
            name="email"
            label="Staff email"
            type="email"
            required
            value={email}
            onChange={setEmail}
            error={errors.email}
            autoComplete="username"
            disabled={submitting}
            placeholder="you@harbourpoint.example"
          />

          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            disabled={submitting}
            inputRef={(element) => {
              passwordRef.current = element
            }}
          />

          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="auth__hint">
          <p>
            Demo: <strong>cenius@cenius.ai</strong> / <strong>cenius</strong>
          </p>
          <button
            type="button"
            className="btn btn--sm"
            disabled={submitting}
            onClick={() => void submit(null, { email: DEMO_EMAIL, password: DEMO_PASSWORD })}
          >
            Sign in with the demo account
          </button>
          <p>
            Staff accounts are created by the harbour office. Boat owners do not sign in here —
            they are added to the board by staff.
          </p>
        </div>
      </div>
    </div>
  )
}
