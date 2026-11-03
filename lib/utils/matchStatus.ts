import { format, formatDistanceStrict } from 'date-fns'
import {
  getMatchStart,
  getNextRSVPCloseTime,
  getNextRSVPOpenTime,
  isMatchPast,
} from '@/lib/utils/rsvpScheduler'
import type { Match } from '@/types/match'

export type MatchStatusTone = 'live' | 'success' | 'neutral' | 'muted'

export interface MatchRsvpStatus {
  tone: MatchStatusTone
  label: string
}

/**
 * RSVP window copy shared by match cards and the match detail hero.
 * Callers pass the scheduler's open/close times so this stays pure.
 */
export function getMatchRsvpStatus({
  rsvpOpen,
  opensAt,
  closesAt,
  now,
}: {
  rsvpOpen: boolean
  opensAt: Date | null
  closesAt: Date | null
  now: Date
}): MatchRsvpStatus {
  if (rsvpOpen) {
    return {
      tone: 'live',
      label:
        closesAt && now < closesAt
          ? `RSVP open · closes ${format(closesAt, 'h:mm a')} CT`
          : 'RSVP open',
    }
  }
  if (opensAt && now < opensAt) {
    return {
      tone: 'neutral',
      label: `RSVP opens ${format(opensAt, "EEE MMM d 'at' h:mm a")} CT`,
    }
  }
  return { tone: 'muted', label: 'RSVP closed' }
}

export const MATCH_ENDED_STATUS: MatchRsvpStatus = {
  tone: 'muted',
  label: 'Match ended',
}

/**
 * Resolves the scheduler window for `match`, then derives its status. A past
 * match always reads "Match ended", even if its rsvpOpen flag is stale.
 */
export function getRsvpStatusForMatch(
  match: Pick<Match, 'date' | 'time' | 'rsvpOpen'>,
  now: Date = new Date()
): MatchRsvpStatus {
  const matchDate = new Date(match.date)
  if (isMatchPast(matchDate, match.time, now)) return MATCH_ENDED_STATUS
  return getMatchRsvpStatus({
    rsvpOpen: match.rsvpOpen,
    opensAt: getNextRSVPOpenTime(matchDate, match.time),
    closesAt: getNextRSVPCloseTime(matchDate, match.time),
    now,
  })
}

/** "in 3 days" before kickoff, "Kicked off" once it has started. */
export function getKickoffLabel(kickoff: Date, now: Date): string {
  if (now >= kickoff) return 'Kicked off'
  return formatDistanceStrict(kickoff, now, { addSuffix: true })
}

export function getKickoffLabelForMatch(
  match: Pick<Match, 'date' | 'time'>,
  now: Date = new Date()
): string {
  return getKickoffLabel(getMatchStart(new Date(match.date), match.time), now)
}
