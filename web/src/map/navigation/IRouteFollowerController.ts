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
}

export type RouteFollowerStartArgs = {
  route: Route
  /**
   * Optional full trip stop list (including destination). When present, reroute can keep the remaining stops.
   * For a simple A→B route, this can be omitted.
   */
  tripStops?: LngLat[]
  /**
   * Optional immediate camera seed so “Follow route” can snap to the user location right away,
   * even before we have enough movement to compute a bearing.
   */
  initialCenter?: LngLat
  initialBearingDegrees?: number
}

export type RouteFollowerUnsubscribe = () => void

/**
 * Owns “follow route” behavior (progress, next maneuver, reroute heuristics, nav camera).
 * Depends only on contracts so it can be reused across raster/vector map displays.
 */
export interface IRouteFollowerController {
  start(args: RouteFollowerStartArgs): void
  stop(): void

  getState(): RouteFollowerState
  subscribe(listener: (state: RouteFollowerState) => void): RouteFollowerUnsubscribe
}

