import { useState } from 'react'

import { ApiRequestError, api } from '../api/client'
import type { Buoy, Inspection, InspectionInput } from '../api/types'
import { formatDate, todayIso } from '../lib/format'
import { Modal } from './Modal'
import { NumberField, SelectField, TextAreaField, TextField } from './Field'

interface InspectionFormDialogProps {
  buoys: Buoy[]
  /** Prefill when opened from a buoy's own page. */
  defaultBuoyId?: number | null
  inspection?: Inspection | null
  onClose: () => void
  onSaved: (inspection: Inspection, mode: 'create' | 'edit') => void
}

export function InspectionFormDialog({
  buoys,
  defaultBuoyId,
  inspection,
  onClose,
  onSaved,
}: InspectionFormDialogProps) {
  const editing = Boolean(inspection)
  const [form, setForm] = useState<InspectionInput>(() => ({
    buoy_id: inspection?.buoy_id ?? defaultBuoyId ?? buoys[0]?.id ?? 0,
    inspected_on: inspection?.inspected_on ?? todayIso(),
    inspector_name: inspection?.inspector_name ?? '',
    chain_wear_percent: inspection ? inspection.chain_wear_percent : 0,
    notes: inspection?.notes ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedBuoy = buoys.find((buoy) => buoy.id === form.buoy_id)

  const update = <K extends keyof InspectionInput>(key: K, value: InspectionInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key as string]
      return next
    })
  }

  const validate = (): boolean => {
    const found: Record<string, string> = {}
    if (!form.buoy_id) found.buoy_id = 'Choose a buoy'
    if (!form.inspected_on) {
      found.inspected_on = 'Inspection date is required'
    } else if (form.inspected_on > todayIso()) {
      found.inspected_on = 'Inspection date cannot be in the future'
    }
    if (!form.inspector_name.trim()) found.inspector_name = 'Inspector name is required'
    const wear = Number(form.chain_wear_percent)
    if (Number.isNaN(wear) || wear < 0 || wear > 100) {
      found.chain_wear_percent = 'Chain wear must be a whole number from 0 to 100'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Re-entrancy guard: a double click cannot record two inspections.
    if (saving) return
    setBanner(null)
    if (!validate()) return

    const payload: InspectionInput = {
      buoy_id: Number(form.buoy_id),
      inspected_on: form.inspected_on,
      inspector_name: form.inspector_name.trim(),
      chain_wear_percent: Math.round(Number(form.chain_wear_percent)),
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      const saved =
        editing && inspection
          ? await api.updateInspection(inspection.id, payload)
          : await api.createInspection(payload)
      onSaved(saved, editing ? 'edit' : 'create')
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // The annual guard answers 409 keyed to the date field, and every typed
        // value stays exactly where it was.
        setErrors(error.errors)
        setBanner(error.message)
      } else {
        setBanner('The inspection could not be saved. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit inspection' : 'Record an annual inspection'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="inspection-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Record inspection'}
          </button>
        </>
      }
    >
      <form id="inspection-form" className="stack" onSubmit={handleSubmit} noValidate>
        {banner ? (
          <div className="error-banner" role="alert">
            <div className="error-banner__text">
              <span className="error-banner__title">{banner}</span>
              <span>Nothing was saved. Check the highlighted field.</span>
            </div>
          </div>
        ) : null}

        <div className="field-grid">
          <SelectField
            id="insp-buoy"
            label="Buoy"
            required
            value={form.buoy_id ? String(form.buoy_id) : ''}
            onChange={(value) => update('buoy_id', Number(value))}
            options={buoys.map((buoy) => ({
              value: String(buoy.id),
              label: `${buoy.code} · ${buoy.bay_name} · ${buoy.size_class}`,
            }))}
            allowEmpty="Choose a buoy…"
            error={errors.buoy_id}
          />
          <TextField
            id="insp-date"
            label="Inspection date"
            required
            type="date"
            value={form.inspected_on}
            onChange={(value) => update('inspected_on', value)}
            error={errors.inspected_on}
            hint={
              selectedBuoy?.last_inspected_on
                ? `Last recorded ${formatDate(selectedBuoy.last_inspected_on)} · next due ${formatDate(selectedBuoy.next_inspection_due)}`
                : 'This buoy has no inspection on record yet.'
            }
          />
          <TextField
            id="insp-inspector"
            label="Inspector"
            required
            value={form.inspector_name}
            onChange={(value) => update('inspector_name', value)}
            error={errors.inspector_name}
            placeholder="M. Kavanagh"
          />
          <NumberField
            id="insp-wear"
            label="Chain wear found"
            required
            value={form.chain_wear_percent}
            onChange={(value) => update('chain_wear_percent', value === '' ? 0 : value)}
            min={0}
            max={100}
            step={1}
            suffix="%"
            error={errors.chain_wear_percent}
            hint="Whole percentage 0–100. 50% or more is flagged for attention."
          />
        </div>

        <TextAreaField
          id="insp-notes"
          label="Notes"
          value={form.notes}
          onChange={(value) => update('notes', value)}
          hint="Gauging points, remedial work, anything the file should carry."
        />
      </form>
    </Modal>
  )
}
