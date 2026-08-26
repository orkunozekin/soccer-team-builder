import { addDays, addMonths, differenceInCalendarMonths } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { MatchLocation } from '@/types/match'
import type { MatchSchedule, ScheduleSlot } from '@/types/schedule'
import { SCHEDULE_TIMEZONE } from '@/types/schedule'

export type ScheduleOccurrence = {
  date: Date
  time: string
  location: MatchLocation | null
  slotId: string
  occurrenceKey: string
  /** Calendar day in schedule timezone (yyyy-MM-dd) */
  ymd: string
}

const TIME_HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/

export function buildOccurrenceKey(
  scheduleId: string,
  slotId: string,
  ymd: string
): string {
  return `${scheduleId}:${slotId}:${ymd}`
}

function ctYmd(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd')
}

/** JS weekday 0=Sun … 6=Sat in the given timezone. */
export function ctWeekday(date: Date, timezone: string): number {
  const isoDow = Number(formatInTimeZone(date, timezone, 'i')) // 1=Mon … 7=Sun
  return isoDow === 7 ? 0 : isoDow
}

function ctDayOfMonth(date: Date, timezone: string): number {
  return Number(formatInTimeZone(date, timezone, 'd'))
}

function instantOnDay(
  ymd: string,
  time: string,
  timezone: string
): Date {
  const t = TIME_HHMM.test(time) ? time : '12:00'
  return fromZonedTime(`${ymd}T${t}:00`, timezone)
}

function addCalendarDaysYmd(
  ymd: string,
  days: number,
  timezone: string
): string {
  const noon = fromZonedTime(`${ymd}T12:00:00`, timezone)
  return formatInTimeZone(addDays(noon, days), timezone, 'yyyy-MM-dd')
}

function monthsSinceAnchor(
  ymd: string,
  anchorYmd: string,
  timezone: string
): number {
  const cursor = fromZonedTime(`${ymd}T12:00:00`, timezone)
  const anchor = fromZonedTime(`${anchorYmd}T12:00:00`, timezone)
  return differenceInCalendarMonths(cursor, anchor)
}

/**
 * Weeks since anchor week (week starts Sunday in schedule TZ), for interval filtering.
 * Uses calendar day counts so DST does not skew the week index.
 */
function weeksSinceAnchor(
  ymd: string,
  anchorYmd: string,
  timezone: string
): number {
  const cursor = fromZonedTime(`${ymd}T12:00:00`, timezone)
  const anchor = fromZonedTime(`${anchorYmd}T12:00:00`, timezone)
  const cursorDow = ctWeekday(cursor, timezone)
  const anchorDow = ctWeekday(anchor, timezone)
  const cursorWeekStartYmd = addCalendarDaysYmd(ymd, -cursorDow, timezone)
  const anchorWeekStartYmd = addCalendarDaysYmd(
    anchorYmd,
    -anchorDow,
    timezone
  )
  const toDayNumber = (day: string) => {
    const [y, m, d] = day.split('-').map(Number)
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  return Math.round(
    (toDayNumber(cursorWeekStartYmd) - toDayNumber(anchorWeekStartYmd)) / 7
  )
}

function matchesInterval(
  cadence: MatchSchedule['cadence'],
  interval: number,
  ymd: string,
  anchorYmd: string,
  timezone: string
): boolean {
  const n = Math.max(1, Math.floor(interval) || 1)
  if (n === 1) return true
  if (cadence === 'weekly') {
    const weeks = weeksSinceAnchor(ymd, anchorYmd, timezone)
    return weeks >= 0 && weeks % n === 0
  }
  const months = monthsSinceAnchor(ymd, anchorYmd, timezone)
  return months >= 0 && months % n === 0
}

function slotsForDay(
  slots: ScheduleSlot[],
  cadence: MatchSchedule['cadence'],
  date: Date,
  timezone: string
): ScheduleSlot[] {
  if (cadence === 'weekly') {
    const dow = ctWeekday(date, timezone)
    return slots.filter(s => s.day === dow)
  }
  const dom = ctDayOfMonth(date, timezone)
  return slots.filter(s => s.day === dom)
}

/**
 * Generate the next chronological occurrences for a schedule starting at `from` (inclusive
 * only if kickoff is still >= from).
 */
export function generateOccurrences(
  schedule: Pick<
    MatchSchedule,
    'id' | 'cadence' | 'interval' | 'timezone' | 'slots' | 'createdAt'
  >,
  from: Date,
  limit: number
): ScheduleOccurrence[] {
  if (limit <= 0 || schedule.slots.length === 0) return []

  const timezone = schedule.timezone || SCHEDULE_TIMEZONE
  const anchorYmd = ctYmd(schedule.createdAt, timezone)
  const results: ScheduleOccurrence[] = []

  if (schedule.cadence === 'monthly') {
    let monthCursor = fromZonedTime(
      `${ctYmd(from, timezone)}T12:00:00`,
      timezone
    )
    // Scan enough months to fill limit (worst case: few slots + large interval)
    const maxMonths = Math.max(limit * schedule.interval * 2, 36)
    for (let i = 0; i < maxMonths && results.length < limit; i++) {
      const year = Number(formatInTimeZone(monthCursor, timezone, 'yyyy'))
      const month = Number(formatInTimeZone(monthCursor, timezone, 'M'))
      for (const slot of schedule.slots) {
        if (slot.day < 1 || slot.day > 28) continue
        const ymd = `${year}-${String(month).padStart(2, '0')}-${String(slot.day).padStart(2, '0')}`
        if (!matchesInterval(schedule.cadence, schedule.interval, ymd, anchorYmd, timezone)) {
          continue
        }
        const start = instantOnDay(ymd, slot.time, timezone)
        if (start.getTime() < from.getTime()) continue
        results.push({
          date: start,
          time: slot.time,
          location: slot.location,
          slotId: slot.id,
          ymd,
          occurrenceKey: buildOccurrenceKey(schedule.id, slot.id, ymd),
        })
      }
      monthCursor = addMonths(monthCursor, 1)
    }
    results.sort((a, b) => a.date.getTime() - b.date.getTime())
    return results.slice(0, limit)
  }

  // weekly: walk day by day
  let ymd = ctYmd(from, timezone)
  const maxDays = Math.max(limit * 7 * schedule.interval * 2, 370)
  for (let i = 0; i < maxDays && results.length < limit; i++) {
    const noon = fromZonedTime(`${ymd}T12:00:00`, timezone)
    if (
      matchesInterval(
        schedule.cadence,
        schedule.interval,
        ymd,
        anchorYmd,
        timezone
      )
    ) {
      const daySlots = slotsForDay(
        schedule.slots,
        schedule.cadence,
        noon,
        timezone
      )
      for (const slot of daySlots) {
        const start = instantOnDay(ymd, slot.time, timezone)
        if (start.getTime() < from.getTime()) continue
        results.push({
          date: start,
          time: slot.time,
          location: slot.location,
          slotId: slot.id,
          ymd,
          occurrenceKey: buildOccurrenceKey(schedule.id, slot.id, ymd),
        })
        if (results.length >= limit) break
      }
    }
    ymd = addCalendarDaysYmd(ymd, 1, timezone)
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime())
  return results.slice(0, limit)
}
