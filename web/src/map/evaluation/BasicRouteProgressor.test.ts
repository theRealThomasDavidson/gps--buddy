import { describe, expect, it } from 'vitest'
import { BasicRouteProgressor } from './BasicRouteProgressor'
import type { LocationFix } from '../location/ILocation'
import type { LngLat, Route } from '../types'

function fix(coords: LngLat, tMs: number, speedMps?: number, headingDeg?: number): LocationFix {
  return {
    coords,
    timestampMs: tMs,
    speedMetersPerSecond: speedMps,
    headingDegrees: headingDeg,
  }
}

function route(geometry: LngLat[]): Route {
  return { id: 'r', provider: 'test', profile: 'drive', geometry }
}

// At lat≈0, 1° lon ≈ 111_320m. This is good enough for deterministic tests.
function eastMetersToLngDelta(m: number): number {
  return m / 111_320
}

function northMetersToLatDelta(m: number): number {
  return m / 110_540
}

function p0(): LngLat {
  return { lng: 0, lat: 0 }
}

function addMetersLL(origin: LngLat, eastM: number, northM: number): LngLat {
  return { lng: origin.lng + eastMetersToLngDelta(eastM), lat: origin.lat + northMetersToLatDelta(northM) }
}

describe('BasicRouteProgressor', () => {
  it('degenerate route (geometry < 2) snaps to fix with zero progress', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0()])
    const out = prog.project(r, fix(addMetersLL(p0(), 12, 3), 0), { last: null, lastFix: null })

    expect(out.progress.segmentIndex).toBe(0)
    expect(out.progress.metersAlongRoute).toBe(0)
    expect(out.progress.distanceToRouteMeters).toBe(0)
    expect(out.progress.snappedCoords).toEqual(addMetersLL(p0(), 12, 3))
  })

  it('projects to the closest point on a straight segment and metersAlongRoute increases', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const a = prog.project(r, fix(addMetersLL(p0(), 100, 10), 0), { last: null, lastFix: null })
    const b = prog.project(r, fix(addMetersLL(p0(), 300, -7), 1000), a.memory)

    expect(a.progress.segmentIndex).toBe(0)
    expect(b.progress.segmentIndex).toBe(0)
    expect(a.progress.distanceToRouteMeters).toBeGreaterThan(0)
    expect(b.progress.distanceToRouteMeters).toBeGreaterThan(0)
    expect(b.progress.metersAlongRoute).toBeGreaterThan(a.progress.metersAlongRoute)
    // snapped point should lie on the segment (lat≈0)
    expect(Math.abs(a.progress.snappedCoords.lat)).toBeLessThan(northMetersToLatDelta(0.5))
    expect(Math.abs(b.progress.snappedCoords.lat)).toBeLessThan(northMetersToLatDelta(0.5))
  })

  it('near a vertex, metersAlongRoute is near the vertex cumulative distance', () => {
    const prog = new BasicRouteProgressor()
    const o = p0()
    const aPt = addMetersLL(o, 100, 0)
    const bPt = addMetersLL(o, 200, 0)
    const r = route([o, aPt, bPt])

    // Put the fix slightly north of the vertex at 100m.
    const out = prog.project(r, fix(addMetersLL(o, 100, 3), 0), { last: null, lastFix: null })

    expect(out.progress.metersAlongRoute).toBeGreaterThan(95)
    expect(out.progress.metersAlongRoute).toBeLessThan(105)
  })

  it('hysteresis prefers local match when global is only slightly closer', () => {
    // Build a skinny rectangle: segment0 and segment3 are nearly on top of each other.
    // If you are near the start, the “other side” segment can be marginally closer due to numeric noise.
    // We expect hysteresis to keep the local segment when within switchMargin.
    const prog = new BasicRouteProgressor({
      searchBackMeters: 30,
      searchForwardMeters: 120,
      switchMarginMeters: 10,
    })

    const o = p0()
    const east = addMetersLL(o, 200, 0)
    const north = addMetersLL(east, 0, 1.2) // 1.2m north
    const westNorth = addMetersLL(o, 0, 1.2)
    const r = route([o, east, north, westNorth])

    // First fix near segment0 at ~50m along.
    const first = prog.project(r, fix(addMetersLL(o, 50, 0.6), 0), { last: null, lastFix: null })
    expect(first.progress.segmentIndex).toBe(0)

    // Second fix almost identical; global best might prefer the top edge (segment2) very slightly.
    // Hysteresis should keep us on the local window near segment0.
    const second = prog.project(r, fix(addMetersLL(o, 52, 0.6), 1000), first.memory)
    expect(second.progress.segmentIndex).toBe(0)
  })

  it('clamps backward jitter to maxBackwardProgressMetersPerFix', () => {
    const prog = new BasicRouteProgressor({
      maxBackwardProgressMetersPerFix: 3,
      progressEpsilonMeters: 1,
    })
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const first = prog.project(r, fix(addMetersLL(p0(), 200, 0), 0), { last: null, lastFix: null })
    // Big backwards jump (GPS glitch) should clamp to at most 3m backwards.
    const second = prog.project(r, fix(addMetersLL(p0(), 150, 0), 1000), first.memory)

    expect(second.progress.metersAlongRoute).toBeGreaterThanOrEqual(first.progress.metersAlongRoute - 3.001)
    expect(second.progress.metersAlongRoute).toBeLessThanOrEqual(first.progress.metersAlongRoute + 0.001)
  })

  it('does not clamp backward progress when within maxBackwardProgressMetersPerFix', () => {
    const prog = new BasicRouteProgressor({
      maxBackwardProgressMetersPerFix: 80,
      progressEpsilonMeters: 1,
    })
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const first = prog.project(r, fix(addMetersLL(p0(), 200, 0), 0), { last: null, lastFix: null })
    // Backwards by 20m, but within maxBackwardProgressMetersPerFix => no clamp branch.
    const second = prog.project(r, fix(addMetersLL(p0(), 180, 0), 1000), first.memory)

    expect(second.progress.metersAlongRoute).toBeLessThan(first.progress.metersAlongRoute)
    expect(second.progress.metersAlongRoute).toBeGreaterThanOrEqual(first.progress.metersAlongRoute - 25)
  })

  it('distance-window search is based on meters, so dense segments do not break progress', () => {
    const prog = new BasicRouteProgressor({
      searchBackMeters: 10,
      searchForwardMeters: 120,
      switchMarginMeters: 10,
    })

    // Dense polyline: points every 2m for 400m.
    const o = p0()
    const geom: LngLat[] = []
    for (let i = 0; i <= 200; i++) geom.push(addMetersLL(o, i * 2, 0))
    const r = route(geom)

    const first = prog.project(r, fix(addMetersLL(o, 40, 3), 0), { last: null, lastFix: null })
    const second = prog.project(r, fix(addMetersLL(o, 80, -2), 1000), first.memory)
    const third = prog.project(r, fix(addMetersLL(o, 120, 1), 2000), second.memory)

    expect(second.progress.metersAlongRoute).toBeGreaterThan(first.progress.metersAlongRoute)
    expect(third.progress.metersAlongRoute).toBeGreaterThan(second.progress.metersAlongRoute)
    // Still snapped onto the baseline (lat≈0)
    expect(Math.abs(third.progress.snappedCoords.lat)).toBeLessThan(northMetersToLatDelta(0.75))
  })

  it('caps forward progress based on speed and time delta (prevents teleporting)', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    // First fix at the start.
    const first = prog.project(r, fix(addMetersLL(p0(), 0, 0), 0, 1), { last: null, lastFix: null })

    // 1s later, a bad snap jumps far ahead, but reported speed is low.
    // Forward cap uses max(speed, 20mph) * dt * 1.5 ≈ 8.94 * 1 * 1.5 = 13.41m.
    const second = prog.project(r, fix(addMetersLL(p0(), 200, 0), 1000, 1), first.memory)

    expect(second.progress.metersAlongRoute).toBeLessThan(20)
    expect(second.progress.metersAlongRoute).toBeGreaterThanOrEqual(0)
  })

  it('does not apply forward cap when speed is missing/NaN', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const first = prog.project(r, fix(addMetersLL(p0(), 0, 0), 1000, 5), { last: null, lastFix: null })

    // Next fix has no speed => cap disabled; progress can jump forward.
    const second = prog.project(r, { coords: addMetersLL(p0(), 500, 0), timestampMs: 2000 }, first.memory)
    expect(second.progress.metersAlongRoute).toBeGreaterThan(200)
  })

  it('does not apply forward cap when speed is NaN', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const first = prog.project(r, fix(addMetersLL(p0(), 0, 0), 1000, 5), { last: null, lastFix: null })
    const second = prog.project(
      r,
      { coords: addMetersLL(p0(), 500, 0), timestampMs: 2000, speedMetersPerSecond: Number.NaN },
      first.memory,
    )
    expect(second.progress.metersAlongRoute).toBeGreaterThan(200)
  })

  it('does not apply forward cap when timestamp does not advance', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const first = prog.project(r, fix(addMetersLL(p0(), 0, 0), 1000, 5), { last: null, lastFix: null })
    // Same timestamp => dtSec <= 0 => cap disabled.
    const second = prog.project(r, fix(addMetersLL(p0(), 500, 0), 1000, 1), first.memory)
    expect(second.progress.metersAlongRoute).toBeGreaterThan(200)
  })

  it('handles zero-length segments (duplicate points) without NaN progress', () => {
    const prog = new BasicRouteProgressor()
    const o = p0()
    const dup = addMetersLL(o, 0, 0)
    const end = addMetersLL(o, 100, 0)
    const r = route([o, dup, end])

    const out = prog.project(r, fix(addMetersLL(o, 10, 5), 0), { last: null, lastFix: null })
    expect(Number.isFinite(out.progress.metersAlongRoute)).toBe(true)
    expect(Number.isFinite(out.progress.distanceToRouteMeters)).toBe(true)
  })

  it('forward-cap clamp works with an initial zero-length segment', () => {
    const prog = new BasicRouteProgressor()
    const o = p0()
    const dup = addMetersLL(o, 0, 0)
    const end = addMetersLL(o, 100, 0)
    const r = route([o, dup, end])

    const first = prog.project(r, fix(addMetersLL(o, 0, 0), 0, 1), { last: null, lastFix: null })

    // Very small dt => very small max forward. With a zero-length first segment, clamping needs to stay finite.
    const second = prog.project(r, fix(addMetersLL(o, 80, 0), 10, 0.1), first.memory)
    expect(Number.isFinite(second.progress.metersAlongRoute)).toBe(true)
    expect(second.progress.metersAlongRoute).toBeLessThan(2)
  })

  it('does not attempt forward-cap when memory.lastFix is missing', () => {
    const prog = new BasicRouteProgressor()
    const r = route([p0(), addMetersLL(p0(), 1000, 0)])

    const first = prog.project(r, fix(addMetersLL(p0(), 0, 0), 0, 5), { last: null, lastFix: null })
    const memoryWithoutFix = { ...first.memory, lastFix: null }

    const second = prog.project(r, fix(addMetersLL(p0(), 500, 0), 1000, 1), memoryWithoutFix)
    expect(second.progress.metersAlongRoute).toBeGreaterThan(200)
  })
})

