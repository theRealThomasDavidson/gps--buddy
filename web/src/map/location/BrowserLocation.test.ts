import { describe, expect, it, vi } from 'vitest'
import { BrowserLocation } from './BrowserLocation'

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
  })
}

describe('BrowserLocation', () => {
  it('getCurrent rejects with AbortError when signal is already aborted', async () => {
    const prev = globalThis.navigator
    const getCurrentPosition = vi.fn() as unknown as Geolocation['getCurrentPosition']
    setNavigator({ geolocation: { getCurrentPosition } } as Partial<Navigator>)

    const c = new AbortController()
    c.abort()

    const svc = new BrowserLocation()
    await expect(svc.getCurrent(c.signal)).rejects.toMatchObject({ name: 'AbortError' })

    setNavigator(prev)
  })

  it('getCurrent rejects with AbortError when aborted mid-flight', async () => {
    const prev = globalThis.navigator
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>(() => {
      // Intentionally never call success/error; we abort instead.
    })
    setNavigator(({ geolocation: { getCurrentPosition } } as unknown as Partial<Navigator>))

    const c = new AbortController()
    const svc = new BrowserLocation()
    const p = svc.getCurrent(c.signal)

    c.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })

    setNavigator(prev)
  })

  it('getCurrent rejects when geolocation is unavailable', async () => {
    const prev = globalThis.navigator
    setNavigator({})

    const svc = new BrowserLocation()
    await expect(svc.getCurrent()).rejects.toThrow(/Geolocation is not available/i)

    setNavigator(prev)
  })

  it('getCurrent returns a normalized fix on success', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success) => {
      success({
        coords: {
          longitude: -73.0,
          latitude: 40.0,
          accuracy: 12,
          heading: 90,
          speed: 1.5,
        },
        timestamp: 123,
      } as unknown as GeolocationPosition)
    })

    const prev = globalThis.navigator
    setNavigator(({ geolocation: { getCurrentPosition } } as unknown as Partial<Navigator>))

    const svc = new BrowserLocation({ enableHighAccuracy: false, timeoutMs: 1, maximumAgeMs: 2 })
    const fix = await svc.getCurrent()

    expect(fix).toEqual({
      coords: { lng: -73.0, lat: 40.0 },
      accuracyMeters: 12,
      timestampMs: 123,
      headingDegrees: 90,
      speedMetersPerSecond: 1.5,
    })

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    setNavigator(prev)
  })

  it('getCurrent omits heading/speed when NaN', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success) => {
      success({
        coords: {
          longitude: -73.0,
          latitude: 40.0,
          accuracy: 12,
          heading: Number.NaN,
          speed: Number.NaN,
        },
        timestamp: 123,
      } as unknown as GeolocationPosition)
    })

    const prev = globalThis.navigator
    setNavigator(({ geolocation: { getCurrentPosition } } as unknown as Partial<Navigator>))

    const svc = new BrowserLocation()
    const fix = await svc.getCurrent()
    expect(fix.headingDegrees).toBeUndefined()
    expect(fix.speedMetersPerSecond).toBeUndefined()

    setNavigator(prev)
  })

  it('getCurrent normalizes permission denied errors', async () => {
    const getCurrentPosition: Geolocation['getCurrentPosition'] = ((_success, error) => {
      error?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'User denied Geolocation',
      } as unknown as GeolocationPositionError)
    }) as Geolocation['getCurrentPosition']

    const prev = globalThis.navigator
    setNavigator({ geolocation: { getCurrentPosition } } as Partial<Navigator>)

    const svc = new BrowserLocation()
    await expect(svc.getCurrent()).rejects.toThrow(/denied geolocation/i)

    setNavigator(prev)
  })

  it('getCurrent normalizes position unavailable errors', async () => {
    const getCurrentPosition: Geolocation['getCurrentPosition'] = ((_success, error) => {
      error?.({
        code: 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'Position unavailable',
      } as unknown as GeolocationPositionError)
    }) as Geolocation['getCurrentPosition']

    const prev = globalThis.navigator
    setNavigator({ geolocation: { getCurrentPosition } } as Partial<Navigator>)

    const svc = new BrowserLocation()
    await expect(svc.getCurrent()).rejects.toThrow(/location unavailable/i)

    setNavigator(prev)
  })

  it('getCurrent normalizes timeout errors', async () => {
    const getCurrentPosition: Geolocation['getCurrentPosition'] = ((_success, error) => {
      error?.({
        code: 3,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'Timeout',
      } as unknown as GeolocationPositionError)
    }) as Geolocation['getCurrentPosition']

    const prev = globalThis.navigator
    setNavigator({ geolocation: { getCurrentPosition } } as Partial<Navigator>)

    const svc = new BrowserLocation()
    await expect(svc.getCurrent()).rejects.toThrow(/location timeout/i)

    setNavigator(prev)
  })

  it('getCurrent uses the browser error message for unknown codes', async () => {
    const getCurrentPosition: Geolocation['getCurrentPosition'] = ((_success, error) => {
      error?.({
        code: 99,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'Something odd happened',
      } as unknown as GeolocationPositionError)
    }) as Geolocation['getCurrentPosition']

    const prev = globalThis.navigator
    setNavigator({ geolocation: { getCurrentPosition } } as Partial<Navigator>)

    const svc = new BrowserLocation()
    await expect(svc.getCurrent()).rejects.toThrow(/Something odd happened/i)

    setNavigator(prev)
  })

  it('getCurrent falls back to a generic message when the browser provides none', async () => {
    const getCurrentPosition: Geolocation['getCurrentPosition'] = ((_success, error) => {
      error?.({
        code: 99,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: '',
      } as unknown as GeolocationPositionError)
    }) as Geolocation['getCurrentPosition']

    const prev = globalThis.navigator
    setNavigator({ geolocation: { getCurrentPosition } } as Partial<Navigator>)

    const svc = new BrowserLocation()
    await expect(svc.getCurrent()).rejects.toThrow(/Unable to get location/i)

    setNavigator(prev)
  })

  it('watch returns a no-op stop when geolocation is unavailable', () => {
    const prev = globalThis.navigator
    setNavigator({})

    const svc = new BrowserLocation()
    const stop = svc.watch(() => {})
    expect(() => stop()).not.toThrow()

    setNavigator(prev)
  })

  it('watch emits fixes and stop clears by id', () => {
    const clearWatch = vi.fn()
    const watchPosition = vi.fn<Geolocation['watchPosition']>((success) => {
      success({
        coords: { longitude: -73, latitude: 40, accuracy: 5, heading: NaN, speed: NaN },
        timestamp: 5,
      } as unknown as GeolocationPosition)
      return 42
    })

    const prev = globalThis.navigator
    const getCurrentPosition = vi.fn() as unknown as Geolocation['getCurrentPosition']
    setNavigator(
      ({ geolocation: { getCurrentPosition, watchPosition, clearWatch } } as unknown as Partial<Navigator>),
    )

    const onFix = vi.fn()
    const svc = new BrowserLocation()
    const stop = svc.watch(onFix)

    expect(onFix).toHaveBeenCalledWith({
      coords: { lng: -73, lat: 40 },
      accuracyMeters: 5,
      timestampMs: 5,
      headingDegrees: undefined,
      speedMetersPerSecond: undefined,
    })

    stop()
    expect(clearWatch).toHaveBeenCalledWith(42)

    setNavigator(prev)
  })

  it('watch ignores errors from the browser callback', () => {
    const clearWatch = vi.fn()
    const watchPosition = vi.fn<Geolocation['watchPosition']>((_success, error) => {
      error?.({
        code: 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'Position unavailable',
      } as unknown as GeolocationPositionError)
      return 99
    })

    const prev = globalThis.navigator
    const getCurrentPosition = vi.fn() as unknown as Geolocation['getCurrentPosition']
    setNavigator(
      ({ geolocation: { getCurrentPosition, watchPosition, clearWatch } } as unknown as Partial<Navigator>),
    )

    const svc = new BrowserLocation()
    const stop = svc.watch(() => {
      throw new Error('should not be called')
    })

    expect(() => stop()).not.toThrow()
    expect(clearWatch).toHaveBeenCalledWith(99)
    setNavigator(prev)
  })

  it('watch includes heading/speed when available and passes watch options', () => {
    const clearWatch = vi.fn()
    const watchPosition = vi.fn<Geolocation['watchPosition']>((success, errorCallback, options) => {
      void errorCallback
      void options
      success({
        coords: { longitude: -73, latitude: 40, accuracy: 5, heading: 10, speed: 2 },
        timestamp: 6,
      } as unknown as GeolocationPosition)
      return 7
    })

    const prev = globalThis.navigator
    const getCurrentPosition = vi.fn() as unknown as Geolocation['getCurrentPosition']
    setNavigator(
      ({ geolocation: { getCurrentPosition, watchPosition, clearWatch } } as unknown as Partial<Navigator>),
    )

    const onFix = vi.fn()
    const svc = new BrowserLocation({ watchMaximumAgeMs: 1234 })
    const stop = svc.watch(onFix)

    expect(onFix).toHaveBeenCalledWith({
      coords: { lng: -73, lat: 40 },
      accuracyMeters: 5,
      timestampMs: 6,
      headingDegrees: 10,
      speedMetersPerSecond: 2,
    })

    expect(watchPosition.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ maximumAge: 1234 }),
    )

    stop()
    expect(clearWatch).toHaveBeenCalledWith(7)
    setNavigator(prev)
  })
})

