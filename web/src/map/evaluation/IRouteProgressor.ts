import type { LocationFix } from '../location/ILocation'
import type { Route } from '../types'
import type { RouteFollowerProgress } from '../navigation/IRouteFollowerController'

export type RouteProgressorOptions = {
  searchBackMeters: number
  searchForwardMeters: number

  switchMarginMeters: number
  maxBackwardProgressMetersPerFix: number
  progressEpsilonMeters: number
}

export type RouteProgressorMemory = {
  last: RouteFollowerProgress | null
  lastFix: LocationFix | null
}

export type RouteProgressorResult = {
  progress: RouteFollowerProgress
  memory: RouteProgressorMemory
}

export interface IRouteProgressor {
  project(route: Route, fix: LocationFix, memory: RouteProgressorMemory): RouteProgressorResult
}

