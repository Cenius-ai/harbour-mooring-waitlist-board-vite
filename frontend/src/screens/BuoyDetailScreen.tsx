import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ApiRequestError, api } from '../api/client'
import type { Bay, Buoy, BuoyStatus, Inspection } from '../api/types'
import { BuoyFormDialog } from '../components/BuoyFormDialog'
import { EmptyState } from '../components/EmptyState'
import { ErrorBanner } from '../components/ErrorBanner'
import { InspectionFormDialog } from '../components/InspectionFormDialog'
import { InspectionTable } from '../components/InspectionTable'
import { ConfirmDialog } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { SkeletonRows } from '../components/Skeleton'
import { SizePill, StatusPill } from '../components/StatusPill'
import { EditIcon, PlusIcon } from '../components/icons'
import { formatDate, formatMetres, formatRelative, statusLabel } from '../lib/format'

const STATUS_OPTIONS: BuoyStatus[] = ['available', 'occupied', 'maintenance']

interface EditDialogProps {
  buoy: Buoy
  onClose: () => void
  onSaved: (buoy: Buoy) => void
}

/** Loads the bays the edit dialog needs, then reuses the register's form. */
function BuoyEditDialog({ buoy, onClose, onSaved }: EditDialogProps) {
  const [bays, setBays] = useState<Bay[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .bays()
      .then((next) => {
        if (!cancelled) setBays(next)
      })
      .catch(() => {
        if (!cancelled) setBays([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (bays === null) return null

  return (
    <BuoyFormDialog
      bays={bays}
      buoy={buoy}
      onClose={onClose}
      onSaved={(saved) => onSaved(saved)}
    />
  )
}

export function BuoyDetailScreen() {
  const { buoyId } = useParams<{ buoyId: string }>()
  const id = Number(buoyId)

  const [buoy, setBuoy] = useState<Buoy | null>(null)
  const [siblings, setSiblings] = useState<Buoy[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [inspectionDialog, setInspectionDialog] = useState<{ inspection?: Inspection } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Inspection | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined)

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const [nextBuoy, nextInspections, allBuoys] = await Promise.all([
        api.buoy(id),
        api.inspections({ buoy_id: id }),
        api.buoys(),
      ])
      setBuoy(nextBuoy)
      setInspections(nextInspections)
      setSiblings(allBuoys)
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 404) {
        setNotFound(true)
      } else {
        setError(caught instanceof ApiRequestError ? caught.message : 'The buoy could not be loaded.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = async (status: BuoyStatus) => {
    if (!buoy || savingStatus) return
    setSavingStatus(true)
    try {
      const updated = await api.updateBuoy(buoy.id, { status })
      setBuoy(updated)
      setSiblings((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : 'The status could not be changed.')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleDeleteInspection = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      await api.deleteInspection(pendingDelete.id)
      setPendingDelete(null)
      await load()
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiRequestError ? caught.message : 'The inspection could not be deleted.',
      )
    } finally {
      setDeleting(false)
    }
  }

  if (notFound) {
    return (
      <div className="error-page">
        <div className="error-page__inner">
          <h1 className="page-header__title">Buoy not found</h1>
          <p className="muted">
            No mooring in the register has that reference. It may have been deleted.
          </p>
          <Link className="btn btn--primary" to="/buoys">
            Back to the register
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={buoy ? buoy.code : 'Buoy'}
        subtitle={
          buoy ? `${buoy.bay_name} · size ${buoy.size_class}` : 'Loading the mooring record…'
        }
        actions={
          <>
            <Link className="btn" to="/buoys">
              Back to register
            </Link>
            {buoy ? (
              <button type="button" className="btn btn--primary" onClick={() => setInspectionDialog({})}>
                <PlusIcon />
                Record inspection
              </button>
            ) : null}
          </>
        }
      />

      {error ? (
        <ErrorBanner message="Could not load this mooring" detail={error} onRetry={() => void load()} />
      ) : null}

      <div className="pane-layout">
        <aside className="panel pane pane--list" aria-label="Buoys in the register">
          <div className="panel__head">
            <h2 className="panel__title">Register</h2>
            <span className="panel__meta">{siblings.length} buoys</span>
          </div>
          <ul className="link-list">
            {siblings.map((item) => (
              <li className="link-list__item" key={item.id}>
                <Link to={`/buoys/${item.id}`} aria-current={item.id === id ? 'page' : undefined}>
                  <span className="link-list__primary">
                    <code>{item.code}</code>
                    <span className="pill pill--size">{item.size_class}</span>
                  </span>
                  <span className="link-list__meta">{statusLabel(item.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="pane pane--detail">
          {loading && !buoy ? (
            <div className="panel">
              <SkeletonRows rows={5} label="Loading the mooring specification" />
            </div>
          ) : null}

          {buoy ? (
            <>
              <section className="panel ticked" aria-labelledby="spec-heading">
                <div className="panel__head">
                  <h2 className="panel__title" id="spec-heading">
                    Mooring specification
                  </h2>
                  <div className="row">
                    <StatusPill status={buoy.status} />
                    <SizePill size={buoy.size_class} />
                  </div>
                </div>
                <div className="panel__body stack">
                  <ul className="spec-list">
                    <li className="spec-list__item">
                      <span className="spec-list__key">Bay</span>
                      <span className="spec-list__value">{buoy.bay_name}</span>
                    </li>
                    <li className="spec-list__item">
                      <span className="spec-list__key">Depth at chart datum</span>
                      <span className="spec-list__value">{formatMetres(buoy.depth_m)}</span>
                    </li>
                    <li className="spec-list__item">
                      <span className="spec-list__key">Swing radius</span>
                      <span className="spec-list__value">{formatMetres(buoy.swing_radius_m)}</span>
                    </li>
                    <li className="spec-list__item">
                      <span className="spec-list__key">Last inspection</span>
                      <span className="spec-list__value">
                        {buoy.last_inspected_on
                          ? `${formatDate(buoy.last_inspected_on)} · ${formatRelative(buoy.last_inspected_on)}`
                          : 'Never inspected'}
                      </span>
                    </li>
                    <li className="spec-list__item">
                      <span className="spec-list__key">Next annual due</span>
                      <span className="spec-list__value">
                        {buoy.next_inspection_due
                          ? formatDate(buoy.next_inspection_due)
                          : 'Not yet scheduled'}
                      </span>
                    </li>
                    <li className="spec-list__item">
                      <span className="spec-list__key">Inspections on file</span>
                      <span className="spec-list__value">{buoy.inspection_count}</span>
                    </li>
                  </ul>

                  {buoy.notes ? <p className="notes-block">{buoy.notes}</p> : null}

                  <div className="row row--between">
                    <div className="field" style={{ maxWidth: '16rem' }}>
                      <label className="field__label" htmlFor="buoy-status-inline">
                        Availability
                      </label>
                      <select
                        id="buoy-status-inline"
                        value={buoy.status}
                        disabled={savingStatus}
                        onChange={(event) => void changeStatus(event.target.value as BuoyStatus)}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {statusLabel(option)}
                          </option>
                        ))}
                      </select>
                      <p className="field__hint">
                        {savingStatus ? 'Saving…' : 'Changing this saves straight away.'}
                      </p>
                    </div>
                    <button type="button" className="btn" onClick={() => setEditing(true)}>
                      <EditIcon />
                      Edit specification
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel" aria-labelledby="history-heading">
                <div className="panel__head">
                  <h2 className="panel__title" id="history-heading">
                    Inspection history
                  </h2>
                  <span className="panel__meta">
                    {inspections.length} record{inspections.length === 1 ? '' : 's'} · newest first
                  </span>
                </div>
                <InspectionTable
                  inspections={inspections}
                  onEdit={(inspection) => setInspectionDialog({ inspection })}
                  onDelete={(inspection) => {
                    setDeleteError(undefined)
                    setPendingDelete(inspection)
                  }}
                  emptyTitle="No inspections recorded yet"
                  emptyHint="This mooring has never been surveyed. Record the first annual inspection to start its history."
                  emptyAction={
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => setInspectionDialog({})}
                    >
                      <PlusIcon />
                      Record the first inspection
                    </button>
                  }
                  caption={`Inspection history for ${buoy.code} in ${buoy.bay_name}`}
                />
              </section>
            </>
          ) : null}

          {!loading && !buoy && !error ? (
            <EmptyState
              title="Nothing to show"
              hint="This mooring record is empty."
              action={
                <Link className="btn btn--primary" to="/buoys">
                  Back to the register
                </Link>
              }
            />
          ) : null}
        </div>
      </div>

      {editing && buoy ? (
        <BuoyEditDialog
          buoy={buoy}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setBuoy(updated)
            setEditing(false)
            void load()
          }}
        />
      ) : null}

      {inspectionDialog ? (
        <InspectionFormDialog
          buoys={siblings}
          defaultBuoyId={buoy?.id ?? null}
          inspection={inspectionDialog.inspection ?? null}
          onClose={() => setInspectionDialog(null)}
          onSaved={() => {
            setInspectionDialog(null)
            void load()
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this inspection?"
          message={`The inspection of ${pendingDelete.buoy_code} on ${formatDate(pendingDelete.inspected_on)} (${pendingDelete.chain_wear_percent}% chain wear) will be removed from the ledger and from this buoy's history.`}
          confirmLabel="Delete inspection"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void handleDeleteInspection()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  )
}
