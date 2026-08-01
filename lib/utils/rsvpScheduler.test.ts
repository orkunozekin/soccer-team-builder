import { describe, expect, it, vi } from 'vitest'
import {
  getMatchStart,
  getNextRSVPCloseTime,
  getNextRSVPOpenTime,
  getRSVPSchedule,
  hasMatchStarted,
  isMatchPast,
  shouldRSVPBeOpen,
} from './rsvpScheduler'

describe('rsvpScheduler', () => {
  it('opens at 9am CT on match day and closes at start + 4h', () => {
    // 2024-03-01 is CST (UTC-6). Kickoff 19:00 CT → close 23:00 CT.
    const matchDate = new Date('2024-03-01T12:00:00Z')
    const { openAt, closeAt } = getRSVPSchedule(matchDate, '19:00')

    expect(openAt).not.toBeNull()
    expect(closeAt).not.toBeNull()
    expect(openAt!.toISOString()).toBe('2024-03-01T15:00:00.000Z')
    expect(closeAt!.toISOString()).toBe('2024-03-02T05:00:00.000Z')
  })

  it('getMatchStart combines CT calendar day with HH:mm', () => {
    const matchDate = new Date('2024-03-01T12:00:00Z')
    const start = getMatchStart(matchDate, '19:00')
    expect(start.toISOString()).toBe('2024-03-02T01:00:00.000Z')
  })

  it('getNextRSVPOpenTime/getNextRSVPCloseTime delegate to schedule', () => {
    const matchDate = new Date('2024-05-10T00:00:00Z')
    const time = '18:30'
    const schedule = getRSVPSchedule(matchDate, time)

    expect(getNextRSVPOpenTime(matchDate, time)).toEqual(schedule.openAt)
    expect(getNextRSVPCloseTime(matchDate, time)).toEqual(schedule.closeAt)
  })

  it('shouldRSVPBeOpen is true only between open and close times', () => {
    const matchDate = new Date('2024-06-01T00:00:00Z')
    const time = '19:00'
    const { openAt, closeAt } = getRSVPSchedule(matchDate, time)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date((openAt!.getTime() + closeAt!.getTime()) / 2))
      expect(shouldRSVPBeOpen(matchDate, time)).toBe(true)

      vi.setSystemTime(new Date(openAt!.getTime() - 1000))
      expect(shouldRSVPBeOpen(matchDate, time)).toBe(false)

      vi.setSystemTime(new Date(closeAt!.getTime() + 1000))
      expect(shouldRSVPBeOpen(matchDate, time)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('isMatchPast is true after start + 4h', () => {
    const matchDate = new Date('2024-03-01T12:00:00Z')
    const time = '19:00'
    const { closeAt } = getRSVPSchedule(matchDate, time)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(closeAt!.getTime() - 1000))
      expect(isMatchPast(matchDate, time)).toBe(false)

      vi.setSystemTime(new Date(closeAt!.getTime() + 1000))
      expect(isMatchPast(matchDate, time)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hasMatchStarted is true at and after kickoff', () => {
    const matchDate = new Date('2024-03-01T12:00:00Z')
    const time = '19:00'
    const start = getMatchStart(matchDate, time)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(start.getTime() - 1000))
      expect(hasMatchStarted(matchDate, time)).toBe(false)

      vi.setSystemTime(start)
      expect(hasMatchStarted(matchDate, time)).toBe(true)

      vi.setSystemTime(new Date(start.getTime() + 60_000))
      expect(hasMatchStarted(matchDate, time)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
