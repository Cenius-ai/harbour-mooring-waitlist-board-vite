import { Link } from 'react-router-dom'

/** An in-shell 404: the navigation stays, only the panel changes. */
export function NotFoundScreen() {
  return (
    <div className="error-page">
      <div className="error-page__inner">
        <h1 className="page-header__title">That screen does not exist</h1>
        <p className="muted">
          The board has an overview, a buoy register, the owner waitlist and the inspections
          ledger. Pick one of those.
        </p>
        <div className="row">
          <Link className="btn btn--primary" to="/dashboard">
            Harbour overview
          </Link>
          <Link className="btn" to="/buoys">
            Buoy register
          </Link>
        </div>
      </div>
    </div>
  )
}
