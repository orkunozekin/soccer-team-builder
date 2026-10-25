import type { ClubMembershipRole, ClubMembershipWithUser } from '@/types/club'

export type ClubRosterRoleFilter = 'all' | 'club_admins' | 'players'

/** Role tabs on the club roster page. */
export const CLUB_ROSTER_ROLE_FILTERS: {
  value: ClubRosterRoleFilter
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'club_admins', label: 'Club admins' },
  { value: 'players', label: 'Players' },
]

function roleMatchesFilter(
  role: ClubMembershipRole,
  filter: ClubRosterRoleFilter
): boolean {
  if (filter === 'club_admins') return role === 'club_admin'
  if (filter === 'players') return role === 'player'
  return true
}

function memberMatchesQuery(
  member: Pick<ClubMembershipWithUser, 'displayName' | 'email'>,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const name = member.displayName.toLowerCase()
  const email = (member.email ?? '').toLowerCase()
  return name.includes(needle) || email.includes(needle)
}

/** Apply role tab + name/email search to the club roster. */
export function filterClubRosterMembers(
  members: ClubMembershipWithUser[],
  filter: ClubRosterRoleFilter,
  query: string
): ClubMembershipWithUser[] {
  return members.filter(
    m => roleMatchesFilter(m.role, filter) && memberMatchesQuery(m, query)
  )
}
