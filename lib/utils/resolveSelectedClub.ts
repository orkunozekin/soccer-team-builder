import type { ClubMembershipWithClub } from '@/types/club'

/**
 * Pick the membership for the club sub-nav / switcher.
 * Prefers activeClubId when it is an active membership; otherwise the sole
 * active membership; otherwise null (caller shows Join).
 */
export function resolveSelectedClubMembership(input: {
  memberships: ClubMembershipWithClub[]
  activeClubId?: string | null
}): ClubMembershipWithClub | null {
  const active = input.memberships.filter(m => m.status === 'active')
  if (active.length === 0) return null

  const preferred =
    typeof input.activeClubId === 'string' ? input.activeClubId.trim() : ''
  if (preferred) {
    const match = active.find(m => m.clubId === preferred)
    if (match) return match
  }

  if (active.length === 1) return active[0]
  // Multiple memberships and no valid activeClubId: still show one so the
  // switcher is usable; prefer the first by stable club name then id.
  return [...active].sort((a, b) => {
    const byName = a.club.name.localeCompare(b.club.name)
    if (byName !== 0) return byName
    return a.clubId.localeCompare(b.clubId)
  })[0]
}

export type ClubSubNavSection = 'matches' | 'roster' | 'invites' | 'settings'

/**
 * Club-scoped section links for the sub-nav.
 * Todo 2: Matches only (still `/matches` until `/c/[slug]` redirects land).
 * Roster / invites / settings hrefs are ready for todos 3–4.
 */
export function clubSubNavSections(input: {
  slug: string
  role: ClubMembershipWithClub['role']
  allowPlayerInvites: boolean
  /** When true, treat as club admin for link visibility (super_user). */
  isSuperUser?: boolean
  /**
   * When false (default until club-admin routes ship), only Matches is listed.
   * Pass true from tests or once `/c/[slug]/roster|invites|settings` exist.
   */
  includeClubAdminSections?: boolean
}): { id: ClubSubNavSection; label: string; href: string }[] {
  const sections: { id: ClubSubNavSection; label: string; href: string }[] = [
    { id: 'matches', label: 'Matches', href: '/matches' },
  ]

  if (!input.includeClubAdminSections) {
    return sections
  }

  const isClubAdmin = input.isSuperUser || input.role === 'club_admin'
  const canInvites = isClubAdmin || input.allowPlayerInvites
  if (isClubAdmin) {
    sections.push({
      id: 'roster',
      label: 'Roster',
      href: `/c/${input.slug}/roster`,
    })
  }
  if (canInvites) {
    sections.push({
      id: 'invites',
      label: 'Invites',
      href: `/c/${input.slug}/invites`,
    })
  }
  if (isClubAdmin) {
    sections.push({
      id: 'settings',
      label: 'Settings',
      href: `/c/${input.slug}/settings`,
    })
  }
  return sections
}
