import type { ILocationOnce, LocationFix } from './ILocationOnce'

type BrowserLocationOnceOptions = {
  enableHighAccuracy?: boolean
  timeoutMs?: number
  maximumAgeMs?: number
}

export class BrowserLocationOnce implements ILocationOnce {
  private readonly options: BrowserLocationOnceOptions

  constructor(options: BrowserLocationOnceOptions = {}) {
    this.options = options
  }

  getCurrent(): Promise<LocationFix> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(new Error('Geolocation is not available in this browser.'))
    }

    return new Promise<LocationFix>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
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
          // Normalize browser messages like "User denied Geolocation"
          // into something we can show in the UI.
          switch (err.code) {
            case err.PERMISSION_DENIED:
              reject(
                new Error(
                  'user denied geolocation — allow location for this site (site settings → location → allow), then reload. you can still pan the map manually.',
                ),
              )
              return
            case err.POSITION_UNAVAILABLE:
              reject(
                new Error(
                  'location unavailable — check OS location services / network, then try again.',
                ),
              )
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
}

