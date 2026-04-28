import type { LocationFix } from '../location/ILocation'
import type { Route } from '../types'
import type { RouteFollowerProgress } from '../navigation/IRouteFollowerController'

export type RouteProgressorOptions = {
  /**
   * Search window behind the last match, in meters along the route.
   * Used to keep selection stable without limiting switchbacks by segment count.
   */
  searchBackMeters: number
  /** Search window ahead of the last match, in meters along the route. */
  searchForwardMeters: number
  /**
   * Hysteresis margin: keep the local-best match unless another segment is closer by at least this much.
   */
  switchMarginMeters: number
  /** Clamp small backward jitter in meters along route per fix. */
  maxBackwardProgressMetersPerFix: number
  /** Treat deltas smaller than this as noise. */
  progressEpsilonMeters: number
}

export type RouteProgressorMemory = {
  last: RouteFollowerProgress | null
}

export type RouteProgressorResult = {
  progress: RouteFollowerProgress
  memory: RouteProgressorMemory
}

export interface IRouteProgressor {
  project(route: Route, fix: LocationFix, memory: RouteProgressorMemory): RouteProgressorResult
}

