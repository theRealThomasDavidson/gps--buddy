import type { Route, RouteRequest } from '../types'

/** Calls a routing backend and returns a normalized {@link Route}. */
export interface IRoutingService {
  readonly id: string
  route(request: RouteRequest, signal?: AbortSignal): Promise<Route>
}
