import { describe, expect, it, vi } from 'vitest'
import { NominatimGeocoder } from './NominatimGeocoder'

describe('NominatimGeocoder', () => {
  it('returns [] for empty query', async () => {
    const g = new NominatimGeocoder()
    expect(await g.geocode('   ')).toEqual([])
  })

  it('includes email param when configured and parses items', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input
      return {
      ok: true,
      status: 200,
      json: async () => [
        { place_id: 7, lat: '40', lon: '-73', display_name: 'Place' },
      ],
      }
    })
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new NominatimGeocoder({ contactEmail: 'me@example.com' })
    const out = await g.geocode('hello')
    expect(out).toEqual([{ id: '7', label: 'Place', center: { lng: -73, lat: 40 } }])

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('email=me%40example.com')
  })

  it('throws on non-200', async () => {
    type FetchFn = typeof fetch
    const fetchMock = vi.fn(async () => ({ ok: false, status: 418 }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)
    const g = new NominatimGeocoder()
    await expect(g.geocode('x')).rejects.toThrow(/failed \(418\)/i)
  })

  it('skips invalid items and omits id when place_id is missing', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { lat: '', lon: '-73', display_name: 'Skip A' },
        { lat: '40', lon: 'x', display_name: 'Skip B' },
        { lat: '40', lon: '-73', display_name: 'Keep' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new NominatimGeocoder()
    const out = await g.geocode('q')
    expect(out).toEqual([{ label: 'Keep', center: { lng: -73, lat: 40 } }])
  })

  it('uses display_name fallback when missing (label defaults to trimmed query)', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ place_id: 99, lat: '40', lon: '-73', display_name: undefined }],
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new NominatimGeocoder()
    const out = await g.geocode('hello')
    expect(out).toEqual([{ id: '99', label: 'hello', center: { lng: -73, lat: 40 } }])
  })

  it('treats non-array JSON payloads as empty', async () => {
    type FetchFn = typeof fetch

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ not: 'an array' }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as FetchFn)

    const g = new NominatimGeocoder()
    expect(await g.geocode('hello')).toEqual([])
  })
})

