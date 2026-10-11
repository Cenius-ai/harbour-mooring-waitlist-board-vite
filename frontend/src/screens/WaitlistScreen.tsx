import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ApiRequestError, api } from '../api/client'
import type { SizeClass, WaitlistEntry, WaitlistStatus } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { ConfirmDialog } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { SkeletonRows } from '../components/Skeleton'
import { StatusPill } from '../components/StatusPill'
import { WaitlistFormDialog } from '../components/WaitlistFormDialog'
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import { formatDate, formatDays, formatMetres, statusLabel } from '../lib/format'

const SIZES: SizeClass[] = ['S', 'M', 'L']
const SIZE_TITLE: Record<SizeClass, string> = {
  S: 'Small craft',
  M: 'Medium',
  L: 'Large',
}
const STATUS_OPTIONS: WaitlistStatus[] = ['waiting', 'placed', 'withdrawn']

interface DialogState {
  entry?: WaitlistEntry
  sizeClass?: SizeClass
}

export function WaitlistScreen() {
  const [params, setParams] = useSearchParams()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<WaitlistEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined)
  const [busyId, setBusyId] = useState<number | null>(null)

  const sizeFilter = params.get('size_class') ?? ''
  const statusFilter = params.get('status') ?? ''
  const search = params.get('q') ?? ''

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await api.waitlist({
        size_class: sizeFilter || undefined,
        status: statusFilter || undefined,
        q: search || undefined,
      })
      setEntries(next)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'The waitlist could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [sizeFilter, statusFilter, search])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    const map: Record<SizeClass, WaitlistEntry[]> = { S: [], M: [], L: [] }
    entries.forEach((entry) => {
      map[entry.size_class].push(entry)
    })
    return map
  }, [entries])

  // The longest-waiting entry in each group is the one with the lowest position
  // among the waiting rows.
  const flagged = useMemo(() => {
    const result: Record<string, number | null> = { S: null, M: null, L: null }
    SIZES.forEach((size) => {
      const waiting = groups[size].filter((entry) => entry.status === 'waiting')
      if (waiting.length > 0) {
        result[size] = waiting.reduce((best, entry) =>
          (entry.position ?? Number.MAX_SAFE_INTEGER) < (best.position ?? Number.MAX_SAFE_INTEGER)
            ? entry
            : best,
        ).id
      }
    })
    return result
  }, [groups])

  const changeStatus = async (entry: WaitlistEntry, status: WaitlistStatus) => {
    if (busyId !== null) return
    setBusyId(entry.id)
    try {
      await api.updateWaitlistEntry(entry.id, { status })
      await load()
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'The status could not be changed.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await api.deleteWaitlistEntry(pendingDelete.id)
      setPendingDelete(null)
      await load()
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiRequestError ? caught.message : 'The entry could not be removed.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const filtered = Boolean(sizeFilter || statusFilter || search)
  const visibleSizes = sizeFilter ? (SIZES.filter((size) => size === sizeFilter) as SizeClass[]) : SIZES
  const waitingCount = entries.filter((entry) => entry.status === 'waiting').length

  return (
    <>
      <PageHeader
        title="Owner waitlist"
        subtitle={`${waitingCount} owner${waitingCount === 1 ? '' : 's'} waiting · queues are ordered by joining date, oldest first`}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setDialog({})}>
            <PlusIcon />
            Add owner
          </button>
        }
      />

      <section className="panel" aria-label="Filters">
        <div className="toolbar">
          <div className="toolbar__field toolbar__field--search">
            <label className="toolbar__label" htmlFor="wl-filter-q">
              Owner or boat
            </label>
            <input
              id="wl-filter-q"
              type="search"
              value={search}
              placeholder="Deverell or Halcyon"
              onChange={(event) => setParam('q', event.target.value)}
            />
          </div>
          <div className="toolbar__field">
            <label className="toolbar__label" htmlFor="wl-filter-size">
              Mooring size
            </label>
            <select
              id="wl-filter-size"
              value={sizeFilter}
              onChange={(event) => setParam('size_class', event.target.value)}
            >
              <option value="">All sizes</option>
              <option value="S">S · small</option>
              <option value="M">M · medium</option>
              <option value="L">L · large</option>
            </select>
          </div>
          <div className="toolbar__field">
            <label className="toolbar__label" htmlFor="wl-filter-status">
              Status
            </label>
            <select
              id="wl-filter-status"
              value={statusFilter}
              onChange={(event) => setParam('status', event.target.value)}
            >
              <option value="">Any status</option>
              <option value="waiting">Waiting</option>
              <option value="placed">Placed</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          {filtered ? (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {error ? (
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <ErrorBanner message="Could not load the waitlist" detail={error} onRetry={() => void load()} />
          </div>
        ) : null}

        {loading ? <SkeletonRows rows={4} label="Loading the waitlist" /> : null}
      </section>

      {!loading && !error ? (
        <div className="board">
          {visibleSizes.map((size) => {
            const rows = groups[size]
            const sizeWaiting = rows.filter((entry) => entry.status === 'waiting').length
            return (
              <section className="board__column" key={size} aria-label={`${SIZE_TITLE[size]} moorings`}>
                <div className="board__head">
                  <h2 className="board__title">
                    <span className="pill pill--size">{size}</span>
                    {SIZE_TITLE[size]} moorings
                  </h2>
                  <span className="panel__meta">
                    {sizeWaiting} waiting
                    {rows.length !== sizeWaiting ? ` · ${rows.length} on the board` : ''}
                  </span>
                </div>

                {rows.length === 0 ? (
                  <div className="panel">
                    <EmptyState
                      title={
                        filtered
                          ? `No entries match for ${size} moorings`
                          : `No one waiting for ${size} moorings`
                      }
                      hint={
                        filtered
                          ? 'Clear the filters to see the whole queue.'
                          : 'The queue for this size class is empty.'
                      }
                      action={
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => setDialog({ sizeClass: size })}
                        >
                          <PlusIcon />
                          Add owner for {size}
                        </button>
                      }
                    />
                  </div>
                ) : (
                  rows.map((entry) => (
                    <article
                      className="queue-entry"
                      key={entry.id}
                      data-flagged={entry.id === flagged[size] ? 'true' : 'false'}
                    >
                      <div className="queue-entry__top">
                        <span className="queue-entry__position">
                          {entry.position ?? '–'}
                        </span>
                        <span className="queue-entry__name">{entry.owner_name}</span>
                        <StatusPill status={entry.status} />
                      </div>
                      <div className="queue-entry__boat">
                        {entry.boat_name} · {formatMetres(entry.boat_length_m)} LOA
                      </div>
                      <div className="queue-entry__facts">
                        <span>Joined {formatDate(entry.joined_on)}</span>
                        <span>
                          {entry.status === 'waiting'
                            ? `${formatDays(entry.days_waiting)} waiting`
                            : `${statusLabel(entry.status)}`}
                        </span>
                        {entry.id === flagged[size] ? <span>Longest waiting for {size}</span> : null}
                      </div>

                      <details>
                        <summary className="muted" style={{ cursor: 'pointer' }}>
                          Contact details and notes
                        </summary>
                        <div className="queue-entry__contact">
                          <span>{entry.owner_email || 'No email on file'}</span>
                          <span>{entry.owner_phone || 'No phone on file'}</span>
                          {entry.notes ? <span>{entry.notes}</span> : null}
                        </div>
                      </details>

                      <div className="queue-entry__actions">
                        <div className="field" style={{ flex: '1 1 9rem' }}>
                          <label className="visually-hidden" htmlFor={`status-${entry.id}`}>
                            Status for {entry.owner_name}
                          </label>
                          <select
                            id={`status-${entry.id}`}
                            value={entry.status}
                            disabled={busyId === entry.id}
                            onChange={(event) =>
                              void changeStatus(entry, event.target.value as WaitlistStatus)
                            }
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {statusLabel(option)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon btn--sm"
                          aria-label={`Edit ${entry.owner_name}`}
                          onClick={() => setDialog({ entry })}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon btn--sm"
                          aria-label={`Remove ${entry.owner_name} from the board`}
                          onClick={() => {
                            setDeleteError(undefined)
                            setPendingDelete(entry)
                          }}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </section>
            )
          })}
        </div>
      ) : null}

      {dialog ? (
        <WaitlistFormDialog
          entry={dialog.entry ?? null}
          defaultSizeClass={dialog.sizeClass}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void load()
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Remove ${pendingDelete.owner_name}?`}
          message={`${pendingDelete.owner_name} (${pendingDelete.boat_name}, ${pendingDelete.size_class} mooring) will be removed from the board along with their joining date and contact details. This cannot be undone.`}
          confirmLabel="Remove entry"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  )
}
