import type { GeocodeResult } from './types'

export interface IGeocoder {
  readonly id: string
  geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>
}
