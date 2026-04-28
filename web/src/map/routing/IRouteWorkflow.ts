import type { IMapDisplay } from '../display/IMapDisplay'
import type { IRoutingService } from './IRoutingService'
import type { Route, RouteRequest } from '../types'

export type RouteWorkflowFitMode = 'fitRoute' | 'noFit'

export type RouteWorkflowOptions = {
  /** Whether to fit the camera to the full route after rendering it. */
  fitMode?: RouteWorkflowFitMode
}

/**
 * Higher-level routing workflow that owns how routes are rendered on a map display.
 *
 * Keeps `IRoutingService` pure (data only) while centralizing `showRoute` / `fitRoute` policy
 * in one routing-owned location.
 */
export interface IRouteWorkflow {
  readonly router: IRoutingService
  readonly display: IMapDisplay

  routeAndRender(request: RouteRequest, options?: RouteWorkflowOptions, signal?: AbortSignal): Promise<Route>
  clearRenderedRoute(): void
}

