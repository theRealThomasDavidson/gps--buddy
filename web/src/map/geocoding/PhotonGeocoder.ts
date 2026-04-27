import type { IGeocoder } from './IGeocoder'
import type { GeocodeResult } from './types'

type PhotonResponse = {
  features?: Array<{
    properties?: {
      name?: string
      street?: string
      city?: string
      state?: string
      country?: string
      postcode?: string
    }
    geometry?: {
      type?: string
      coordinates?: [number, number]
    }
  }>
}

export class PhotonGeocoder implements IGeocoder {
  readonly id = 'photon'

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', trimmed)
    url.searchParams.set('limit', '8')

    const res = await fetch(url.toString(), { signal })
    if (!res.ok) {
      throw new Error(`photon geocoder failed (${res.status})`)
    }

    const json = (await res.json()) as PhotonResponse
    const features = json.features ?? []

    const out: GeocodeResult[] = []
    for (const f of features) {
      const coords = f.geometry?.coordinates
      if (!coords || coords.length < 2) continue

      const [lng, lat] = coords
      const p = f.properties ?? {}
      const label =
        [p.name, p.street, p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ') ||
        trimmed

      out.push({ label, center: { lng, lat } })
    }

    return out
  }
}
