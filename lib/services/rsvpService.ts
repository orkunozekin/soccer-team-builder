import { where } from 'firebase/firestore/lite'
import {
  createDocument,
  deleteDocument,
  getCollectionCount,
  getDocument,
  queryDocuments,
  timestampToDate,
  updateDocument,
} from '@/lib/firebase/firestore'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'
import { CheckInMethod, RSVP, RSVPStatus } from '@/types/rsvp'

function mapRsvpDoc(rsvp: Record<string, unknown>): RSVP {
  const checkedInAt = rsvp.checkedInAt
    ? timestampToDate(rsvp.checkedInAt as never)
    : null
  return {
    id: rsvp.id as string,
    matchId: rsvp.matchId as string,
    userId: rsvp.userId as string,
    status: rsvp.status as RSVPStatus,
    position: (rsvp.position as string | null) ?? null,
    jerseyNumber: normalizeJerseyNumber(rsvp.jerseyNumber),
    attended: typeof rsvp.attended === 'boolean' ? rsvp.attended : null,
    checkedInAt,
    checkInMethod: (rsvp.checkInMethod as CheckInMethod | null) ?? null,
    rsvpAt: timestampToDate(rsvp.rsvpAt as never) || new Date(),
    updatedAt: timestampToDate(rsvp.updatedAt as never) || new Date(),
  }
}

export const createRSVP = async (
  matchId: string,
  userId: string
): Promise<string> => {
  const rsvpId = `rsvp_${matchId}_${userId}_${Date.now()}`
  const rsvpData = {
    matchId,
    userId,
    status: 'confirmed' as RSVPStatus,
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
  }

  await createDocument('rsvps', rsvpId, rsvpData)
  return rsvpId
}

export const getRSVP = async (rsvpId: string): Promise<RSVP | null> => {
  const rsvpDoc = await getDocument('rsvps', rsvpId)
  if (!rsvpDoc) return null
  return mapRsvpDoc({ ...rsvpDoc, id: rsvpId })
}

export const getUserRSVP = async (
  matchId: string,
  userId: string
): Promise<RSVP | null> => {
  const rsvps = await queryDocuments('rsvps', [
    where('matchId', '==', matchId),
    where('userId', '==', userId),
    where('status', '==', 'confirmed'),
  ])

  if (rsvps.length === 0) return null

  const rsvp = rsvps[0] as Record<string, unknown>
  return mapRsvpDoc(rsvp)
}

export const getMatchRSVPs = async (matchId: string): Promise<RSVP[]> => {
  const rsvps = await queryDocuments('rsvps', [
    where('matchId', '==', matchId),
    where('status', '==', 'confirmed'),
  ])

  return rsvps.map((rsvp: Record<string, unknown>) => mapRsvpDoc(rsvp))
}

/** All RSVPs for a user (any match), for attendance stats. */
export const getUserRSVPs = async (userId: string): Promise<RSVP[]> => {
  const rsvps = await queryDocuments('rsvps', [where('userId', '==', userId)])
  return rsvps.map((rsvp: Record<string, unknown>) => mapRsvpDoc(rsvp))
}

/**
 * Returns the number of confirmed RSVPs for a match.
 * Uses a count aggregation (~1 read) instead of loading every RSVP doc.
 * Prefer {@link Match.rsvpConfirmedCount} from an already-loaded match when present.
 */
export const getMatchRsvpCount = async (matchId: string): Promise<number> => {
  return getCollectionCount('rsvps', [
    where('matchId', '==', matchId),
    where('status', '==', 'confirmed'),
  ])
}

export const cancelRSVP = async (rsvpId: string): Promise<void> => {
  await updateDocument('rsvps', rsvpId, { status: 'cancelled' as RSVPStatus })
}

export const deleteRSVP = async (rsvpId: string): Promise<void> => {
  await deleteDocument('rsvps', rsvpId)
}
