import { describe, expect, it } from 'vitest'
import { ACCENT_PRESETS, contrastText } from './theme'

describe('theme contrast', () => {
  it('uses white text on the terracotta accent', () => {
    expect(contrastText('#D97757')).toBe('#ffffff')
  })

  it('uses ink text on the cream canvas', () => {
    expect(contrastText('#FAF9F5')).toBe('#141413')
  })

  it('keeps accent presets well formed', () => {
    expect(ACCENT_PRESETS).toHaveLength(6)
    for (const preset of ACCENT_PRESETS) {
      expect(preset.value).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
