import { Link } from 'react-router-dom'

import { AnchorIcon, BrandMark, GaugeIcon } from '../components/icons'

const CAPABILITIES = [
  {
    title: 'Buoy register, bay by bay',
    body:
      'Every mooring listed under its bay with the S/M/L size class, depth at chart datum and swing radius in metres, and whether it is free, taken or out of service.',
  },
  {
    title: 'Waitlist per mooring size',
    body:
      'Owners queue by size class in joining-date order. Positions are recomputed on every read, so the board always shows who is genuinely next.',
  },
  {
    title: 'Annual inspections with chain wear',
    body:
      'Record the date, the inspector and the chain wear found. One inspection per buoy per year, and anything at 50% or more is flagged for attention.',
  },
]

export function LandingScreen() {
  return (
    <div className="public">
      <header className="public__bar">
        <span className="public__brand">
          <BrandMark />
          Harbour Mooring Board
        </span>
        <Link className="btn btn--primary" to="/login">
          Staff sign in
        </Link>
      </header>

      <main className="public__main">
        <section className="public__hero">
          <p className="public__eyebrow">Harbour Point · staff tool</p>
          <h1 className="public__title">One board for moorings, the queue and the annual round.</h1>
          <p className="public__lede">
            The harbour office keeps three registers side by side: what is moored where, who is
            waiting for a berth of their size, and which ground tackle is due its next inspection.
            This is the working view of all three.
          </p>
          <div className="public__actions">
            <Link className="btn btn--primary" to="/login">
              <GaugeIcon />
              Open the board
            </Link>
            <a className="btn" href="/api/health">
              Service health
            </a>
          </div>
        </section>

        <section className="public__grid" aria-label="What the board holds">
          {CAPABILITIES.map((item) => (
            <article className="public__cell" key={item.title}>
              <AnchorIcon />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="public__foot">
        Seeded demonstration harbour · sign in with <strong>cenius@cenius.ai</strong> /{' '}
        <strong>cenius</strong>
      </footer>
    </div>
  )
}
