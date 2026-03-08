import type { User } from '@/types/user'

/**
 * Profile is complete when display name and position are set (both required for RSVP).
 * Jersey number is optional.
 */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false
  const hasName =
    typeof user.displayName === 'string' && user.displayName.trim().length > 0

  const hasPosition =
    typeof user.position === 'string' && user.position.trim().length > 0
  return hasName && hasPosition
}
