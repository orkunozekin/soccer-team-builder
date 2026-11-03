import { getMatchesByIds } from '@/lib/services/matchService'
import { getUserRSVPs } from '@/lib/services/rsvpService'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

export type HistoryMatch = Pick<Match, 'id' | 'date' | 'time' | 'location'>

/** A player's RSVPs and the matches they point at. */
export type PlayerHistory = { rsvps: RSVP[]; matches: HistoryMatch[] }

export type LoadPlayerHistory = () => Promise<PlayerHistory>

/** Every RSVP the player made, across clubs (super-user views). */
export async function loadPlayerHistory(
  userId: string
): Promise<PlayerHistory> {
  const rsvps = await getUserRSVPs(userId)
  const matches = await getMatchesByIds(
    rsvps.map(r => r.matchId),
    { includeDeleted: true }
  )
  return { rsvps, matches }
}
