interface SkeletonRowsProps {
  rows?: number
  label: string
}

/** Loading placeholder shaped like the content it replaces. */
export function SkeletonRows({ rows = 5, label }: SkeletonRowsProps) {
  return (
    <div className="skeleton-stack" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={index}
          className="skeleton"
          style={{ height: index === 0 ? '1.5rem' : '2rem', width: index === 0 ? '40%' : '100%' }}
        />
      ))}
    </div>
  )
}
