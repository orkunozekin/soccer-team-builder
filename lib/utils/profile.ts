import type { User } from '@/types/user'

/**
 * Profile is complete when display name is set (required for RSVP).
 * Jersey number is optional; modal only prompts when display name is missing.
 */
export function isProfileComplete(user: User | null | undefined): boolean {
  if (!user) return false
  const hasName = typeof user.displayName === 'string' && user.displayName.trim().length > 0
  return hasName
}
