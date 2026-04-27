import type { IGeocoder } from './IGeocoder'
import type { GeocodeResult } from './types'

type NominatimItem = {
  place_id?: number
  lat?: string
  lon?: string
  display_name?: string
}

export class NominatimGeocoder implements IGeocoder {
  readonly id = 'nominatim'

  constructor(private readonly options: { contactEmail?: string } = {}) {}

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    // Nominatim usage policy expects identifiable traffic; in browsers you can't reliably set UA.
    // If you want Nominatim in production, prefer self-hosted Nominatim or a paid geocoder.
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', trimmed)
    url.searchParams.set('limit', '8')
    if (this.options.contactEmail) {
      url.searchParams.set('email', this.options.contactEmail)
    }

    const res = await fetch(url.toString(), {
      signal,
      headers: {
        // Some deployments honor this; harmless if ignored.
        'Accept-Language': 'en',
      },
    })

    if (!res.ok) {
      throw new Error(`nominatim geocoder failed (${res.status})`)
    }

    const json = (await res.json()) as NominatimItem[]
    const items = Array.isArray(json) ? json : []

    const out: GeocodeResult[] = []
    for (const item of items) {
      if (!item.lat || !item.lon) continue
      const lat = Number(item.lat)
      const lng = Number(item.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

      out.push({
        id: typeof item.place_id === 'number' ? String(item.place_id) : undefined,
        label: item.display_name ?? trimmed,
        center: { lng, lat },
      })
    }

    return out
  }
}
