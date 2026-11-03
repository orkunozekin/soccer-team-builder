import { getRsvpStatusForMatch } from '@/lib/utils/matchStatus'
import type { MatchRsvpStatus } from '@/lib/utils/matchStatus'
import { getRosterFill } from '@/lib/utils/rosterFill'
import { getMatchStart } from '@/lib/utils/rsvpScheduler'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

export type PlayerMatchFilter = 'upcoming' | 'mine'

export const PLAYER_MATCH_FILTERS: {
  value: PlayerMatchFilter
  label: string
}[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'mine', label: "I'm in" },
]

const kickoffTime = (match: Pick<Match, 'date' | 'time'>) =>
  getMatchStart(new Date(match.date), match.time).getTime()

/** Earliest kickoff first; does not mutate the input. */
export function sortByKickoff<T extends Pick<Match, 'date' | 'time'>>(
  matches: readonly T[]
): T[] {
  return [...matches].sort((a, b) => kickoffTime(a) - kickoffTime(b))
}

/** The soonest match becomes the "Next up" hero; the rest list below it. */
export function splitNextMatch<T extends Pick<Match, 'date' | 'time'>>(
  matches: readonly T[]
): { next: T | null; rest: T[] } {
  const [next = null, ...rest] = sortByKickoff(matches)
  return { next, rest }
}

/** Confirmed RSVPs keyed by match id (cancelled RSVPs are ignored). */
export function indexConfirmedRsvps(rsvps: readonly RSVP[]): Map<string, RSVP> {
  const byMatchId = new Map<string, RSVP>()
  for (const rsvp of rsvps) {
    if (rsvp.status === 'confirmed') byMatchId.set(rsvp.matchId, rsvp)
  }
  return byMatchId
}

export function filterPlayerMatches<T extends Pick<Match, 'id'>>(
  matches: readonly T[],
  filter: PlayerMatchFilter,
  myRsvps: ReadonlyMap<string, RSVP>
): T[] {
  if (filter === 'mine') return matches.filter(m => myRsvps.has(m.id))
  return [...matches]
}

/**
 * Row status line: a confirmed player sees their spot ("You're in · ST ·
 * 12/22"); everyone else sees the RSVP window.
 */
export function getPlayerMatchStatus({
  match,
  myRsvp,
  rsvpCount,
  now = new Date(),
}: {
  match: Pick<Match, 'date' | 'time' | 'rsvpOpen'>
  myRsvp?: Pick<RSVP, 'position'> | null
  rsvpCount?: number
  now?: Date
}): MatchRsvpStatus {
  if (!myRsvp) return getRsvpStatusForMatch(match, now)
  const parts = ["You're in"]
  if (myRsvp.position) parts.push(myRsvp.position)
  if (rsvpCount !== undefined) {
    parts.push(`${rsvpCount}/${getRosterFill(rsvpCount).capacity}`)
  }
  return { tone: 'success', label: parts.join(' · ') }
}
