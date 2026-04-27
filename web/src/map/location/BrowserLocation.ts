import type { ILocation, LocationFix, LocationWatchStop } from './ILocation'

export type BrowserLocationOptions = {
  enableHighAccuracy?: boolean
  timeoutMs?: number
  maximumAgeMs?: number
  watchMaximumAgeMs?: number
}

export class BrowserLocation implements ILocation {
  private readonly options: BrowserLocationOptions

  constructor(options: BrowserLocationOptions = {}) {
    this.options = options
  }

  getCurrent(signal?: AbortSignal): Promise<LocationFix> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(new Error('Geolocation is not available in this browser.'))
    }

    return new Promise<LocationFix>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      const abortHandler = () => reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', abortHandler, { once: true })

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          signal?.removeEventListener('abort', abortHandler)
          resolve({
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
        (err) => {
          signal?.removeEventListener('abort', abortHandler)
          switch (err.code) {
            case err.PERMISSION_DENIED:
              reject(
                new Error(
                  'user denied geolocation — allow location for this site (site settings → location → allow), then reload. you can still pan the map manually.',
                ),
              )
              return
            case err.POSITION_UNAVAILABLE:
              reject(new Error('location unavailable — check OS location services / network, then try again.'))
              return
            case err.TIMEOUT:
              reject(new Error('location timeout — try again.'))
              return
            default:
              reject(new Error(err.message || 'Unable to get location.'))
          }
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy ?? true,
          timeout: this.options.timeoutMs ?? 12_000,
          maximumAge: this.options.maximumAgeMs ?? 10_000,
        },
      )
    })
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
        maximumAge: this.options.watchMaximumAgeMs ?? 0,
      },
    )

    return () => {
      navigator.geolocation.clearWatch(id)
    }
  }
}

