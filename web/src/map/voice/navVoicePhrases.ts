import type { IDistanceFormatter } from '../units/IDistanceFormatter'

export function voicePromptForManeuver(args: {
  instruction: string
  distanceMeters: number | null
  formatter: IDistanceFormatter
}): string {
  const instruction = args.instruction.trim()
  if (!instruction) return ''
  if (args.distanceMeters === null) return instruction
  const dist = args.formatter.formatDistance(args.distanceMeters, 'voice')
  if (!dist) return instruction
  // Prefer “In <distance>, <instruction>” for navigation cadence.
  return `In ${dist}, ${instruction}`
}

export function voiceHalfMileReminder(args: { instruction: string }): string {
  const instruction = args.instruction.trim()
  if (!instruction) return ''
  return `In half a mile, ${instruction}`
}

