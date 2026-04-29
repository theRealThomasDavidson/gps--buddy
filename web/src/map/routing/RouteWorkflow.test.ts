import { describe, expect, it, vi } from 'vitest'
import { RouteWorkflow } from './RouteWorkflow'
import type { IMapDisplay } from '../display/IMapDisplay'
import type { IRoutingService } from './IRoutingService'
import type { Route, RouteRequest } from '../types'

function sampleRoute(): Route {
  return {
    id: 'r1',
    provider: 'test',
    profile: 'drive',
    geometry: [
      { lng: 0, lat: 0 },
      { lng: 1, lat: 0 },
    ],
  }
}

describe('RouteWorkflow', () => {
  it('routeAndRender shows the route, fits by default, and returns the route', async () => {
    const route = sampleRoute()
    const router: IRoutingService = {
      id: 'fake-router',
      route: vi.fn(async () => route),
    }

    const showRoute = vi.fn()
    const fitRoute = vi.fn()
    const display = { showRoute, fitRoute } as unknown as IMapDisplay

    const wf = new RouteWorkflow({ router, display })

    const req: RouteRequest = { profile: 'drive', waypoints: [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }] }
    const ac = new AbortController()
    const out = await wf.routeAndRender(req, {}, ac.signal)

    expect(router.route).toHaveBeenCalledWith(req, ac.signal)
    expect(showRoute).toHaveBeenCalledTimes(1)
    expect(showRoute).toHaveBeenCalledWith(route)
    expect(fitRoute).toHaveBeenCalledTimes(1)
    expect(fitRoute).toHaveBeenCalledWith(route)
    expect(out).toBe(route)
  })

  it('routeAndRender skips fitRoute when fitMode is noFit', async () => {
    const route = sampleRoute()
    const router: IRoutingService = {
      id: 'fake-router',
      route: vi.fn(async () => route),
    }

    const showRoute = vi.fn()
    const fitRoute = vi.fn()
    const display = { showRoute, fitRoute } as unknown as IMapDisplay

    const wf = new RouteWorkflow({ router, display })
    const req: RouteRequest = { profile: 'drive', waypoints: [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }] }

    await wf.routeAndRender(req, { fitMode: 'noFit' })

    expect(showRoute).toHaveBeenCalledWith(route)
    expect(fitRoute).not.toHaveBeenCalled()
  })

  it('clearRenderedRoute clears the route overlay', () => {
    const router: IRoutingService = { id: 'fake-router', route: vi.fn() }
    const showRoute = vi.fn()
    const display = { showRoute } as unknown as IMapDisplay

    const wf = new RouteWorkflow({ router, display })
    wf.clearRenderedRoute()

    expect(showRoute).toHaveBeenCalledWith(null)
  })
})
