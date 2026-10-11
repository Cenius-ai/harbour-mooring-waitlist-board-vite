import { useState } from 'react'

import { ApiRequestError, api } from '../api/client'
import type { Bay, Buoy, BuoyInput, BuoyStatus, SizeClass } from '../api/types'
import { Modal } from './Modal'
import { NumberField, SelectField, TextAreaField, TextField } from './Field'

const SIZE_OPTIONS = [
  { value: 'S', label: 'S · small craft (to ~7 m)' },
  { value: 'M', label: 'M · medium (7–11 m)' },
  { value: 'L', label: 'L · large (11 m and over)' },
]

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
]

interface BuoyFormDialogProps {
  bays: Bay[]
  buoy?: Buoy | null
  defaultBayId?: number | null
  onClose: () => void
  onSaved: (buoy: Buoy, mode: 'create' | 'edit') => void
}

interface FormState {
  bay_id: string
  code: string
  size_class: SizeClass
  depth_m: number | ''
  swing_radius_m: number | ''
  status: BuoyStatus
  notes: string
}

export function BuoyFormDialog({ bays, buoy, defaultBayId, onClose, onSaved }: BuoyFormDialogProps) {
  const editing = Boolean(buoy)
  const [form, setForm] = useState<FormState>(() => ({
    bay_id: String(buoy?.bay_id ?? defaultBayId ?? bays[0]?.id ?? ''),
    code: buoy?.code ?? '',
    size_class: buoy?.size_class ?? 'M',
    depth_m: buoy ? buoy.depth_m : '',
    swing_radius_m: buoy ? buoy.swing_radius_m : '',
    status: buoy?.status ?? 'available',
    notes: buoy?.notes ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
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
    if (!form.bay_id) found.bay_id = 'Choose a bay'
    if (!form.code.trim()) found.code = 'Buoy code is required'
    if (form.depth_m === '' || Number(form.depth_m) <= 0) {
      found.depth_m = 'Depth must be greater than 0 metres'
    }
    if (form.swing_radius_m === '' || Number(form.swing_radius_m) <= 0) {
      found.swing_radius_m = 'Swing radius must be greater than 0 metres'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    setBanner(null)
    if (!validate()) return

    const payload: BuoyInput = {
      bay_id: Number(form.bay_id),
      code: form.code.trim().toUpperCase(),
      size_class: form.size_class,
      depth_m: Number(form.depth_m),
      swing_radius_m: Number(form.swing_radius_m),
      status: form.status,
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      const saved = editing && buoy
        ? await api.updateBuoy(buoy.id, payload)
        : await api.createBuoy(payload)
      onSaved(saved, editing ? 'edit' : 'create')
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.errors)
        setBanner(error.message)
      } else {
        setBanner('The buoy could not be saved. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit buoy ${buoy?.code ?? ''}` : 'New mooring buoy'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="buoy-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add buoy'}
          </button>
        </>
      }
    >
      <form id="buoy-form" className="stack" onSubmit={handleSubmit} noValidate>
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
            id="buoy-bay"
            label="Bay"
            required
            value={form.bay_id}
            onChange={(value) => update('bay_id', value)}
            options={bays.map((bay) => ({ value: String(bay.id), label: bay.name }))}
            allowEmpty="Choose a bay…"
            error={errors.bay_id}
            hint="Bays are fixed harbour geography."
          />
          <TextField
            id="buoy-code"
            label="Buoy code"
            required
            value={form.code}
            onChange={(value) => update('code', value)}
            error={errors.code}
            hint="2–12 characters, letters, digits and dashes."
            placeholder="NB-05"
          />
          <SelectField
            id="buoy-size"
            label="Mooring size class"
            required
            value={form.size_class}
            onChange={(value) => update('size_class', value as SizeClass)}
            options={SIZE_OPTIONS}
            error={errors.size_class}
          />
          <SelectField
            id="buoy-status"
            label="Availability"
            required
            value={form.status}
            onChange={(value) => update('status', value as BuoyStatus)}
            options={STATUS_OPTIONS}
            error={errors.status}
          />
          <NumberField
            id="buoy-depth"
            label="Depth at chart datum"
            required
            value={form.depth_m}
            onChange={(value) => update('depth_m', value)}
            min={0.1}
            max={99.9}
            step={0.1}
            suffix="m"
            error={errors.depth_m}
            hint="Metres to one decimal place."
          />
          <NumberField
            id="buoy-swing"
            label="Swing radius"
            required
            value={form.swing_radius_m}
            onChange={(value) => update('swing_radius_m', value)}
            min={0.1}
            max={99.9}
            step={0.1}
            suffix="m"
            error={errors.swing_radius_m}
            hint="Metres to one decimal place."
          />
        </div>

        <TextAreaField
          id="buoy-notes"
          label="Notes"
          value={form.notes}
          onChange={(value) => update('notes', value)}
          hint="Anything the next inspection should know."
        />
      </form>
    </Modal>
  )
}
