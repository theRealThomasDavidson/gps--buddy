# Geocoding (`IGeocoder`)

Geocoding turns **free text** (“123 main st…”) into one or more **`GeocodeResult`** objects:

- `label` (display string)
- `center` (`LngLat`)

## Reliability strategy (demo)

We use a **`ChainedGeocoder`** that tries multiple providers in order and **merges + dedupes** nearby hits.

Default chain (see `createGeocoder.ts`):

- **Photon** (`photon.komoot.io`)
- **Open-Meteo geocoding** (`geocoding-api.open-meteo.com`)
- **Nominatim** (`nominatim.openstreetmap.org`) *(last resort; has strict usage expectations)*

If one provider errors or returns nothing useful, the chain continues.

## `IGeocoder`

```ts
import type { GeocodeResult } from './types'

export interface IGeocoder {
  readonly id: string
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>
}
```

## Notes / expectations

- **`OpenMeteoGeocoder`** ignores rows whose `latitude` / `longitude` are missing, non-numeric, or non-finite — defensive parsing against messy upstream JSON.
- Public geocoders can be **rate limited** or **blocked** for heavy traffic; for production you usually want:
  - a paid provider, or
  - self-hosted Pelias/Nominatim, or
  - your own cached index
- Nominatim in particular expects **identifiable app traffic**; browsers can’t reliably set `User-Agent`.
  - Optional: set `VITE_CONTACT_EMAIL` so we can pass `email=` on requests (still not a substitute for following the policy at scale).

## DI point

`MapPage` (or a controller) depends on `IGeocoder` and calls `geocode()`; map centering remains `IMapDisplay.setCenter(...)`.
