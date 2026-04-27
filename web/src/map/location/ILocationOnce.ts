import type { LngLat } from '../types'

export type LocationFix = {
  coords: LngLat
  accuracyMeters?: number
  timestampMs: number
  /** Degrees clockwise from true north, when available from the platform. */
  headingDegrees?: number
  /** Meters per second, when available from the platform. */
  speedMetersPerSecond?: number
}

export interface ILocationOnce {
  getCurrent(signal?: AbortSignal): Promise<LocationFix>
}

