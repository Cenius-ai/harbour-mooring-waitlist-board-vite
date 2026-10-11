import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiRequestError, api } from '../api/client'
import type { Bay, Overview } from '../api/types'
import { ErrorBanner } from '../components/ErrorBanner'
import { PageHeader } from '../components/PageHeader'
import { SkeletonRows } from '../components/Skeleton'
import { BrandMark, ChevronRightIcon } from '../components/icons'
import { formatDate, formatDays } from '../lib/format'

const YEAR = new Date().getFullYear()

function LegendList() {
  return (
    <ul className="metric-list" aria-label="How the board reads status">
      <li className="metric-list__item">
        <span className="metric-list__key">
          <span className="pill__dot" style={{ background: 'var(--success)' }} aria-hidden="true" />
          Inspection current
        </span>
        <span className="metric-list__value">within 12 months</span>
      </li>
      <li className="metric-list__item">
        <span className="metric-list__key">
          <span className="pill__dot" style={{ background: 'var(--warning)' }} aria-hidden="true" />
          Maintenance berth
        </span>
        <span className="metric-list__value">out of service</span>
      </li>
      <li className="metric-list__item">
        <span className="metric-list__key">
          <span className="pill__dot" style={{ background: 'var(--danger)' }} aria-hidden="true" />
          Chain wear 50%+
        </span>
        <span className="metric-list__value">flagged for attention</span>
      </li>
    </ul>
  )
}

