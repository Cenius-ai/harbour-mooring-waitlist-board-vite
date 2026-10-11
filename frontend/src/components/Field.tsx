import { useId, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'

/**
 * Form controls with a real label, an inline error bound to the field, and the
 * aria wiring that makes the error reachable for screen-reader users.
 */

interface FieldShellProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  suffix?: string
}

function FieldShell({ id, label, error, hint, required, children, suffix }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="field__control">
        {children}
        {suffix ? <span className="field__suffix">{suffix}</span> : null}
      </div>
      {error ? (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type InputType = 'text' | 'email' | 'url' | 'date' | 'password' | 'search'

interface TextFieldProps {
  id?: string
  name?: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  type?: InputType
  placeholder?: string
  autoComplete?: string
  autoFocus?: boolean
  required?: boolean
  disabled?: boolean
  suffix?: string
  onBlur?: () => void
}

export function TextField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  placeholder,
  autoComplete,
  autoFocus,
  required,
  disabled,
  suffix,
  onBlur,
}: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} suffix={suffix}>
      <input
        id={fieldId}
        name={name}
        className={`field__input${suffix ? ' field__input--with-affix' : ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </FieldShell>
  )
}

interface NumberFieldProps {
  id?: string
  name?: string
  label: string
  value: number | ''
  onChange: (value: number | '') => void
  error?: string
  hint?: string
  min?: number
  max?: number
  step?: number
  suffix?: string
  required?: boolean
  disabled?: boolean
}

export function NumberField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  hint,
  min,
  max,
  step = 0.1,
  suffix,
  required,
  disabled,
}: NumberFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} suffix={suffix}>
      <input
        id={fieldId}
        name={name}
        className={`field__input${suffix ? ' field__input--with-affix' : ''}`}
        type="number"
        inputMode="decimal"
        value={value === '' ? '' : String(value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? '' : Number(raw))
        }}
      />
    </FieldShell>
  )
}

interface SelectFieldProps {
  id?: string
  name?: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  allowEmpty?: string
}

export function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  required,
  disabled,
  allowEmpty,
}: SelectFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <select
        id={fieldId}
        name={name}
        className="field__input"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty ? <option value="">{allowEmpty}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

interface TextAreaFieldProps {
  id?: string
  name?: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  rows?: number
  placeholder?: string
}

export function TextAreaField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  hint,
  rows = 3,
  placeholder,
}: TextAreaFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <textarea
        id={fieldId}
        name={name}
        className="field__input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  )
}

interface PasswordFieldProps {
  id?: string
  name?: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoComplete?: string
  disabled?: boolean
  inputRef?: (element: HTMLInputElement | null) => void
}

export function PasswordField({
  id,
  name = 'password',
  label,
  value,
  onChange,
  error,
  autoComplete = 'current-password',
  disabled,
  inputRef,
}: PasswordFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [revealed, setRevealed] = useState(false)

  return (
    <FieldShell id={fieldId} label={label} error={error} required>
      <input
        id={fieldId}
        name={name}
        ref={inputRef}
        className="field__input field__input--with-affix"
        type={revealed ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="field__affix">
        <button
          type="button"
          className="field__toggle"
          onClick={() => setRevealed((current) => !current)}
          aria-pressed={revealed}
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
      </span>
    </FieldShell>
  )
}
