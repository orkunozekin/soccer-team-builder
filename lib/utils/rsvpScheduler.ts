import { formatInTimeZone } from 'date-fns-tz'

const CT_TIMEZONE = 'America/Chicago'
const RSVP_CLOSE_HOURS_AFTER_START = 4
const TIME_HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/

/**
 * Resolve kickoff as date (calendar day in CT) + HH:mm (CT).
 * Falls back to the time embedded in `date` when `time` is missing/invalid.
 */
export function getMatchStart(date: Date, time?: string | null): Date {
  const dateStr = formatInTimeZone(date, CT_TIMEZONE, 'yyyy-MM-dd')
  const offset = formatInTimeZone(date, CT_TIMEZONE, 'xxx')
  const timeStr =
    time && TIME_HHMM.test(time)
      ? time
      : formatInTimeZone(date, CT_TIMEZONE, 'HH:mm')
  return new Date(`${dateStr}T${timeStr}:00${offset}`)
}

/**
 * RSVP opens at 9:00 AM CT on match day and closes at match start + 4 hours.
 */
export function getRSVPSchedule(
  date: Date,
  time?: string | null
): {
  openAt: Date | null
  closeAt: Date | null
} {
  const dateStr = formatInTimeZone(date, CT_TIMEZONE, 'yyyy-MM-dd')
  const offset = formatInTimeZone(date, CT_TIMEZONE, 'xxx')
  const openAt = new Date(`${dateStr}T09:00:00${offset}`)
  const matchStart = getMatchStart(date, time)
  const closeAt = new Date(
    matchStart.getTime() + RSVP_CLOSE_HOURS_AFTER_START * 60 * 60 * 1000
  )
  return { openAt, closeAt }
}

/**
 * True when kickoff has been reached (match has started).
 */
export function hasMatchStarted(
  date: Date,
  time?: string | null,
  now: Date = new Date()
): boolean {
  return now.getTime() >= getMatchStart(date, time).getTime()
}

/**
 * True when the RSVP/close window has ended (match start + 4h passed).
 */
export function isMatchPast(date: Date, time?: string | null): boolean {
  const { closeAt } = getRSVPSchedule(date, time)
  if (!closeAt) return false
  return new Date() > closeAt
}

/**
 * Check if RSVP should be open for the match's schedule window.
 */
export function shouldRSVPBeOpen(
  matchDate: Date,
  time?: string | null,
  _manualOpenAt: Date | null = null,
  _manualCloseAt: Date | null = null
): boolean {
  const now = new Date()
  const schedule = getRSVPSchedule(matchDate, time)
  if (!schedule.openAt || !schedule.closeAt) return false
  return now >= schedule.openAt && now <= schedule.closeAt
}

/**
 * Get the next RSVP open time for a match
 */
export function getNextRSVPOpenTime(
  matchDate: Date,
  time?: string | null
): Date | null {
  const schedule = getRSVPSchedule(matchDate, time)
  return schedule.openAt
}

/**
 * Get the next RSVP close time for a match
 */
export function getNextRSVPCloseTime(
  matchDate: Date,
  time?: string | null
): Date | null {
  const schedule = getRSVPSchedule(matchDate, time)
  return schedule.closeAt
}
