import { describe, expect, it } from 'vitest'
import {
  filterPlayerMatches,
  getPlayerMatchStatus,
  indexConfirmedRsvps,
  splitNextMatch,
} from './playerMatchList'
import type { RSVP } from '@/types/rsvp'

const match = (id: string, isoDay: string, time = '19:30') => ({
  id,
  date: new Date(`${isoDay}T18:00:00Z`),
  time,
  rsvpOpen: false,
})

const rsvp = (matchId: string, status: RSVP['status'] = 'confirmed'): RSVP => ({
  id: `r_${matchId}`,
  matchId,
  userId: 'u1',
  status,
  position: 'ST',
  jerseyNumber: 10,
  attended: null,
  checkedInAt: null,
  checkInMethod: null,
  rsvpAt: new Date(),
  updatedAt: new Date(),
})

describe('splitNextMatch', () => {
  it('puts the soonest kickoff in the hero regardless of input order', () => {
    const later = match('later', '2030-01-12')
    const sameDayEarly = match('early', '2030-01-10', '09:00')
    const sameDayLate = match('late', '2030-01-10', '19:30')
    const { next, rest } = splitNextMatch([later, sameDayLate, sameDayEarly])
    expect(next?.id).toBe('early')
    expect(rest.map(m => m.id)).toEqual(['late', 'later'])
  })

  it('returns no hero for an empty list', () => {
    expect(splitNextMatch([])).toEqual({ next: null, rest: [] })
  })
})

describe('indexConfirmedRsvps / filterPlayerMatches', () => {
  it('keeps only matches the player is confirmed for', () => {
    const mine = indexConfirmedRsvps([rsvp('a'), rsvp('b', 'cancelled')])
    const all = [match('a', '2030-01-10'), match('b', '2030-01-11')]
    expect(filterPlayerMatches(all, 'mine', mine).map(m => m.id)).toEqual(['a'])
    expect(filterPlayerMatches(all, 'upcoming', mine)).toHaveLength(2)
  })
})

describe('getPlayerMatchStatus', () => {
  it("shows the player's spot when they are in", () => {
    expect(
      getPlayerMatchStatus({
        match: match('a', '2030-01-10'),
        myRsvp: { position: 'ST' },
        rsvpCount: 12,
      })
    ).toEqual({ tone: 'success', label: "You're in · ST · 12/22" })
  })

  it('omits unknown position and count', () => {
    expect(
      getPlayerMatchStatus({
        match: match('a', '2030-01-10'),
        myRsvp: { position: null },
      }).label
    ).toBe("You're in")
  })

  it('falls back to the RSVP window when not in', () => {
    const status = getPlayerMatchStatus({
      match: { ...match('a', '2030-01-10'), rsvpOpen: true },
      now: new Date('2030-01-10T15:00:00Z'),
    })
    expect(status.tone).toBe('live')
    expect(status.label).toMatch(/^RSVP open/)
  })
})
