export type LngLat = {
  lng: number
  lat: number
}

export type BaseView = 'roads' | 'satellite' | 'terrain'

export type MapLayerState = {
  labels: boolean
  boundaries?: boolean
  bicycleEmphasis?: boolean
}

export type RouteProfile = 'drive' | 'walk' | 'bike'

export type RouteRequest = {
  profile: RouteProfile
  waypoints: LngLat[]
  avoid?: {
    highways?: boolean
    tolls?: boolean
    ferries?: boolean
  }
}

export type RouteDirectionStep = {
  instruction: string
  distanceMeters?: number
  durationSeconds?: number
}

/**
 * Normalized route shape used by the app, regardless of provider.
 * Geometry is stored as WGS84 lng/lat pairs.
 */
export type Route = {
  id: string
  provider: string
  profile: RouteProfile
  geometry: LngLat[]
  distanceMeters?: number
  durationSeconds?: number
  steps?: RouteDirectionStep[]
}

export type RouteEvaluation = {
  score?: number
  notes: string[]
  distanceMeters?: number
  durationSeconds?: number
}

