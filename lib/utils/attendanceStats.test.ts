import { describe, expect, it, vi } from 'vitest'
import { computeAttendanceStats } from './attendanceStats'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

function makeRsvp(overrides: Partial<RSVP>): RSVP {
  return {
    id: 'r1',
    matchId: 'm1',
    userId: 'u1',
    status: 'confirmed',
    position: null,
    jerseyNumber: null,
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
    rsvpAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('computeAttendanceStats', () => {
  it('counts attended and no-shows after check-in window', () => {
    // Match kickoff far in the past so window has ended
    const pastMatch: Pick<Match, 'date' | 'time'> = {
      date: new Date('2020-01-01T12:00:00Z'),
      time: '19:00',
    }
    const matchesById = new Map([['m1', pastMatch]])

    const rsvps = [
      makeRsvp({ id: 'a', attended: true, checkInMethod: 'geo' }),
      makeRsvp({ id: 'b', attended: null }),
      makeRsvp({ id: 'c', status: 'cancelled' }),
    ]

    const stats = computeAttendanceStats(rsvps, matchesById)
    expect(stats.confirmedCount).toBe(2)
    expect(stats.attendedCount).toBe(1)
    expect(stats.noShowCount).toBe(1)
    expect(stats.showRate).toBe(50)
  })

  it('does not count pending RSVPs as no-shows before window ends', () => {
    vi.useFakeTimers()
    try {
      // Kickoff in the future
      vi.setSystemTime(new Date('2024-06-01T12:00:00Z'))
      const upcoming: Pick<Match, 'date' | 'time'> = {
        date: new Date('2024-06-01T12:00:00Z'),
        time: '19:00',
      }
      const matchesById = new Map([['m1', upcoming]])
      const rsvps = [makeRsvp({ attended: null })]

      const stats = computeAttendanceStats(rsvps, matchesById)
      expect(stats.confirmedCount).toBe(1)
      expect(stats.attendedCount).toBe(0)
      expect(stats.noShowCount).toBe(0)
      expect(stats.showRate).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
