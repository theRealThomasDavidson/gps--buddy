import type { DistanceFormatStyle, IDistanceFormatter } from './IDistanceFormatter'
import { Units } from './Units'

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

function milesFromMeters(meters: number): number {
  return meters / Units.distance.far.Imperial.value
}

function yardsFromMeters(meters: number): number {
  return meters * Units.distance.close.Imperial.value
}

function formatUi(meters: number): string {
  const miles = milesFromMeters(meters)
  if (miles >= 0.2) return `${miles.toFixed(1)} mi`
  const yards = yardsFromMeters(meters)
  const rounded = Math.max(0, roundTo(yards, 10))
  return `${rounded} yd`
}

function formatVoice(meters: number): string {
  const miles = milesFromMeters(meters)
  if (Math.abs(miles - 0.5) < 0.05) return 'half a mile'
  if (miles >= 1) return `${miles.toFixed(1)} ${Units.distance.far.Imperial.name}`
  if (miles >= 0.2) return `${miles.toFixed(1)} ${Units.distance.far.Imperial.name}`
  const yards = yardsFromMeters(meters)
  const rounded = Math.max(0, roundTo(yards, 10))
  const unit = rounded === 1 ? 'yard' : Units.distance.close.Imperial.name
  return `${rounded} ${unit}`
}

export const imperialDistanceFormatter: IDistanceFormatter = {
  system: 'imperial',
  formatDistance(meters: number, style: DistanceFormatStyle): string {
    if (!Number.isFinite(meters)) return ''
    if (style === 'voice') return formatVoice(meters)
    return formatUi(meters)
  },
}

