import type { BuoyStatus, SizeClass, WaitlistStatus } from '../api/types'

type PillTone = 'available' | 'occupied' | 'maintenance' | 'waiting' | 'placed' | 'withdrawn'

const LABELS: Record<string, string> = {
  available: 'Available',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  waiting: 'Waiting',
  placed: 'Placed',
  withdrawn: 'Withdrawn',
}

/** Status is always colour *and* a word - never colour alone. */
export function StatusPill({ status }: { status: BuoyStatus | WaitlistStatus }) {
  const tone = status as PillTone
  return (
    <span className={`pill pill--${tone}`}>
      <span className="pill__dot" aria-hidden="true" />
      {LABELS[status] ?? status}
    </span>
  )
}

export function SizePill({ size }: { size: SizeClass }) {
  return (
    <span className="pill pill--size" title={`Mooring size ${size}`}>
      {size}
    </span>
  )
}
