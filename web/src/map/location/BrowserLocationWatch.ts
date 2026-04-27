import type { ILocationWatch, LocationWatchStop } from './ILocationWatch'
import type { LocationFix } from './ILocationOnce'

type BrowserLocationWatchOptions = {
  enableHighAccuracy?: boolean
  maximumAgeMs?: number
}

export class BrowserLocationWatch implements ILocationWatch {
  private readonly options: BrowserLocationWatchOptions

  constructor(options: BrowserLocationWatchOptions = {}) {
    this.options = options
  }

  watch(onFix: (fix: LocationFix) => void): LocationWatchStop {
    if (!('geolocation' in navigator)) {
      return () => {}
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        onFix({
          coords: { lng: pos.coords.longitude, lat: pos.coords.latitude },
          accuracyMeters: pos.coords.accuracy,
          timestampMs: pos.timestamp,
          headingDegrees:
            typeof pos.coords.heading === 'number' && !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : undefined,
          speedMetersPerSecond:
            typeof pos.coords.speed === 'number' && !Number.isNaN(pos.coords.speed)
              ? pos.coords.speed
              : undefined,
        })
      },
      () => {
        // Errors are surfaced by the one-shot flow; watch failures are ignored for demo.
      },
      {
        enableHighAccuracy: this.options.enableHighAccuracy ?? true,
        maximumAge: this.options.maximumAgeMs ?? 0,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(id)
    }
  }
}
