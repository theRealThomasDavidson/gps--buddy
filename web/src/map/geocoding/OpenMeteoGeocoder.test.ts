import { describe, expect, it, vi } from 'vitest'
import { OpenMeteoGeocoder } from './OpenMeteoGeocoder'

describe('OpenMeteoGeocoder', () => {
  it('returns [] for empty query', async () => {
    const g = new OpenMeteoGeocoder()
    expect(await g.geocode('')).toEqual([])
  })

  it('parses results into GeocodeResult', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { id: 1, name: 'A', admin1: 'B', country: 'C', latitude: 40, longitude: -73 },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new OpenMeteoGeocoder()
    const out = await g.geocode('hi')
    expect(out).toEqual([{ id: '1', label: 'A, B, C', center: { lng: -73, lat: 40 } }])
  })

  it('throws on non-200', async () => {
    type FetchFn = typeof fetch
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429 }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)
    const g = new OpenMeteoGeocoder()
    await expect(g.geocode('x')).rejects.toThrow(/failed \(429\)/i)
  })

  it('handles missing results array and skips rows without coordinates', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { id: 1, latitude: Number.NaN, longitude: -73 },
          { id: 'x' as unknown as number, name: 'OnlyName', latitude: 40, longitude: -73 },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new OpenMeteoGeocoder()
    const out = await g.geocode('hi')
    expect(out).toEqual([{ label: 'OnlyName', center: { lng: -73, lat: 40 } }])
  })

  it('skips rows when latitude/longitude are not finite numbers', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { latitude: Number.POSITIVE_INFINITY, longitude: -73 },
          { latitude: 40, longitude: Number.NaN },
          { latitude: 40, longitude: -73 },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new OpenMeteoGeocoder()
    expect(await g.geocode('hi')).toEqual([
      {
        label: 'hi',
        center: { lng: -73, lat: 40 },
      },
    ])
  })

  it('skips rows when latitude/longitude are not numbers', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { latitude: '40' as unknown as number, longitude: -73 },
          { latitude: 40, longitude: '-73' as unknown as number },
          { latitude: 40, longitude: -73 },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new OpenMeteoGeocoder()
    expect(await g.geocode('hi')).toEqual([
      {
        label: 'hi',
        center: { lng: -73, lat: 40 },
      },
    ])
  })

  it('treats missing results field as empty', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new OpenMeteoGeocoder()
    expect(await g.geocode('hi')).toEqual([])
  })
})

