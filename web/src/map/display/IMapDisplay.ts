import type { BaseView, LngLat, MapLayerState, Route } from '../types'

export type PositionFixDisplay = {
  coords: LngLat
  /** Degrees clockwise from true north; used to rotate a direction arrow. */
  bearingDegrees?: number
  /** Meters per second; used to hide arrow when effectively stationary. */
  speedMetersPerSecond?: number
}

export type MapPin = {
  id: string
  coords: LngLat
  title?: string
  /**
   * CSS color for the thumbtack cap (`currentColor` in the inline SVG).
   * If omitted, the map display picks a default (e.g. yellow for search, red for saved).
   */
  accentColor?: string
}

export interface IMapDisplay {
  mount(container: HTMLElement): void
  unmount(): void

  setBaseView(view: BaseView): void
  setLayers(layers: MapLayerState): void

  setCenter(center: LngLat, zoom?: number): void

  showRoute(route: Route | null): void
  showPositionFix(fix: PositionFixDisplay | null): void

  /** Yellow pins for transient search results. */
  setSearchPins(pins: MapPin[]): void
  /** Thumbtack-style pins for saved addresses. */
  setSavedPins(pins: MapPin[]): void
}

