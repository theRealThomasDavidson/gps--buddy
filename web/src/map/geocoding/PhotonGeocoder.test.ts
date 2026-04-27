import { describe, expect, it, vi } from 'vitest'
import { PhotonGeocoder } from './PhotonGeocoder'

describe('PhotonGeocoder', () => {
  it('returns [] for empty query', async () => {
    const g = new PhotonGeocoder()
    expect(await g.geocode('   ')).toEqual([])
  })

  it('parses features into results', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      void _input
      return {
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            properties: { name: 'A', city: 'B', country: 'C' },
            geometry: { type: 'Point', coordinates: [-73, 40] },
          },
        ],
      }),
      }
    })
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new PhotonGeocoder()
    const out = await g.geocode('hello')
    expect(out).toEqual([{ label: 'A, B, C', center: { lng: -73, lat: 40 } }])

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('photon.komoot.io')
    expect(url).toContain('q=hello')
  })

  it('throws on non-200', async () => {
    type FetchFn = typeof fetch
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)
    const g = new PhotonGeocoder()
    await expect(g.geocode('x')).rejects.toThrow(/failed \(500\)/i)
  })

  it('skips features without coordinates and falls back label to query', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        features: undefined,
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new PhotonGeocoder()
    expect(await g.geocode('fallback')).toEqual([])
  })

  it('skips too-short coordinate arrays but keeps valid points', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          { properties: {}, geometry: { coordinates: [-73] } },
          { properties: {}, geometry: { coordinates: [-73, 40] } },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new PhotonGeocoder()
    const out = await g.geocode('fallback')
    expect(out).toEqual([{ label: 'fallback', center: { lng: -73, lat: 40 } }])
  })

  it('falls back label to query when property fields are blank strings', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            properties: { name: '', street: '', city: '', state: '', postcode: '', country: '' },
            geometry: { coordinates: [-73, 40] },
          },
        ],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new PhotonGeocoder()
    const out = await g.geocode('fallback')
    expect(out).toEqual([{ label: 'fallback', center: { lng: -73, lat: 40 } }])
  })

  it('handles null properties objects from JSON', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        features: [{ properties: null as unknown as undefined, geometry: { coordinates: [-73, 40] } }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new PhotonGeocoder()
    const out = await g.geocode('fallback')
    expect(out).toEqual([{ label: 'fallback', center: { lng: -73, lat: 40 } }])
  })
})

