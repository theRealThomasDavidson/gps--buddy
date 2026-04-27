# Location interface (one-shot + watch)

These contracts separate **where location comes from** (browser, phone, mock)
from how the app uses it (center map, follow route, reroute).

## `ILocation`

Unified location contract (one-shot + streaming).

```ts
import type { LngLat } from '../types'

export type LocationFix = {
  coords: LngLat
  accuracyMeters?: number
  timestampMs: number
  headingDegrees?: number
  speedMetersPerSecond?: number
}

export type LocationWatchStop = () => void

export interface ILocation {
  getCurrent(signal?: AbortSignal): Promise<LocationFix>
  watch(onFix: (fix: LocationFix) => void): LocationWatchStop
}
```

## Notes

- `signal` support allows the UI to cancel an in-flight request (optional in implementations).
- Accuracy varies widely on desktop browsers; the UI must handle permission denied and unavailable.

## DI point

`MapPage` (or a controller) depends on `ILocation` and calls it to obtain fixes, then calls `IMapDisplay.setCenter(...)` / `IMapDisplay.showPositionFix(...)`.

