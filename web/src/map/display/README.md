# `IMapDisplay` (map rendering contract)

`IMapDisplay` is responsible for **showing a map** and drawing overlays.

It should be implementable by MapLibre, Leaflet, Cesium, a canvas renderer, or a test double.

## Responsibilities

- Mount/unmount the map view into a DOM container
- Set the basemap / base view (roads vs satellite vs terrain)
- Toggle map look layers (labels, boundaries, etc.)
- Render overlays: user position, route geometry, markers

## Non-responsibilities

- Calling routing providers
- Deciding which route is “best”
- Reading/writing settings persistence

## Proposed interface

```ts
import type { BaseView, LngLat, MapLayerState, Route } from '../types'

export type PositionFixDisplay = {
  coords: LngLat
  bearingDegrees?: number
  speedMetersPerSecond?: number
}

export type MapPin = {
  id: string
  coords: LngLat
  title?: string
  /** Optional CSS color for the thumbtack cap (inline SVG uses `currentColor`). */
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

  /** Transient pins (e.g. geocode search results). */
  setSearchPins(pins: MapPin[]): void
  /** Persistent-ish pins (e.g. saved addresses). */
  setSavedPins(pins: MapPin[]): void
}
```

## DI points

- `MapPage` depends on `IMapDisplay` only.
- Composition root provides a concrete `MapLibreDisplay` (later) or `DemoMapDisplay` (now).

## Overlay conventions (defaults)

- **User location marker**: default MapLibre marker anchor is **`center`**, so a lat/lng corresponds to the **visual center** of the marker element.
- **Address pins**: marker anchor is **`bottom`**, so a lat/lng corresponds to the **bottom of the short metal stem** under the spool cap.

## Dynamic pin graphics

- **`ThumbtackPinGenerator`** (`ThumbtackPinGenerator.ts`): **generates** the full marker (`generate({ accentColorCss, title })` → wrapper + inline SVG). The **spool / hourglass** cap uses **`fill="currentColor"`** (wrapper `style.color`); a short **grey** stem sits under the cap. Named colors: **`accent('yellow')`**, **`element('yellow', title)`** (palette only grows when you add keys to `DEFAULT_PALETTE`). `RasterTileMapDisplay` calls **`generate`** with each pin’s resolved accent (including saved default `#E11D48`). Per-pin override on the map: `MapPin.accentColor`.

