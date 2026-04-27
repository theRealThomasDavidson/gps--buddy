import type { IRoutingService } from './IRoutingService'
import type { LngLat, Route, RouteProfile, RouteRequest } from '../types'

const OSRM_DEMO_BASE = 'https://router.project-osrm.org/route/v1'

function osrmProfile(profile: RouteProfile): string {
  switch (profile) {
    case 'drive':
      return 'driving'
    case 'walk':
      return 'walking'
    case 'bike':
      return 'cycling'
  }
}

function encodeWaypoints(waypoints: LngLat[]): string {
  return waypoints.map((p) => `${p.lng},${p.lat}`).join(';')
}

/**
 * Public OSRM demo server (`router.project-osrm.org`). Fine for development;
 * do not rely on it for production traffic or SLAs.
 */
export class OsrmRoutingService implements IRoutingService {
  readonly id = 'osrm-demo'

  constructor(private readonly baseUrl: string = OSRM_DEMO_BASE) {}

  async route(request: RouteRequest, signal?: AbortSignal): Promise<Route> {
    if (request.waypoints.length < 2) {
      throw new Error('Route needs at least two waypoints.')
    }

    const profile = osrmProfile(request.profile)
    const coords = encodeWaypoints(request.waypoints)
    const url = `${this.baseUrl}/${profile}/${coords}?overview=full&geometries=geojson`

    const res = await fetch(url, { signal })
    if (!res.ok) {
      throw new Error(`Routing failed (${res.status}).`)
    }

    const data: unknown = await res.json()
    const routes = (data as { routes?: unknown }).routes
    if (!Array.isArray(routes) || routes.length === 0) {
      throw new Error('No route returned.')
    }

    const first = routes[0] as {
      distance?: number
      duration?: number
      geometry?: { coordinates?: unknown }
    }

    const coordsRaw = first.geometry?.coordinates
    if (!Array.isArray(coordsRaw) || coordsRaw.length < 2) {
      throw new Error('Invalid route geometry.')
    }

    const geometry: LngLat[] = []
    for (const pair of coordsRaw) {
      if (!Array.isArray(pair) || pair.length < 2) continue
      const lng = Number(pair[0])
      const lat = Number(pair[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      geometry.push({ lng, lat })
    }

    if (geometry.length < 2) {
      throw new Error('Route geometry too short.')
    }

    return {
      id: crypto.randomUUID(),
      provider: this.id,
      profile: request.profile,
      geometry,
      distanceMeters: typeof first.distance === 'number' ? first.distance : undefined,
      durationSeconds: typeof first.duration === 'number' ? first.duration : undefined,
    }
  }
}
