import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ApiRequestError, api } from '../api/client'
import type { Buoy, Inspection } from '../api/types'
import { ErrorBanner } from '../components/ErrorBanner'
import { InspectionFormDialog } from '../components/InspectionFormDialog'
import { InspectionTable } from '../components/InspectionTable'
import { ConfirmDialog } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { SkeletonRows } from '../components/Skeleton'
import { PlusIcon } from '../components/icons'
import { formatDate } from '../lib/format'

const CURRENT_YEAR = new Date().getFullYear()

export function InspectionsScreen() {
  const [params, setParams] = useSearchParams()
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [buoys, setBuoys] = useState<Buoy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ inspection?: Inspection } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Inspection | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined)

  const yearFilter = params.get('year') ?? ''
  const buoyFilter = params.get('buoy_id') ?? ''

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
      const [nextInspections, nextBuoys] = await Promise.all([
        api.inspections({
          year: yearFilter ? Number(yearFilter) : undefined,
          buoy_id: buoyFilter ? Number(buoyFilter) : undefined,
        }),
        api.buoys(),
      ])
      setInspections(nextInspections)
      setBuoys(nextBuoys)
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : 'The inspection ledger could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [yearFilter, buoyFilter])

  useEffect(() => {
    void load()
  }, [load])

  // Years that actually have records, so the filter never offers an empty scope
  // without the staff member choosing it.
  const years = useMemo(() => {
    const found = new Set<number>()
    inspections.forEach((row) => found.add(Number(row.inspected_on.slice(0, 4))))
    found.add(CURRENT_YEAR)
    return Array.from(found).sort((a, b) => b - a)
  }, [inspections])

  const handleDelete = async () => {
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

  const filtered = Boolean(yearFilter || buoyFilter)
  const selectedBuoy = buoyFilter ? buoys.find((buoy) => String(buoy.id) === buoyFilter) : undefined

  return (
    <>
      <PageHeader
        title="Inspections ledger"
        subtitle="Every annual inspection recorded against a mooring, newest first."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setDialog({})}>
            <PlusIcon />
            Record inspection
          </button>
        }
      />

      <section className="panel" aria-label="Filters">
        <div className="toolbar">
          <div className="toolbar__field">
            <label className="toolbar__label" htmlFor="insp-filter-year">
              Calendar year
            </label>
            <select
              id="insp-filter-year"
              value={yearFilter}
              onChange={(event) => setParam('year', event.target.value)}
            >
              <option value="">All years</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar__field">
            <label className="toolbar__label" htmlFor="insp-filter-buoy">
              Buoy
            </label>
            <select
              id="insp-filter-buoy"
              value={buoyFilter}
              onChange={(event) => setParam('buoy_id', event.target.value)}
            >
              <option value="">All buoys</option>
              {buoys.map((buoy) => (
                <option key={buoy.id} value={String(buoy.id)}>
                  {buoy.code} · {buoy.bay_name}
                </option>
              ))}
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
          <span className="panel__meta" style={{ marginLeft: 'auto' }}>
            {inspections.length} record{inspections.length === 1 ? '' : 's'} in view
          </span>
        </div>

        {error ? (
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            <ErrorBanner message="Could not load the ledger" detail={error} onRetry={() => void load()} />
          </div>
        ) : null}

        {loading ? <SkeletonRows rows={6} label="Loading the inspection ledger" /> : null}
      </section>

      {!loading && !error ? (
        <section className="panel">
          <InspectionTable
            inspections={inspections}
            onEdit={(inspection) => setDialog({ inspection })}
            onDelete={(inspection) => {
              setDeleteError(undefined)
              setPendingDelete(inspection)
            }}
            emptyTitle={
              yearFilter
                ? `No inspections recorded in ${yearFilter}`
                : selectedBuoy
                  ? `No inspections recorded for ${selectedBuoy.code}`
                  : 'No inspections recorded yet'
            }
            emptyHint="Record an annual inspection and it will appear here straight away."
            emptyAction={
              <button type="button" className="btn btn--primary" onClick={() => setDialog({})}>
                <PlusIcon />
                Record inspection
              </button>
            }
            caption={`${inspections.length} inspection record${inspections.length === 1 ? '' : 's'}${yearFilter ? ` from ${yearFilter}` : ''}`}
          />
        </section>
      ) : null}

      {dialog ? (
        <InspectionFormDialog
          buoys={buoys}
          defaultBuoyId={buoyFilter ? Number(buoyFilter) : null}
          inspection={dialog.inspection ?? null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            void load()
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this inspection?"
          message={`The inspection of ${pendingDelete.buoy_code} on ${formatDate(pendingDelete.inspected_on)} (${pendingDelete.chain_wear_percent}% chain wear) will be removed from the ledger and from the buoy's history.`}
          confirmLabel="Delete inspection"
          busy={deleting}
          error={deleteError}
          onConfirm={() => void handleDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  )
}
