import type { IMapDisplay } from '../display/IMapDisplay'
import type { Route, RouteRequest } from '../types'
import type { IRoutingService } from './IRoutingService'
import type { IRouteWorkflow, RouteWorkflowOptions } from './IRouteWorkflow'

export class RouteWorkflow implements IRouteWorkflow {
  readonly router: IRoutingService
  readonly display: IMapDisplay

  constructor(args: { router: IRoutingService; display: IMapDisplay }) {
    this.router = args.router
    this.display = args.display
  }

  async routeAndRender(
    request: RouteRequest,
    options: RouteWorkflowOptions = {},
    signal?: AbortSignal,
  ): Promise<Route> {
    const route = await this.router.route(request, signal)
    this.display.showRoute(route)
    if (options.fitMode !== 'noFit') {
      this.display.fitRoute(route)
    }
    return route
  }

  clearRenderedRoute(): void {
    this.display.showRoute(null)
  }
}

