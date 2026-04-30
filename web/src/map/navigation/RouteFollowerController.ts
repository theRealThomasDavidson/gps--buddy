import type { IMapDisplay } from '../display/IMapDisplay'
import type { ILocation, LocationFix, LocationWatchStop } from '../location/ILocation'
import type { LngLat, Route } from '../types'
import type { IRouteProgressor, RouteProgressorMemory } from '../evaluation/IRouteProgressor'
import type {
  IRouteFollowerController,
  RouteFollowerStartArgs,
  RouteFollowerState,
} from './IRouteFollowerController'
import type { RouteDirectionStep } from '../types'
import type { IRouteWorkflow } from '../routing/IRouteWorkflow'

export type RouteFollowerControllerOptions = {
  offRouteThresholdMeters: number
  minStrikes: number
  cooldownMs: number

  // Nav camera tuning (first cut; display chooses how to interpret)
  navZoom: number
  navPitchDegrees: number
  navBottomPaddingPx: number
}

const DEFAULTS: RouteFollowerControllerOptions = {
  offRouteThresholdMeters: 40,
  minStrikes: 3,
  cooldownMs: 20_000,
  navZoom: 17,
  navPitchDegrees: 55,
  navBottomPaddingPx: 220,
}

const NAV_BEARING_SMOOTHING_ALPHA = 0.25
const NAV_FOLLOW_EASE_DURATION_MS = 200
const NAV_MIN_MOVEMENT_METERS_FOR_BEARING = 2
const NAV_MIN_DT_MS_FOR_BEARING = 400
const NAV_CAMERA_MIN_INTERVAL_MS = 1000
const NAV_CAMERA_MIN_MOVE_METERS = 1
const NAV_CAMERA_MIN_BEARING_DELTA_DEG = 2

/**
 * First-cut controller: owns progress computation + emits state.
 * Reroute + camera policies are stubbed but shaped here so we can implement incrementally.
 */
export class RouteFollowerController implements IRouteFollowerController {
  private readonly display: IMapDisplay
  private readonly location: ILocation
  private readonly workflow: IRouteWorkflow
  private readonly progressor: IRouteProgressor
  private readonly opts: RouteFollowerControllerOptions

  private stopWatch: LocationWatchStop | null = null
  private memory: RouteProgressorMemory = { last: null, lastFix: null }
  private listeners = new Set<(s: RouteFollowerState) => void>()
  private prevFix: { coords: LngLat; timestampMs: number } | null = null
  private smoothedBearingDegrees: number | null = null
  private lastCameraUpdateAtMs: number | null = null
  private lastCameraCenter: LngLat | null = null
  private lastCameraBearingDegrees: number | null = null
  private state: RouteFollowerState = {
    enabled: false,
    route: null,
    tripStops: null,
    progress: null,
    nextManeuver: null,
    offRouteStrikeCount: 0,
    lastRerouteAtMs: null,
    rerouting: false,
    lastRerouteErrorAtMs: null,
    lastRerouteErrorMessage: null,
  }

  constructor(args: {
    display: IMapDisplay
    location: ILocation
    workflow: IRouteWorkflow
    progressor: IRouteProgressor
    options?: Partial<RouteFollowerControllerOptions>
  }) {
    this.display = args.display
    this.location = args.location
    this.workflow = args.workflow
    this.progressor = args.progressor
    this.opts = { ...DEFAULTS, ...(args.options ?? {}) }
  }

