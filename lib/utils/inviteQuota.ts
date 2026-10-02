import { PLAYER_INVITE_COOLDOWN_MS } from '@/lib/constants/invites'

export interface InviteQuotaState {
  limited: boolean
  /** When the player may create their next invite; null when not limited. */
  nextAllowedAt: Date | null
}

/**
 * Player invite limit: one invite per club per cooldown window. Revoking the
 * last invite frees the slot immediately.
 */
export function getInviteQuotaState(input: {
  lastCreatedAt: Date | null
  lastInviteRevoked: boolean
  now: Date
}): InviteQuotaState {
  const { lastCreatedAt, lastInviteRevoked, now } = input
  if (!lastCreatedAt || lastInviteRevoked) {
    return { limited: false, nextAllowedAt: null }
  }
  const nextAllowedMs = lastCreatedAt.getTime() + PLAYER_INVITE_COOLDOWN_MS
  if (now.getTime() >= nextAllowedMs) {
    return { limited: false, nextAllowedAt: null }
  }
  return { limited: true, nextAllowedAt: new Date(nextAllowedMs) }
}

/** e.g. "11h 42m", "42m", "Less than a minute"; null when no time remains. */
export function formatInviteTimeRemaining(
  target: Date,
  now: Date
): string | null {
  const remainingMs = target.getTime() - now.getTime()
  if (remainingMs <= 0) return null
  const totalMinutes = Math.floor(remainingMs / 60_000)
  if (totalMinutes < 1) return 'Less than a minute'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}
