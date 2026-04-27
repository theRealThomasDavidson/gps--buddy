import { describe, expect, it, vi } from 'vitest'
import { OsrmRoutingService } from './OsrmRoutingService'

function makeCryptoMock(uuid: `${string}-${string}-${string}-${string}-${string}`): Crypto {
  return {
    randomUUID: () => uuid,
    getRandomValues: (arr) => arr,
    subtle: {} as SubtleCrypto,
  }
}

describe('OsrmRoutingService', () => {
  it('maps walk/bike profiles to OSRM paths', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input
      return {
      ok: true,
      status: 200,
      json: async () => ({
        routes: [{ geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] } }],
      }),
      }
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000001'))

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')

    await svc.route({
      profile: 'walk',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    await svc.route({
      profile: 'bike',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/walking/'))).toBe(true)
    expect(urls.some((u) => u.includes('/cycling/'))).toBe(true)
  })

  it('throws when fewer than two waypoints are provided', async () => {
    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    await expect(
      svc.route({
        profile: 'drive',
        waypoints: [{ lng: -73.0, lat: 40.0 }],
      }),
    ).rejects.toThrow(/at least two waypoints/i)
  })

  it('throws on non-OK HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    await expect(
      svc.route({
        profile: 'drive',
        waypoints: [
          { lng: -73.0, lat: 40.0 },
          { lng: -73.1, lat: 40.1 },
        ],
      }),
    ).rejects.toThrow(/Routing failed \(500\)/i)
  })

  it('throws when no routes are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ routes: [] }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    await expect(
      svc.route({
        profile: 'drive',
        waypoints: [
          { lng: -73.0, lat: 40.0 },
          { lng: -73.1, lat: 40.1 },
        ],
      }),
    ).rejects.toThrow(/No route returned/i)
  })

  it('throws on invalid route geometry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [{ geometry: { coordinates: [] } }],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    await expect(
      svc.route({
        profile: 'drive',
        waypoints: [
          { lng: -73.0, lat: 40.0 },
          { lng: -73.1, lat: 40.1 },
        ],
      }),
    ).rejects.toThrow(/Invalid route geometry/i)
  })

  it('throws when geometry parses to fewer than 2 points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          // Coordinates array has 2 entries, but only one is valid numeric lng/lat.
          routes: [{ geometry: { coordinates: [[-73.0, 40.0], ['x', 'y']] } }],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    await expect(
      svc.route({
        profile: 'drive',
        waypoints: [
          { lng: -73.0, lat: 40.0 },
          { lng: -73.1, lat: 40.1 },
        ],
      }),
    ).rejects.toThrow(/Route geometry too short/i)
  })

  it('skips invalid coordinate pairs and still returns a valid route', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000005'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: {
                coordinates: [
                  [-73.0, 40.0],
                  null,
                  [-73.05],
                  ['x', 'y'],
                  [-73.1, 40.1],
                ],
              },
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.geometry).toEqual([
      { lng: -73.0, lat: 40.0 },
      { lng: -73.1, lat: 40.1 },
    ])
  })

  it('drops steps when maneuver.type is missing/invalid', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000006'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] },
              legs: [
                {
                  steps: [
                    { maneuver: {}, name: 'Main St' },
                    { maneuver: { type: '' }, name: 'Broadway' },
                  ],
                },
              ],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.steps).toBeUndefined()
  })

  it('skips legs whose steps field is not an array', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000007'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] },
              legs: [{ steps: { not: 'an array' } }, { steps: [] }],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.steps).toBeUndefined()
  })

  it('drops steps when maneuver.type is not a string', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000008'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] },
              legs: [
                {
                  steps: [
                    {
                      distance: 1,
                      duration: 1,
                      name: 'X',
                      maneuver: { type: 123 as unknown as string },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.steps).toBeUndefined()
  })

  it('tolerates non-string step.name values from upstream JSON', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000009'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] },
              legs: [
                {
                  steps: [
                    {
                      distance: 10,
                      duration: 2,
                      name: 123 as unknown as string,
                      maneuver: { type: 'turn', modifier: 'right' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.steps?.map((s) => s.instruction)).toEqual(['Continue right'])
  })

  it('returns geometry and normalized step instructions', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000002'))

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input
      return {
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              distance: 1234,
              duration: 456,
              geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] },
              legs: [
                {
                  steps: [
                    {
                      distance: 10,
                      duration: 2,
                      name: 'Main St',
                      maneuver: { type: 'depart' },
                    },
                    {
                      distance: 100,
                      duration: 20,
                      name: 'Broadway',
                      maneuver: { type: 'turn', modifier: 'left' },
                    },
                    {
                      distance: 200,
                      duration: 30,
                      name: '',
                      maneuver: { type: 'arrive' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.id).toBe('00000000-0000-0000-0000-000000000002')
    expect(route.geometry).toEqual([
      { lng: -73.0, lat: 40.0 },
      { lng: -73.1, lat: 40.1 },
    ])

    expect(route.steps?.map((s) => s.instruction)).toEqual([
      'Depart onto Main St',
      'Continue left onto Broadway',
      'Arrive at destination',
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('steps=true')
    expect(url).toContain('geometries=geojson')
  })

  it('formats roundabout instructions with exit number', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000003'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: { coordinates: [[-86.1311113, 39.970001], [-86.1262457, 39.9662138]] },
              legs: [
                {
                  steps: [
                    {
                      distance: 25,
                      duration: 5,
                      name: '1st St SW',
                      maneuver: { type: 'roundabout', exit: 1, modifier: 'slight right' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -86.1311113, lat: 39.970001 },
        { lng: -86.1262457, lat: 39.9662138 },
      ],
    })

    expect(route.steps?.[0]?.instruction).toBe('At roundabout, take exit 1 onto 1st St SW')
  })

  it('formats common instruction variants (depart/continue/roundabout without exit)', async () => {
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-0000-0000-000000000004'))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              geometry: { coordinates: [[-73.0, 40.0], [-73.1, 40.1]] },
              legs: [
                {
                  steps: [
                    { maneuver: { type: 'depart' }, name: '' },
                    { maneuver: { type: 'turn' }, name: '' },
                    { maneuver: { type: 'turn', modifier: 'right' }, name: 'Elm St' },
                    { maneuver: { type: 'roundabout' }, name: '' },
                  ],
                },
              ],
            },
          ],
        }),
      })) as unknown as typeof fetch,
    )

    const svc = new OsrmRoutingService('https://example.invalid/route/v1')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [
        { lng: -73.0, lat: 40.0 },
        { lng: -73.1, lat: 40.1 },
      ],
    })

    expect(route.steps?.map((s) => s.instruction)).toEqual([
      'Depart',
      'Continue',
      'Continue right onto Elm St',
      'At roundabout, continue',
    ])
  })
})

