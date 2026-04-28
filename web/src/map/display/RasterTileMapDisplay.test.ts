import maplibregl from 'maplibre-gl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RasterTileMapDisplay } from './RasterTileMapDisplay'

vi.mock('maplibre-gl', () => {
  type LngLatLike = [number, number]
  type MarkerOptions = { element?: HTMLDivElement }
  type EaseToOptions = {
    center: LngLatLike
    zoom?: number
    bearing?: number
    pitch?: number
    padding?: unknown
    duration?: number
    essential?: boolean
  }

  class LngLatBounds {
    sw: LngLatLike
    ne: LngLatLike
    constructor(a: LngLatLike, b: LngLatLike) {
      this.sw = [...a] as LngLatLike
      this.ne = [...b] as LngLatLike
    }
    extend(p: LngLatLike) {
      this.sw[0] = Math.min(this.sw[0], p[0])
      this.sw[1] = Math.min(this.sw[1], p[1])
      this.ne[0] = Math.max(this.ne[0], p[0])
      this.ne[1] = Math.max(this.ne[1], p[1])
      return this
    }
  }

  class Marker {
    private el: HTMLDivElement
    removed = false
    setLngLatCalls = 0
    lastLngLat: LngLatLike | null = null
    constructor(opts: MarkerOptions) {
      this.el = opts.element ?? document.createElement('div')
    }
    setLngLat(lngLat: LngLatLike) {
      this.setLngLatCalls++
      this.lastLngLat = lngLat
      return this
    }
    addTo() {
      return this
    }
    remove() {
      this.removed = true
    }
    getElement() {
      return this.el
    }
  }

  class NavigationControl {
    constructor() {}
  }

  /** Test double for `maplibregl.Map`; internal name avoids clashing with the built-in `Map` type. */
  class MockCartoMap {
    controls: unknown[] = []
    removed = false
    easeCalls: EaseToOptions[] = []
    flyCalls: EaseToOptions[] = []
    fitBoundsCalls: Array<{ bounds: unknown; options: unknown }> = []
    cameraForBoundsCalls: Array<{ bounds: unknown; options: unknown }> = []
    sources = new Set<string>()
    layers = new Set<string>()
    styleLoaded = true
    onLoadHandlers: Array<() => void> = []
    private handlers = new Map<string, Array<(e: unknown) => void>>()
    cameraForBoundsReturnsUndefined = false

    constructor() {}
    addControl(c: unknown) {
      this.controls.push(c)
    }
    remove() {
      this.removed = true
    }
    easeTo(opts: EaseToOptions) {
      this.easeCalls.push(opts)
    }
    flyTo(opts: EaseToOptions) {
      this.flyCalls.push(opts)
    }
    cameraForBounds(bounds: unknown, options: unknown) {
      this.cameraForBoundsCalls.push({ bounds, options })
      if (this.cameraForBoundsReturnsUndefined) return undefined
      const box = bounds as { sw: [number, number]; ne: [number, number] }
      const minLng = Math.min(box.sw[0], box.ne[0])
      const maxLng = Math.max(box.sw[0], box.ne[0])
      const minLat = Math.min(box.sw[1], box.ne[1])
      const maxLat = Math.max(box.sw[1], box.ne[1])
      return {
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as LngLatLike,
        zoom: 10,
        bearing: 0,
      }
    }
    fitBounds(bounds: unknown, options: unknown) {
      this.fitBoundsCalls.push({ bounds, options })
    }
    resize() {
      // no-op; real MapLibre updates canvas size from the container
    }
    isStyleLoaded() {
      return this.styleLoaded
    }
    once(event: string, cb: () => void) {
      if (event === 'load') this.onLoadHandlers.push(cb)
    }
    triggerLoad() {
      for (const cb of this.onLoadHandlers.splice(0)) cb()
    }
    getSource(id: string) {
      return this.sources.has(id) ? {} : undefined
    }
    addSource(id: string) {
      this.sources.add(id)
    }
    removeSource(id: string) {
      this.sources.delete(id)
    }
    getLayer(id: string) {
      return this.layers.has(id) ? {} : undefined
    }
    addLayer(layer: { id: unknown }) {
      this.layers.add(String(layer.id))
    }
    removeLayer(id: string) {
      this.layers.delete(id)
    }
    on(event: string, fn: (e: unknown) => void) {
      const list = this.handlers.get(event) ?? []
      list.push(fn)
      this.handlers.set(event, list)
    }
    off(event: string, fn: (e: unknown) => void) {
      const list = this.handlers.get(event)
      if (!list) return
      const i = list.indexOf(fn)
      if (i >= 0) list.splice(i, 1)
    }
    emit(event: string, payload: unknown) {
      this.handlers.get(event)?.forEach((fn) => fn(payload))
    }
  }

  return {
    default: { Map: MockCartoMap, Marker, NavigationControl, LngLatBounds },
    Map: MockCartoMap,
    Marker,
    NavigationControl,
    LngLatBounds,
  }
})

