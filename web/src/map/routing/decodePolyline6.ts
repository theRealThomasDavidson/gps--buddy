import type { LngLat } from '../types'

/** Decodes a Valhalla / Mapbox **polyline6** string to WGS84 points (lat, lng order in encoding). */
export function decodePolyline6(encoded: string): LngLat[] {
  if (!encoded) return []

  let index = 0
  let latE6 = 0
  let lngE6 = 0
  const out: LngLat[] = []

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b: number
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    latE6 += dlat

    result = 0
    shift = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lngE6 += dlng

    out.push({ lng: lngE6 / 1e6, lat: latE6 / 1e6 })
  }

  return out
}
