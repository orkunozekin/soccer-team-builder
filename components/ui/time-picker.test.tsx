import { describe, expect, it } from 'vitest'
import { buildTimeOptions, normalizeTimeValue } from './time-picker'

describe('normalizeTimeValue', () => {
  it('pads hours and minutes', () => {
    expect(normalizeTimeValue('9:00')).toBe('09:00')
    expect(normalizeTimeValue('09:05:00')).toBe('09:05')
  })

  it('returns empty for empty input', () => {
    expect(normalizeTimeValue('')).toBe('')
  })
})

describe('buildTimeOptions', () => {
  it('builds 5-minute options for a full day', () => {
    const options = buildTimeOptions(300)
    expect(options).toHaveLength(288)
    expect(options[0]).toEqual({ value: '00:00', label: '12:00 AM' })
    expect(options[1]).toEqual({ value: '00:05', label: '12:05 AM' })
    expect(options[108]).toEqual({ value: '09:00', label: '9:00 AM' })
    expect(options.at(-1)).toEqual({ value: '23:55', label: '11:55 PM' })
  })

  it('supports hourly steps', () => {
    const options = buildTimeOptions(3600)
    expect(options).toHaveLength(24)
    expect(options[9]).toEqual({ value: '09:00', label: '9:00 AM' })
  })
})