vi.mock('../../assets/user-location.svg', () => ({ default: 'user-location.svg' }))

describe('RasterTileMapDisplay', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  /** Route updates are flushed in a microtask; await this after `showRoute` / `fitRoute` before asserting. */
  async function flushRouteMicrotasks() {
    await Promise.resolve()
  }

  type DisplayPrivates = {
    map: unknown
    positionMarker: unknown
    arrowEl: unknown
    searchMarkers: unknown
    savedMarkers: unknown
  }

  it('implements basic lifecycle and no-op configuration methods', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    expect(() => d.setBaseView('roads')).not.toThrow()
    expect(() => d.setLayers({ labels: true })).not.toThrow()

    d.unmount()
    expect(() => d.unmount()).not.toThrow()
  })

  it('setUserMapInteractionHandler fires only for events with originalEvent', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    const fn = vi.fn()
    d.setUserMapInteractionHandler(fn)

    const map = (d as unknown as DisplayPrivates).map as {
      emit: (event: string, payload: unknown) => void
    }

    map.emit('dragstart', { originalEvent: new MouseEvent('mousedown') })
    expect(fn).toHaveBeenCalledTimes(1)

    map.emit('dragstart', { originalEvent: undefined })
    map.emit('dragstart', {})
    expect(fn).toHaveBeenCalledTimes(1)

    d.setUserMapInteractionHandler(null)
    map.emit('dragstart', { originalEvent: new MouseEvent('mousedown') })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('setBaseView ignores non-roads views for the raster basemap', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    expect(() => d.setBaseView('satellite')).not.toThrow()
    expect(() => d.setBaseView('terrain')).not.toThrow()
  })

  it('setCenter calls through to map.easeTo', async () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    // Access the private map via a cast; this is a unit test seam.
    const map = (d as unknown as DisplayPrivates).map as { easeCalls: Array<unknown> }
    d.setCenter({ lng: 1, lat: 2 })
    d.setCenter({ lng: 3, lat: 4 }, 9)

    expect(map.easeCalls).toEqual([
      { center: [1, 2] },
      { center: [3, 4], zoom: 9 },
    ])
  })


  it('showRoute adds and clears route layers', async () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)
    const map = (d as unknown as DisplayPrivates).map as { sources: Set<string>; layers: Set<string> }

    d.showRoute({
      id: 'r',
      provider: 'x',
      profile: 'drive',
      geometry: [
        { lng: 0, lat: 0 },
        { lng: 1, lat: 1 },
      ],
    })
    await flushRouteMicrotasks()

    expect(map.sources.has('app-route-geojson')).toBe(true)
    expect(map.layers.has('app-route-line')).toBe(true)

    d.showRoute(null)
    await flushRouteMicrotasks()
    expect(map.sources.has('app-route-geojson')).toBe(false)
    expect(map.layers.has('app-route-line')).toBe(false)
  })

  it('fitRoute fits bounds to the route geometry after showRoute', async () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    const map = (d as unknown as DisplayPrivates).map as {
      cameraForBoundsCalls: Array<{ bounds: { sw: [number, number]; ne: [number, number] }; options: unknown }>
      easeCalls: Array<{ duration?: number; maxZoom?: unknown }>
      fitBoundsCalls: unknown[]
    }

    const route = {
      id: 'r',
      provider: 'x',
      profile: 'drive' as const,
      geometry: [
        { lng: 0, lat: 0 },
        { lng: 2, lat: 1 },
      ],
    }

    d.showRoute(route)
    d.fitRoute(route)
    await flushRouteMicrotasks()

    expect(map.cameraForBoundsCalls.length).toBe(1)
    expect(map.fitBoundsCalls.length).toBe(0)
    expect(map.cameraForBoundsCalls[0]?.options).toEqual(
      expect.objectContaining({
        maxZoom: 16,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    )
    expect(map.easeCalls[0]).toEqual(expect.objectContaining({ duration: 650, zoom: 10, bearing: 0 }))

    // Min/max of vertices, then ROUTE_FIT_GEO_PADDING_FRACTION (0.1) of span padded on each side (lng span 2, lat span 1).
    const b = map.cameraForBoundsCalls[0]!.bounds
    expect(b.sw[0]).toBeCloseTo(-0.2, 10)
    expect(b.ne[0]).toBeCloseTo(2.2, 10)
    expect(b.sw[1]).toBeCloseTo(-0.1, 10)
    expect(b.ne[1]).toBeCloseTo(1.1, 10)
  })

  it('fitRoute passes bounds whose axis-aligned box contains every vertex (arc-like polyline)', async () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    const map = (d as unknown as DisplayPrivates).map as {
      cameraForBoundsCalls: Array<{ bounds: { sw: [number, number]; ne: [number, number] } }>
    }

    // Quarter-circle in lng/lat: mid-arc points extend past the straight chord between endpoints.
    const centerLng = -73.97
    const centerLat = 40.75
    const rDeg = 0.012
    const geometry: Array<{ lng: number; lat: number }> = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const angle = (Math.PI / 2) * t
      geometry.push({
        lng: centerLng + rDeg * Math.cos(angle),
        lat: centerLat + rDeg * Math.sin(angle),
      })
    }

    const route = {
      id: 'r',
      provider: 'x',
      profile: 'drive' as const,
      geometry,
    }

    d.showRoute(route)
    d.fitRoute(route)
    await flushRouteMicrotasks()

    expect(map.cameraForBoundsCalls.length).toBe(1)
    const b = map.cameraForBoundsCalls[0]!.bounds
    const minLng = Math.min(b.sw[0], b.ne[0])
    const maxLng = Math.max(b.sw[0], b.ne[0])
    const minLat = Math.min(b.sw[1], b.ne[1])
    const maxLat = Math.max(b.sw[1], b.ne[1])

    for (const p of geometry) {
      expect(p.lng).toBeGreaterThanOrEqual(minLng)
      expect(p.lng).toBeLessThanOrEqual(maxLng)
      expect(p.lat).toBeGreaterThanOrEqual(minLat)
      expect(p.lat).toBeLessThanOrEqual(maxLat)
    }

    // Sanity: envelope is not degenerate (arc reaches north of the chord).
    expect(maxLat - minLat).toBeGreaterThan(rDeg * 0.35)
  })

  it('fitRoute warns and does not call camera when geometry has fewer than two points', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    const map = (d as unknown as DisplayPrivates).map as {
      cameraForBoundsCalls: unknown[]
      fitBoundsCalls: unknown[]
      easeCalls: unknown[]
    }

    d.fitRoute({
      id: 'r',
      provider: 'x',
      profile: 'drive',
      geometry: [{ lng: 0, lat: 0 }],
    })

    expect(warnSpy).toHaveBeenCalledWith(
      '[route cameraForBounds] skipped: route geometry needs at least two points',
    )
    expect(map.cameraForBoundsCalls.length).toBe(0)
    expect(map.fitBoundsCalls.length).toBe(0)
    expect(map.easeCalls.length).toBe(0)
    warnSpy.mockRestore()
  })

  it('fitRoute uses fitBounds when cameraForBounds returns undefined', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    const map = (d as unknown as DisplayPrivates).map as {
      cameraForBoundsReturnsUndefined: boolean
      cameraForBoundsCalls: unknown[]
      fitBoundsCalls: Array<{ bounds: unknown; options: unknown }>
      easeCalls: unknown[]
    }
    map.cameraForBoundsReturnsUndefined = true

    d.fitRoute({
      id: 'r',
      provider: 'x',
      profile: 'drive' as const,
      geometry: [
        { lng: 0, lat: 0 },
        { lng: 1, lat: 0 },
      ],
    })

    expect(map.cameraForBoundsCalls.length).toBe(1)
    expect(map.fitBoundsCalls.length).toBe(1)
    expect(map.fitBoundsCalls[0]?.options).toEqual(
      expect.objectContaining({
        maxZoom: 16,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: 650,
      }),
    )
    expect(map.easeCalls.length).toBe(0)
  })

  it('fitRoute is a no-op when the map has never been mounted', () => {
    const d = new RasterTileMapDisplay()
    expect(() =>
      d.fitRoute({
        id: 'r',
        provider: 'x',
        profile: 'drive',
        geometry: [
          { lng: 0, lat: 0 },
          { lng: 1, lat: 1 },
        ],
      }),
    ).not.toThrow()
  })

  it('applyCameraForBounds returns early when map reference is null', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)
    const bounds = new maplibregl.LngLatBounds([0, 0], [1, 1])
    ;(d as unknown as { map: null }).map = null
    const apply = (d as unknown as { applyCameraForBounds: (b: maplibregl.LngLatBounds) => void })
      .applyCameraForBounds
    expect(() => apply.call(d, bounds)).not.toThrow()
  })

  it('showPositionFix creates and updates the marker element, and clears on null', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.showPositionFix({
      coords: { lng: -73, lat: 40 },
      bearingDegrees: 0,
      speedMetersPerSecond: 0,
    })

    expect((d as unknown as DisplayPrivates).positionMarker).not.toBeNull()
    expect((d as unknown as DisplayPrivates).arrowEl).not.toBeNull()

    d.showPositionFix(null)
    expect((d as unknown as DisplayPrivates).positionMarker).toBeNull()
    expect((d as unknown as DisplayPrivates).arrowEl).toBeNull()
  })

  it('showPositionFix updates existing marker position', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.showPositionFix({ coords: { lng: -73, lat: 40 }, bearingDegrees: 0, speedMetersPerSecond: 1 })
    const marker = (d as unknown as DisplayPrivates).positionMarker as {
      setLngLatCalls: number
      lastLngLat: unknown
    }
    expect(marker).toBeTruthy()
    expect(marker.setLngLatCalls).toBe(1)
    expect(marker.lastLngLat).toEqual([-73, 40])

    d.showPositionFix({ coords: { lng: -73.2, lat: 40.2 }, bearingDegrees: 15, speedMetersPerSecond: 1 })
    expect((d as unknown as DisplayPrivates).positionMarker).toBe(marker)
    expect(marker.setLngLatCalls).toBe(2)
    expect(marker.lastLngLat).toEqual([-73.2, 40.2])
  })

  it('hides the direction wedge when stationary and shows it when moving fast enough', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.showPositionFix({
      coords: { lng: -73, lat: 40 },
      bearingDegrees: 42,
      speedMetersPerSecond: 0,
    })

    const arrowEl = (d as unknown as DisplayPrivates).arrowEl as HTMLDivElement
    expect(arrowEl.style.display).toBe('none')
    expect(arrowEl.style.transform).toBe('rotate(42deg)')

    // ~1 mph threshold is 0.44704 m/s.
    d.showPositionFix({
      coords: { lng: -73, lat: 40 },
      bearingDegrees: 42,
      speedMetersPerSecond: 0.44704,
    })

    expect(arrowEl.style.display).toBe('block')
    expect(arrowEl.style.transform).toBe('rotate(42deg)')
  })

  it('hides the direction wedge when speed is missing/NaN, and defaults bearing to 0 when missing', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.showPositionFix({
      coords: { lng: -73, lat: 40 },
      speedMetersPerSecond: undefined,
    })

    const arrowEl = (d as unknown as DisplayPrivates).arrowEl as HTMLDivElement
    expect(arrowEl.style.display).toBe('none')
    expect(arrowEl.style.transform).toBe('rotate(0deg)')

    d.showPositionFix({
      coords: { lng: -73, lat: 40 },
      speedMetersPerSecond: Number.NaN,
    })
    expect(arrowEl.style.display).toBe('none')
  })

  it('setCenter is a no-op if the map is not mounted', () => {
    const d = new RasterTileMapDisplay()
    expect(() => d.setCenter({ lng: 1, lat: 2 })).not.toThrow()
  })

  it('setSearchPins/setSavedPins/showRoute/showPositionFix are safe if the map was never mounted', () => {
    const d = new RasterTileMapDisplay()

    expect(() =>
      d.setSearchPins([{ id: 'a', coords: { lng: 0, lat: 0 }, title: 'A' }]),
    ).not.toThrow()
    expect(() =>
      d.setSavedPins([{ id: 'b', coords: { lng: 1, lat: 1 }, title: 'B' }]),
    ).not.toThrow()

    expect(() =>
      d.showRoute({
        id: 'r',
        provider: 'x',
        profile: 'drive',
        geometry: [
          { lng: 0, lat: 0 },
          { lng: 1, lat: 1 },
        ],
      }),
    ).not.toThrow()

    expect(() =>
      d.showPositionFix({ coords: { lng: -73, lat: 40 }, bearingDegrees: 0, speedMetersPerSecond: 1 }),
    ).not.toThrow()
  })

  it('continues updating the marker even if arrow DOM is unexpectedly missing', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.showPositionFix({
      coords: { lng: -73, lat: 40 },
      bearingDegrees: 12,
      speedMetersPerSecond: 1,
    })

    const marker = (d as unknown as DisplayPrivates).positionMarker as {
      setLngLatCalls: number
      lastLngLat: unknown
    }
    expect(marker.setLngLatCalls).toBe(1)

    // Simulate an inconsistent internal state: marker exists but arrow overlay is missing.
    ;(d as unknown as DisplayPrivates).arrowEl = null

    expect(() =>
      d.showPositionFix({
        coords: { lng: -73.2, lat: 40.2 },
        bearingDegrees: 34,
        speedMetersPerSecond: 2,
      }),
    ).not.toThrow()

    expect(marker.setLngLatCalls).toBe(2)
    expect(marker.lastLngLat).toEqual([-73.2, 40.2])
  })

  it('defaults pin labels when titles are blank', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.setSearchPins([{ id: 's', coords: { lng: 0, lat: 0 }, title: '   ' }])
    d.setSavedPins([{ id: 'x', coords: { lng: 1, lat: 1 }, title: ' \t ' }])

    const searchMarkers = (d as unknown as DisplayPrivates).searchMarkers as Map<
      string,
      { getElement: () => HTMLElement }
    >
    const savedMarkers = (d as unknown as DisplayPrivates).savedMarkers as Map<
      string,
      { getElement: () => HTMLElement }
    >

    expect(searchMarkers.get('s')?.getElement().getAttribute('aria-label')).toBe('Search result')
    expect(savedMarkers.get('x')?.getElement().getAttribute('aria-label')).toBe('Saved place')
  })

  it('uses default saved-pin accent when accentColor is omitted', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.setSavedPins([{ id: 'x', coords: { lng: 1, lat: 1 }, title: 'Home' }])

    const savedMarkers = (d as unknown as DisplayPrivates).savedMarkers as Map<
      string,
      { getElement: () => HTMLElement }
    >
    expect(savedMarkers.get('x')?.getElement().style.color).toBe('rgb(225, 29, 72)')
  })

  it('setSearchPins and setSavedPins run without throwing', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    expect(() =>
      d.setSearchPins([{ id: 'a', coords: { lng: 0, lat: 0 }, title: 'A' }]),
    ).not.toThrow()
    expect(() =>
      d.setSavedPins([{ id: 'b', coords: { lng: 1, lat: 1 }, title: 'B' }]),
    ).not.toThrow()
  })

  it('syncs pins by updating existing marker elements and removing missing ones', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    // Create two search pins.
    d.setSearchPins([
      { id: 'a', coords: { lng: 0, lat: 0 }, title: 'A', accentColor: '#111111' },
      { id: 'b', coords: { lng: 1, lat: 1 }, title: 'B', accentColor: '#222222' },
    ])

    const markerMap = (d as unknown as DisplayPrivates).searchMarkers as Map<
      string,
      { removed: boolean; getElement: () => HTMLElement }
    >
    const a0 = markerMap.get('a')
    const b0 = markerMap.get('b')
    expect(a0).toBeTruthy()
    expect(b0).toBeTruthy()

    // Update "a" with new label+color and drop "b".
    d.setSearchPins([{ id: 'a', coords: { lng: 2, lat: 2 }, title: 'A2', accentColor: '#333333' }])

    const a1 = markerMap.get('a')
    expect(a1).toBe(a0) // same marker instance is reused
    expect(a1.getElement().style.color).toBe('rgb(51, 51, 51)')
    expect(a1.getElement().getAttribute('aria-label')).toBe('A2')

    expect(b0.removed).toBe(true)
    expect(markerMap.has('b')).toBe(false)
  })

  it('continues syncing pins when an existing marker has no DOM element', () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)

    d.setSearchPins([{ id: 'a', coords: { lng: 0, lat: 0 }, title: 'A', accentColor: '#111111' }])

    const markerMap = (d as unknown as DisplayPrivates).searchMarkers as Map<
      string,
      { setLngLat: (p: [number, number]) => unknown; getElement: () => HTMLElement | null }
    >
    const marker = markerMap.get('a')
    expect(marker).toBeTruthy()

    marker!.getElement = () => null

    expect(() =>
      d.setSearchPins([{ id: 'a', coords: { lng: 2, lat: 2 }, title: 'A2', accentColor: '#333333' }]),
    ).not.toThrow()
  })

  it('defers showRoute until style is loaded', async () => {
    const d = new RasterTileMapDisplay()
    const container = document.createElement('div')
    d.mount(container)
    const map = (d as unknown as DisplayPrivates).map as {
      styleLoaded: boolean
      sources: Set<string>
      layers: Set<string>
      fitBoundsCalls: unknown[]
      cameraForBoundsCalls: unknown[]
      easeCalls: unknown[]
      triggerLoad: () => void
    }
    map.styleLoaded = false

    const route = {
      id: 'r',
      provider: 'x',
      profile: 'drive' as const,
      geometry: [
        { lng: 0, lat: 0 },
        { lng: 1, lat: 1 },
      ],
    }

    d.showRoute(route)
    d.fitRoute(route)
    await flushRouteMicrotasks()

    // Nothing added yet.
    expect(map.sources.has('app-route-geojson')).toBe(false)
    expect(map.layers.has('app-route-line')).toBe(false)

    // Simulate style load.
    map.styleLoaded = true
    map.triggerLoad()

    expect(map.sources.has('app-route-geojson')).toBe(true)
    expect(map.layers.has('app-route-line')).toBe(true)
    expect(map.cameraForBoundsCalls.length).toBe(1)
    expect(map.fitBoundsCalls.length).toBe(0)
    expect(map.easeCalls.length).toBeGreaterThanOrEqual(1)
  })
})

