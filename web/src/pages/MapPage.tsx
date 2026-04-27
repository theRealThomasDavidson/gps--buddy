import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './pages.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { createMapDisplay } from '../map/createMapDisplay'
import { BrowserLocation } from '../map/location/BrowserLocation'
import { createDefaultChainedGeocoder } from '../map/geocoding/createGeocoder'
import type { IMapDisplay, MapPin } from '../map/display/IMapDisplay'
import { thumbtackPinGenerator } from '../map/display/ThumbtackPinGenerator'
import { createDefaultRoutingService } from '../map/routing/createRoutingService'
import type { LngLat, Route } from '../map/types'
import type { GeocodeResult } from '../map/geocoding/types'
import {
  MAP_BANNER_LOADING_DELAY_MS,
  MAP_BANNER_MIN_VISIBLE_MS,
  type MapBanner,
  type MapBannerResolveOutcome,
} from './mapBannerTiming'

const SAVED_PLACES_STORAGE_KEY = 'gps.demo.savedPlaces.v1'

type SavedPlaceV1 = {
  version: 1
  id: string
  label: string
  center: LngLat
  createdAtMs: number
}

const TRIP_MAX_STOPS = 8
const TRIP_DND_MIME = 'application/x-gps-trip-index'

type TripStop = {
  id: string
  label: string
  coords: LngLat | null
}

function newTripStop(): TripStop {
  return { id: crypto.randomUUID(), label: '', coords: null }
}

