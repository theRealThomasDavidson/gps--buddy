export type DistanceSystem = 'metric' | 'imperial'

export type DistanceFormatStyle = 'ui' | 'voice'

export interface IDistanceFormatter {
  readonly system: DistanceSystem
  formatDistance(meters: number, style: DistanceFormatStyle): string
}

