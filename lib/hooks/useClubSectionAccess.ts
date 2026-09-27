'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAdmin } from '@/lib/hooks/useAdmin'
import {
  useClubSlugAccess,
  type ResolvedClubAccess,
} from '@/lib/hooks/useClubSlugAccess'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { clubMatchesPath } from '@/lib/utils/clubPaths'
import {
  canAccessClubSection,
  type ClubSubNavSection,
} from '@/lib/utils/resolveSelectedClub'
import type { ClubMembershipRole } from '@/types/club'

export type ClubSectionAccess =
  | ResolvedClubAccess
  | { status: 'redirect'; href: string }

/**
 * Resolve `/c/[slug]/{section}` access.
 * Non-members → forbidden (404). Members without the section role → redirect
 * to matches (same club). Super users get club-admin visibility.
 */
export function useClubSectionAccess(
  slug: string | undefined,
  section: Exclude<ClubSubNavSection, 'matches'>
): ClubSectionAccess {
  const router = useRouter()
  const { isSuperUser } = useAdmin()
  const { memberships } = useClubMemberships()
  const access = useClubSlugAccess(slug)

  const membershipRole: ClubMembershipRole | null = useMemo(() => {
    if (access.status !== 'ok') return null
    const m = memberships.find(
      mem =>
        mem.status === 'active' &&
        (mem.clubId === access.club.id || mem.club.slug === access.club.slug)
    )
    return m?.role ?? null
  }, [access, memberships])

  const allowed = useMemo(() => {
    if (access.status !== 'ok') return false
    // Super user without membership: useClubSlugAccess already allowed them.
    const role = membershipRole ?? 'player'
    return canAccessClubSection({
      section,
      role,
      allowPlayerInvites: access.club.settings.allowPlayerInvites,
      isSuperUser: !!isSuperUser,
    })
  }, [access, membershipRole, section, isSuperUser])

  const redirectHref =
    access.status === 'ok' ? clubMatchesPath(access.club.slug) : null

  useEffect(() => {
    if (access.status === 'ok' && !allowed && redirectHref) {
      router.replace(redirectHref)
    }
  }, [access.status, allowed, redirectHref, router])

  if (access.status !== 'ok') return access
  if (!allowed) {
    return {
      status: 'redirect',
      href: redirectHref ?? clubMatchesPath(access.club.slug),
    }
  }
  return access
}
