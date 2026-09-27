import type { ClubMembershipWithClub } from '@/types/club'
import { resolveSelectedClubMembership } from '@/lib/utils/resolveSelectedClub'

export function clubMatchesPath(slug: string): string {
  return `/c/${slug}/matches`
}

export function clubMatchPath(slug: string, matchId: string): string {
  return `/c/${slug}/matches/${matchId}`
}

/** Extract `/c/[slug]` from a pathname, or null when not on a club route. */
export function parseClubSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

/**
 * Slug for legacy `/matches` redirects: activeClubId membership, else sole
 * (or stable) active membership. Null → send the user to `/join`.
 */
export function resolveLegacyMatchesRedirectSlug(input: {
  memberships: ClubMembershipWithClub[]
  activeClubId?: string | null
}): string | null {
  return resolveSelectedClubMembership(input)?.club.slug ?? null
}

/**
 * Prefer the membership whose club slug matches the URL; otherwise fall back
 * to activeClubId / sole membership resolution.
 */
export function resolveClubMembershipForPath(input: {
  memberships: ClubMembershipWithClub[]
  activeClubId?: string | null
  pathSlug?: string | null
}): ClubMembershipWithClub | null {
  const slug =
    typeof input.pathSlug === 'string' ? input.pathSlug.trim() : ''
  if (slug) {
    const fromPath = input.memberships.find(
      m => m.status === 'active' && m.club.slug === slug
    )
    if (fromPath) return fromPath
  }
  return resolveSelectedClubMembership({
    memberships: input.memberships,
    activeClubId: input.activeClubId,
  })
}
