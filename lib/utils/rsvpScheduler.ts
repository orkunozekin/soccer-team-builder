import { formatInTimeZone } from 'date-fns-tz'

const CT_TIMEZONE = 'America/Chicago'

/**
 * Get the RSVP schedule for a given date based on day of week
 * Monday/Wednesday: Open 6am CT, Close 8pm CT
 * Sunday: Open 6am CT, Close 5pm CT
 * Other days: No automatic schedule
 */
export function getRSVPSchedule(date: Date): {
  openAt: Date | null
  closeAt: Date | null
} {
  const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Only schedule for Monday (1), Wednesday (3), and Sunday (0)
  if (dayOfWeek !== 0 && dayOfWeek !== 1 && dayOfWeek !== 3) {
    return { openAt: null, closeAt: null }
  }

  // Create date strings in CT timezone
  const dateStr = formatInTimeZone(date, CT_TIMEZONE, 'yyyy-MM-dd')

  if (dayOfWeek === 1 || dayOfWeek === 3) {
    // Monday or Wednesday: 6am - 8pm CT
    const openAt = new Date(`${dateStr}T06:00:00-06:00`) // 6am CT
    const closeAt = new Date(`${dateStr}T20:00:00-06:00`) // 8pm CT
    return { openAt, closeAt }
  } else if (dayOfWeek === 0) {
    // Sunday: 6am - 5pm CT
    const openAt = new Date(`${dateStr}T06:00:00-06:00`) // 6am CT
    const closeAt = new Date(`${dateStr}T17:00:00-06:00`) // 5pm CT
    return { openAt, closeAt }
  }

  return { openAt: null, closeAt: null }
}

/**
 * Check if RSVP should be open based on schedule and current time
 */
export function shouldRSVPBeOpen(
  matchDate: Date,
  manualOpenAt: Date | null = null,
  manualCloseAt: Date | null = null
): boolean {
  const now = new Date()

  // If manual override times are set, use those
  if (manualOpenAt && manualCloseAt) {
    return now >= manualOpenAt && now <= manualCloseAt
  }

  // Otherwise, use automatic schedule
  const schedule = getRSVPSchedule(matchDate)
  if (!schedule.openAt || !schedule.closeAt) {
    return false
  }

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
