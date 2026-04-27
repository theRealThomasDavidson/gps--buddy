import type { IGeocoder } from './IGeocoder'
import type { GeocodeResult } from './types'
import type { LngLat } from '../types'

type ChainedGeocoderOptions = {
  /** Dedupe results that are basically the same place. */
  dedupeMeters?: number
}

function haversineMeters(a: LngLat, b: LngLat) {
  const R = 6371008.8
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180

  const sinΔφ = Math.sin(Δφ / 2)
  const sinΔλ = Math.sin(Δλ / 2)

  const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export class ChainedGeocoder implements IGeocoder {
  readonly id: string

  constructor(
    private readonly providers: IGeocoder[],
    private readonly options: ChainedGeocoderOptions = {},
  ) {
    this.id = `chained(${providers.map((p) => p.id).join('→')})`
  }

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const dedupeMeters = this.options.dedupeMeters ?? 35

    const merged: GeocodeResult[] = []
    const keys = new Set<string>()

    for (const provider of this.providers) {
      let batch: GeocodeResult[] = []
      try {
        batch = await provider.geocode(query, signal)
      } catch {
        // Try the next provider; this is the whole point of chaining.
        continue
      }

      for (const r of batch) {
        const key = `${r.center.lat.toFixed(5)}:${r.center.lng.toFixed(5)}:${r.label}`
        if (keys.has(key)) continue

        const isNearDup = merged.some((m) => haversineMeters(m.center, r.center) <= dedupeMeters)
        if (isNearDup) continue

        keys.add(key)
        merged.push(r)
      }

      // If we already have a decent set, stop early.
      if (merged.length >= 8) break
    }

    return merged
  }
}