  start(args: RouteFollowerStartArgs): void {
    this.stop()
    this.memory = { last: null, lastFix: null }
    this.prevFix = null
    this.smoothedBearingDegrees = null
    this.lastCameraUpdateAtMs = null
    this.lastCameraCenter = null
    this.lastCameraBearingDegrees = null
    this.state = {
      ...this.state,
      enabled: true,
      route: args.route,
      tripStops: args.tripStops ? [...args.tripStops] : null,
      progress: null,
      nextManeuver: null,
      offRouteStrikeCount: 0,
      rerouting: false,
      lastRerouteAtMs: null,
      lastRerouteErrorAtMs: null,
      lastRerouteErrorMessage: null,
    }
    this.emit()

    if (args.initialCenter) {
      // Immediate “go into nav camera” seed. Bearing is optional; we can still pitch/pad.
      this.display.setNavCamera({
        center: args.initialCenter,
        zoom: this.opts.navZoom,
        bearingDegrees:
          typeof args.initialBearingDegrees === 'number' && Number.isFinite(args.initialBearingDegrees)
            ? args.initialBearingDegrees
            : undefined,
        pitchDegrees: this.opts.navPitchDegrees,
        bottomPaddingPx: this.opts.navBottomPaddingPx,
        transition: 'ease',
        durationMs: NAV_FOLLOW_EASE_DURATION_MS,
      })
    }

    this.stopWatch = this.location.watch((fix) => this.onFix(fix))
  }

  stop(): void {
    this.stopWatch?.()
    this.stopWatch = null
    this.memory = { last: null, lastFix: null }
    this.prevFix = null
    this.smoothedBearingDegrees = null
    this.lastCameraUpdateAtMs = null
    this.lastCameraCenter = null
    this.lastCameraBearingDegrees = null
    if (!this.state.enabled && this.state.route == null) return
    this.state = {
      ...this.state,
      enabled: false,
      route: null,
      tripStops: null,
      progress: null,
      nextManeuver: null,
      offRouteStrikeCount: 0,
      rerouting: false,
      lastRerouteAtMs: null,
      lastRerouteErrorAtMs: null,
      lastRerouteErrorMessage: null,
    }
    this.emit()
  }

  getState(): RouteFollowerState {
    return this.state
  }

  subscribe(listener: (state: RouteFollowerState) => void): () => void {
    this.listeners.add(listener)
    // push current snapshot
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l(this.state)
  }

  private onFix(fix: LocationFix) {
    if (!this.state.enabled || !this.state.route) return

    const { progress, memory } = this.progressor.project(this.state.route, fix, this.memory)
    this.memory = memory

    const bearingDegrees = this.deriveSmoothedBearingDegrees(fix)
    const offRouteStrikeCount = this.nextStrikeCount(progress.distanceToRouteMeters, fix, this.state.offRouteStrikeCount)
    const nextManeuver = deriveNextManeuver(this.state.route, progress.metersAlongRoute)

    this.state = {
      ...this.state,
      progress,
      offRouteStrikeCount,
      nextManeuver,
    }
    this.emit()

    // Camera + reroute are intentionally incremental; wire once we have UI + thresholds stable.
    void this.maybeReroute(fix, progress.distanceToRouteMeters, offRouteStrikeCount)
    this.maybeDriveNavCamera(bearingDegrees, progress.snappedCoords)
  }

  private nextStrikeCount(distanceToRouteMeters: number, fix: LocationFix, prev: number): number {
    // Don't accumulate strikes while basically stationary / unknown speed.
    const speed = fix.speedMetersPerSecond
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.5) return 0

