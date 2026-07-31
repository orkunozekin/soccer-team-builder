import { getMatchStart } from '@/lib/utils/rsvpScheduler'
import type { MatchLocation } from '@/types/match'

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

export type CheckInMethod = 'geo' | 'host'

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
