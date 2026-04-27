import { Link } from 'react-router-dom'
import './pages.css'
import './OptionsPage.css'

/**
 * Demo options: only defaults are actionable; other choices are visible but disabled.
 */
export function OptionsPage() {
  return (
    <div className="page page--options">
      <header className="page__bar">
        <Link to="/">Home</Link>
        <span className="page__bar-title">Options</span>
        <Link to="/map">Map</Link>
      </header>

      <main className="options">
        <p className="options__demo-tag">Demo — only defaults are available</p>

        <form className="options__form" aria-label="Application options">
          <fieldset className="options__fieldset">
            <legend>Map look</legend>
            <label className="options__row">
              <span>Base view</span>
              <select name="baseView" defaultValue="roads">
                <option value="roads">Roads (default)</option>
                <option value="satellite" disabled title="Not in demo">
                  Satellite imagery
                </option>
                <option value="terrain" disabled title="Not in demo">
                  Terrain
                </option>
              </select>
            </label>

            <div className="options__row">
              <span>Layers</span>
              <div className="options__checks" role="group" aria-label="Map layers">
                <label className="options__check">
                  <input type="checkbox" name="layerLabels" defaultChecked />
                  <span>Labels</span>
                </label>
                <label className="options__check">
                  <input type="checkbox" name="layerBoundaries" disabled />
                  <span>Boundaries (not in demo)</span>
                </label>
                <label className="options__check">
                  <input type="checkbox" name="layerBike" disabled />
                  <span>Bicycle emphasis (not in demo)</span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className="options__fieldset">
            <legend>Routing</legend>
            <label className="options__row">
              <span>Services</span>
              <details className="options__dropdown">
                <summary className="options__dropdown-summary">
                  Choose routing services (default list)
                </summary>
                <div
                  className="options__checks"
                  role="group"
                  aria-label="Routing services"
                >
                  <label className="options__check">
                    <input type="checkbox" name="svc_openrouteservice" disabled />
                    <span>OpenRouteService (not in demo)</span>
                  </label>
                  <label className="options__check">
                    <input type="checkbox" name="svc_graphhopper" disabled />
                    <span>GraphHopper (not in demo)</span>
                  </label>
                  <label className="options__check">
                    <input type="checkbox" name="svc_osrm" disabled />
                    <span>OSRM (not in demo)</span>
                  </label>
                  <label className="options__check">
                    <input type="checkbox" name="svc_valhalla" disabled />
                    <span>Valhalla (not in demo)</span>
                  </label>
                  <label className="options__check">
                    <input type="checkbox" name="svc_brouter" disabled />
                    <span>BRouter (not in demo)</span>
                  </label>
                </div>
              </details>
            </label>

            <label className="options__row">
              <span>Mode</span>
              <select name="routingMode" defaultValue="drive" disabled>
                <option value="drive">Drive</option>
                <option value="walk">Walk</option>
                <option value="bike">Bike</option>
              </select>
            </label>

            <div className="options__row">
              <span>Options</span>
              <div className="options__checks" role="group" aria-label="Routing options">
                <label className="options__check">
                  <input type="checkbox" name="avoidHighways" disabled />
                  <span>Avoid highways (not in demo)</span>
                </label>
                <label className="options__check">
                  <input type="checkbox" name="avoidTolls" disabled />
                  <span>Avoid tolls (not in demo)</span>
                </label>
                <label className="options__check">
                  <input type="checkbox" name="avoidFerries" disabled />
                  <span>Avoid ferries (not in demo)</span>
                </label>
              </div>
            </div>

            <p className="options__hint">
              Routing providers and their parameters will be wired later; this is
              a placeholder for the settings UI.
            </p>
          </fieldset>

          <fieldset className="options__fieldset">
            <legend>Basemap</legend>
            <label className="options__row">
              <span>Style</span>
              <select name="basemap" defaultValue="standard">
                <option value="standard">Standard (cartographic)</option>
              </select>
            </label>
          </fieldset>

          <fieldset className="options__fieldset">
            <legend>Units</legend>
            <label className="options__row">
              <span>Distance & speed</span>
              <select name="units" defaultValue="imperial">
                <option value="imperial">Imperial (default)</option>
              </select>
            </label>
            <label className="options__row">
              <span>Coordinates</span>
              <select name="coords" defaultValue="decimal">
                <option value="decimal">Decimal degrees</option>
              </select>
            </label>
          </fieldset>

          <fieldset className="options__fieldset">
            <legend>Location</legend>
            <label className="options__row options__row--check">
              <input type="checkbox" name="highAccuracy" disabled />
              <span>High-accuracy GPS (coming later)</span>
            </label>
            <label className="options__row">
              <span>Position updates</span>
              <select name="refresh" defaultValue="normal">
                <option value="normal">Normal</option>
              </select>
            </label>
          </fieldset>

          <p className="options__hint">
            Saving preferences is not wired yet; controls are for layout and copy
            review only.
          </p>
        </form>
      </main>
    </div>
  )
}