export function MapPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const displayRef = useRef<IMapDisplay | null>(null)
  const stopWatchRef = useRef<(() => void) | null>(null)
  const geocodeAbortRef = useRef<AbortController | null>(null)
  const routeAbortRef = useRef<AbortController | null>(null)
  const prevFixRef = useRef<{ coords: LngLat; timestampMs: number } | null>(null)
  const smoothedBearingRef = useRef<number | null>(null)
  const [mapBanner, setMapBanner] = useState<MapBanner | null>(null)
  const [mapBannerDismissed, setMapBannerDismissed] = useState(false)
  const bannerSeqRef = useRef(0)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [addressQuery, setAddressQuery] = useState('')
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [pinned, setPinned] = useState<GeocodeResult | null>(null)
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceV1[]>(() => loadSavedPlacesV1())
  const [mapReady, setMapReady] = useState(false)
  const [lastUserCoords, setLastUserCoords] = useState<LngLat | null>(null)
  const [routing, setRouting] = useState(false)
  const [activeRoute, setActiveRoute] = useState<Route | null>(null)
  const [tripStops, setTripStops] = useState<TripStop[]>(() => [newTripStop(), newTripStop()])
  const [tripDragOverIndex, setTripDragOverIndex] = useState<number | null>(null)
  const tripDragFromRef = useRef<number | null>(null)
  const followMyLocationRef = useRef(false)
  const [followingMyLocation, setFollowingMyLocation] = useState(false)

  const location = useMemo(() => new BrowserLocation(), [])
  const geocoder = useMemo(() => createDefaultChainedGeocoder(), [])
  const router = useMemo(() => createDefaultRoutingService(), [])

  const clearBannerTimer = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = null
    }
  }, [])

  const scheduleLoadingBanner = useCallback(
    (message: string): number => {
    clearBannerTimer()
    const id = ++bannerSeqRef.current
    bannerTimerRef.current = setTimeout(() => {
      bannerTimerRef.current = null
      if (bannerSeqRef.current !== id) return
      setMapBannerDismissed(false)
      setMapBanner({ tone: 'loading', message })
    }, MAP_BANNER_LOADING_DELAY_MS)
    return id
    },
    [clearBannerTimer],
  )

  const showErrorBanner = useCallback(
    (message: string) => {
    clearBannerTimer()
    bannerSeqRef.current++
    setMapBannerDismissed(false)
    setMapBanner({ tone: 'error', message })
    },
    [clearBannerTimer],
  )

  const resolveOpBanner = useCallback(
    (id: number, startTime: number, outcome: MapBannerResolveOutcome) => {
      clearBannerTimer()
      if (bannerSeqRef.current !== id) return
      const elapsed = Date.now() - startTime

      if (outcome.kind === 'hide') {
        setMapBanner(null)
        return
      }

      if (elapsed < MAP_BANNER_MIN_VISIBLE_MS) {
        setMapBanner(null)
        return
      }

      setMapBannerDismissed(false)
      if (outcome.kind === 'success') {
        setMapBanner({ tone: 'success', message: outcome.message })
        return
      }
      setMapBanner({ tone: 'info', message: outcome.message })
    },
    [clearBannerTimer],
  )

  const stopFollowingMyLocation = useCallback(() => {
    followMyLocationRef.current = false
    setFollowingMyLocation(false)
  }, [])

  const toggleFollowMyLocation = useCallback(() => {
    const display = displayRef.current
    if (!display || !lastUserCoords) return
    if (followMyLocationRef.current) {
      stopFollowingMyLocation()
      return
    }
    followMyLocationRef.current = true
    setFollowingMyLocation(true)
    display.setCenter(lastUserCoords, 15)
  }, [lastUserCoords, stopFollowingMyLocation])

  useEffect(() => () => clearBannerTimer(), [clearBannerTimer])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const display = createMapDisplay({ kind: 'raster' })
    displayRef.current = display
    display.mount(container)
    display.setUserMapInteractionHandler(() => {
      followMyLocationRef.current = false
      setFollowingMyLocation(false)
    })
    setMapReady(true)

    // Demo behavior: center once on initial load.
    ;(async () => {
      const t0 = Date.now()
      const bid = scheduleLoadingBanner('Requesting location…')
      try {
        const fix = await location.getCurrent()
        setLastUserCoords(fix.coords)
        display.setCenter(fix.coords, 15)
        display.showPositionFix({
          coords: fix.coords,
          bearingDegrees: fix.headingDegrees,
          speedMetersPerSecond: fix.speedMetersPerSecond,
        })
        resolveOpBanner(bid, t0, { kind: 'hide' })

        stopWatchRef.current?.()
        stopWatchRef.current = location.watch((wFix) => {
          const displayNow = displayRef.current
          if (!displayNow) return

          let bearing: number | undefined = wFix.headingDegrees

          if (bearing === undefined && prevFixRef.current) {
            const dtMs = wFix.timestampMs - prevFixRef.current.timestampMs
            const movedMeters = haversineMeters(prevFixRef.current.coords, wFix.coords)
            if (dtMs > 400 && movedMeters > 2) {
              bearing = bearingDegrees(prevFixRef.current.coords, wFix.coords)
            }
          }

          if (typeof bearing === 'number') {
            const prev = smoothedBearingRef.current
            smoothedBearingRef.current =
              prev === null ? bearing : lerpAngleDegrees(prev, bearing, 0.25)
          }

          prevFixRef.current = { coords: wFix.coords, timestampMs: wFix.timestampMs }
          setLastUserCoords(wFix.coords)

          if (followMyLocationRef.current) {
            displayNow.setCenter(wFix.coords)
          }

          displayNow.showPositionFix({
            coords: wFix.coords,
            bearingDegrees: smoothedBearingRef.current ?? undefined,
            speedMetersPerSecond: wFix.speedMetersPerSecond,
          })
        })
      } catch (e) {
        showErrorBanner(e instanceof Error ? e.message : 'Unable to get location.')
      }
    })()

    return () => {
      routeAbortRef.current?.abort()
      routeAbortRef.current = null
      setMapReady(false)
      stopWatchRef.current?.()
      stopWatchRef.current = null
      geocodeAbortRef.current?.abort()
      geocodeAbortRef.current = null
      prevFixRef.current = null
      smoothedBearingRef.current = null
      followMyLocationRef.current = false
      display.setUserMapInteractionHandler(null)
      display.unmount()
      displayRef.current = null
    }
  }, [location, resolveOpBanner, scheduleLoadingBanner, showErrorBanner])

  useEffect(() => {
    const display = displayRef.current
    if (!mapReady || !display) return

    const searchPins: MapPin[] = geocodeResults.map((r, idx) => ({
      id: geocodeResultPinId(r, idx),
      coords: r.center,
      title: r.label,
      accentColor: thumbtackPinGenerator.accent('yellow'),
    }))

    if (pinned) {
      const alreadyInResults = geocodeResults.some(
        (r) => r.label === pinned.label && r.center.lat === pinned.center.lat && r.center.lng === pinned.center.lng,
      )
      if (!alreadyInResults) {
        searchPins.push({
          id: `search:pinned:${pinned.center.lat.toFixed(6)}:${pinned.center.lng.toFixed(6)}:${pinned.label}`,
          coords: pinned.center,
          title: pinned.label,
          accentColor: thumbtackPinGenerator.accent('yellow'),
        })
      }
    }

    const savedPins: MapPin[] = savedPlaces.map((p) => ({
      id: p.id,
      coords: p.center,
      title: p.label,
    }))

    display.setSearchPins(searchPins)
    display.setSavedPins(savedPins)
  }, [geocodeResults, mapReady, pinned, savedPlaces])

  useEffect(() => {
    persistSavedPlacesV1(savedPlaces)
  }, [savedPlaces])

  async function searchAddress() {
    const q = addressQuery.trim()
    if (!q) {
      setGeocodeResults([])
      clearBannerTimer()
      bannerSeqRef.current++
      setMapBanner(null)
      return
    }

    geocodeAbortRef.current?.abort()
    const ac = new AbortController()
    geocodeAbortRef.current = ac

    const t0 = Date.now()
    const bid = scheduleLoadingBanner('Searching…')
    try {
      setGeocoding(true)
      const results = await geocoder.geocode(q, ac.signal)
      setGeocodeResults(results)
      setPinned(null)
      resolveOpBanner(
        bid,
        t0,
        results.length ? { kind: 'hide' } : { kind: 'info', message: 'No results for that search.' },
      )

      const display = displayRef.current
      if (display && results.length > 0) {
        stopFollowingMyLocation()
        display.setCenter(results[0].center, 15)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        clearBannerTimer()
        bannerSeqRef.current++
        return
      }
      showErrorBanner(e instanceof Error ? e.message : 'Search failed.')
      setGeocodeResults([])
    } finally {
      setGeocoding(false)
    }
  }

  function pickGeocodeResult(result: GeocodeResult) {
    const display = displayRef.current
    if (!display) return

    stopFollowingMyLocation()
    setPinned(result)
    display.setCenter(result.center, 16)
    // Keep the user marker as the “live location” marker; address selection just recenters for now.
  }

  function savePinnedPlace() {
    if (!pinned) return

    const next: SavedPlaceV1 = {
      version: 1,
      id: crypto.randomUUID(),
      label: pinned.label,
      center: pinned.center,
      createdAtMs: Date.now(),
    }

    setSavedPlaces((prev) => {
      const deduped = prev.filter(
        (p) => !(p.label === next.label && p.center.lat === next.center.lat && p.center.lng === next.center.lng),
      )
      return [next, ...deduped]
    })
  }

  function flyToSavedPlace(place: SavedPlaceV1) {
    const display = displayRef.current
    if (!display) return
    stopFollowingMyLocation()
    display.setCenter(place.center, 16)
  }

  function removeSavedPlace(id: string) {
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id))
  }

  const setTripStopAt = (index: number, coords: LngLat, label: string) => {
    setTripStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, coords, label: label.trim() || 'Stop' } : s)),
    )
  }

  const clearTripStopAt = (index: number) => {
    setTripStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, label: '', coords: null } : s)),
    )
  }

  const addTripStop = () => {
    setTripStops((prev) => (prev.length >= TRIP_MAX_STOPS ? prev : [...prev, newTripStop()]))
  }

  const removeLastTripStop = () => {
    setTripStops((prev) => (prev.length <= 2 ? prev : prev.slice(0, -1)))
  }

  const resetTripItinerary = () => {
    setTripStops([newTripStop(), newTripStop()])
  }

  const endTripListDrag = () => {
    tripDragFromRef.current = null
    setTripDragOverIndex(null)
  }

  const moveTripStop = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setTripStops((prev) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) return prev
      const next = [...prev]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, removed)
      return next
    })
  }

  const fillTripStopFromMe = (index: number) => {
    if (!lastUserCoords) return
    setTripStopAt(index, lastUserCoords, 'My location')
  }

  const fillTripStopFromPinned = (index: number) => {
    if (!pinned) return
    setTripStopAt(index, pinned.center, pinned.label)
  }

  const runTripFromItinerary = () => {
    const coords = tripStops.map((s) => s.coords).filter((c): c is LngLat => c !== null)
    if (coords.length < 2) {
      showErrorBanner('Set at least two trip points (use Me, Pinned, or assign a search/saved row to a point).')
      return
    }
    void runRouteWaypoints(coords)
  }

  async function runRouteWaypoints(waypoints: LngLat[]) {
    const display = displayRef.current
    if (!display || waypoints.length < 2) return

    routeAbortRef.current?.abort()
    const ac = new AbortController()
    routeAbortRef.current = ac

    const t0 = Date.now()
    const bid = scheduleLoadingBanner('Routing…')
    try {
      setRouting(true)
      const route = await router.route({ profile: 'drive', waypoints }, ac.signal)
      stopFollowingMyLocation()
      display.showRoute(route)
      display.fitRoute(route)
      setActiveRoute(route)
      const km = (route.distanceMeters ?? 0) / 1000
      const min = Math.round((route.durationSeconds ?? 0) / 60)
      resolveOpBanner(bid, t0, {
        kind: 'success',
        message: `Trip: ${km.toFixed(1)} km · ~${min} min`,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        clearBannerTimer()
        bannerSeqRef.current++
        return
      }
      display.showRoute(null)
      setActiveRoute(null)
      showErrorBanner(e instanceof Error ? e.message : 'Routing failed.')
    } finally {
      setRouting(false)
    }
  }

  function clearRoute() {
    routeAbortRef.current?.abort()
    routeAbortRef.current = null
    displayRef.current?.showRoute(null)
    setActiveRoute(null)
    setMapBanner(null)
  }

  return (
    <div className="page page--map">
      <header className="page__bar">
        <Link to="/">Home</Link>
        <span className="page__bar-title">Map</span>
        <Link to="/options">Options</Link>
      </header>
      <div className="page__map-wrap">
        <div className="page__map-tools" aria-label="Map tools">
          <button
            type="button"
            onClick={toggleFollowMyLocation}
            disabled={!lastUserCoords}
            aria-pressed={followingMyLocation}
            title={
              !lastUserCoords
                ? 'Need a location fix first (no cached position yet)'
                : followingMyLocation
                  ? 'Stop keeping the map centered on your position'
                  : 'Center on your position and keep following as you move'
            }
          >
            {followingMyLocation ? 'Following' : 'Center on me'}
          </button>
        </div>

        <div className="page__map-search" aria-label="Address search">
          <div className="page__map-search-row">
            <input
              className="page__map-search-input"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchAddress()
              }}
              placeholder="address search"
              aria-label="Address search"
            />
            <button type="button" onClick={() => void searchAddress()} disabled={geocoding}>
              search
            </button>
          </div>

          <div className="page__map-trip" aria-label="Trip itinerary">
            <h3 className="page__map-trip-title">Trip</h3>
            <p className="page__map-trip-hint">
              Fill points in order, then route. Drag the grip beside a row to reorder. Use Me / Pinned on a point, or
              assign a search or saved row via the dropdown.
            </p>
            <ol className="page__map-trip-stops">
              {tripStops.map((stop, index) => (
                <li
                  key={stop.id}
                  className={
                    tripDragOverIndex === index ? 'page__map-trip-stop page__map-trip-stop--over' : 'page__map-trip-stop'
                  }
                  onDragOver={(e) => {
                    if (routing) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setTripDragOverIndex(index)
                  }}
                  onDrop={(e) => {
                    if (routing) return
                    e.preventDefault()
                    const raw = e.dataTransfer.getData(TRIP_DND_MIME) || e.dataTransfer.getData('text/plain')
                    const parsed = raw === '' ? NaN : Number.parseInt(raw, 10)
                    const from = !Number.isNaN(parsed) ? parsed : tripDragFromRef.current
                    endTripListDrag()
                    if (from === null || Number.isNaN(from)) return
                    moveTripStop(from, index)
                  }}
                >
                  <div className="page__map-trip-stop-inner">
                    <div
                      className="page__map-trip-drag"
                      draggable={!routing}
                      title="Drag to reorder stops"
                      aria-label={`Drag to reorder point ${index + 1}`}
                      onDragStart={(e) => {
                        if (routing) {
                          e.preventDefault()
                          return
                        }
                        tripDragFromRef.current = index
                        e.dataTransfer.setData(TRIP_DND_MIME, String(index))
                        e.dataTransfer.setData('text/plain', String(index))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnd={endTripListDrag}
                    >
                      <span className="page__map-trip-drag-bar" />
                      <span className="page__map-trip-drag-bar" />
                      <span className="page__map-trip-drag-bar" />
                    </div>
                    <div className="page__map-trip-stop-body">
                      <div className="page__map-trip-stop-head">
                        <span className="page__map-trip-stop-label">Point {index + 1}</span>
                        <span className="page__map-trip-stop-value">{stop.coords ? stop.label : '— empty —'}</span>
                      </div>
                      <div className="page__map-trip-stop-actions">
                        <button
                          type="button"
                          onClick={() => fillTripStopFromMe(index)}
                          disabled={!lastUserCoords || routing}
                          title={!lastUserCoords ? 'Need a cached location first' : undefined}
                        >
                          Me
                        </button>
                        <button
                          type="button"
                          onClick={() => fillTripStopFromPinned(index)}
                          disabled={!pinned || routing}
                          title={!pinned ? 'Pin a search result first' : undefined}
                        >
                          Pinned
                        </button>
                        <button type="button" onClick={() => clearTripStopAt(index)} disabled={routing}>
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="page__map-trip-toolbar">
              <button type="button" onClick={addTripStop} disabled={tripStops.length >= TRIP_MAX_STOPS || routing}>
                Add stop
              </button>
              <button type="button" onClick={removeLastTripStop} disabled={tripStops.length <= 2 || routing}>
                Remove last stop
              </button>
              <button
                type="button"
                onClick={runTripFromItinerary}
                disabled={routing || tripStops.filter((s) => s.coords !== null).length < 2}
                title={
                  tripStops.filter((s) => s.coords !== null).length < 2
                    ? 'Fill at least two points before routing'
                    : undefined
                }
              >
                Route trip
              </button>
              <button type="button" onClick={clearRoute} disabled={routing}>
                Clear route line
              </button>
              <button type="button" onClick={resetTripItinerary} disabled={routing}>
                Reset trip points
              </button>
            </div>
          </div>

          {activeRoute?.steps?.length ? (
            <div className="page__map-directions" aria-label="Directions">
              <h3 className="page__map-directions-title">Directions</h3>
              <ol className="page__map-directions-list">
                {activeRoute.steps.slice(0, 40).map((s, i) => (
                  <li key={i} className="page__map-direction">
                    <div className="page__map-direction-main">{s.instruction}</div>
                    <div className="page__map-direction-meta">
                      {typeof s.distanceMeters === 'number' ? formatMeters(s.distanceMeters) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {pinned ? (
            <div className="page__map-pinned" aria-label="Pinned result">
              <div>pinned: {pinned.label}</div>
              <div className="page__map-pinned-actions">
                <button type="button" onClick={savePinnedPlace}>
                  Save pinned address
                </button>
              </div>
            </div>
          ) : null}

          {geocodeResults.length ? (
            <ol className="page__map-results" aria-label="Geocode results">
              {geocodeResults.map((r, idx) => (
                <li key={geocodeResultPinId(r, idx)}>
                  <div className="page__map-result-row">
                    <button type="button" className="page__map-result" onClick={() => pickGeocodeResult(r)}>
                      {r.label}
                    </button>
                    <label className="page__map-trip-assign-wrap">
                      <select
                        className="page__map-trip-assign"
                        aria-label={`Assign search result to trip point: ${r.label}`}
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '') return
                          setTripStopAt(Number(v), r.center, r.label)
                          e.currentTarget.selectedIndex = 0
                        }}
                      >
                        <option value="">To point…</option>
                        {tripStops.map((_, i) => (
                          <option key={i} value={String(i)}>
                            Point {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {savedPlaces.length ? (
            <div className="page__map-saved" aria-label="Saved addresses">
              <h3 className="page__map-saved-title">Saved</h3>
              <ol className="page__map-saved-list">
                {savedPlaces.map((p) => (
                  <li key={p.id}>
                    <div className="page__map-saved-row">
                      <button type="button" className="page__map-saved-label" onClick={() => flyToSavedPlace(p)}>
                        {p.label}
                      </button>
                      <label className="page__map-trip-assign-wrap">
                        <select
                          className="page__map-trip-assign"
                          aria-label={`Assign saved place to trip point: ${p.label}`}
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '') return
                            setTripStopAt(Number(v), p.center, p.label)
                            e.currentTarget.selectedIndex = 0
                          }}
                        >
                          <option value="">To point…</option>
                          {tripStops.map((_, i) => (
                            <option key={i} value={String(i)}>
                              Point {i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="page__map-saved-remove"
                        onClick={() => removeSavedPlace(p.id)}
                        aria-label={`Remove saved place: ${p.label}`}
                      >
                        remove
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <div className="page__map-stage">
          {!mapBannerDismissed && mapBanner ? (
            <div
              className={`page__map-alert page__map-alert--${mapBanner.tone}`}
              role={mapBanner.tone === 'error' ? 'alert' : 'status'}
              aria-live={mapBanner.tone === 'error' ? 'assertive' : 'polite'}
            >
              <div className="page__map-alert-body">{mapBanner.message}</div>
              <button
                type="button"
                className="page__map-alert-close"
                onClick={() => setMapBannerDismissed(true)}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          ) : null}

          <div ref={containerRef} className="page__map" role="region" aria-label="Map" />
        </div>
      </div>
    </div>
  )
}

function geocodeResultPinId(r: GeocodeResult, idx: number) {
  return `search:${idx}:${r.center.lat.toFixed(6)}:${r.center.lng.toFixed(6)}:${r.label}`
}

function loadSavedPlacesV1(): SavedPlaceV1[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const out: SavedPlaceV1[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Partial<SavedPlaceV1>
      if (rec.version !== 1) continue
      if (typeof rec.id !== 'string' || !rec.id) continue
      if (typeof rec.label !== 'string' || !rec.label) continue
      if (!rec.center || typeof rec.center.lat !== 'number' || typeof rec.center.lng !== 'number') continue
      if (typeof rec.createdAtMs !== 'number') continue
      out.push({
        version: 1,
        id: rec.id,
        label: rec.label,
        center: { lat: rec.center.lat, lng: rec.center.lng },
        createdAtMs: rec.createdAtMs,
      })
    }
    return out
  } catch {
    return []
  }
}

function persistSavedPlacesV1(places: SavedPlaceV1[]) {
  try {
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(places))
  } catch {
    // demo-only persistence
  }
}

function haversineMeters(a: LngLat, b: LngLat) {
  const R = 6371008.8
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180

  const sinΔφ = Math.sin(Δφ / 2)
  const sinΔλ = Math.sin(Δλ / 2)

  const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function bearingDegrees(from: LngLat, to: LngLat) {
  const φ1 = (from.lat * Math.PI) / 180
  const φ2 = (to.lat * Math.PI) / 180
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const θ = Math.atan2(y, x)
  const deg = ((θ * 180) / Math.PI + 360) % 360
  return deg
}

function lerpAngleDegrees(from: number, to: number, t: number) {
  const delta = ((to - from + 540) % 360) - 180
  return (from + delta * t + 360) % 360
}

function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) return ''
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

