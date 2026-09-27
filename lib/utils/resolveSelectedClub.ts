import type { ClubMembershipWithClub } from '@/types/club'

/**
 * Pick the membership for the club sub-nav / switcher / match scope.
 * Prefers activeClubId when it is an active membership; otherwise the sole
 * active membership; with multiple memberships and no valid activeClubId,
 * picks a stable club (name, then id) so UI stays consistent.
 * Returns null when there are no active memberships (caller shows Join).
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

/** Club id for the membership chosen by {@link resolveSelectedClubMembership}. */
export function resolveEffectiveActiveClubId(input: {
  memberships: ClubMembershipWithClub[]
  activeClubId?: string | null
}): string | null {
  return resolveSelectedClubMembership(input)?.clubId ?? null
}

export type ClubSubNavSection = 'matches' | 'roster' | 'invites' | 'settings'

/** Whether the viewer may open a club console section (nav + page gate). */
export function canAccessClubSection(input: {
  section: ClubSubNavSection
  role: ClubMembershipWithClub['role']
  allowPlayerInvites: boolean
  isSuperUser?: boolean
}): boolean {
  if (input.section === 'matches') return true
  const isClubAdmin = Boolean(input.isSuperUser) || input.role === 'club_admin'
  if (input.section === 'roster' || input.section === 'settings') {
    return isClubAdmin
  }
  // invites
  return isClubAdmin || input.allowPlayerInvites
}

/**
 * Club-scoped section links for the sub-nav.
 * Matches uses `/c/[slug]/matches`. Roster / invites / settings are the
 * club-admin console (players see Invites only when allowPlayerInvites).
 */
export function clubSubNavSections(input: {
  slug: string
  role: ClubMembershipWithClub['role']
  allowPlayerInvites: boolean
  /** When true, treat as club admin for link visibility (super_user). */
  isSuperUser?: boolean
}): { id: ClubSubNavSection; label: string; href: string }[] {
  const sections: { id: ClubSubNavSection; label: string; href: string }[] = [
    { id: 'matches', label: 'Matches', href: `/c/${input.slug}/matches` },
  ]

  const isClubAdmin = Boolean(input.isSuperUser) || input.role === 'club_admin'
  const canInvites = canAccessClubSection({
    section: 'invites',
    role: input.role,
    allowPlayerInvites: input.allowPlayerInvites,
    isSuperUser: input.isSuperUser,
  })
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
