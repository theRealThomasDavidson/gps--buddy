import type { LocationFix } from '../location/ILocation'
import type { LngLat, Route } from '../types'
import type { IRouteProgressor, RouteProgressorMemory, RouteProgressorOptions, RouteProgressorResult } from './IRouteProgressor'
import type { RouteFollowerProgress } from '../navigation/IRouteFollowerController'

const DEFAULTS: RouteProgressorOptions = {
  searchBackMeters: 50,
  searchForwardMeters: 200,
  switchMarginMeters: 10,
  maxBackwardProgressMetersPerFix: 3,
  progressEpsilonMeters: 1,
}

type SegmentProjection = {
  segmentIndex: number
  snapped: LngLat
  t: number
  distanceToRouteMeters: number
  metersAlongRoute: number
}

/**
 * Demo-friendly progressor:
 * - projects a fix to the closest point on the route polyline
 * - uses a distance-window search around last progress for stability
 */
export class BasicRouteProgressor implements IRouteProgressor {
  private readonly opts: RouteProgressorOptions

  constructor(options: Partial<RouteProgressorOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options }
  }

  project(route: Route, fix: LocationFix, memory: RouteProgressorMemory): RouteProgressorResult {
    const geom = route.geometry
    if (geom.length < 2) {
      // Degenerate route: treat the fix as the snapped point.
      const progress: RouteFollowerProgress = {
        snappedCoords: fix.coords,
        segmentIndex: 0,
        metersAlongRoute: 0,
        distanceToRouteMeters: 0,
      }
      return { progress, memory: { last: progress } }
    }

    const cumulative = buildCumulativeMeters(geom)

    const globalBest = projectToBestSegment(geom, cumulative, fix.coords, 0, geom.length - 2)

    const last = memory.last
    if (!last) {
      const progress = toProgress(globalBest)
      return { progress, memory: { last: progress } }
    }

    const localRange = segmentRangeForDistanceWindow(cumulative, last.metersAlongRoute, this.opts.searchBackMeters, this.opts.searchForwardMeters)
    const localBest =
      localRange.startIndex <= localRange.endIndex
        ? projectToBestSegment(geom, cumulative, fix.coords, localRange.startIndex, localRange.endIndex)
        : null

    // Hysteresis: prefer local match unless global is meaningfully closer.
    const chosen =
      localBest && localBest.distanceToRouteMeters <= globalBest.distanceToRouteMeters + this.opts.switchMarginMeters
        ? localBest
        : globalBest

    const unclamped = toProgress(chosen)
    const clamped = clampProgress(unclamped, last, this.opts)
    return { progress: clamped, memory: { last: clamped } }
  }
}

function toProgress(p: SegmentProjection): RouteFollowerProgress {
  return {
    snappedCoords: p.snapped,
    segmentIndex: p.segmentIndex,
    metersAlongRoute: p.metersAlongRoute,
    distanceToRouteMeters: p.distanceToRouteMeters,
  }
}

function clampProgress(next: RouteFollowerProgress, prev: RouteFollowerProgress, opts: RouteProgressorOptions): RouteFollowerProgress {
  const delta = next.metersAlongRoute - prev.metersAlongRoute
  if (delta >= -opts.progressEpsilonMeters) return next
  const clampedMeters = Math.max(prev.metersAlongRoute - opts.maxBackwardProgressMetersPerFix, next.metersAlongRoute)
  if (clampedMeters === next.metersAlongRoute) return next
  return { ...next, metersAlongRoute: clampedMeters }
}

function buildCumulativeMeters(geom: LngLat[]): number[] {
  const cum: number[] = new Array(geom.length).fill(0)
  for (let i = 1; i < geom.length; i++) {
    cum[i] = cum[i - 1] + haversineMeters(geom[i - 1], geom[i])
  }
  return cum
}

function segmentRangeForDistanceWindow(cumulative: number[], atMeters: number, backMeters: number, forwardMeters: number): { startIndex: number; endIndex: number } {
  const minM = Math.max(0, atMeters - backMeters)
  const maxM = Math.min(cumulative[cumulative.length - 1], atMeters + forwardMeters)
  const startVertex = lowerBound(cumulative, minM)
  const endVertex = upperBound(cumulative, maxM)
  const startIndex = Math.max(0, Math.min(cumulative.length - 2, startVertex))
  const endIndex = Math.max(0, Math.min(cumulative.length - 2, endVertex))
  if (endIndex < startIndex) return { startIndex, endIndex: startIndex }
  return { startIndex, endIndex }
}

function projectToBestSegment(geom: LngLat[], cumulative: number[], point: LngLat, startIndex: number, endIndex: number): SegmentProjection {
  let best: SegmentProjection | null = null
  for (let i = startIndex; i <= endIndex; i++) {
    const a = geom[i]
    const b = geom[i + 1]
    const proj = projectPointToSegmentMeters(point, a, b)
    const metersAlongRoute = cumulative[i] + proj.t * haversineMeters(a, b)
    const cand: SegmentProjection = {
      segmentIndex: i,
      snapped: proj.snapped,
      t: proj.t,
      distanceToRouteMeters: proj.distanceMeters,
      metersAlongRoute,
    }
    if (!best || cand.distanceToRouteMeters < best.distanceToRouteMeters) best = cand
  }
  // route has at least one segment, so best is non-null
  return best!
}

function projectPointToSegmentMeters(p: LngLat, a: LngLat, b: LngLat): { t: number; snapped: LngLat; distanceMeters: number } {
  // Local tangent-plane approximation around point a (good enough for short segments in a demo).
  const ax = 0
  const ay = 0
  const bx = metersEast(a, b)
  const by = metersNorth(a, b)
  const px = metersEast(a, p)
  const py = metersNorth(a, p)

  const ab2 = bx * bx + by * by
  const tRaw = ab2 === 0 ? 0 : (px * bx + py * by) / ab2
  const t = clamp01(tRaw)

  const sx = ax + t * bx
  const sy = ay + t * by

  const dx = px - sx
  const dy = py - sy

  const snapped = addMeters(a, sx, sy)
  return { t, snapped, distanceMeters: Math.hypot(dx, dy) }
}

function metersEast(origin: LngLat, p: LngLat): number {
  const latRad = (origin.lat * Math.PI) / 180
  const metersPerDegLng = 111_320 * Math.cos(latRad)
  return (p.lng - origin.lng) * metersPerDegLng
}

function metersNorth(origin: LngLat, p: LngLat): number {
  const metersPerDegLat = 110_540
  return (p.lat - origin.lat) * metersPerDegLat
}

function addMeters(origin: LngLat, eastMeters: number, northMeters: number): LngLat {
  const latRad = (origin.lat * Math.PI) / 180
  const metersPerDegLng = 111_320 * Math.cos(latRad)
  const metersPerDegLat = 110_540
  return {
    lng: origin.lng + eastMeters / metersPerDegLng,
    lat: origin.lat + northMeters / metersPerDegLat,
  }
}

function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const sin1 = Math.sin(dLat / 2)
  const sin2 = Math.sin(dLng / 2)
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function clamp01(t: number): number {
  if (t < 0) return 0
  if (t > 1) return 1
  return t
}

function lowerBound(arr: number[], x: number): number {
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (arr[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

function upperBound(arr: number[], x: number): number {
  let lo = 0
  let hi = arr.length - 1
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (arr[mid] > x) hi = mid - 1
    else lo = mid
  }
  return lo
}

