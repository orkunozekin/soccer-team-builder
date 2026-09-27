import { describe, expect, it } from 'vitest'
import {
  clubMatchPath,
  clubMatchesPath,
  parseClubSlugFromPathname,
  resolveClubMembershipForPath,
  resolveLegacyMatchesRedirectSlug,
} from './clubPaths'
import type { ClubMembershipWithClub } from '@/types/club'

function membership(
  overrides: Partial<ClubMembershipWithClub> & {
    clubId: string
    name?: string
    slug?: string
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
      settings: { allowPlayerInvites: false },
    },
  }
}

describe('clubPaths', () => {
  it('builds club match paths', () => {
    expect(clubMatchesPath('jax')).toBe('/c/jax/matches')
    expect(clubMatchPath('jax', 'm1')).toBe('/c/jax/matches/m1')
  })

  it('parses slug from club pathnames', () => {
    expect(parseClubSlugFromPathname('/c/jax/matches')).toBe('jax')
    expect(parseClubSlugFromPathname('/c/jax/matches/m1')).toBe('jax')
    expect(parseClubSlugFromPathname('/matches')).toBeNull()
    expect(parseClubSlugFromPathname('/profile')).toBeNull()
  })

  it('resolves legacy redirect slug from activeClubId', () => {
    const a = membership({ clubId: 'a', slug: 'alpha', name: 'Alpha' })
    const b = membership({ clubId: 'b', slug: 'beta', name: 'Beta' })
    expect(
      resolveLegacyMatchesRedirectSlug({
        memberships: [a, b],
        activeClubId: 'b',
      })
    ).toBe('beta')
  })

  it('returns null when there are no memberships', () => {
    expect(
      resolveLegacyMatchesRedirectSlug({ memberships: [], activeClubId: 'a' })
    ).toBeNull()
  })

  it('prefers the membership matching the path slug', () => {
    const a = membership({ clubId: 'a', slug: 'alpha', name: 'Alpha' })
    const b = membership({ clubId: 'b', slug: 'beta', name: 'Beta' })
    expect(
      resolveClubMembershipForPath({
        memberships: [a, b],
        activeClubId: 'a',
        pathSlug: 'beta',
      })?.clubId
    ).toBe('b')
  })
})
