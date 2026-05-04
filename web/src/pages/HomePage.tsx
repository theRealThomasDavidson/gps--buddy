import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './pages.css'

const bottomNotes = [
  'Project notes and copy can grow here.',
  'Routing, basemaps, and GPS behavior will plug in later.',
]

function isUnreachableShortcutOrigin(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  const octets = hostname.split('.').map((x) => Number(x))
  if (octets.length !== 4 || octets.some((n) => !Number.isFinite(n))) return false
  const [a, b] = octets
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

export function HomePage() {
  const [standalonePwa, setStandalonePwa] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const sync = () => setStandalonePwa(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''
  const warnUnreachable =
    standalonePwa && typeof window !== 'undefined' && isUnreachableShortcutOrigin(window.location.hostname)

  return (
    <div className="page page--home">
      <header className="page__top">
        <Link className="page__primary" to="/map">
          Go to the map
        </Link>
        <nav className="page__subnav" aria-label="Secondary">
          <Link to="/options">Options</Link>
          {' · '}
          <Link to="/license">License</Link>
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
          <li>
            <strong>Offline (PWA):</strong> After a <strong>production</strong> build (<code>npm run build</code> +{' '}
            <code>npm run preview</code> or a deployed HTTPS site), open the app once while online so the service worker
            can save the app shell. Map tiles for areas you have already viewed are cached; new routing / search still
            needs a network. Dev mode (<code>npm run dev</code>) does not use the installable service worker.
          </li>
          <li>
            <strong>Add to Home Screen / Install:</strong> The icon opens the same URL you used when you saved it (
            {origin || 'this origin'}). On a phone, <code>localhost</code> means the phone, not your dev PC. A{' '}
            <code>192.168.x.x</code> address only works on that Wi‑Fi. For a shortcut that works on cellular or away
            from home, deploy the built app behind <strong>HTTPS</strong> (or use a tunnel like ngrok/Cloudflare for
            demos).
          </li>
          {warnUnreachable ? (
            <li>
              <strong>Installed app shows “can’t be reached”?</strong> This session is the standalone shortcut loading{' '}
              <code>{origin}</code>, which is only reachable on certain networks or while your dev server is running.
              Open the site from a stable HTTPS URL, then add to Home Screen again.
            </li>
          ) : null}
        </ul>
      </footer>
    </div>
  )
}
