import { describe, expect, it, vi } from 'vitest'
import {
  getAttendanceLabel,
  getCheckInWindow,
  hasCheckInWindowStarted,
  isCheckInWindowEnded,
  isWithinCheckInWindow,
} from './checkIn'

describe('checkIn window', () => {
  // Kickoff 19:00 CT on 2024-03-01 → 01:00 UTC on Mar 2
  const matchDate = new Date('2024-03-01T12:00:00Z')
  const time = '19:00'

  it('opens 40m before kickoff and ends 2h after', () => {
    const { start, end } = getCheckInWindow(matchDate, time)
    // Kickoff 2024-03-02T01:00:00.000Z
    expect(start.toISOString()).toBe('2024-03-02T00:20:00.000Z')
    expect(end.toISOString()).toBe('2024-03-02T03:00:00.000Z')
  })

  it('isWithinCheckInWindow is true only inside the window', () => {
    const { start, end } = getCheckInWindow(matchDate, time)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(start.getTime() - 1000))
      expect(isWithinCheckInWindow(matchDate, time)).toBe(false)

      vi.setSystemTime(new Date((start.getTime() + end.getTime()) / 2))
      expect(isWithinCheckInWindow(matchDate, time)).toBe(true)

      vi.setSystemTime(new Date(end.getTime() + 1000))
      expect(isWithinCheckInWindow(matchDate, time)).toBe(false)
      expect(isCheckInWindowEnded(matchDate, time)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hasCheckInWindowStarted is true during and after the window', () => {
    const { start, end } = getCheckInWindow(matchDate, time)
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(start.getTime() - 1000))
      expect(hasCheckInWindowStarted(matchDate, time)).toBe(false)

      vi.setSystemTime(start)
      expect(hasCheckInWindowStarted(matchDate, time)).toBe(true)

      vi.setSystemTime(new Date(end.getTime() + 1000))
      expect(hasCheckInWindowStarted(matchDate, time)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('getAttendanceLabel', () => {
  it('returns Present when attended is true', () => {
    expect(
      getAttendanceLabel({ attended: true, status: 'confirmed' }, false)
    ).toBe('Present')
    expect(
      getAttendanceLabel({ attended: true, status: 'confirmed' }, true)
    ).toBe('Present')
  })

  it('returns No-show after the window when confirmed and not present', () => {
    expect(
      getAttendanceLabel({ attended: null, status: 'confirmed' }, true)
    ).toBe('No-show')
    expect(
      getAttendanceLabel({ attended: false, status: 'confirmed' }, true)
    ).toBe('No-show')
  })

  it('returns Pending before the window ends when not present', () => {
    expect(
      getAttendanceLabel({ attended: null, status: 'confirmed' }, false)
    ).toBe('Pending')
  })
})
