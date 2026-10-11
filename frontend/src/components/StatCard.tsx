import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface StatCardProps {
  label: string
  value: ReactNode
  detail?: string
  to?: string
}

/** One KPI: the value, what it counts, and a link into the matching screen. */
export function StatCard({ label, value, detail, to }: StatCardProps) {
  const body = (
    <>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {detail ? <span className="stat__detail">{detail}</span> : null}
    </>
  )

  if (to) {
    return (
      <Link className="stat" to={to}>
        {body}
      </Link>
    )
  }

  return <div className="stat">{body}</div>
}
