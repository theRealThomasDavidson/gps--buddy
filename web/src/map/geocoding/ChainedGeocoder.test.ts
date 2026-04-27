import { describe, expect, it } from 'vitest'
import { ChainedGeocoder } from './ChainedGeocoder'
import type { IGeocoder } from './IGeocoder'

function fakeProvider(id: string, results: { label: string; lat: number; lng: number }[]): IGeocoder {
  return {
    id,
    async geocode() {
      return results.map((r) => ({ label: r.label, center: { lat: r.lat, lng: r.lng } }))
    },
  }
}

describe('ChainedGeocoder', () => {
  it('merges providers and dedupes nearby hits', async () => {
    const a = fakeProvider('a', [{ label: 'X', lat: 40.0, lng: -73.0 }])
    // ~11m away in latitude; should dedupe with default 35m threshold.
    const b = fakeProvider('b', [{ label: 'Y', lat: 40.0001, lng: -73.0 }])
    const c = fakeProvider('c', [{ label: 'Z', lat: 40.01, lng: -73.0 }])

    const g = new ChainedGeocoder([a, b, c])
    const out = await g.geocode('test')

    expect(out.map((r) => r.label)).toEqual(['X', 'Z'])
  })

  it('dedupes exact key matches (same rounded center + same label)', async () => {
    const a = fakeProvider('a', [{ label: 'X', lat: 40.1234567, lng: -73.7654321 }])
    // Same toFixed(5) and same label => same key.
    const b = fakeProvider('b', [{ label: 'X', lat: 40.1234566, lng: -73.76543209 }])

    const g = new ChainedGeocoder([a, b])
    const out = await g.geocode('test')

    expect(out.map((r) => r.label)).toEqual(['X'])
  })

  it('skips failed providers and stops early once enough results are collected', async () => {
    const failing: IGeocoder = {
      id: 'fail',
      async geocode() {
        throw new Error('boom')
      },
    }

    const many = fakeProvider(
      'many',
      Array.from({ length: 9 }, (_, i) => ({
        label: `P${i + 1}`,
        lat: 40 + i * 0.01,
        lng: -73,
      })),
    )

    const neverCalled: IGeocoder = {
      id: 'never',
      async geocode() {
        throw new Error('should not be called')
      },
    }

    const g = new ChainedGeocoder([failing, many, neverCalled])
    const out = await g.geocode('test')

    // default stop condition: stop calling later providers once merged.length >= 8
    expect(out.length).toBeGreaterThanOrEqual(8)
    expect(out[0]?.label).toBe('P1')
    expect(out[7]?.label).toBe('P8')
  })
})

