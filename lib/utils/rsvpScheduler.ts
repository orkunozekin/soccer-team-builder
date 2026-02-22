import { formatInTimeZone } from 'date-fns-tz'

const CT_TIMEZONE = 'America/Chicago'

/**
 * Get the RSVP schedule for the match day: always 9am CT - 10pm CT on that date.
 */
export function getRSVPSchedule(date: Date): {
  openAt: Date | null
  closeAt: Date | null
} {
  const dateStr = formatInTimeZone(date, CT_TIMEZONE, 'yyyy-MM-dd')
  const openAt = new Date(`${dateStr}T09:00:00-06:00`) // 9am CT
  const closeAt = new Date(`${dateStr}T22:00:00-06:00`) // 10pm CT
  return { openAt, closeAt }
}

/**
 * Check if RSVP should be open: current time is within 9am–10pm CT on match day.
 * Manual open/close times are no longer used; schedule is always 9am–10pm CT on match day.
 */
export function shouldRSVPBeOpen(
  matchDate: Date,
  _manualOpenAt: Date | null = null,
  _manualCloseAt: Date | null = null
): boolean {
  const now = new Date()
  const schedule = getRSVPSchedule(matchDate)
  if (!schedule.openAt || !schedule.closeAt) return false
  return now >= schedule.openAt && now <= schedule.closeAt
}

/**
 * Get the next RSVP open time for a match
 */
export function getNextRSVPOpenTime(matchDate: Date): Date | null {
  const schedule = getRSVPSchedule(matchDate)
  return schedule.openAt
}

/**
 * Get the next RSVP close time for a match
 */
export function getNextRSVPCloseTime(matchDate: Date): Date | null {
  const schedule = getRSVPSchedule(matchDate)
  return schedule.closeAt
}
