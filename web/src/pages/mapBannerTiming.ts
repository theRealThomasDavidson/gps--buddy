/** Do not show success/info banners (or loading had no time to matter) for ops shorter than this. */
export const MAP_BANNER_MIN_VISIBLE_MS = 1000

/** Delay before showing a “working…” banner so sub-second ops never flash. */
export const MAP_BANNER_LOADING_DELAY_MS = 1000

export type MapBannerTone = 'loading' | 'success' | 'info' | 'error'

export type MapBanner = {
  tone: MapBannerTone
  message: string
}

export type MapBannerResolveOutcome =
  | { kind: 'hide' }
  | { kind: 'info'; message: string }
  | { kind: 'success'; message: string }
