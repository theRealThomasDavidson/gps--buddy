/** Built-in named cap colors for thumbtack markers. Add keys here as you add palette entries. */
const DEFAULT_PALETTE = {
  yellow: '#FACC15',
} as const

export type ThumbtackPaletteColor = keyof typeof DEFAULT_PALETTE

/**
 * **Generates** the full thumbtack map marker: wrapper `div` plus inline SVG (spool cap
 * uses `currentColor` from the wrapper). Named palette entries resolve to CSS colors via
 * {@link accent}; arbitrary CSS is supported via {@link generate}.
 */
export class ThumbtackPinGenerator {
  private readonly palette: Readonly<Record<ThumbtackPaletteColor, string>>

  constructor(palette: Readonly<Record<ThumbtackPaletteColor, string>> = DEFAULT_PALETTE) {
    this.palette = palette
  }

  /** CSS color string for `MapPin.accentColor` or other styling. */
  accent(name: ThumbtackPaletteColor): string {
    return this.palette[name]
  }

  /**
   * Full marker element (spool cap + stem) for the given CSS accent color.
   * This is the single implementation of the thumbtack graphic.
   */
  generate(options: { accentColorCss: string; title: string }): HTMLDivElement {
    const { accentColorCss, title } = options
    const wrap = document.createElement('div')
    wrap.style.width = '40px'
    wrap.style.height = '40px'
    wrap.style.pointerEvents = 'none'
    wrap.style.color = accentColorCss
    wrap.style.filter = 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25))'
    wrap.setAttribute('role', 'img')
    wrap.setAttribute('aria-label', title)

    wrap.innerHTML = ThumbtackPinGenerator.thumbtackSvgMarkup()

    return wrap
  }

  /** Same as {@link generate} using a palette name (e.g. `"yellow"`). */
  element(name: ThumbtackPaletteColor, title: string): HTMLDivElement {
    return this.generate({ accentColorCss: this.accent(name), title })
  }

  /** Inline SVG for the thumbtack shape (cap uses `currentColor`). */
  private static thumbtackSvgMarkup(): string {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 54" width="40" height="40" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
  <ellipse cx="24" cy="52.2" rx="5.5" ry="1.5" fill="rgba(0,0,0,0.12)"/>
  <rect
    x="21.25"
    y="31.5"
    width="5.5"
    height="20.5"
    rx="1.35"
    fill="#9CA3AF"
    stroke="rgba(0,0,0,0.24)"
    stroke-width="0.65"
  />
  <rect x="22.1" y="32.5" width="1.15" height="17" rx="0.35" fill="rgba(255,255,255,0.35)"/>

  <path
    d="M24 3.2
       C31.2 3.2 38.2 6.2 38.8 11.2
       C39.3 14.2 35.2 16.8 30.5 17.8
       L30.5 18.6
       C34.2 19.8 36.8 22.6 36.8 25.8
       C36.8 29.6 31.5 31.8 24 31.8
       C16.5 31.8 11.2 29.6 11.2 25.8
       C11.2 22.6 13.8 19.8 17.5 18.6
       L17.5 17.8
       C12.8 16.8 8.7 14.2 9.2 11.2
       C9.8 6.2 16.8 3.2 24 3.2Z"
    fill="currentColor"
    stroke="rgba(0,0,0,0.34)"
    stroke-width="0.9"
    stroke-linejoin="round"
  />
  <path
    d="M15 10.5 Q24 6.5 33 10.5 Q24 13.5 15 10.5"
    fill="rgba(255,255,255,0.28)"
  />
  <ellipse cx="24" cy="30.8" rx="9" ry="1.8" fill="rgba(0,0,0,0.14)"/>
</svg>`.trim()
  }
}

/** Shared default generator; use `new ThumbtackPinGenerator(customPalette)` when needed. */
export const thumbtackPinGenerator = new ThumbtackPinGenerator()
