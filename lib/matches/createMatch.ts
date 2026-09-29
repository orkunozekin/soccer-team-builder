import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { serializeMatchLocation } from '@/lib/utils/location'
import { getRSVPSchedule } from '@/lib/utils/rsvpScheduler'
import type { MatchLocation } from '@/types/match'

export type CreateMatchInput = {
  date: Date
  time: string
  location?: MatchLocation | null
  clubId?: string | null
  scheduleId?: string | null
  scheduleSlotId?: string | null
  scheduleOccurrenceKey?: string | null
}

/**
 * Create a match document via Admin SDK. Shared by POST /api/matches and schedule materialization.
 */
export async function createMatchDoc(
  input: CreateMatchInput
): Promise<{ matchId: string }> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    throw new Error('Firebase Admin not configured')
  }

  const { openAt, closeAt } = getRSVPSchedule(input.date, input.time)
  const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Timestamp.now()
  const locationValue = serializeMatchLocation(input.location ?? null)

  const matchRef = adminDb.collection('matches').doc(matchId)
  const stateRef = matchRef.collection('_state').doc('rsvp')
  const batch = adminDb.batch()
  batch.set(matchRef, {
    date: Timestamp.fromDate(input.date),
    time: input.time,
    location: locationValue,
    clubId: input.clubId ?? null,
    rsvpOpen: false,
    rsvpOpenAt: openAt ? Timestamp.fromDate(openAt) : null,
    rsvpCloseAt: closeAt ? Timestamp.fromDate(closeAt) : null,
    deletedAt: null,
    scheduleId: input.scheduleId ?? null,
    scheduleSlotId: input.scheduleSlotId ?? null,
    scheduleOccurrenceKey: input.scheduleOccurrenceKey ?? null,
    rsvpConfirmedCount: 0,
    createdAt: now,
    updatedAt: now,
  })
  batch.set(stateRef, {
    confirmedCount: 0,
    gkCount: 0,
    updatedAt: now,
  })
  await batch.commit()

  return { matchId }
}
