import { useState } from 'react'

import { ApiRequestError, api } from '../api/client'
import type { SizeClass, WaitlistEntry, WaitlistInput, WaitlistStatus } from '../api/types'
import { todayIso } from '../lib/format'
import { Modal } from './Modal'
import { NumberField, SelectField, TextAreaField, TextField } from './Field'

const SIZE_OPTIONS = [
  { value: 'S', label: 'S · small craft (to ~7 m)' },
  { value: 'M', label: 'M · medium (7–11 m)' },
  { value: 'L', label: 'L · large (11 m and over)' },
]

const STATUS_OPTIONS = [
  { value: 'waiting', label: 'Waiting' },
  { value: 'placed', label: 'Placed' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** The length field is empty until typed, so the form keeps its own shape. */
interface WaitlistFormState {
  owner_name: string
  owner_email: string
  owner_phone: string
  boat_name: string
  boat_length_m: number | ''
  size_class: SizeClass
  joined_on: string
  status: WaitlistStatus
  notes: string
}

interface WaitlistFormDialogProps {
  entry?: WaitlistEntry | null
  defaultSizeClass?: SizeClass
  onClose: () => void
  onSaved: (entry: WaitlistEntry, mode: 'create' | 'edit') => void
}

export function WaitlistFormDialog({
  entry,
  defaultSizeClass,
  onClose,
  onSaved,
}: WaitlistFormDialogProps) {
  const editing = Boolean(entry)
  const [form, setForm] = useState<WaitlistFormState>(() => ({
    owner_name: entry?.owner_name ?? '',
    owner_email: entry?.owner_email ?? '',
    owner_phone: entry?.owner_phone ?? '',
    boat_name: entry?.boat_name ?? '',
    boat_length_m: entry ? entry.boat_length_m : '',
    size_class: entry?.size_class ?? defaultSizeClass ?? 'M',
    joined_on: entry?.joined_on ?? todayIso(),
    status: entry?.status ?? 'waiting',
    notes: entry?.notes ?? '',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = <K extends keyof WaitlistFormState>(key: K, value: WaitlistFormState[K]) => {
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
    if (!form.owner_name.trim()) found.owner_name = 'Owner name is required'
    if (!form.boat_name.trim()) found.boat_name = 'Boat name is required'
    if (form.boat_length_m === '' || Number(form.boat_length_m) <= 0) {
      found.boat_length_m = 'Boat length must be greater than 0 metres'
    }
    if (!form.joined_on) {
      found.joined_on = 'Joining date is required'
    } else if (form.joined_on > todayIso()) {
      found.joined_on = 'Joining date cannot be in the future'
    }
    if (form.owner_email.trim() && !EMAIL_PATTERN.test(form.owner_email.trim())) {
      found.owner_email = 'Enter a valid email address'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Re-entrancy guard: a double click cannot create two records.
    if (saving) return
    setBanner(null)
    if (!validate()) return

    const payload: WaitlistInput = {
      owner_name: form.owner_name.trim(),
      owner_email: form.owner_email.trim(),
      owner_phone: form.owner_phone.trim(),
      boat_name: form.boat_name.trim(),
      boat_length_m: Number(form.boat_length_m),
      size_class: form.size_class,
      joined_on: form.joined_on,
      status: form.status,
      notes: form.notes.trim(),
    }

    setSaving(true)
    try {
      const saved =
        editing && entry
          ? await api.updateWaitlistEntry(entry.id, payload)
          : await api.createWaitlistEntry(payload)
      onSaved(saved, editing ? 'edit' : 'create')
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.errors)
        setBanner(error.message)
      } else {
        setBanner('The entry could not be saved. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit ${entry?.owner_name ?? 'waitlist entry'}` : 'Add owner to the waitlist'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="waitlist-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to queue'}
          </button>
        </>
      }
    >
      <form id="waitlist-form" className="stack" onSubmit={handleSubmit} noValidate>
        {banner ? (
          <div className="error-banner" role="alert">
            <div className="error-banner__text">
              <span className="error-banner__title">{banner}</span>
              <span>Nothing was saved. Check the highlighted field.</span>
            </div>
          </div>
        ) : null}

        <div className="field-grid">
          <TextField
            id="wl-owner"
            label="Owner name"
            required
            value={form.owner_name}
            onChange={(value) => update('owner_name', value)}
            error={errors.owner_name}
            autoComplete="name"
            placeholder="Marcus Deverell"
          />
          <TextField
            id="wl-email"
            label="Email"
            type="email"
            value={form.owner_email}
            onChange={(value) => update('owner_email', value)}
            error={errors.owner_email}
            autoComplete="email"
            placeholder="owner@example.com"
          />
          <TextField
            id="wl-phone"
            label="Phone"
            value={form.owner_phone}
            onChange={(value) => update('owner_phone', value)}
            error={errors.owner_phone}
            autoComplete="tel"
            placeholder="07700 900000"
          />
          <TextField
            id="wl-boat"
            label="Boat name"
            required
            value={form.boat_name}
            onChange={(value) => update('boat_name', value)}
            error={errors.boat_name}
            placeholder="Halcyon"
          />
          <NumberField
            id="wl-length"
            label="Boat length overall"
            required
            value={form.boat_length_m}
            onChange={(value) => update('boat_length_m', value)}
            min={0.1}
            max={99.9}
            step={0.1}
            suffix="m"
            error={errors.boat_length_m}
          />
          <SelectField
            id="wl-size"
            label="Requested mooring size"
            required
            value={form.size_class}
            onChange={(value) => update('size_class', value as SizeClass)}
            options={SIZE_OPTIONS}
            error={errors.size_class}
            hint="The queue key - positions are per size class."
          />
          <TextField
            id="wl-joined"
            label="Joined the list on"
            required
            type="date"
            value={form.joined_on}
            onChange={(value) => update('joined_on', value)}
            error={errors.joined_on}
            hint="Positions are ordered by this date, oldest first."
          />
          <SelectField
            id="wl-status"
            label="Status"
            required
            value={form.status}
            onChange={(value) => update('status', value as WaitlistStatus)}
            options={STATUS_OPTIONS}
            error={errors.status}
            hint="Placed and withdrawn leave the active queue."
          />
        </div>

        <TextAreaField
          id="wl-notes"
          label="Notes"
          value={form.notes}
          onChange={(value) => update('notes', value)}
          hint="Preferences or anything the office should know."
        />
      </form>
    </Modal>
  )
}
