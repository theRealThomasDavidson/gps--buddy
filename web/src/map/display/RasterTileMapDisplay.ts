import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl'
import type { BaseView, LngLat, MapLayerState, Route } from '../types'
import type { IMapDisplay, MapPin, PositionFixDisplay } from './IMapDisplay'
import { thumbtackPinGenerator } from './ThumbtackPinGenerator'
import userLocationIconUrl from '../../assets/user-location.svg'

/**
 * Default overlay anchoring for MapLibre markers in this app.
 *
 * We treat the geographic point as the **visual center** of overlay icons unless
 * a specific overlay intentionally needs a different anchor (e.g. a pin stem).
 */
const DEFAULT_MARKER_ANCHOR: maplibregl.PositionAnchor = 'center'
const PIN_MARKER_ANCHOR: maplibregl.PositionAnchor = 'bottom'

const DEFAULT_SAVED_PIN_ACCENT = '#E11D48'

const ROUTE_SOURCE_ID = 'app-route-geojson'
const ROUTE_LAYER_ID = 'app-route-line'

// Debug-only: when true, render the direction wedge pointing north while stationary.
const DEBUG_LOCK_DIRECTION_WEDGE_NORTH_WHEN_STATIONARY = false

type RasterTileMapDisplayOptions = {
  /**
   * Raster tile URL template.
   * Default is OSM Standard; do not use this for heavy production traffic.
   */
  tilesUrl?: string
  attributionHtml?: string
  initialCenter?: LngLat
  initialZoom?: number
}

export class RasterTileMapDisplay implements IMapDisplay {
  private map: MapLibreMap | null = null
  private positionMarker: maplibregl.Marker | null = null
  private arrowEl: HTMLDivElement | null = null
  private readonly searchMarkers = new Map<string, maplibregl.Marker>()
  private readonly savedMarkers = new Map<string, maplibregl.Marker>()
  private readonly options: RasterTileMapDisplayOptions

  constructor(options: RasterTileMapDisplayOptions = {}) {
    this.options = options
  }

