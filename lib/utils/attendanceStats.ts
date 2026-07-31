import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'
import { isCheckInWindowEnded } from '@/lib/utils/checkIn'

export interface AttendanceStats {
  confirmedCount: number
  attendedCount: number
  noShowCount: number
  showRate: number | null
}

/**
 * Compute RSVP→attendance stats.
 * No-show: confirmed && attended !== true after the check-in window ends.
 * Matches still inside/before the window are excluded from no-show (pending).
 */
export function computeAttendanceStats(
  rsvps: RSVP[],
  matchesById: Map<string, Pick<Match, 'date' | 'time'>>,
  now: Date = new Date()
): AttendanceStats {
  let confirmedCount = 0
  let attendedCount = 0
  let noShowCount = 0
  let settledConfirmed = 0

  for (const rsvp of rsvps) {
    if (rsvp.status !== 'confirmed') continue
    confirmedCount += 1

    if (rsvp.attended === true) {
      attendedCount += 1
    }

    const match = matchesById.get(rsvp.matchId)
    if (!match) continue
    if (!isCheckInWindowEnded(match.date, match.time, now)) continue

    settledConfirmed += 1
    if (rsvp.attended !== true) {
      noShowCount += 1
    }
  }

  const showRate =
    settledConfirmed > 0
      ? Math.round(
          ((settledConfirmed - noShowCount) / settledConfirmed) * 1000
        ) / 10
      : null

  return { confirmedCount, attendedCount, noShowCount, showRate }
}