export function DashboardScreen() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [bays, setBays] = useState<Bay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextOverview, nextBays] = await Promise.all([api.overview(), api.bays()])
      setOverview(nextOverview)
      setBays(nextBays)
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError
          ? caught.message
          : 'The harbour overview could not be loaded.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader
        title="Harbour overview"
        subtitle="What needs attention today across the register, the queue and the annual round."
        actions={
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        }
      />

      {error ? (
        <ErrorBanner
          message="Could not load the overview"
          detail={error}
          onRetry={() => void load()}
        />
      ) : null}

      {loading && !overview ? (
        <div className="panel">
          <SkeletonRows rows={6} label="Loading the harbour overview" />
        </div>
      ) : null}

      {overview ? (
        <div className="bento">
          <section className="bento__cell bento__cell--anchor ticked" aria-labelledby="overdue-heading">
            <div className="stack stack--tight">
              <h2 className="panel__title" id="overdue-heading">
                Inspections overdue
              </h2>
              <p className="panel__meta">
                No inspection on record, or the last one more than twelve months ago.
              </p>
            </div>
            {overview.overdue_inspections.length === 0 ? (
              <div className="empty-state" style={{ padding: 0 }}>
                <p className="empty-state__title">All inspections are current</p>
                <p className="empty-state__hint">
                  Every buoy in the register has been inspected within the last twelve months.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Buoy</th>
                      <th scope="col">Bay</th>
                      <th scope="col">Last inspected</th>
                      <th scope="col" className="table__num">
                        Overdue by
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.overdue_inspections.map((buoy) => (
                      <tr key={buoy.id}>
                        <td>
                          <Link to={`/buoys/${buoy.id}`}>
                            <code>{buoy.code}</code>
                          </Link>
                        </td>
                        <td>{buoy.bay_name}</td>
                        <td className="tabular">
                          {buoy.last_inspected_on
                            ? formatDate(buoy.last_inspected_on)
                            : 'Never inspected'}
                        </td>
                        <td className="table__num tabular">
                          {buoy.days_overdue === null ? '—' : formatDays(buoy.days_overdue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bento__cell bento__cell--wide ticked" aria-labelledby="counts-heading">
            <div className="stack stack--tight">
              <h2 className="panel__title" id="counts-heading">
                The register at a glance
              </h2>
              <p className="panel__meta">
                {overview.bay_count} bays · {overview.buoy_count} moorings
              </p>
            </div>
            <div className="stat-row">
              <Link className="stat" to="/buoys?status=available">
                <span className="stat__label">Available</span>
                <span className="stat__value">{overview.buoys_available}</span>
                <span className="stat__detail">Free to let</span>
              </Link>
              <Link className="stat" to="/buoys?status=occupied">
                <span className="stat__label">Occupied</span>
                <span className="stat__value">{overview.buoys_occupied}</span>
                <span className="stat__detail">Boat in residence</span>
              </Link>
              <Link className="stat" to="/buoys?status=maintenance">
                <span className="stat__label">Maintenance</span>
                <span className="stat__value">{overview.buoys_maintenance}</span>
                <span className="stat__detail">Out of service</span>
              </Link>
              <Link className="stat" to="/waitlist?status=waiting">
                <span className="stat__label">Owners waiting</span>
                <span className="stat__value">{overview.owners_waiting}</span>
                <span className="stat__detail">
                  S {overview.waiting_by_size.S ?? 0} · M {overview.waiting_by_size.M ?? 0} · L{' '}
                  {overview.waiting_by_size.L ?? 0}
                </span>
              </Link>
            </div>
          </section>

          <section className="bento__cell ticked" aria-labelledby="longest-heading">
            <div className="stack stack--tight">
              <h2 className="panel__title" id="longest-heading">
                Longest waiting
              </h2>
              <p className="panel__meta">One owner per mooring size.</p>
            </div>
            {overview.longest_waiting.length === 0 ? (
              <div className="empty-state" style={{ padding: 0 }}>
                <p className="empty-state__title">Nobody is waiting</p>
                <p className="empty-state__hint">Every mooring size queue is empty.</p>
                <Link className="btn btn--sm" to="/waitlist">
                  Open the waitlist
                </Link>
              </div>
            ) : (
              <ul className="link-list">
                {overview.longest_waiting.map((entry) => (
                  <li className="link-list__item" key={entry.id}>
                    <Link to={`/waitlist?size_class=${entry.size_class}`}>
                      <span className="link-list__primary">
                        <span className="pill pill--size">{entry.size_class}</span>
                        <span>{entry.owner_name}</span>
                      </span>
                      <span className="link-list__meta">
                        {formatDays(entry.days_waiting)} waiting
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bento__cell bento__cell--accent ticked" aria-labelledby="bays-heading">
            <div className="stack stack--tight">
              <h2 className="panel__title" id="bays-heading">
                Bays
              </h2>
              <p className="panel__meta">Moorings per bay.</p>
            </div>
            <ul className="link-list">
              {bays.map((bay) => (
                <li className="link-list__item" key={bay.id}>
                  <Link to={`/buoys?bay_id=${bay.id}`}>
                    <span className="link-list__primary">
                      <span>{bay.name}</span>
                    </span>
                    <span className="link-list__meta">
                      {bay.buoy_count} buoys
                      <ChevronRightIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="bento__cell ticked" aria-labelledby="ledger-heading">
            <div className="stack stack--tight">
              <h2 className="panel__title" id="ledger-heading">
                Inspection ledger
              </h2>
              <p className="panel__meta">Every annual inspection on record.</p>
            </div>
            <ul className="metric-list">
              <li className="metric-list__item">
                <span className="metric-list__key">Recorded in {YEAR}</span>
                <span className="metric-list__value">{overview.inspections_this_year}</span>
              </li>
              <li className="metric-list__item">
                <span className="metric-list__key">Buoys overdue</span>
                <span className="metric-list__value">{overview.overdue_inspections.length}</span>
              </li>
            </ul>
            <Link className="btn btn--sm" to={`/inspections?year=${YEAR}`}>
              Open the ledger
            </Link>
          </section>

          <section className="bento__cell ticked" aria-labelledby="legend-heading">
            <div className="stack stack--tight">
              <h2 className="panel__title" id="legend-heading">
                How to read the board
              </h2>
              <p className="panel__meta">Status is always a word as well as a colour.</p>
            </div>
            <LegendList />
          </section>

          <section className="bento__cell ticked" aria-labelledby="brand-heading">
            <span className="public__brand">
              <BrandMark />
              Harbour Point
            </span>
            <p className="panel__meta" id="brand-heading">
              Single-harbour deployment. Bays are seeded geography; staff own the buoys, the queue
              and the annual round.
            </p>
          </section>
        </div>
      ) : null}
    </>
  )
}