  mount(container: HTMLElement) {
    const center = this.options.initialCenter ?? { lng: -73.9857, lat: 40.7484 }
    const zoom = this.options.initialZoom ?? 12

    const tilesUrl =
      this.options.tilesUrl ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

    const attribution =
      this.options.attributionHtml ??
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'

    this.map = new maplibregl.Map({
      container,
      center: [center.lng, center.lat],
      zoom,
      style: {
        version: 8,
        name: 'OSM Standard (raster)',
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: [tilesUrl],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution,
          },
        },
        layers: [
          {
            id: 'osm-raster-layer',
            type: 'raster',
            source: 'osm-raster',
          },
        ],
      },
    })

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }))
  }

  unmount() {
    this.positionMarker?.remove()
    this.positionMarker = null
    this.arrowEl = null
    for (const m of this.searchMarkers.values()) m.remove()
    this.searchMarkers.clear()
    for (const m of this.savedMarkers.values()) m.remove()
    this.savedMarkers.clear()
    this.clearRouteLayer()
    this.map?.remove()
    this.map = null
  }

  setBaseView(view: BaseView) {
    // Raster OSM Standard is one baked basemap. We accept the call for API stability.
    if (view !== 'roads') return
  }

  setLayers(layers: MapLayerState) {
    // Raster tiles do not support meaningful layer toggles (roads/labels are baked in).
    void layers
  }

  setCenter(center: LngLat, zoom?: number) {
    if (!this.map) return
    if (typeof zoom === 'number') {
      this.map.easeTo({ center: [center.lng, center.lat], zoom })
      return
    }
    this.map.easeTo({ center: [center.lng, center.lat] })
  }

  showRoute(route: Route | null) {
    if (!this.map) return

    if (!this.map.isStyleLoaded()) {
      this.map.once('load', () => this.showRoute(route))
      return
    }

    this.clearRouteLayer()
    if (!route) return

    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: route.geometry.map((p) => [p.lng, p.lat]),
      },
    }

    this.map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data,
    })

    this.map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#1d4ed8',
        'line-width': 4,
        'line-opacity': 0.88,
      },
    })
  }

  private clearRouteLayer() {
    const map = this.map
    if (!map) return
    if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID)
    if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID)
  }

  showPositionFix(fix: PositionFixDisplay | null) {
    if (!this.map) return

    if (!fix) {
      this.positionMarker?.remove()
      this.positionMarker = null
      this.arrowEl = null
      return
    }

    if (!this.positionMarker) {
      const el = document.createElement('div')
      el.style.position = 'relative'
      el.style.width = '56px'
      el.style.height = '56px'
      el.style.pointerEvents = 'none'

      const img = document.createElement('img')
      img.src = userLocationIconUrl
      img.alt = 'Your location'
      img.width = 40
      img.height = 40
      img.style.position = 'absolute'
      img.style.left = '50%'
      img.style.top = '50%'
      img.style.transform = 'translate(-50%, -50%)'
      img.style.display = 'block'
      img.style.filter = 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25))'
      img.style.zIndex = '1'
      el.appendChild(img)

      // === DIRECTION ARROW (BEGIN) ===
      // Full-size overlay that rotates; the wedge sits in the icon's blue ring.
      const arrowWrap = document.createElement('div')
      arrowWrap.style.position = 'absolute'
      arrowWrap.style.left = '0'
      arrowWrap.style.top = '0'
      arrowWrap.style.width = '56px'
      arrowWrap.style.height = '56px'
      arrowWrap.style.zIndex = '2'
      arrowWrap.style.pointerEvents = 'none'
      arrowWrap.style.transformOrigin = '50% 50%'
      arrowWrap.setAttribute('aria-hidden', 'true')

      const wedge = document.createElement('div')
      wedge.style.position = 'absolute'
      wedge.style.left = '50%'
      // Sit on the dark-blue inner ring (r=12 @ 64px svg, scaled to 40px inside 56px box).
      wedge.style.top = '18px'
      wedge.style.transform = 'translateX(-50%)'
      wedge.style.width = '0'
      wedge.style.height = '0'
      wedge.style.borderLeft = '3.5px solid transparent'
      wedge.style.borderRight = '3.5px solid transparent'
      wedge.style.borderBottom = '6.3px solid #facc15'
      wedge.style.filter = 'drop-shadow(0 2px 0 rgba(0,0,0,0.25)) drop-shadow(0 2px 8px rgba(0,0,0,0.35))'

      arrowWrap.appendChild(wedge)
      el.appendChild(arrowWrap)
      this.arrowEl = arrowWrap
      // === DIRECTION ARROW (END) ===

      this.positionMarker = new maplibregl.Marker({ element: el, anchor: DEFAULT_MARKER_ANCHOR })
        .setLngLat([fix.coords.lng, fix.coords.lat])
        .addTo(this.map)
    } else {
      this.positionMarker.setLngLat([fix.coords.lng, fix.coords.lat])
    }

    if (this.arrowEl) {
      // === DIRECTION ARROW ROTATION/VISIBILITY (BEGIN) ===
      // Hide direction arrow when effectively stationary (< 1 mph).
      const speedMps = fix.speedMetersPerSecond
      const showArrow = (typeof speedMps === 'number' && speedMps >= 0.44704) || DEBUG_LOCK_DIRECTION_WEDGE_NORTH_WHEN_STATIONARY
      this.arrowEl.style.display = showArrow ? 'block' : 'none'

      const bearing = typeof fix.bearingDegrees === 'number' ? fix.bearingDegrees : 0
      // Arrow points "up" at 0° bearing; rotate clockwise.
      this.arrowEl.style.transform = `rotate(${bearing}deg)`
      // === DIRECTION ARROW ROTATION/VISIBILITY (END) ===
    }
  }

  setSearchPins(pins: MapPin[]) {
    this.syncPinMarkers(this.searchMarkers, pins, thumbtackPinGenerator.accent('yellow'), 'Search result')
  }

  setSavedPins(pins: MapPin[]) {
    this.syncPinMarkers(this.savedMarkers, pins, DEFAULT_SAVED_PIN_ACCENT, 'Saved place')
  }

  private syncPinMarkers(
    markerMap: Map<string, maplibregl.Marker>,
    pins: MapPin[],
    defaultAccent: string,
    defaultAlt: string,
  ) {
    if (!this.map) return

    const nextIds = new Set<string>()
    for (const pin of pins) {
      nextIds.add(pin.id)
      const accent = pin.accentColor ?? defaultAccent
      const label = pin.title?.trim() ? pin.title : defaultAlt
      const existing = markerMap.get(pin.id)
      if (existing) {
        existing.setLngLat([pin.coords.lng, pin.coords.lat])
        const root = existing.getElement() as HTMLDivElement | null
        if (root) {
          root.style.color = accent
          root.setAttribute('aria-label', label)
        }
        continue
      }

      const el = thumbtackPinGenerator.generate({ accentColorCss: accent, title: label })

      const marker = new maplibregl.Marker({ element: el, anchor: PIN_MARKER_ANCHOR })
        .setLngLat([pin.coords.lng, pin.coords.lat])
        .addTo(this.map)

      markerMap.set(pin.id, marker)
    }

    for (const [id, marker] of markerMap.entries()) {
      if (nextIds.has(id)) continue
      marker.remove()
      markerMap.delete(id)
    }
  }
}

