import type { IRoutingService } from './IRoutingService'
import { decodePolyline6 } from './decodePolyline6'
import type { LngLat, Route, RouteDirectionStep, RouteProfile, RouteRequest } from '../types'

/** FOSSGIS public Valhalla HTTP API (see https://www.fossgis.de/news/2021-11-12_funding_valhalla/). */
const VALHALLA_FOSSGIS_ROUTE_URL = 'https://valhalla1.openstreetmap.de/route'
const VERCEL_PROXY_ROUTE_URL = '/api/valhalla/route'

function defaultRouteUrl(): string {
  // Production runs on Vercel where the Valhalla public host does not set permissive CORS headers.
  // Use a same-origin serverless proxy so the browser avoids cross-origin preflights.
  return import.meta.env.PROD ? VERCEL_PROXY_ROUTE_URL : VALHALLA_FOSSGIS_ROUTE_URL
}

function valhallaCosting(profile: RouteProfile): string {
  switch (profile) {
    case 'drive':
      return 'auto'
    case 'walk':
      return 'pedestrian'
    case 'bike':
      return 'bicycle'
  }
}

function mergeLegGeometries(legs: { shape?: string }[]): LngLat[] {
  const merged: LngLat[] = []
  for (const leg of legs) {
    const shape = typeof leg.shape === 'string' ? leg.shape : ''
    const part = decodePolyline6(shape)
    if (part.length === 0) continue
    if (merged.length === 0) {
      merged.push(...part)
      continue
    }
    const last = merged[merged.length - 1]
    const first = part[0]
    const same =
      last &&
      first &&
      Math.abs(last.lat - first.lat) < 1e-9 &&
      Math.abs(last.lng - first.lng) < 1e-9
    merged.push(...(same ? part.slice(1) : part))
  }
  return merged
}

/**
 * Calls the public **Valhalla** instance hosted by FOSSGIS (`valhalla1.openstreetmap.de`).
 * Development / demo use only; respect provider capacity and terms.
 */
export class ValhallaRoutingService implements IRoutingService {
  readonly id = 'valhalla-fossgis'
  private readonly routeUrl: string

  constructor(routeUrl: string = defaultRouteUrl()) {
    this.routeUrl = routeUrl
  }

  async route(request: RouteRequest, signal?: AbortSignal): Promise<Route> {
    if (request.waypoints.length < 2) {
      throw new Error('Route needs at least two waypoints.')
    }

    const body = {
      locations: request.waypoints.map((w) => ({ lat: w.lat, lon: w.lng })),
      costing: valhallaCosting(request.profile),
      shape_format: 'polyline6',
      directions_options: { units: 'kilometers' },
    }

    const res = await fetch(this.routeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      throw new Error(`Routing failed (${res.status}).`)
    }

    const data: unknown = await res.json()
    const trip = (data as { trip?: unknown }).trip as
      | {
          legs?: unknown
          summary?: { time?: number; length?: number }
          status?: number
        }
      | undefined

    if (!trip || !Array.isArray(trip.legs) || trip.legs.length === 0) {
      throw new Error('No route returned.')
    }

    const geometry = mergeLegGeometries(trip.legs as { shape?: string }[])
    if (geometry.length < 2) {
      throw new Error('Invalid route geometry.')
    }

    const steps: RouteDirectionStep[] = []
    for (const leg of trip.legs) {
      const maneuvers = (leg as { maneuvers?: unknown }).maneuvers
      if (!Array.isArray(maneuvers)) continue
      for (const m of maneuvers) {
        const row = m as { instruction?: string; length?: number; time?: number }
        const instruction = typeof row.instruction === 'string' ? row.instruction.trim() : ''
        if (!instruction) continue
        const lengthKm = typeof row.length === 'number' ? row.length : undefined
        const timeSec = typeof row.time === 'number' ? row.time : undefined
        steps.push({
          instruction,
          distanceMeters: lengthKm !== undefined ? lengthKm * 1000 : undefined,
          durationSeconds: timeSec,
        })
      }
    }

    const summary = trip.summary
    const distanceKm = typeof summary?.length === 'number' ? summary.length : undefined
    const durationSec = typeof summary?.time === 'number' ? summary.time : undefined

    return {
      id: crypto.randomUUID(),
      provider: this.id,
      profile: request.profile,
      geometry,
      distanceMeters: distanceKm !== undefined ? distanceKm * 1000 : undefined,
      durationSeconds: durationSec,
      steps: steps.length ? steps : undefined,
    }
  }
}
