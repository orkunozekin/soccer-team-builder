import { describe, expect, it } from 'vitest'
import {
  buildRosterPlaceholders,
  collectMatchParticipantIds,
  mergeRosterProfiles,
} from './matchParticipants'
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
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
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

describe('buildRosterPlaceholders / mergeRosterProfiles', () => {
  it('builds placeholders from RSVP position and jersey', () => {
    const rsvp = { ...makeRsvp('a'), position: 'ST', jerseyNumber: 9 }
    const placeholders = buildRosterPlaceholders(['a', 'b'], [rsvp])
    expect(placeholders).toHaveLength(2)
    expect(placeholders[0]).toMatchObject({
      uid: 'a',
      displayName: 'Player',
      position: 'ST',
      jerseyNumber: 9,
    })
    expect(placeholders[1]).toMatchObject({
      uid: 'b',
      position: null,
      jerseyNumber: null,
    })
  })

  it('merges profiles over placeholders without dropping missing profiles', () => {
    const placeholders = buildRosterPlaceholders(
      ['a', 'b'],
      [makeRsvp('a'), makeRsvp('b')]
    )
    const profiles = [
      {
        ...placeholders[0],
        displayName: 'Alex',
        email: 'a@example.com',
      },
    ]
    const merged = mergeRosterProfiles(placeholders, profiles)
    expect(merged.map(u => u.uid)).toEqual(['a', 'b'])
    expect(merged[0].displayName).toBe('Alex')
    expect(merged[1].displayName).toBe('Player')
  })
})
