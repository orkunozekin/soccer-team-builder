import { describe, expect, it } from 'vitest'
import { collectMatchParticipantIds } from './matchParticipants'
import type { RSVP } from '@/types/rsvp'
import type { Team } from '@/types/team'

function makeTeam(playerIds: string[]): Team {
  return {
    id: 't1',
    matchId: 'match1',
    teamNumber: 1,
    name: 'Team 1',
    color: 'red',
    playerIds,
    maxSize: 11,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeRsvp(userId: string, status: RSVP['status'] = 'confirmed'): RSVP {
  const now = new Date()
  return {
    id: `rsvp_${userId}`,
    matchId: 'match1',
    userId,
    status,
    position: null,
    jerseyNumber: null,
    rsvpAt: now,
    updatedAt: now,
  }
}

describe('collectMatchParticipantIds', () => {
  it('includes team players and confirmed RSVPs', () => {
    const ids = collectMatchParticipantIds(
      [makeTeam(['a', 'b'])],
      [makeRsvp('b'), makeRsvp('c')]
    )
    expect(ids.sort()).toEqual(['a', 'b', 'c'])
  })

  it('ignores cancelled RSVPs', () => {
    const ids = collectMatchParticipantIds(
      [makeTeam(['a'])],
      [makeRsvp('b', 'cancelled')]
    )
    expect(ids).toEqual(['a'])
  })

  it('deduplicates ids', () => {
    const ids = collectMatchParticipantIds(
      [makeTeam(['a', 'a'])],
      [makeRsvp('a')]
    )
    expect(ids).toEqual(['a'])
  })
})
