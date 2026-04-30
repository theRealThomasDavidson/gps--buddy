import { describe, expect, it, vi } from 'vitest'
import { deriveNextManeuver, RouteFollowerController } from './RouteFollowerController'
import type { IMapDisplay, NavCameraIntent } from '../display/IMapDisplay'
import type { ILocation, LocationFix, LocationWatchStop } from '../location/ILocation'
import type { IRouteProgressor, RouteProgressorMemory, RouteProgressorResult } from '../evaluation/IRouteProgressor'
import type { IRouteWorkflow } from '../routing/IRouteWorkflow'
import type { LngLat } from '../types'
import type { Route } from '../types'

function routeWithSteps(args: { routeDistance: number; stepDistances: number[] }): Route {
  return {
    id: 'r',
    provider: 'test',
    profile: 'drive',
    distanceMeters: args.routeDistance,
    geometry: [
      { lng: 0, lat: 0 },
      { lng: 1, lat: 0 },
    ],
    steps: args.stepDistances.map((d, i) => ({ instruction: `Step ${i}`, distanceMeters: d })),
  }
}

describe('deriveNextManeuver', () => {
  it('returns Arrive at destination when route has no steps', () => {
    const r: Route = {
      id: 'r',
      provider: 'test',
      profile: 'drive',
      distanceMeters: 1000,
      geometry: [
        { lng: 0, lat: 0 },
        { lng: 1, lat: 0 },
      ],
      steps: [],
    }

    const m = deriveNextManeuver(r, 250)
    expect(m?.instruction).toBe('Arrive at destination')
    expect(m?.distanceToNextMeters).toBe(750)
  })

  it('falls back to step 0 with distance 0 if any step distance is missing', () => {
    const r: Route = {
      id: 'r',
      provider: 'test',
      profile: 'drive',
      distanceMeters: 300,
      geometry: [
        { lng: 0, lat: 0 },
        { lng: 1, lat: 0 },
      ],
      steps: [{ instruction: 'Turn left' }, { instruction: 'Turn right', distanceMeters: 50 }],
    }

    const m = deriveNextManeuver(r, 100)
    expect(m).toEqual({ stepIndex: 0, instruction: 'Turn left', distanceToNextMeters: 0 })
  })

  it('shows the upcoming maneuver (next step) with distance until that transition', () => {
    // steps: [100, 200], totalSteps=300, routeTotal=600 => metersIntoSteps = metersAlongRoute * 0.5
    const r = routeWithSteps({ routeDistance: 600, stepDistances: [100, 200] })

    const m0 = deriveNextManeuver(r, 0)
    expect(m0).toEqual({ stepIndex: 1, instruction: 'Step 1', distanceToNextMeters: 100 })

    const m50 = deriveNextManeuver(r, 100) // metersIntoSteps=50 => 50 m until end of leg leading to Step 1
    expect(m50).toEqual({ stepIndex: 1, instruction: 'Step 1', distanceToNextMeters: 50 })

    const mAtBoundary = deriveNextManeuver(r, 200) // metersIntoSteps=100 => at Step 1 maneuver
    expect(mAtBoundary).toEqual({ stepIndex: 1, instruction: 'Step 1', distanceToNextMeters: 0 })

    const mOnLastLeg = deriveNextManeuver(r, 300) // metersIntoSteps=150 => on final step only — no further step
    expect(mOnLastLeg).toEqual({ stepIndex: 1, instruction: 'Step 1', distanceToNextMeters: 150 })
  })

  it('returns last step with distance 0 when past the end', () => {
    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    const m = deriveNextManeuver(r, 1000)
    expect(m).toEqual({ stepIndex: 1, instruction: 'Step 1', distanceToNextMeters: 0 })
  })
})

function mkFix(args: { coords: LngLat; tMs: number; speedMps?: number; headingDeg?: number }): LocationFix {
  return {
    coords: args.coords,
    timestampMs: args.tMs,
    speedMetersPerSecond: args.speedMps,
    headingDegrees: args.headingDeg,
  }
}

