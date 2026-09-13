import { describe, expect, it } from 'vitest'
import {
  breakAddressAutolink,
  formatJerseyDisplay,
  formatPositionDisplay,
  normalizeJerseyNumber,
} from './jerseyNumber'

describe('jerseyNumber utils', () => {
  it('normalizes valid numbers and strings', () => {
    expect(normalizeJerseyNumber(10)).toBe(10)
    expect(normalizeJerseyNumber('7')).toBe(7)
    expect(normalizeJerseyNumber('  9  ')).toBe(9)
  })

  it('returns null for empty or invalid values', () => {
    expect(normalizeJerseyNumber(null)).toBeNull()
    expect(normalizeJerseyNumber('')).toBeNull()
    expect(normalizeJerseyNumber(100)).toBeNull()
    expect(normalizeJerseyNumber('abc')).toBeNull()
  })

  it('formats jersey for display without hiding duplicates', () => {
    expect(formatJerseyDisplay(10)).toBe('1\u200B0')
    expect(formatJerseyDisplay(0)).toBe('0')
    expect(formatJerseyDisplay(null)).toBe('')
  })

  it('breaks address-like autolink patterns in jersey and position text', () => {
    expect(breakAddressAutolink('10')).toBe('1\u200B0')
    expect(breakAddressAutolink('ST')).toBe('S\u200BT')
    expect(formatPositionDisplay('ST')).toBe('S\u200BT')
    expect(formatPositionDisplay(null)).toBe('')
    // Browsers concatenate "10 Joel Hawbaker ST" into a fake street address;
    // ZWSPs prevent that while leaving the visible glyphs unchanged.
    expect(
      `${formatJerseyDisplay(10)} Joel Hawbaker ${formatPositionDisplay('ST')}`
    ).not.toContain('10 Joel Hawbaker ST')
  })
})
