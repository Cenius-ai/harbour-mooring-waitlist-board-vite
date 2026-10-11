import type { Inspection } from '../api/types'
import { formatDate } from '../lib/format'
import { EmptyState } from './EmptyState'
import { EditIcon, TrashIcon } from './icons'

interface InspectionTableProps {
  inspections: Inspection[]
  onEdit: (inspection: Inspection) => void
  onDelete: (inspection: Inspection) => void
  emptyTitle?: string
  emptyHint?: string
  emptyAction?: React.ReactNode
  caption?: string
}

export function InspectionTable({
  inspections,
  onEdit,
  onDelete,
  emptyTitle = 'No inspections recorded yet',
  emptyHint = 'Record the first annual inspection to start this mooring’s history.',
  emptyAction,
  caption,
}: InspectionTableProps) {
  if (inspections.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        hint={emptyHint}
        action={emptyAction}
      />
    )
  }

  return (
    <div className="table-scroll">
      <table className="table">
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col">Inspected</th>
            <th scope="col">Buoy</th>
            <th scope="col">Bay</th>
            <th scope="col">Inspector</th>
            <th scope="col" className="table__num">
              Chain wear
            </th>
            <th scope="col">Notes</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((inspection) => (
            <tr key={inspection.id}>
              <td className="tabular">{formatDate(inspection.inspected_on)}</td>
              <td>
                <code>{inspection.buoy_code}</code>
              </td>
              <td>{inspection.bay_name}</td>
              <td>{inspection.inspector_name}</td>
              <td className="table__num">
                <span className={`pill ${inspection.attention ? 'pill--attention' : 'pill--available'}`}>
                  {inspection.chain_wear_percent}%{inspection.attention ? ' · attention' : ''}
                </span>
              </td>
              <td className="muted">{inspection.notes || '—'}</td>
              <td>
                <div className="table__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm"
                    aria-label={`Edit inspection for ${inspection.buoy_code} on ${formatDate(inspection.inspected_on)}`}
                    onClick={() => onEdit(inspection)}
                  >
                    <EditIcon />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--sm"
                    aria-label={`Delete inspection for ${inspection.buoy_code} on ${formatDate(inspection.inspected_on)}`}
                    onClick={() => onDelete(inspection)}
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
  )
}
