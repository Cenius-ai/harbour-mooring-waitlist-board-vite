/**
 * Thin fetch wrapper for the JSON API.
 *
 * Every call is same-origin (nginx in the container, the Vite proxy in
 * development) so the HttpOnly session cookie travels automatically. A 401
 * anywhere broadcasts an event the auth provider listens for, which is what
 * turns an expired session into a return trip to the sign-in screen.
 */

import type {
  Bay,
  Buoy,
  BuoyInput,
  Inspection,
  InspectionInput,
  Overview,
  StaffUser,
  WaitlistEntry,
  WaitlistInput,
} from './types'

export const UNAUTHORIZED_EVENT = 'harbour:unauthorized'

export class ApiRequestError extends Error {
  readonly status: number
  readonly errors: Record<string, string>

  constructor(status: number, message: string, errors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.errors = errors
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Skip the global 401 broadcast (used by the session probe). */
  silent401?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, silent401 = false } = options

  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'include',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError(
      0,
      'The harbour service could not be reached. Check your connection and try again.',
    )
  }

  if (response.status === 401 && !silent401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const data = (payload ?? {}) as { message?: string; errors?: Record<string, string> }
    const message =
      typeof data.message === 'string' && data.message
        ? data.message
        : `Request failed (${response.status})`
    throw new ApiRequestError(response.status, message, data.errors ?? {})
  }

  return payload as T
}

export type BuoyQuery = {
  bay_id?: number | null
  size_class?: string
  status?: string
  q?: string
}

export type WaitlistQuery = {
  size_class?: string
  status?: string
  q?: string
}

export type InspectionQuery = {
  year?: number | null
  buoy_id?: number | null
}

function queryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export const api = {
  login: (email: string, password: string) =>
    request<StaffUser>('/api/auth/login', { method: 'POST', body: { email, password } }),

  me: () => request<StaffUser>('/api/auth/me', { silent401: true }),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  bays: () => request<Bay[]>('/api/bays'),

  buoys: (query: BuoyQuery = {}) => request<Buoy[]>(`/api/buoys${queryString({ ...query })}`),

  buoy: (id: number) => request<Buoy>(`/api/buoys/${id}`),

  createBuoy: (input: BuoyInput) => request<Buoy>('/api/buoys', { method: 'POST', body: input }),

  updateBuoy: (id: number, input: Partial<BuoyInput>) =>
    request<Buoy>(`/api/buoys/${id}`, { method: 'PATCH', body: input }),

  deleteBuoy: (id: number) => request<void>(`/api/buoys/${id}`, { method: 'DELETE' }),

  waitlist: (query: WaitlistQuery = {}) =>
    request<WaitlistEntry[]>(`/api/waitlist${queryString({ ...query })}`),

  createWaitlistEntry: (input: WaitlistInput) =>
    request<WaitlistEntry>('/api/waitlist', { method: 'POST', body: input }),

  updateWaitlistEntry: (id: number, input: Partial<WaitlistInput>) =>
    request<WaitlistEntry>(`/api/waitlist/${id}`, { method: 'PATCH', body: input }),

  deleteWaitlistEntry: (id: number) => request<void>(`/api/waitlist/${id}`, { method: 'DELETE' }),

  inspections: (query: InspectionQuery = {}) =>
    request<Inspection[]>(`/api/inspections${queryString({ ...query })}`),

  createInspection: (input: InspectionInput) =>
    request<Inspection>('/api/inspections', { method: 'POST', body: input }),

  updateInspection: (id: number, input: Partial<InspectionInput>) =>
    request<Inspection>(`/api/inspections/${id}`, { method: 'PATCH', body: input }),

  deleteInspection: (id: number) => request<void>(`/api/inspections/${id}`, { method: 'DELETE' }),

  overview: () => request<Overview>('/api/overview'),
}
