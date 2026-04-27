import type { LngLat } from '../types'

export type GeocodeResult = {
  label: string
  center: LngLat
  /** Optional stable-ish id from upstream (when available). */
  id?: string
}
