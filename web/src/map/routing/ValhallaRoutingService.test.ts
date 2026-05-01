import { describe, expect, it, vi } from 'vitest'
import type { LngLat } from '../types'
import { decodePolyline6 } from './decodePolyline6'
import { ValhallaRoutingService } from './ValhallaRoutingService'

function makeCryptoMock(uuid: `${string}-${string}-${string}-${string}-${string}`): Crypto {
  return {
    randomUUID: () => uuid,
    getRandomValues: (arr) => arr,
    subtle: {} as SubtleCrypto,
  }
}

function encodeSigned(n: number): string {
  const v = n < 0 ? ~(n << 1) : n << 1
  let rem = v
  let chunk = ''
  while (rem >= 0x20) {
    chunk += String.fromCharCode((0x20 | (rem & 0x1f)) + 63)
    rem >>= 5
  }
  chunk += String.fromCharCode(rem + 63)
  return chunk
}

function encodePolyline6(points: LngLat[]): string {
  let prevLatE6 = 0
  let prevLngE6 = 0
  let out = ''
  for (const p of points) {
    const latE6 = Math.round(p.lat * 1e6)
    const lngE6 = Math.round(p.lng * 1e6)
    out += encodeSigned(latE6 - prevLatE6)
    out += encodeSigned(lngE6 - prevLngE6)
    prevLatE6 = latE6
    prevLngE6 = lngE6
  }
  return out
}

const W1: LngLat = { lng: -73.98, lat: 40.75 }
const W2: LngLat = { lng: -73.99, lat: 40.76 }
const W3: LngLat = { lng: -74.0, lat: 40.77 }
const SHAPE_W1_W2 = encodePolyline6([W1, W2])
const SHAPE_W2_W3 = encodePolyline6([W2, W3])

describe('ValhallaRoutingService', () => {
  it('POSTs costing from profile (auto / pedestrian / bicycle)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        trip: {
          legs: [{ shape: SHAPE_W1_W2, maneuvers: [] }],
          summary: { time: 1, length: 0.001 },
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-4000-8000-000000000001'))

    const svc = new ValhallaRoutingService('https://example.invalid/route')
    const wps = [W1, W2]

    await svc.route({ profile: 'drive', waypoints: wps })
    await svc.route({ profile: 'walk', waypoints: wps })
    await svc.route({ profile: 'bike', waypoints: wps })

    const bodies = fetchMock.mock.calls.map((c) => {
      const init = c[1] as RequestInit
      return JSON.parse(String(init.body))
    })
    expect(bodies[0].costing).toBe('auto')
    expect(bodies[1].costing).toBe('pedestrian')
    expect(bodies[2].costing).toBe('bicycle')
    expect(bodies[0].locations).toEqual([
      { lat: 40.75, lon: -73.98 },
      { lat: 40.76, lon: -73.99 },
    ])
  })

  it('throws when fewer than two waypoints are provided', async () => {
    const svc = new ValhallaRoutingService('https://example.invalid/route')
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
      vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch,
    )
    const svc = new ValhallaRoutingService('https://example.invalid/route')
    await expect(
      svc.route({
        profile: 'drive',
        waypoints: [
          { lng: -73.0, lat: 40.0 },
          { lng: -73.1, lat: 40.1 },
        ],
      }),
    ).rejects.toThrow(/Routing failed \(503\)/i)
  })

  it('throws when no legs are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ trip: { legs: [] } }),
      })) as unknown as typeof fetch,
    )
    const svc = new ValhallaRoutingService('https://example.invalid/route')
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

  it('maps trip summary and maneuvers to Route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          trip: {
            legs: [
              {
                shape: SHAPE_W1_W2,
                maneuvers: [
                  { instruction: 'Head east.', length: 0.1, time: 30 },
                  { instruction: 'Arrive at destination.', length: 0, time: 0 },
                ],
              },
            ],
            summary: { time: 120.5, length: 2.5 },
          },
        }),
      })) as unknown as typeof fetch,
    )
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-4000-8000-000000000002'))

    const svc = new ValhallaRoutingService('https://example.invalid/route')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [W1, W2],
    })

    expect(route.provider).toBe('valhalla-fossgis')
    expect(route.distanceMeters).toBeCloseTo(2500, 5)
    expect(route.durationSeconds).toBe(120.5)
    expect(route.steps?.length).toBe(2)
    expect(route.steps?.[0].instruction).toBe('Head east.')
    expect(route.steps?.[0].distanceMeters).toBeCloseTo(100, 5)
    expect(route.steps?.[0].durationSeconds).toBe(30)
    expect(route.geometry.length).toBeGreaterThanOrEqual(2)
  })

  it('concatenates shapes across legs without duplicating the join point', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          trip: {
            legs: [
              {
                shape: SHAPE_W1_W2,
                maneuvers: [],
              },
              {
                shape: SHAPE_W2_W3,
                maneuvers: [],
              },
            ],
            summary: { time: 1, length: 0.002 },
          },
        }),
      })) as unknown as typeof fetch,
    )
    vi.stubGlobal('crypto', makeCryptoMock('00000000-0000-4000-8000-000000000003'))

    const svc = new ValhallaRoutingService('https://example.invalid/route')
    const route = await svc.route({
      profile: 'drive',
      waypoints: [W1, W2, W3],
    })
    const n1 = decodePolyline6(SHAPE_W1_W2).length
    const n2 = decodePolyline6(SHAPE_W2_W3).length
    expect(route.geometry.length).toBe(n1 + n2 - 1)
  })
})
