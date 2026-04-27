import { Link } from 'react-router-dom'
import './pages.css'

const bottomNotes = [
  'Project notes and copy can grow here.',
  'Routing, basemaps, and GPS behavior will plug in later.',
]

export function HomePage() {
  return (
    <div className="page page--home">
      <header className="page__top">
        <Link className="page__primary" to="/map">
          Go to the map
        </Link>
        <nav className="page__subnav" aria-label="Secondary">
          <Link to="/options">Options</Link>
        </nav>
      </header>

      <main className="page__main">
        <h1 className="page__title">GPS / map experiment</h1>
        <p className="page__lede">
          Landing shell: map and settings are separate routes for now.
        </p>
      </main>

      <footer className="page__notes" aria-label="Project notes">
        <h2 className="page__notes-heading">Notes</h2>
        <ul className="page__notes-list">
          {bottomNotes.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </footer>
    </div>
  )
}
