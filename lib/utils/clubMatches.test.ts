import { describe, expect, it } from 'vitest'
import {
  canCreateClubMatches,
  canManageMatchClub,
  filterMatchesForClubScope,
  resolveVisibleClubIds,
} from './clubMatches'
import type { Match } from '@/types/match'

function match(id: string, clubId: string | null): Match {
  return {
    id,
    date: new Date(),
    time: '19:00',
    location: null,
    clubId,
    rsvpOpen: true,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('resolveVisibleClubIds', () => {
  it('prefers activeClubId when the user is a member', () => {
    expect(
      resolveVisibleClubIds({
        memberships: [
          { clubId: 'a', status: 'active' },
          { clubId: 'b', status: 'active' },
        ],
        activeClubId: 'b',
      })
    ).toEqual(['b'])
  })

  it('falls back to all active memberships when activeClubId is missing', () => {
    expect(
      resolveVisibleClubIds({
        memberships: [
          { clubId: 'a', status: 'active' },
          { clubId: 'b', status: 'active' },
          { clubId: 'c', status: 'active' },
        ],
        activeClubId: null,
      })
    ).toEqual(['a', 'b', 'c'])
  })

  it('ignores activeClubId when not a membership', () => {
    expect(
      resolveVisibleClubIds({
        memberships: [{ clubId: 'a', status: 'active' }],
        activeClubId: 'other',
      })
    ).toEqual(['a'])
  })
})

describe('filterMatchesForClubScope', () => {
  const matches = [
    match('m1', 'club-a'),
    match('m2', 'club-b'),
    match('m3', null),
  ]

  it('shows all matches for super user without activeClubId', () => {
    expect(
      filterMatchesForClubScope({
        matches,
        memberships: [],
        isSuperUser: true,
      }).map(m => m.id)
    ).toEqual(['m1', 'm2', 'm3'])
  })

  it('scopes super user to activeClubId plus unscoped docs', () => {
    expect(
      filterMatchesForClubScope({
        matches,
        memberships: [],
        activeClubId: 'club-a',
        isSuperUser: true,
      }).map(m => m.id)
    ).toEqual(['m1', 'm3'])
  })

  it('filters members to their clubs and unscoped docs', () => {
    expect(
      filterMatchesForClubScope({
        matches,
        memberships: [{ clubId: 'club-a', status: 'active' }],
      }).map(m => m.id)
    ).toEqual(['m1', 'm3'])
  })

  it('respects activeClubId for members', () => {
    expect(
      filterMatchesForClubScope({
        matches,
        memberships: [
          { clubId: 'club-a', status: 'active' },
          { clubId: 'club-b', status: 'active' },
        ],
        activeClubId: 'club-b',
      }).map(m => m.id)
    ).toEqual(['m2', 'm3'])
  })

  it('shows only unscoped matches when user has no memberships', () => {
    expect(
      filterMatchesForClubScope({
        matches,
        memberships: [],
      }).map(m => m.id)
    ).toEqual(['m3'])
  })
})

describe('canManageMatchClub / canCreateClubMatches', () => {
  it('allows club_admin for their club only', () => {
    const memberships = [
      { clubId: 'club-a', role: 'club_admin' as const, status: 'active' as const },
      { clubId: 'club-b', role: 'player' as const, status: 'active' as const },
    ]
    expect(
      canManageMatchClub({ matchClubId: 'club-a', memberships })
    ).toBe(true)
    expect(
      canManageMatchClub({ matchClubId: 'club-b', memberships })
    ).toBe(false)
    expect(canManageMatchClub({ matchClubId: null, memberships })).toBe(false)
    expect(
      canCreateClubMatches({ memberships, activeClubId: 'club-a' })
    ).toBe(true)
    expect(
      canCreateClubMatches({ memberships, activeClubId: 'club-b' })
    ).toBe(false)
  })

  it('hides create when the user is only a player on the selected club', () => {
    const memberships = [
      { clubId: 'club-a', role: 'player' as const, status: 'active' as const },
      {
        clubId: 'club-b',
        role: 'club_admin' as const,
        status: 'active' as const,
      },
    ]
    expect(
      canCreateClubMatches({ memberships, activeClubId: 'club-a' })
    ).toBe(false)
  })

  it('requires an effective activeClubId for non-super-users', () => {
    expect(
      canCreateClubMatches({
        memberships: [
          {
            clubId: 'only',
            role: 'club_admin' as const,
            status: 'active' as const,
          },
        ],
        activeClubId: null,
      })
    ).toBe(false)
    expect(
      canCreateClubMatches({
        memberships: [
          {
            clubId: 'only',
            role: 'club_admin' as const,
            status: 'active' as const,
          },
        ],
        activeClubId: 'only',
      })
    ).toBe(true)
  })

  it('allows super user everywhere', () => {
    expect(
      canManageMatchClub({
        matchClubId: null,
        memberships: [],
        isSuperUser: true,
      })
    ).toBe(true)
    expect(canCreateClubMatches({ memberships: [], isSuperUser: true })).toBe(
      true
    )
  })
})
