import type { LngLat, Route } from '../types'

export type RouteFollowerProgress = {
  /** Closest point on the route polyline (WGS84 lng/lat). */
  snappedCoords: LngLat
  /** Index of the route segment \(geometry[i] → geometry[i+1]\) used for the snap. */
  segmentIndex: number
  /** Cumulative meters along the route to `snappedCoords`. */
  metersAlongRoute: number
  /** Lateral distance in meters from the raw fix to the snapped point. */
  distanceToRouteMeters: number
}

export type RouteFollowerNextManeuver = {
  stepIndex: number
  instruction: string
  /** Estimated meters remaining until this maneuver. */
  distanceToNextMeters: number
}

export type RouteFollowerState = {
  enabled: boolean
  route: Route | null
  tripStops: LngLat[] | null

  progress: RouteFollowerProgress | null
  nextManeuver: RouteFollowerNextManeuver | null

  offRouteStrikeCount: number
  lastRerouteAtMs: number | null
  rerouting: boolean

  lastRerouteErrorAtMs: number | null
  lastRerouteErrorMessage: string | null
}

export type RouteFollowerStartArgs = {
  route: Route
  tripStops?: LngLat[]
  initialCenter?: LngLat
  initialBearingDegrees?: number
}

export type RouteFollowerUnsubscribe = () => void

export interface IRouteFollowerController {
  start(args: RouteFollowerStartArgs): void
  stop(): void

  getState(): RouteFollowerState
  subscribe(listener: (state: RouteFollowerState) => void): RouteFollowerUnsubscribe
}