    if (distanceToRouteMeters > this.opts.offRouteThresholdMeters) return prev + 1
    return 0
  }

  private async maybeReroute(fix: LocationFix, distanceToRouteMeters: number, strikes: number) {
    if (!this.state.route) return
    if (this.state.rerouting) return
    if (strikes < this.opts.minStrikes) return
    if (distanceToRouteMeters <= this.opts.offRouteThresholdMeters) return

    const now = Date.now()
    if (this.state.lastRerouteAtMs && now - this.state.lastRerouteAtMs < this.opts.cooldownMs) return

    this.state = {
      ...this.state,
      rerouting: true,
      lastRerouteAtMs: now,
      lastRerouteErrorAtMs: null,
      lastRerouteErrorMessage: null,
    }
    this.emit()

    try {
      const waypoints = this.buildRerouteWaypoints(fix.coords, this.state.progress?.metersAlongRoute ?? null)
      const newRoute = await this.workflow.routeAndRender(
        { profile: this.state.route.profile, waypoints },
        { fitMode: 'noFit' },
      )
      this.state = {
        ...this.state,
        route: newRoute,
        rerouting: false,
        offRouteStrikeCount: 0,
      }
      this.memory = { last: null, lastFix: null }
      this.emit()
    } catch {
      this.state = {
        ...this.state,
        rerouting: false,
        offRouteStrikeCount: 0,
        lastRerouteErrorAtMs: now,
        lastRerouteErrorMessage: 'Reroute failed. Staying on your current route.',
      }
      this.emit()
    }
  }

  private buildRerouteWaypoints(current: LngLat, currentMetersAlongRoute: number | null): LngLat[] {
    const stops = this.state.tripStops
    if (!stops || stops.length < 2) {
      // fallback: reroute to the last point in the existing route geometry
      const geom = this.state.route?.geometry
      const dest = geom && geom.length ? geom[geom.length - 1] : current
      return [current, dest]
    }

    const geom = this.state.route?.geometry
    if (!geom || geom.length < 2) return [current, stops[stops.length - 1]]

    // Keep remaining intermediate stops, based on their projection along the current route geometry.
    // This avoids accidentally dropping mid-trip waypoints when rerouting.
    const cumulative = buildCumulativeMeters(geom)
    const atMeters =
      typeof currentMetersAlongRoute === 'number' && Number.isFinite(currentMetersAlongRoute)
        ? currentMetersAlongRoute
        : projectPointToPolylineMeters(geom, cumulative, current)

    const remainingWithMeters = stops
      .map((s, idx) => ({ idx, coords: s, metersAlongRoute: projectPointToPolylineMeters(geom, cumulative, s) }))
      .filter((s) => s.metersAlongRoute > atMeters + 5)
      .sort((a, b) => a.idx - b.idx)

    const remainingStops = remainingWithMeters.map((s) => s.coords)
    const dest = stops[stops.length - 1]

    if (remainingStops.length === 0) return [current, dest]

    // Avoid duplicating a stop that's effectively at the current fix.
    const first = remainingStops[0]
    const trimmed = haversineMeters(first, current) < 10 ? remainingStops.slice(1) : remainingStops
    return trimmed.length ? [current, ...trimmed] : [current, dest]
  }

  private maybeDriveNavCamera(bearingDegrees: number | null, center: LngLat) {
    if (!this.state.enabled) return

    const now = Date.now()
    if (this.lastCameraUpdateAtMs && now - this.lastCameraUpdateAtMs < NAV_CAMERA_MIN_INTERVAL_MS) return

    if (this.lastCameraCenter) {
      const moved = haversineMeters(this.lastCameraCenter, center)
      const bearingDelta =
        bearingDegrees != null && this.lastCameraBearingDegrees != null
          ? Math.abs((((bearingDegrees - this.lastCameraBearingDegrees) % 360) + 540) % 360 - 180)
          : 0
      if (moved < NAV_CAMERA_MIN_MOVE_METERS && bearingDelta < NAV_CAMERA_MIN_BEARING_DELTA_DEG) return
    }

    this.display.setNavCamera({
      center,
      zoom: this.lastCameraUpdateAtMs ? undefined : this.opts.navZoom,
      bearingDegrees: bearingDegrees ?? undefined,
      pitchDegrees: this.opts.navPitchDegrees,
      bottomPaddingPx: this.opts.navBottomPaddingPx,
      transition: 'ease',
      durationMs: NAV_FOLLOW_EASE_DURATION_MS,
    })

    this.lastCameraUpdateAtMs = now
    this.lastCameraCenter = center
    this.lastCameraBearingDegrees = bearingDegrees
  }

  private deriveSmoothedBearingDegrees(fix: LocationFix): number | null {
    let bearing: number | undefined = fix.headingDegrees

    if (bearing === undefined && this.prevFix) {
      const dtMs = fix.timestampMs - this.prevFix.timestampMs
      const movedMeters = haversineMeters(this.prevFix.coords, fix.coords)
      if (dtMs > NAV_MIN_DT_MS_FOR_BEARING && movedMeters > NAV_MIN_MOVEMENT_METERS_FOR_BEARING) {
        bearing = bearingDegrees(this.prevFix.coords, fix.coords)
      }
    }

    this.prevFix = { coords: fix.coords, timestampMs: fix.timestampMs }

    if (typeof bearing !== 'number' || !Number.isFinite(bearing)) return this.smoothedBearingDegrees

    const prev = this.smoothedBearingDegrees
    this.smoothedBearingDegrees = prev === null ? bearing : lerpAngleDegrees(prev, bearing, NAV_BEARING_SMOOTHING_ALPHA)
    return this.smoothedBearingDegrees
  }
}

