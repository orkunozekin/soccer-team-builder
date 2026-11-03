import {
  MATCH_ENDED_STATUS,
  getRsvpStatusForMatch,
} from '@/lib/utils/matchStatus'
import type { MatchRsvpStatus } from '@/lib/utils/matchStatus'
import { getRosterFill } from '@/lib/utils/rosterFill'
import { getMatchStart, isMatchPast } from '@/lib/utils/rsvpScheduler'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

export type PlayerMatchFilter = 'upcoming' | 'mine' | 'past'

const FILTER_OPTIONS: { value: PlayerMatchFilter; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'mine', label: "I'm in" },
  { value: 'past', label: 'Past' },
]

/**
 * Filter pills for the matches list. Past is offered only to people who can
 * manage matches: player lists never contain past matches.
 */
export function getMatchListFilters(includePast: boolean) {
  return includePast
    ? FILTER_OPTIONS
    : FILTER_OPTIONS.filter(option => option.value !== 'past')
}

const kickoffTime = (match: Pick<Match, 'date' | 'time'>) =>
  getMatchStart(new Date(match.date), match.time).getTime()

/** Earliest kickoff first; does not mutate the input. */
export function sortByKickoff<T extends Pick<Match, 'date' | 'time'>>(
  matches: readonly T[]
): T[] {
  return [...matches].sort((a, b) => kickoffTime(a) - kickoffTime(b))
}

/**
 * The soonest match that hasn't kicked off becomes the "Next up" hero; the
 * rest (including any already in progress) list below it in kickoff order.
 */
export function splitNextMatch<T extends Pick<Match, 'date' | 'time'>>(
  matches: readonly T[],
  now: Date = new Date()
): { next: T | null; rest: T[] } {
  const sorted = sortByKickoff(matches)
  const nextIndex = sorted.findIndex(m => kickoffTime(m) > now.getTime())
  if (nextIndex === -1) return { next: null, rest: sorted }
  const [next] = sorted.splice(nextIndex, 1)
  return { next, rest: sorted }
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
  filter: Exclude<PlayerMatchFilter, 'past'>,
  myRsvps: ReadonlyMap<string, RSVP>
): T[] {
  if (filter === 'mine') return matches.filter(m => myRsvps.has(m.id))
  return [...matches]
}

/**
 * Splits a list into the "Next up" hero (soonest match yet to kick off) and the rows
 * for the chosen filter: remaining upcoming matches, the ones I'm in, or past
 * matches newest first.
 */
export function selectMatchList<T extends Pick<Match, 'id' | 'date' | 'time'>>(
  matches: readonly T[],
  filter: PlayerMatchFilter,
  myRsvps: ReadonlyMap<string, RSVP>,
  now: Date = new Date()
): { next: T | null; rows: T[] } {
  const isPast = (m: T) => isMatchPast(new Date(m.date), m.time, now)
  const { next, rest } = splitNextMatch(
    matches.filter(m => !isPast(m)),
    now
  )
  if (filter === 'past') {
    return { next, rows: sortByKickoff(matches.filter(isPast)).reverse() }
  }
  return { next, rows: filterPlayerMatches(rest, filter, myRsvps) }
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
  if (!myRsvp || isMatchPast(new Date(match.date), match.time, now)) {
    return getRsvpStatusForMatch(match, now)
  }
  const parts = ["You're in"]
  if (myRsvp.position) parts.push(myRsvp.position)
  if (rsvpCount !== undefined) {
    parts.push(`${rsvpCount}/${getRosterFill(rsvpCount).capacity}`)
  }
  return { tone: 'success', label: parts.join(' · ') }
}
