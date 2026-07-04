import type { RSVP } from '@/types/rsvp'
import type { Team } from '@/types/team'

/** User IDs on match teams plus confirmed RSVPs (for roster display and profile merge). */
export function collectMatchParticipantIds(
  teams: Team[],
  rsvps: RSVP[]
): string[] {
  const ids = new Set<string>()
  for (const team of teams) {
    for (const playerId of team.playerIds) {
      ids.add(playerId)
    }
  }
  for (const rsvp of rsvps) {
    if (rsvp.status === 'confirmed') {
      ids.add(rsvp.userId)
    }
  }
  return Array.from(ids)
}