export function deriveNextManeuver(route: Route, metersAlongRoute: number): RouteFollowerState['nextManeuver'] {
  // If the route has no steps at all, synthesize a stable “arrive” maneuver and
  // compute remaining distance directly in route meters (no step scaling).
  if (!Array.isArray(route.steps) || route.steps.length === 0) {
    const remaining =
      typeof route.distanceMeters === 'number' && Number.isFinite(route.distanceMeters)
        ? Math.max(0, route.distanceMeters - metersAlongRoute)
        : 0
    return { stepIndex: 0, instruction: 'Arrive at destination', distanceToNextMeters: remaining }
  }

  const steps: RouteDirectionStep[] = route.steps

  const stepDistances = steps.map((s) => (typeof s.distanceMeters === 'number' && Number.isFinite(s.distanceMeters) ? s.distanceMeters : null))
  const hasAllStepDistances = stepDistances.every((d) => d !== null)

  if (!hasAllStepDistances) {
    const first = steps[0]
    return {
      stepIndex: 0,
      instruction: first.instruction,
      distanceToNextMeters: 0,
    }
  }

  const dists = stepDistances as number[]
  const totalSteps = dists.reduce((a, b) => a + b, 0)
  const routeTotal = typeof route.distanceMeters === 'number' && Number.isFinite(route.distanceMeters) ? route.distanceMeters : null

  // Convert metersAlongRoute to an equivalent distance along the steps ladder.
  const metersIntoSteps =
    routeTotal && routeTotal > 0 && totalSteps > 0 ? (metersAlongRoute / routeTotal) * totalSteps : metersAlongRoute

  let cum = 0
  for (let i = 0; i < dists.length; i++) {
    const end = cum + dists[i]
    if (metersIntoSteps <= end) {
      const remainingToLeaveStep = Math.max(0, end - metersIntoSteps)
      const nextIdx = i + 1
      if (nextIdx < steps.length) {
        return {
          stepIndex: nextIdx,
          instruction: steps[nextIdx].instruction,
          distanceToNextMeters: remainingToLeaveStep,
        }
      }
      return {
        stepIndex: i,
        instruction: steps[i].instruction,
        distanceToNextMeters: remainingToLeaveStep,
      }
    }
    cum = end
  }

  // Past the end: treat as last instruction.
  const lastIdx = steps.length - 1
  return {
    stepIndex: lastIdx,
    instruction: steps[lastIdx].instruction,
    distanceToNextMeters: 0,
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

function buildCumulativeMeters(geom: LngLat[]): number[] {
  const cum: number[] = new Array(geom.length).fill(0)
  for (let i = 1; i < geom.length; i++) {
    cum[i] = cum[i - 1] + haversineMeters(geom[i - 1], geom[i])
  }
  return cum
}

function projectPointToPolylineMeters(geom: LngLat[], cumulative: number[], point: LngLat): number {
  let bestMeters = 0
  let bestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < geom.length - 1; i++) {
    const a = geom[i]
    const b = geom[i + 1]
    const proj = projectPointToSegmentMeters(point, a, b)
    const metersAlongRoute = cumulative[i] + proj.t * haversineMeters(a, b)
    if (proj.distanceMeters < bestDist) {
      bestDist = proj.distanceMeters
      bestMeters = metersAlongRoute
    }
  }
  return bestMeters
}

function projectPointToSegmentMeters(p: LngLat, a: LngLat, b: LngLat): { t: number; distanceMeters: number } {
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
  return { t, distanceMeters: Math.hypot(dx, dy) }
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

function clamp01(t: number): number {
  if (t < 0) return 0
  if (t > 1) return 1
  return t
}

function bearingDegrees(from: LngLat, to: LngLat): number {
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

function lerpAngleDegrees(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180
  return (a + delta * t + 360) % 360
}

