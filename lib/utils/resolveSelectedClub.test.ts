import { describe, expect, it } from 'vitest'
import {
  canAccessClubSection,
  clubSubNavSections,
  resolveEffectiveActiveClubId,
  resolveSelectedClubMembership,
} from './resolveSelectedClub'
import type { ClubMembershipWithClub } from '@/types/club'

function membership(
  overrides: Partial<ClubMembershipWithClub> & {
    clubId: string
    role?: ClubMembershipWithClub['role']
    name?: string
    slug?: string
    allowPlayerInvites?: boolean
  }
): ClubMembershipWithClub {
  const clubId = overrides.clubId
  return {
    id: `${clubId}_u1`,
    clubId,
    userId: 'u1',
    role: overrides.role ?? 'player',
    status: overrides.status ?? 'active',
    joinedAt: new Date(),
    updatedAt: new Date(),
    club: {
      id: clubId,
      name: overrides.name ?? clubId,
      slug: overrides.slug ?? clubId,
      settings: {
        allowPlayerInvites: overrides.allowPlayerInvites ?? false,
      },
    },
  }
}

describe('resolveSelectedClubMembership', () => {
  it('returns null when there are no active memberships', () => {
    expect(
      resolveSelectedClubMembership({ memberships: [], activeClubId: 'a' })
    ).toBeNull()
  })

  it('prefers activeClubId when it is an active membership', () => {
    const a = membership({ clubId: 'a', name: 'Alpha' })
    const b = membership({ clubId: 'b', name: 'Beta' })
    expect(
      resolveSelectedClubMembership({
        memberships: [a, b],
        activeClubId: 'b',
      })
    ).toEqual(b)
  })

  it('falls back to the sole membership when activeClubId is missing', () => {
    const only = membership({ clubId: 'only' })
    expect(
      resolveSelectedClubMembership({
        memberships: [only],
        activeClubId: null,
      })
    ).toEqual(only)
  })

  it('ignores activeClubId that is not a membership and picks a stable club', () => {
    const z = membership({ clubId: 'z', name: 'Zulu' })
    const a = membership({ clubId: 'a', name: 'Alpha' })
    const selected = resolveSelectedClubMembership({
      memberships: [z, a],
      activeClubId: 'other',
    })
    expect(selected?.clubId).toBe('a')
  })

  it('resolveEffectiveActiveClubId matches the selected membership club', () => {
    const z = membership({ clubId: 'z', name: 'Zulu' })
    const a = membership({ clubId: 'a', name: 'Alpha', role: 'club_admin' })
    expect(
      resolveEffectiveActiveClubId({
        memberships: [z, a],
        activeClubId: null,
      })
    ).toBe('a')
  })
})

describe('clubSubNavSections', () => {
  it('shows Matches only for a player without invite permission', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'player',
        allowPlayerInvites: false,
      }).map(s => s.id)
    ).toEqual(['matches'])
  })

  it('shows Invites for a player when allowPlayerInvites is on', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'player',
        allowPlayerInvites: true,
      }).map(s => s.id)
    ).toEqual(['matches', 'invites'])
  })

  it('shows all sections for club_admin', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'club_admin',
        allowPlayerInvites: false,
      }).map(s => ({ id: s.id, href: s.href }))
    ).toEqual([
      { id: 'matches', href: '/c/jax/matches' },
      { id: 'roster', href: '/c/jax/roster' },
      { id: 'invites', href: '/c/jax/invites' },
      { id: 'settings', href: '/c/jax/settings' },
    ])
  })

  it('treats super_user like club admin for link visibility', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'player',
        allowPlayerInvites: false,
        isSuperUser: true,
      }).map(s => s.id)
    ).toEqual(['matches', 'roster', 'invites', 'settings'])
  })
})

describe('canAccessClubSection', () => {
  it('allows roster only for club admins and super users', () => {
    expect(
      canAccessClubSection({
        section: 'roster',
        role: 'player',
        allowPlayerInvites: true,
      })
    ).toBe(false)
    expect(
      canAccessClubSection({
        section: 'roster',
        role: 'club_admin',
        allowPlayerInvites: false,
      })
    ).toBe(true)
    expect(
      canAccessClubSection({
        section: 'invites',
        role: 'player',
        allowPlayerInvites: true,
      })
    ).toBe(true)
  })
})
