import { describe, expect, it } from 'vitest'
import { formatJerseyDisplay, normalizeJerseyNumber } from './jerseyNumber'

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
    expect(formatJerseyDisplay(10)).toBe('10')
    expect(formatJerseyDisplay(0)).toBe('0')
    expect(formatJerseyDisplay(null)).toBe('')
  })
})
