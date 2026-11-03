import { describe, expect, it } from 'vitest'
import { normalizeThemePreference } from './user'

describe('normalizeThemePreference', () => {
  it('keeps light', () => {
    expect(normalizeThemePreference('light')).toBe('light')
  })

  it.each([
    ['dark', 'dark'],
    ['missing', undefined],
    ['null', null],
    ['an unknown string', 'system'],
    ['different casing', 'Light'],
    ['a number', 1],
    ['an object', { theme: 'light' }],
  ])('resolves %s to dark', (_label, value) => {
    expect(normalizeThemePreference(value)).toBe('dark')
  })
})
