import type { ClubMembershipRole } from '@/types/club'

/** User-facing membership role. Stored values stay snake_case. */
export function formatMembershipRole(role: ClubMembershipRole | string): string {
  if (role === 'club_admin') return 'Club admin'
  if (role === 'player') return 'Player'
  return role
}
