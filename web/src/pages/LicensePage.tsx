import { Link } from 'react-router-dom'
import './pages.css'

const MIT_LICENSE = `MIT License

Copyright (c) 2026 the project contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

/** Served from `web/public/LICENSE` at deploy time; repo root `LICENSE` is the same text. */
const licenseFileUrl = `${import.meta.env.BASE_URL}LICENSE`

export function LicensePage() {
  return (
    <div className="page page--license">
      <header className="page__bar">
        <Link to="/">Home</Link>
        <span className="page__bar-title">License &amp; attribution</span>
        <Link to="/map">Map</Link>
      </header>

      <main className="page__license">
        <p className="page__license-lede">
          This page summarizes how this app is licensed, how we credit map data and
          libraries, and how public network services fit in. It is not legal advice.
        </p>

        <section className="page__license-section" aria-labelledby="license-mit-heading">
          <h2 id="license-mit-heading">Application source code</h2>
          <p>
            The application&apos;s own source code is intended to be released under the{' '}
            <strong>MIT License</strong>. Using or deploying this software (including from a host
            such as Vercel) is governed by that license and by the notices below.
          </p>
          <p>
            <a href={licenseFileUrl}>Plain-text LICENSE file</a> (bundled with this site; same text
            as in the repository root).
          </p>
          <pre className="page__license-pre" tabIndex={0}>
            {MIT_LICENSE}
          </pre>
        </section>

        <section className="page__license-section" aria-labelledby="license-osm-heading">
          <h2 id="license-osm-heading">Map data (OpenStreetMap)</h2>
          <p>
            Default raster map tiles come from the OpenStreetMap community tile service (
            <code>tile.openstreetmap.org</code>). OpenStreetMap data is licensed under the{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              Open Database License (ODbL)
            </a>
            . You must keep map attribution visible for end users: typically{' '}
            <strong>© OpenStreetMap contributors</strong> with a link to the copyright page, as
            shown on the map in this app. If you switch tile providers, update attribution to
            match that provider&apos;s requirements.
          </p>
        </section>

        <section className="page__license-section" aria-labelledby="license-net-heading">
          <h2 id="license-net-heading">Third-party network services</h2>
          <p>
            These public endpoints are used at runtime. They do not dictate which open-source
            license you use for <em>your</em> code, but each has its own acceptable-use rules,
            rate limits, and (for some) attribution expectations. Follow their current policies if
            you run your own deployment.
          </p>
          <ul className="page__license-list">
            <li>
              <strong>Photon</strong> — <code>photon.komoot.io</code> (geocoding). Public Komoot
              instance; fair-use limits apply.
            </li>
            <li>
              <strong>Open-Meteo Geocoding</strong> —{' '}
              <code>geocoding-api.open-meteo.com</code>. See{' '}
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                open-meteo.com
              </a>{' '}
              for terms.
            </li>
            <li>
              <strong>Nominatim</strong> — <code>nominatim.openstreetmap.org</code>. Strict usage
              policy; identifiable application contact is expected at scale. See the{' '}
              <a
                href="https://operations.osmfoundation.org/policies/nominatim/"
                target="_blank"
                rel="noreferrer"
              >
                OSMF Nominatim usage policy
              </a>
              . This app can pass <code>email=</code> when <code>VITE_CONTACT_EMAIL</code> is set.
            </li>
            <li>
              <strong>Valhalla (routing)</strong> —{' '}
              <code>valhalla1.openstreetmap.de</code> (FOSSGIS public API). Development/demo style
              use; no API key. Heavy production traffic should use your own Valhalla or another
              routing provider.
            </li>
          </ul>
        </section>

        <section className="page__license-section" aria-labelledby="license-npm-heading">
          <h2 id="license-npm-heading">Bundled open-source libraries</h2>
          <p>
            The built web app includes dependencies (for example React, Vite, MapLibre GL, and
            testing tools). Each package is under its own license (MIT, ISC, Apache-2.0, BSD,
            etc.). For a full list, run <code>npm install</code> and inspect{' '}
            <code>package.json</code> / <code>node_modules/&lt;package&gt;/package.json</code>, or
            generate a third-party notices file as part of your release process. Those licenses
            govern the library code, not your application&apos;s MIT license above.
          </p>
        </section>
      </main>
    </div>
  )
}
