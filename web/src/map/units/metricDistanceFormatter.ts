import type { DistanceFormatStyle, IDistanceFormatter } from './IDistanceFormatter'
import { Units } from './Units'

function formatUi(meters: number): string {
  if (meters >= Units.distance.far.Metric.value) return `${(meters / Units.distance.far.Metric.value).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function formatVoice(meters: number): string {
  if (meters >= Units.distance.far.Metric.value) return `${(meters / Units.distance.far.Metric.value).toFixed(1)} ${Units.distance.far.Metric.name}`
  // For voice, avoid awkward “0 meters” if we're basically at the maneuver.
  if (meters < 5) return 'now'
  const rounded = Math.round(meters)
  const unit = rounded === 1 ? 'meter' : Units.distance.close.Metric.name
  return `${rounded} ${unit}`
}

export const metricDistanceFormatter: IDistanceFormatter = {
  system: 'metric',
  formatDistance(meters: number, style: DistanceFormatStyle): string {
    if (!Number.isFinite(meters)) return ''
    if (style === 'voice') return formatVoice(meters)
    return formatUi(meters)
  },
}

