import { describe, expect, it, vi } from 'vitest'
import {
  getNextRSVPCloseTime,
  getNextRSVPOpenTime,
  getRSVPSchedule,
  shouldRSVPBeOpen,
} from './rsvpScheduler'

describe('rsvpScheduler', () => {
  it('returns open and close times on the match day', () => {
    const matchDate = new Date('2024-03-01T12:00:00Z')
    const { openAt, closeAt } = getRSVPSchedule(matchDate)

    expect(openAt).not.toBeNull()
    expect(closeAt).not.toBeNull()

    const openIso = openAt!.toISOString()
    const closeIso = closeAt!.toISOString()

    expect(openIso.startsWith('2024-03-01T')).toBe(true)
    expect(
      closeIso.startsWith('2024-03-02T') || closeIso.startsWith('2024-03-01T')
    ).toBe(true)
  })

  it('getNextRSVPOpenTime/getNextRSVPCloseTime delegate to schedule', () => {
    const matchDate = new Date('2024-05-10T00:00:00Z')
    const schedule = getRSVPSchedule(matchDate)

    expect(getNextRSVPOpenTime(matchDate)).toEqual(schedule.openAt)
    expect(getNextRSVPCloseTime(matchDate)).toEqual(schedule.closeAt)
  })

  it('shouldRSVPBeOpen is true only between open and close times', () => {
    const matchDate = new Date('2024-06-01T00:00:00Z')
    const { openAt, closeAt } = getRSVPSchedule(matchDate)

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date((openAt!.getTime() + closeAt!.getTime()) / 2))
      expect(shouldRSVPBeOpen(matchDate)).toBe(true)

      vi.setSystemTime(new Date(openAt!.getTime() - 1000))
      expect(shouldRSVPBeOpen(matchDate)).toBe(false)

      vi.setSystemTime(new Date(closeAt!.getTime() + 1000))
      expect(shouldRSVPBeOpen(matchDate)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
