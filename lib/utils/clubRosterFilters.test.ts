import { describe, expect, it } from 'vitest'
import {
  CLUB_ROSTER_ROLE_FILTERS,
  filterClubRosterMembers,
} from './clubRosterFilters'
import type { ClubMembershipWithUser } from '@/types/club'

function member(
  partial: Partial<ClubMembershipWithUser> &
    Pick<ClubMembershipWithUser, 'userId' | 'role' | 'displayName'>
): ClubMembershipWithUser {
  return {
    id: partial.id ?? `m-${partial.userId}`,
    clubId: 'c1',
    status: 'active',
    joinedAt: new Date(),
    updatedAt: new Date(),
    email: partial.email,
    ...partial,
  }
}

describe('filterClubRosterMembers', () => {
  const members = [
    member({
      userId: 'a1',
      role: 'club_admin',
      displayName: 'Ada Admin',
      email: 'ada@example.com',
    }),
    member({
      userId: 'p1',
      role: 'player',
      displayName: 'Pat Player',
      email: 'pat@club.test',
    }),
    member({
      userId: 'p2',
      role: 'player',
      displayName: 'Sam Smith',
      email: undefined,
    }),
  ]

  it('exposes All, Club admins, and Players tabs', () => {
    expect(CLUB_ROSTER_ROLE_FILTERS.map(f => f.label)).toEqual([
      'All',
      'Club admins',
      'Players',
    ])
  })

  it('filters by club membership role', () => {
    expect(
      filterClubRosterMembers(members, 'club_admins', '').map(m => m.userId)
    ).toEqual(['a1'])
    expect(
      filterClubRosterMembers(members, 'players', '').map(m => m.userId)
    ).toEqual(['p1', 'p2'])
    expect(
      filterClubRosterMembers(members, 'all', '').map(m => m.userId)
    ).toEqual(['a1', 'p1', 'p2'])
  })

  it('searches display name and email case-insensitively', () => {
    expect(
      filterClubRosterMembers(members, 'all', 'ADA').map(m => m.userId)
    ).toEqual(['a1'])
    expect(
      filterClubRosterMembers(members, 'all', 'club.test').map(m => m.userId)
    ).toEqual(['p1'])
    expect(
      filterClubRosterMembers(members, 'all', 'sam').map(m => m.userId)
    ).toEqual(['p2'])
  })

  it('combines role filter with search', () => {
    expect(
      filterClubRosterMembers(members, 'players', 'ada').map(m => m.userId)
    ).toEqual([])
    expect(
      filterClubRosterMembers(members, 'club_admins', 'ada').map(m => m.userId)
    ).toEqual(['a1'])
  })
})
