import { isMatchPast } from '@/lib/utils/rsvpScheduler'

/** Shown (and returned by the RSVP API) when a player acts on a finished match. */
export const MATCH_ENDED_MESSAGE = 'This match has ended'

/**
 * Past matches (RSVP window closed: kickoff + 4h) are read-only for anyone who
 * cannot manage the match's club. Club admins and super users keep full
 * control so they can fix attendance and teams afterwards.
 */
export function isMatchReadOnly(
  match: { date: Date; time?: string | null },
  canManage: boolean,
  now: Date = new Date()
): boolean {
  return !canManage && isMatchPast(new Date(match.date), match.time, now)
}
