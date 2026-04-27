# Location interfaces (one-shot + watch)

These contracts separate **where location comes from** (browser, phone, mock)
from how the app uses it (center map, follow route, reroute).

## `ILocationOnce`

Minimal “get my current location once” interface.

```ts
import type { LngLat } from '../types'

export type LocationFix = {
  coords: LngLat
  accuracyMeters?: number
  timestampMs: number
  headingDegrees?: number
  speedMetersPerSecond?: number
}

export interface ILocationOnce {
  getCurrent(signal?: AbortSignal): Promise<LocationFix>
}
```

## `ILocationWatch`

Minimal “stream location updates” interface (used for direction + live tracking demos).

```ts
import type { LocationFix } from './ILocationOnce'

export type LocationWatchStop = () => void

export interface ILocationWatch {
  watch(onFix: (fix: LocationFix) => void): LocationWatchStop
}
```

## Notes

- `signal` support allows the UI to cancel an in-flight request (optional in implementations).
- Accuracy varies widely on desktop browsers; the UI must handle permission denied and unavailable.

## DI point

`MapPage` (or a controller) depends on `ILocationOnce` / `ILocationWatch` and calls them to obtain fixes, then calls `IMapDisplay.setCenter(...)` / `IMapDisplay.showPositionFix(...)`.

