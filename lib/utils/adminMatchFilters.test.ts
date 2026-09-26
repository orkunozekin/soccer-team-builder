import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterMatches } from './adminMatchFilters'
import type { Match } from '@/types/match'

vi.mock('@/lib/utils/rsvpScheduler', () => ({
  isMatchPast: (date: Date) => date.getTime() < Date.UTC(2026, 5, 15),
}))

function match(
  partial: Partial<Match> & Pick<Match, 'id' | 'date' | 'time'>
): Match {
  return {
    location: null,
    clubId: null,
    rsvpOpen: false,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    deletedAt: null,
    scheduleId: null,
    scheduleSlotId: null,
    scheduleOccurrenceKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

describe('filterMatches', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sorts past matches by date descending (newest first)', () => {
    const matches = [
      match({
        id: 'old',
        date: new Date('2026-01-01T12:00:00Z'),
        time: '09:00',
      }),
      match({
        id: 'newer',
        date: new Date('2026-06-01T12:00:00Z'),
        time: '09:00',
      }),
      match({
        id: 'mid',
        date: new Date('2026-03-01T12:00:00Z'),
        time: '11:00',
      }),
      match({
        id: 'future',
        date: new Date('2026-07-01T12:00:00Z'),
        time: '09:00',
      }),
    ]

    const past = filterMatches(matches, 'past')
    expect(past.map(m => m.id)).toEqual(['newer', 'mid', 'old'])
  })

  it('sorts upcoming matches by date ascending', () => {
    const matches = [
      match({
        id: 'later',
        date: new Date('2026-08-01T12:00:00Z'),
        time: '09:00',
      }),
      match({
        id: 'soon',
        date: new Date('2026-07-01T12:00:00Z'),
        time: '09:00',
      }),
      match({
        id: 'past',
        date: new Date('2026-01-01T12:00:00Z'),
        time: '09:00',
      }),
    ]

    const upcoming = filterMatches(matches, 'upcoming')
    expect(upcoming.map(m => m.id)).toEqual(['soon', 'later'])
  })
})
