import { describe, expect, it } from 'vitest'
import { decodePolyline6 } from './decodePolyline6'
import type { LngLat } from '../types'

/** Test-only encoder for polyline6 (inverse of {@link decodePolyline6}). */
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

describe('decodePolyline6', () => {
  it('returns empty array for empty input', () => {
    expect(decodePolyline6('')).toEqual([])
  })

  it('round-trips sample coordinates', () => {
    const original: LngLat[] = [
      { lng: -73.98, lat: 40.75 },
      { lng: -73.985, lat: 40.755 },
      { lng: -73.99, lat: 40.76 },
    ]
    expect(decodePolyline6(encodePolyline6(original))).toEqual(original)
  })
})
