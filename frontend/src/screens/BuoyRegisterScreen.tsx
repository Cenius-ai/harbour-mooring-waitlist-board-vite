import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ApiRequestError, api } from '../api/client'
import type { Bay, Buoy } from '../api/types'
import { BuoyFormDialog } from '../components/BuoyFormDialog'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/Modal'
import { SkeletonRows } from '../components/Skeleton'
import { SizePill, StatusPill } from '../components/StatusPill'
import { EditIcon, PlusIcon, TrashIcon } from '../components/icons'
import { formatDate, formatMetres, statusLabel } from '../lib/format'

interface DialogState {
  mode: 'create' | 'edit'
  buoy?: Buoy
  bayId?: number | null
}

export function BuoyRegisterScreen() {
  const [params, setParams] = useSearchParams()
  const [bays, setBays] = useState<Bay[]>([])
  const [buoys, setBuoys] = useState<Buoy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Buoy | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined)
  const [flashId, setFlashId] = useState<number | null>(null)

  const bayFilter = params.get('bay_id') ?? ''
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
      const [nextBays, nextBuoys] = await Promise.all([
        api.bays(),
        api.buoys({
          bay_id: bayFilter ? Number(bayFilter) : undefined,
          size_class: sizeFilter || undefined,
          status: statusFilter || undefined,
          q: search || undefined,
        }),
      ])
      setBays(nextBays)
      setBuoys(nextBuoys)
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'The register could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [bayFilter, sizeFilter, statusFilter, search])

  useEffect(() => {
    void load()
  }, [load])

  // Buoys grouped under their bay heading, in the order the API returns them.
  const groups = useMemo(() => {
    const map = new Map<number, { bay: Bay | undefined; buoys: Buoy[] }>()
    buoys.forEach((buoy) => {
      if (!map.has(buoy.bay_id)) {
        map.set(buoy.bay_id, { bay: bays.find((bay) => bay.id === buoy.bay_id), buoys: [] })
      }
      map.get(buoy.bay_id)?.buoys.push(buoy)
    })
    return Array.from(map.values())
  }, [buoys, bays])

  const totals = useMemo(
    () => ({
      available: buoys.filter((buoy) => buoy.status === 'available').length,
      occupied: buoys.filter((buoy) => buoy.status === 'occupied').length,
      maintenance: buoys.filter((buoy) => buoy.status === 'maintenance').length,
    }),
    [buoys],
  )

  const filtered = Boolean(bayFilter || sizeFilter || statusFilter || search)

  const flash = (id: number) => {
    setFlashId(id)
    window.setTimeout(() => setFlashId(null), 600)
  }

  const handleSaved = (buoy: Buoy, mode: 'create' | 'edit') => {
    setDialog(null)
    flash(buoy.id)
    if (mode === 'create' && search) {
      // A stale code search would hide the buoy that was just added; clearing it
      // re-runs the load through the URL change.
      setParam('q', '')
    } else {
      void load()
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await api.deleteBuoy(pendingDelete.id)
      setPendingDelete(null)
      await load()
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiRequestError ? caught.message : 'The buoy could not be deleted.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Buoy register"
        subtitle={`${buoys.length} mooring${buoys.length === 1 ? '' : 's'} shown · ${totals.available} available · ${totals.occupied} occupied · ${totals.maintenance} in maintenance`}
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setDialog({ mode: 'create', bayId: bayFilter ? Number(bayFilter) : null })}
          >
            <PlusIcon />
            New buoy
          </button>
        }
      />

      <section className="panel" aria-label="Filters">
        <div className="toolbar">
          <div className="toolbar__field toolbar__field--search">
            <label className="toolbar__label" htmlFor="filter-code">
              Buoy code
            </label>
            <input
              id="filter-code"
              type="search"
              value={search}
              placeholder="NB-04"
              onChange={(event) => setParam('q', event.target.value)}
            />
          </div>
          <div className="toolbar__field">
            <label className="toolbar__label" htmlFor="filter-bay">
              Bay
            </label>
            <select
              id="filter-bay"
              value={bayFilter}
              onChange={(event) => setParam('bay_id', event.target.value)}
            >
              <option value="">All bays</option>
              {bays.map((bay) => (
                <option key={bay.id} value={String(bay.id)}>
                  {bay.name}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar__field">
            <label className="toolbar__label" htmlFor="filter-size">
              Size class
            </label>
            <select
              id="filter-size"
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
            <label className="toolbar__label" htmlFor="filter-status">
              Availability
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(event) => setParam('status', event.target.value)}
            >
              <option value="">Any status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
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
            <ErrorBanner message="Could not load the register" detail={error} onRetry={() => void load()} />
          </div>
        ) : null}

        {loading ? <SkeletonRows rows={6} label="Loading the buoy register" /> : null}

        {!loading && !error && buoys.length === 0 ? (
          <EmptyState
            title={
              filtered
                ? `No buoys match${search ? ` “${search}”` : ' these filters'}`
                : 'No buoys registered yet'
            }
            hint={
              filtered
                ? 'Try a different bay, size class or availability, or clear the filters.'
                : 'Add the first mooring and it will appear under its bay heading straight away.'
            }
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setDialog({ mode: 'create', bayId: bayFilter ? Number(bayFilter) : null })}
              >
                <PlusIcon />
                {filtered ? 'Add a buoy' : 'Add the first buoy'}
              </button>
            }
          />
        ) : null}
      </section>

      {!loading && !error
        ? groups.map(({ bay, buoys: bayBuoys }) => (
            <section
              className="panel"
              key={bay?.id ?? bayBuoys[0]?.bay_id}
              aria-label={bay?.name ?? bayBuoys[0]?.bay_name}
            >
              <div className="bay-heading">
                <h2>{bay?.name ?? bayBuoys[0]?.bay_name ?? 'Bay'}</h2>
                <span className="bay-heading__meta">
                  {bayBuoys.length} buoy{bayBuoys.length === 1 ? '' : 's'}
                  {bay?.waiting_count
                    ? ` · ${bay.waiting_count} owner${bay.waiting_count === 1 ? '' : 's'} waiting for a size that is free here`
                    : ''}
                </span>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Code</th>
                      <th scope="col">Size</th>
                      <th scope="col" className="table__num">
                        Depth
                      </th>
                      <th scope="col" className="table__num">
                        Swing radius
                      </th>
                      <th scope="col">Availability</th>
                      <th scope="col">Last inspection</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bayBuoys.map((buoy) => (
                      <tr key={buoy.id} className={flashId === buoy.id ? 'flash' : undefined}>
                        <td>
                          <Link to={`/buoys/${buoy.id}`}>
                            <code>{buoy.code}</code>
                          </Link>
                        </td>
                        <td>
                          <SizePill size={buoy.size_class} />
                        </td>
                        <td className="table__num tabular">{formatMetres(buoy.depth_m)}</td>
                        <td className="table__num tabular">{formatMetres(buoy.swing_radius_m)}</td>
                        <td>
                          <StatusPill status={buoy.status} />
                        </td>
                        <td className="tabular">
                          {buoy.last_inspected_on ? formatDate(buoy.last_inspected_on) : 'Never'}
                        </td>
                        <td>
                          <div className="table__actions">
                            <Link
                              className="btn btn--ghost btn--sm"
                              to={`/buoys/${buoy.id}`}
                              aria-label={`Open ${buoy.code}`}
                            >
                              Open
                            </Link>
                            <button
                              type="button"
                              className="btn btn--ghost btn--icon btn--sm"
                              aria-label={`Edit ${buoy.code}`}
                              onClick={() => setDialog({ mode: 'edit', buoy })}
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--icon btn--sm"
                              aria-label={`Delete ${buoy.code}`}
                              onClick={() => {
                                setDeleteError(undefined)
                                setPendingDelete(buoy)
                              }}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        : null}

      {dialog ? (
        <BuoyFormDialog
          bays={bays}
          buoy={dialog.buoy ?? null}
          defaultBayId={dialog.bayId ?? null}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete ${pendingDelete.code}?`}
          message={`${pendingDelete.code} in ${pendingDelete.bay_name} (${statusLabel(pendingDelete.status)}, size ${pendingDelete.size_class}) will be removed. Its ${pendingDelete.inspection_count} inspection record${pendingDelete.inspection_count === 1 ? '' : 's'} are deleted with it, and this cannot be undone.`}
          confirmLabel="Delete buoy"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  )
}
