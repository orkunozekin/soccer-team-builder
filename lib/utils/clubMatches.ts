import type { ClubMembershipWithClub } from '@/types/club'
import type { Match } from '@/types/match'

export type ClubMatchFilterInput = {
  matches: Match[]
  memberships: Pick<ClubMembershipWithClub, 'clubId' | 'status'>[]
  activeClubId?: string | null
  /** Global platform operator — sees all clubs unless activeClubId is set. */
  isSuperUser?: boolean
}

/**
 * Resolve which clubIds a user should see matches for.
 * Prefers activeClubId when it is one of their active memberships;
 * otherwise all active membership club ids.
 */
export function resolveVisibleClubIds(input: {
  memberships: Pick<ClubMembershipWithClub, 'clubId' | 'status'>[]
  activeClubId?: string | null
}): string[] {
  const active = input.memberships
    .filter(m => m.status === 'active')
    .map(m => m.clubId)

  const preferred =
    typeof input.activeClubId === 'string' ? input.activeClubId.trim() : ''
  if (preferred && active.includes(preferred)) {
    return [preferred]
  }
  return Array.from(new Set(active))
}

/**
 * Client-side match list scoping.
 *
 * - Super user with no activeClubId: all matches
 * - Super user with activeClubId: that club + unscoped (pre-backfill) docs
 * - Member: membership clubs (or activeClubId) + unscoped docs
 * - No memberships: only unscoped docs (pre-backfill shared universe / orphan empty after stamp)
 */
export function filterMatchesForClubScope(
  input: ClubMatchFilterInput
): Match[] {
  const { matches, isSuperUser = false } = input

  if (isSuperUser) {
    const preferred =
      typeof input.activeClubId === 'string' ? input.activeClubId.trim() : ''
    if (!preferred) return matches
    return matches.filter(
      m => m.clubId == null || m.clubId === '' || m.clubId === preferred
    )
  }

  const visibleClubIds = resolveVisibleClubIds({
    memberships: input.memberships,
    activeClubId: input.activeClubId,
  })

  if (visibleClubIds.length === 0) {
    // Pre-backfill / orphan: only matches that have not been stamped yet.
    return matches.filter(m => m.clubId == null || m.clubId === '')
  }

  const allowed = new Set(visibleClubIds)
  return matches.filter(
    m => m.clubId == null || m.clubId === '' || allowed.has(m.clubId)
  )
}

/**
 * Whether the user can manage a match's club ops in the client UI.
 * Missing clubId (pre-backfill) → super user only.
 */
export function canManageMatchClub(input: {
  matchClubId?: string | null
  memberships: Pick<ClubMembershipWithClub, 'clubId' | 'role' | 'status'>[]
  isSuperUser?: boolean
}): boolean {
  if (input.isSuperUser) return true
  const clubId = input.matchClubId
  if (!clubId) return false
  return input.memberships.some(
    m =>
      m.status === 'active' &&
      m.clubId === clubId &&
      m.role === 'club_admin'
  )
}

/** True if the user can create matches for at least one club. */
export function canCreateClubMatches(input: {
  memberships: Pick<ClubMembershipWithClub, 'role' | 'status'>[]
  isSuperUser?: boolean
}): boolean {
  if (input.isSuperUser) return true
  return input.memberships.some(
    m => m.status === 'active' && m.role === 'club_admin'
  )
}
