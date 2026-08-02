import { getMatchStart } from '@/lib/utils/rsvpScheduler'
import type { MatchLocation } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

export const CHECK_IN_WINDOW_BEFORE_MS = 40 * 60 * 1000
export const CHECK_IN_WINDOW_AFTER_MS = 2 * 60 * 60 * 1000

export function getCheckInWindow(
  date: Date,
  time?: string | null
): { start: Date; end: Date } {
  const matchStart = getMatchStart(date, time)
  return {
    start: new Date(matchStart.getTime() - CHECK_IN_WINDOW_BEFORE_MS),
    end: new Date(matchStart.getTime() + CHECK_IN_WINDOW_AFTER_MS),
  }
}

export function isWithinCheckInWindow(
  date: Date,
  time?: string | null,
  now: Date = new Date()
): boolean {
  const { start, end } = getCheckInWindow(date, time)
  return now >= start && now <= end
}

export function isCheckInWindowEnded(
  date: Date,
  time?: string | null,
  now: Date = new Date()
): boolean {
  const { end } = getCheckInWindow(date, time)
  return now > end
}

/** True once the check-in window has opened (during or after). */
export function hasCheckInWindowStarted(
  date: Date,
  time?: string | null,
  now: Date = new Date()
): boolean {
  const { start } = getCheckInWindow(date, time)
  return now >= start
}

export type CheckInMethod = 'geo' | 'host'

export type AttendanceLabel = 'Present' | 'No-show' | 'Pending'

export function getAttendanceLabel(
  rsvp: Pick<RSVP, 'attended' | 'status'>,
  windowEnded: boolean
): AttendanceLabel {
  if (rsvp.attended === true) return 'Present'
  if (windowEnded && rsvp.status === 'confirmed') return 'No-show'
  return 'Pending'
}

export function attendanceBadgeClassName(label: AttendanceLabel): string {
  if (label === 'Present') {
    return 'border-transparent bg-emerald-600 text-white hover:bg-emerald-600'
  }
  if (label === 'No-show') {
    return 'border-transparent bg-red-600 text-white hover:bg-red-600'
  }
  return ''
}

export function venueHasCheckInCoords(
  location: MatchLocation | null | undefined
): boolean {
  if (!location) return false
  return (
    location.lat != null &&
    location.lng != null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    Math.abs(location.lat) <= 90 &&
    Math.abs(location.lng) <= 180
  )
}
