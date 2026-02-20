import type { User } from '@/types/user'

/**
 * Profile is complete when display name is set and jersey number is set (0-99).
 * Required for RSVP and enforced on first-time users via redirect to profile.
 */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false
  const hasName = typeof user.displayName === 'string' && user.displayName.trim().length > 0
  const hasJersey =
    typeof user.jerseyNumber === 'number' &&
    Number.isInteger(user.jerseyNumber) &&
    user.jerseyNumber >= 0 &&
    user.jerseyNumber <= 99
  return hasName && hasJersey
}
