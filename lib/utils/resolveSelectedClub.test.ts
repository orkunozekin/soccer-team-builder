import { describe, expect, it } from 'vitest'
import {
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
  it('defaults to Matches only until club-admin routes ship', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'club_admin',
        allowPlayerInvites: true,
      }).map(s => s.id)
    ).toEqual(['matches'])
  })

  it('shows Invites for a player when allowPlayerInvites is on', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'player',
        allowPlayerInvites: true,
        includeClubAdminSections: true,
      }).map(s => s.id)
    ).toEqual(['matches', 'invites'])
  })

  it('shows all sections for club_admin when enabled', () => {
    expect(
      clubSubNavSections({
        slug: 'jax',
        role: 'club_admin',
        allowPlayerInvites: false,
        includeClubAdminSections: true,
      }).map(s => ({ id: s.id, href: s.href }))
    ).toEqual([
      { id: 'matches', href: '/matches' },
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
        includeClubAdminSections: true,
      }).map(s => s.id)
    ).toEqual(['matches', 'roster', 'invites', 'settings'])
  })
})
