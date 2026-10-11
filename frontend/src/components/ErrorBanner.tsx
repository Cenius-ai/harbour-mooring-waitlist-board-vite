interface ErrorBannerProps {
  message: string
  detail?: string
  onRetry?: () => void
}

/** A failed load always names the failure and offers to run the same call again. */
export function ErrorBanner({ message, detail, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__text">
        <span className="error-banner__title">{message}</span>
        {detail ? <span>{detail}</span> : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}
