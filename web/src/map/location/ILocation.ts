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

export type LocationWatchStop = () => void

/**
 * Unified location contract: supports one-shot fixes and continuous watch updates.
 */
export interface ILocation {
  getCurrent(signal?: AbortSignal): Promise<LocationFix>
  watch(onFix: (fix: LocationFix) => void): LocationWatchStop
}