describe('RouteFollowerController', () => {
  it('increments off-route strikes when moving and beyond threshold, and triggers reroute on minStrikes', async () => {
    const navCalls: NavCameraIntent[] = []

    const display: IMapDisplay = {
      setNavCamera: (i) => navCalls.push(i),
      setCenter: () => {},
      setBaseView: () => {},
      setLayers: () => {},
      setUserMapInteractionHandler: () => {},
      mount: () => {},
      unmount: () => {},
      showRoute: () => {},
      fitRoute: () => {},
      showPositionFix: () => {},
      setSearchPins: () => {},
      setSavedPins: () => {},
      setPinnedAddress: () => {},
    }

    let watchCb: ((fix: LocationFix) => void) | null = null
    const location: ILocation = {
      getCurrent: async () => mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0 }),
      watch: (cb) => {
        watchCb = cb
        const stop: LocationWatchStop = () => {
          watchCb = null
        }
        return stop
      },
    }

    const routed: Array<{ waypoints: LngLat[]; fitMode?: string }> = []
    const workflow: IRouteWorkflow = {
      router: { id: 'fake', route: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) },
      display,
      routeAndRender: async (req, opts) => {
        routed.push({ waypoints: req.waypoints, fitMode: opts?.fitMode })
        return { id: 'nr', provider: 't', profile: req.profile, geometry: [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }] }
      },
      clearRenderedRoute: () => {},
    }

    const progressor: IRouteProgressor = {
      project: (route, fix, memory): RouteProgressorResult => {
        // Always "off-route" by 100m; pretend we're at 0 along route.
        return {
          progress: { snappedCoords: fix.coords, segmentIndex: 0, metersAlongRoute: 30_000, distanceToRouteMeters: 100 },
          memory: { ...memory, lastFix: fix },
        }
      },
    }

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(1_000_000)

    const controller = new RouteFollowerController({
      display,
      location,
      workflow,
      progressor,
      options: { offRouteThresholdMeters: 40, minStrikes: 3, cooldownMs: 20_000 },
    })

    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({
      route: r,
      tripStops: [
        { lng: 0, lat: 0 },
        { lng: 0.5, lat: 0 },
        { lng: 1, lat: 0 },
      ],
    })
    expect(typeof watchCb).toBe('function')

    // 3 moving fixes off-route => reroute once.
    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 2 }))
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0 }, tMs: 1000, speedMps: 2 }))
    watchCb!(mkFix({ coords: { lng: 0.0002, lat: 0 }, tMs: 2000, speedMps: 2 }))

    // Allow async maybeReroute to flush.
    await Promise.resolve()
    await Promise.resolve()

    expect(routed.length).toBe(1)
    expect(routed[0]?.fitMode).toBe('noFit')
    // current + remaining stops (mid + destination)
    expect(routed[0]?.waypoints.length).toBe(3)

    nowSpy.mockRestore()
    controller.stop()
  })

  it('reroute without tripStops uses last route geometry point as destination', async () => {
    const display: IMapDisplay = {
      setNavCamera: () => {},
      setCenter: () => {},
      setBaseView: () => {},
      setLayers: () => {},
      setUserMapInteractionHandler: () => {},
      mount: () => {},
      unmount: () => {},
      showRoute: () => {},
      fitRoute: () => {},
      showPositionFix: () => {},
      setSearchPins: () => {},
      setSavedPins: () => {},
      setPinnedAddress: () => {},
    }

    let watchCb: ((fix: LocationFix) => void) | null = null
    const location: ILocation = {
      getCurrent: async () => mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0 }),
      watch: (cb) => {
        watchCb = cb
        return () => {
          watchCb = null
        }
      },
    }

    const routed: LngLat[][] = []
    const workflow: IRouteWorkflow = {
      router: { id: 'fake', route: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) },
      display,
      routeAndRender: async (req) => {
        routed.push(req.waypoints)
        return { id: 'nr', provider: 't', profile: req.profile, geometry: [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }] }
      },
      clearRenderedRoute: () => {},
    }

    const progressor: IRouteProgressor = {
      project: (route, fix, memory): RouteProgressorResult => ({
        progress: {
          snappedCoords: fix.coords,
          segmentIndex: 0,
          metersAlongRoute: 30_000,
          distanceToRouteMeters: 100,
        },
        memory: { ...memory, lastFix: fix },
      }),
    }

    const controller = new RouteFollowerController({
      display,
      location,
      workflow,
      progressor,
      options: { offRouteThresholdMeters: 40, minStrikes: 3, cooldownMs: 20_000 },
    })

    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r })

    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 2 }))
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0 }, tMs: 1000, speedMps: 2 }))
    watchCb!(mkFix({ coords: { lng: 0.0002, lat: 0 }, tMs: 2000, speedMps: 2 }))

    await Promise.resolve()
    await Promise.resolve()

    expect(routed.length).toBe(1)
    expect(routed[0]).toEqual([
      { lng: 0.0002, lat: 0 },
      { lng: 1, lat: 0 },
    ])

    controller.stop()
  })

  it('sets reroute error state when routeAndRender rejects', async () => {
    const display: IMapDisplay = {
      setNavCamera: () => {},
      setCenter: () => {},
      setBaseView: () => {},
      setLayers: () => {},
      setUserMapInteractionHandler: () => {},
      mount: () => {},
      unmount: () => {},
      showRoute: () => {},
      fitRoute: () => {},
      showPositionFix: () => {},
      setSearchPins: () => {},
      setSavedPins: () => {},
      setPinnedAddress: () => {},
    }

    let watchCb: ((fix: LocationFix) => void) | null = null
    const location: ILocation = {
      getCurrent: async () => mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0 }),
      watch: (cb) => {
        watchCb = cb
        return () => {
          watchCb = null
        }
      },
    }

    const workflow: IRouteWorkflow = {
      router: { id: 'fake', route: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) },
      display,
      routeAndRender: async () => {
        throw new Error('demo reroute failure')
      },
      clearRenderedRoute: () => {},
    }

    const progressor: IRouteProgressor = {
      project: (route, fix, memory): RouteProgressorResult => ({
        progress: {
          snappedCoords: fix.coords,
          segmentIndex: 0,
          metersAlongRoute: 30_000,
          distanceToRouteMeters: 100,
        },
        memory: { ...memory, lastFix: fix },
      }),
    }

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(2_000_000)

    const controller = new RouteFollowerController({
      display,
      location,
      workflow,
      progressor,
      options: { offRouteThresholdMeters: 40, minStrikes: 3, cooldownMs: 20_000 },
    })

    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r })

    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 2 }))
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0 }, tMs: 1000, speedMps: 2 }))
    watchCb!(mkFix({ coords: { lng: 0.0002, lat: 0 }, tMs: 2000, speedMps: 2 }))

    await Promise.resolve()
    await Promise.resolve()

    const s = controller.getState()
    expect(s.rerouting).toBe(false)
    expect(s.lastRerouteErrorAtMs).toBe(2_000_000)
    expect(s.lastRerouteErrorMessage).toBe('Reroute failed. Staying on your current route.')

    nowSpy.mockRestore()
    controller.stop()
  })

  it('does not accumulate strikes while stationary (speed < 0.5 m/s)', async () => {
    let watchCb: ((fix: LocationFix) => void) | null = null
    const location: ILocation = {
      getCurrent: async () => mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0 }),
      watch: (cb) => {
        watchCb = cb
        return () => {
          watchCb = null
        }
      },
    }

    let reroutes = 0
    const display = { setNavCamera: () => {} } as unknown as IMapDisplay
    const workflow = {
      routeAndRender: async () => {
        reroutes++
        return { id: 'nr', provider: 't', profile: 'drive', geometry: [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }] }
      },
    } as unknown as IRouteWorkflow

    const progressor: IRouteProgressor = {
      project: (_route, fix, memory) => ({
        progress: { snappedCoords: fix.coords, segmentIndex: 0, metersAlongRoute: 0, distanceToRouteMeters: 100 },
        memory: { ...memory, lastFix: fix },
      }),
    }

    const controller = new RouteFollowerController({
      display,
      location,
      workflow,
      progressor,
      options: { offRouteThresholdMeters: 40, minStrikes: 1, cooldownMs: 0 },
    })

    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r })

    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 0.1 }))
    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 1000, speedMps: 0.1 }))
    await Promise.resolve()

    expect(reroutes).toBe(0)
    controller.stop()
  })

  it('throttles nav camera updates by minimum interval', () => {
    const navCalls: NavCameraIntent[] = []
    const display = { setNavCamera: (i: NavCameraIntent) => navCalls.push(i) } as unknown as IMapDisplay

    let watchCb: ((fix: LocationFix) => void) | null = null
    const location = {
      watch: (cb: (fix: LocationFix) => void) => {
        watchCb = cb
        return () => {
          watchCb = null
        }
      },
    } as unknown as ILocation

    const workflow = { routeAndRender: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) } as unknown as IRouteWorkflow

    const progressor = {
      project: (_route: Route, fix: LocationFix, memory: RouteProgressorMemory) => ({
        progress: { snappedCoords: fix.coords, segmentIndex: 0, metersAlongRoute: 0, distanceToRouteMeters: 0 },
        memory: { ...memory, lastFix: fix },
      }),
    } as unknown as IRouteProgressor

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(10_000)

    const controller = new RouteFollowerController({ display, location, workflow, progressor })
    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r, initialCenter: { lng: 0, lat: 0 } })
    expect(navCalls.length).toBe(1) // initial seed

    // First fix triggers an update.
    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 2 }))
    expect(navCalls.length).toBe(2)

    // Within interval: no new camera call.
    nowSpy.mockReturnValue(10_100)
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0 }, tMs: 1000, speedMps: 2 }))
    expect(navCalls.length).toBe(2)

    // After interval: should update.
    nowSpy.mockReturnValue(11_500)
    watchCb!(mkFix({ coords: { lng: 0.0002, lat: 0 }, tMs: 2000, speedMps: 2 }))
    expect(navCalls.length).toBe(3)

    nowSpy.mockRestore()
    controller.stop()
  })

  it('derives bearing from movement when heading is missing, and smooths subsequent bearings', () => {
    const navCalls: NavCameraIntent[] = []
    const display = { setNavCamera: (i: NavCameraIntent) => navCalls.push(i) } as unknown as IMapDisplay

    let watchCb: ((fix: LocationFix) => void) | null = null
    const location = {
      watch: (cb: (fix: LocationFix) => void) => {
        watchCb = cb
        return () => {
          watchCb = null
        }
      },
    } as unknown as ILocation

    const workflow = { routeAndRender: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) } as unknown as IRouteWorkflow
    const progressor = {
      project: (_route: Route, fix: LocationFix, memory: RouteProgressorMemory) => ({
        progress: { snappedCoords: fix.coords, segmentIndex: 0, metersAlongRoute: 0, distanceToRouteMeters: 0 },
        memory: { ...memory, lastFix: fix },
      }),
    } as unknown as IRouteProgressor

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(0)

    const controller = new RouteFollowerController({ display, location, workflow, progressor })
    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r })

    // Fix 1 seeds prevFix only (no heading).
    nowSpy.mockReturnValue(10_000)
    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 2 }))

    // Fix 2: dt>400ms and moved>2m => derive bearing from movement. (eastward ≈ 90°)
    nowSpy.mockReturnValue(12_000)
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0 }, tMs: 1000, speedMps: 2 }))

    // Fix 3: northward => bearing ≈ 0°, but smoothing means it won't snap instantly.
    nowSpy.mockReturnValue(14_000)
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0.0001 }, tMs: 2000, speedMps: 2 }))

    const withBearing = navCalls.filter((c) => typeof c.bearingDegrees === 'number')
    expect(withBearing.length).toBeGreaterThanOrEqual(2)
    // First derived bearing near east.
    expect((withBearing[0].bearingDegrees as number)).toBeGreaterThan(60)
    expect((withBearing[0].bearingDegrees as number)).toBeLessThan(120)
    // Smoothed bearing should be between 0 and 90 (not a hard snap).
    expect((withBearing[1].bearingDegrees as number)).toBeGreaterThan(0)
    expect((withBearing[1].bearingDegrees as number)).toBeLessThan(90)

    nowSpy.mockRestore()
    controller.stop()
  })

  it('keeps previous smoothed bearing when heading becomes non-finite', () => {
    const navCalls: NavCameraIntent[] = []
    const display = { setNavCamera: (i: NavCameraIntent) => navCalls.push(i) } as unknown as IMapDisplay

    let watchCb: ((fix: LocationFix) => void) | null = null
    const location = {
      watch: (cb: (fix: LocationFix) => void) => {
        watchCb = cb
        return () => {
          watchCb = null
        }
      },
    } as unknown as ILocation

    const workflow = { routeAndRender: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) } as unknown as IRouteWorkflow
    const progressor = {
      project: (_route: Route, fix: LocationFix, memory: RouteProgressorMemory) => ({
        progress: { snappedCoords: fix.coords, segmentIndex: 0, metersAlongRoute: 0, distanceToRouteMeters: 0 },
        memory: { ...memory, lastFix: fix },
      }),
    } as unknown as IRouteProgressor

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(0)

    const controller = new RouteFollowerController({ display, location, workflow, progressor })
    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r })

    nowSpy.mockReturnValue(10_000)
    watchCb!(mkFix({ coords: { lng: 0, lat: 0 }, tMs: 0, speedMps: 2, headingDeg: 45 }))
    nowSpy.mockReturnValue(12_000)
    watchCb!(mkFix({ coords: { lng: 0.0001, lat: 0 }, tMs: 1000, speedMps: 2, headingDeg: Number.NaN }))

    const bearings = navCalls
      .map((c) => c.bearingDegrees)
      .filter((b): b is number => typeof b === 'number' && Number.isFinite(b))
    expect(bearings[0]).toBe(45)

    nowSpy.mockRestore()
    controller.stop()
  })

  it('supports getState + subscribe/unsubscribe and is idempotent to stop', () => {
    const display = { setNavCamera: () => {} } as unknown as IMapDisplay
    const location = { watch: () => () => {} } as unknown as ILocation
    const workflow = { routeAndRender: async () => ({ id: 'nr', provider: 't', profile: 'drive', geometry: [] }) } as unknown as IRouteWorkflow
    const progressor = {
      project: (_route: Route, fix: LocationFix, memory: RouteProgressorMemory) => ({
        progress: { snappedCoords: fix.coords, segmentIndex: 0, metersAlongRoute: 0, distanceToRouteMeters: 0 },
        memory: { ...memory, lastFix: fix },
      }),
    } as unknown as IRouteProgressor

    const controller = new RouteFollowerController({ display, location, workflow, progressor })

    const snapshots: boolean[] = []
    const unsub = controller.subscribe((s) => snapshots.push(s.enabled))
    expect(controller.getState().enabled).toBe(false)

    const r = routeWithSteps({ routeDistance: 300, stepDistances: [100, 100] })
    controller.start({ route: r })
    expect(controller.getState().enabled).toBe(true)

    unsub()
    controller.stop()
    controller.stop() // should not throw / should early-return

    // First subscribe call receives initial snapshot (enabled=false), then start emits enabled=true.
    expect(snapshots[0]).toBe(false)
    expect(snapshots).toContain(true)
  })
})

