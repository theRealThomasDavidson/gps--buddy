import type { LocationFix } from './ILocationOnce'

export type LocationWatchStop = () => void

export interface ILocationWatch {
  watch(onFix: (fix: LocationFix) => void): LocationWatchStop
}
