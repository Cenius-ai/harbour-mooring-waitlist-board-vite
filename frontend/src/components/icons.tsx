/** Inline icon set - local SVGs on currentColor, 20px by default. */

interface IconProps {
  className?: string
}

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export function BrandMark({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden focusable="false">
      <circle cx="16" cy="7" r="3" fill="currentColor" />
      <path d="M16 7v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 13h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <path
        d="M16 25c-4.4 0-8-2.6-8.6-6h17.2c-.6 3.4-4.2 6-8.6 6Z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  )
}

export function GaugeIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15l4-4" />
      <path d="M3 19h18" />
    </svg>
  )
}

export function AnchorIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.2V20" />
      <path d="M8 11h8" />
      <path d="M5 14c.6 3.4 3.4 6 7 6s6.4-2.6 7-6" />
    </svg>
  )
}

export function QueueIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 7h10" />
      <path d="M4 12h13" />
      <path d="M4 17h7" />
      <circle cx="18" cy="7" r="1.6" />
      <circle cx="20" cy="12" r="1.6" />
    </svg>
  )
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9.5 4V3h5v1" />
      <path d="M9 10h6" />
      <path d="M9 14h4" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  )
}

export function EditIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function SignOutIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M11 8l-4 4 4 4" />
      <path d="M7 12h8" />
    </svg>
  )
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M12 4l8.5 15H3.5L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 16.6v.4" />
    </svg>
  )
}
