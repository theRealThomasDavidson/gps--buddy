import { describe, expect, it } from 'vitest'
import { ThumbtackPinGenerator } from './ThumbtackPinGenerator'

describe('ThumbtackPinGenerator', () => {
  it('generates a marker element with correct color and aria label', () => {
    const gen = new ThumbtackPinGenerator({ yellow: '#FACC15' })
    const el = gen.generate({ accentColorCss: '#123456', title: 'Test pin' })

    expect(el.getAttribute('aria-label')).toBe('Test pin')
    // jsdom normalizes hex colors to rgb()
    expect(el.style.color).toBe('rgb(18, 52, 86)')
    expect(el.innerHTML).toContain('<svg')
  })

  it('supports palette-based element creation', () => {
    const gen = new ThumbtackPinGenerator({ yellow: '#FACC15' })
    expect(gen.accent('yellow')).toBe('#FACC15')

    const el = gen.element('yellow', 'Yellow pin')
    expect(el.getAttribute('aria-label')).toBe('Yellow pin')
    expect(el.style.color).toBe('rgb(250, 204, 21)')
  })
})

