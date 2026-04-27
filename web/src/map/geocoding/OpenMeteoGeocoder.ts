import type { IGeocoder } from './IGeocoder'
import type { GeocodeResult } from './types'

type OpenMeteoResponse = {
  results?: Array<{
    id?: number
    name?: string
    admin1?: string
    country?: string
    latitude?: number
    longitude?: number
  }>
}

export class OpenMeteoGeocoder implements IGeocoder {
  readonly id = 'open-meteo'

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', trimmed)
    url.searchParams.set('count', '10')
    url.searchParams.set('language', 'en')
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString(), { signal })
    if (!res.ok) {
      throw new Error(`open-meteo geocoder failed (${res.status})`)
    }

    const json = (await res.json()) as OpenMeteoResponse
    const results = json.results ?? []

    const out: GeocodeResult[] = []
    for (const r of results) {
      if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue
      const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ') || trimmed
      out.push({
        id: typeof r.id === 'number' ? String(r.id) : undefined,
        label,
        center: { lng: r.longitude, lat: r.latitude },
      })
    }

    return out
  }
}
