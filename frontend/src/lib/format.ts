/** Presentation helpers. Every value shown to staff carries its unit. */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** Parse a `YYYY-MM-DD` date without the timezone drift of `new Date(string)`. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDate(value: string | null | undefined): string {
  const date = parseIsoDate(value)
  if (!date) return 'Not recorded'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** Relative wording, clamped so it never reads "-1 days ago". */
export function formatRelative(value: string | null | undefined, today = new Date()): string {
  const date = parseIsoDate(value)
  if (!date) return 'Not recorded'
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((startOfToday.getTime() - date.getTime()) / 86_400_000)
  if (days < 0) return formatDate(value)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? 'A year ago' : `${years} years ago`
}

/** Depth and swing radius are metres to one decimal place, everywhere. */
export function formatMetres(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)} m`
}

export function formatDays(value: number): string {
  if (value <= 0) return 'Today'
  if (value === 1) return '1 day'
  if (value < 60) return `${value} days`
  const months = Math.floor(value / 30)
  return months === 1 ? 'About a month' : `About ${months} months`
}

export function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}
