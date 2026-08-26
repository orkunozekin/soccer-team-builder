import { Timestamp } from 'firebase-admin/firestore'
import { createMatchDoc } from '@/lib/matches/createMatch'
import { getAdminDb } from '@/lib/firebase/admin'
import { generateOccurrences } from '@/lib/schedules/occurrences'
import { parseMatchLocation } from '@/lib/utils/location'
import { getRSVPSchedule, isMatchPast } from '@/lib/utils/rsvpScheduler'
import type { MatchSchedule, ScheduleSlot } from '@/types/schedule'
import { SCHEDULE_LOOKAHEAD, SCHEDULE_TIMEZONE } from '@/types/schedule'

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

function mapScheduleDoc(
  id: string,
  data: Record<string, unknown>
): MatchSchedule {
  const slots = Array.isArray(data.slots)
    ? (data.slots as ScheduleSlot[]).map(s => ({
        id: String(s.id),
        day: Number(s.day),
        time: String(s.time),
        location: parseMatchLocation(s.location),
      }))
    : []

  return {
    id,
    name: String(data.name ?? ''),
    cadence: data.cadence === 'monthly' ? 'monthly' : 'weekly',
    interval: Math.max(1, Number(data.interval) || 1),
    timezone: String(data.timezone || SCHEDULE_TIMEZONE),
    slots,
    active: data.active === true,
    createdAt: timestampToDate(data.createdAt as Timestamp | Date | null) || new Date(),
    updatedAt: timestampToDate(data.updatedAt as Timestamp | Date | null) || new Date(),
    createdBy: String(data.createdBy ?? ''),
  }
}

export type MaterializeResult = {
  scheduleId: string
  upcomingBefore: number
  created: number
  matchIds: string[]
}

/**
 * Ensure an active schedule has SCHEDULE_LOOKAHEAD upcoming non-deleted matches.
 */
export async function materializeSchedule(
  scheduleId: string,
  now: Date = new Date()
): Promise<MaterializeResult> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    throw new Error('Firebase Admin not configured')
  }

  const scheduleSnap = await adminDb.collection('schedules').doc(scheduleId).get()
  if (!scheduleSnap.exists) {
    throw new Error('Schedule not found')
  }

  const schedule = mapScheduleDoc(scheduleId, scheduleSnap.data()!)
  if (!schedule.active) {
    return {
      scheduleId,
      upcomingBefore: 0,
      created: 0,
      matchIds: [],
    }
  }

  const matchesSnap = await adminDb
    .collection('matches')
    .where('scheduleId', '==', scheduleId)
    .get()

  const existingKeys = new Set<string>()
  let upcomingCount = 0

  for (const doc of matchesSnap.docs) {
    const data = doc.data()
    const key =
      typeof data.scheduleOccurrenceKey === 'string'
        ? data.scheduleOccurrenceKey
        : null
    if (key) existingKeys.add(key)

    const deletedAt = timestampToDate(data.deletedAt)
    if (deletedAt) continue

    const matchDate = timestampToDate(data.date)
    if (!matchDate) continue
    const time = typeof data.time === 'string' ? data.time : null
    const { closeAt } = getRSVPSchedule(matchDate, time)
    const past = closeAt ? now > closeAt : isMatchPast(matchDate, time)
    if (!past) upcomingCount += 1
  }

  const upcomingBefore = upcomingCount
  if (upcomingCount >= SCHEDULE_LOOKAHEAD) {
    return {
      scheduleId,
      upcomingBefore,
      created: 0,
      matchIds: [],
    }
  }

  const needed = SCHEDULE_LOOKAHEAD - upcomingCount
  // Over-fetch candidates so we can skip keys that already exist
  const candidates = generateOccurrences(
    schedule,
    now,
    needed + existingKeys.size + 12
  )

  const matchIds: string[] = []
  for (const occ of candidates) {
    if (matchIds.length >= needed) break
    if (existingKeys.has(occ.occurrenceKey)) continue
    const { closeAt } = getRSVPSchedule(occ.date, occ.time)
    if (closeAt && now > closeAt) continue

    const { matchId } = await createMatchDoc({
      date: occ.date,
      time: occ.time,
      location: occ.location,
      scheduleId: schedule.id,
      scheduleSlotId: occ.slotId,
      scheduleOccurrenceKey: occ.occurrenceKey,
    })
    matchIds.push(matchId)
    existingKeys.add(occ.occurrenceKey)
  }

  return {
    scheduleId,
    upcomingBefore,
    created: matchIds.length,
    matchIds,
  }
}

/**
 * Materialize all active schedules.
 */
export async function materializeAllActiveSchedules(
  now: Date = new Date()
): Promise<{
  checked: number
  created: number
  results: MaterializeResult[]
}> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    throw new Error('Firebase Admin not configured')
  }

  const snap = await adminDb
    .collection('schedules')
    .where('active', '==', true)
    .get()

  const results: MaterializeResult[] = []
  let created = 0
  for (const doc of snap.docs) {
    const result = await materializeSchedule(doc.id, now)
    results.push(result)
    created += result.created
  }

  return { checked: snap.size, created, results }
}

export { mapScheduleDoc }
