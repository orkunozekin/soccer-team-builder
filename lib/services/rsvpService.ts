import { where } from 'firebase/firestore'
import {
  createDocument,
  deleteDocument,
  getDocument,
  queryDocuments,
  timestampToDate,
  updateDocument,
} from '@/lib/firebase/firestore'
import { RSVP, RSVPStatus } from '@/types/rsvp'

export const createRSVP = async (
  matchId: string,
  userId: string
): Promise<string> => {
  const rsvpId = `rsvp_${matchId}_${userId}_${Date.now()}`
  const rsvpData = {
    matchId,
    userId,
    status: 'confirmed' as RSVPStatus,
  }

  await createDocument('rsvps', rsvpId, rsvpData)
  return rsvpId
}

export const getRSVP = async (rsvpId: string): Promise<RSVP | null> => {
  const rsvpDoc = await getDocument('rsvps', rsvpId)
  if (!rsvpDoc) return null

  return {
    id: rsvpId,
    matchId: rsvpDoc.matchId,
    userId: rsvpDoc.userId,
    status: rsvpDoc.status,
    position: rsvpDoc.position ?? null,
    rsvpAt: timestampToDate(rsvpDoc.rsvpAt) || new Date(),
    updatedAt: timestampToDate(rsvpDoc.updatedAt) || new Date(),
  }
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

  const rsvp = rsvps[0] as any
  return {
    id: rsvp.id,
    matchId: rsvp.matchId,
    userId: rsvp.userId,
    status: rsvp.status,
    position: rsvp.position ?? null,
    rsvpAt: timestampToDate(rsvp.rsvpAt) || new Date(),
    updatedAt: timestampToDate(rsvp.updatedAt) || new Date(),
  }
}

export const getMatchRSVPs = async (matchId: string): Promise<RSVP[]> => {
  const rsvps = await queryDocuments('rsvps', [
    where('matchId', '==', matchId),
    where('status', '==', 'confirmed'),
  ])

  return rsvps.map((rsvp: any) => ({
    id: rsvp.id,
    matchId: rsvp.matchId,
    userId: rsvp.userId,
    status: rsvp.status,
    position: rsvp.position ?? null,
    rsvpAt: timestampToDate(rsvp.rsvpAt) || new Date(),
    updatedAt: timestampToDate(rsvp.updatedAt) || new Date(),
  }))
}

/** Returns the number of confirmed RSVPs for a match. */
export const getMatchRsvpCount = async (matchId: string): Promise<number> => {
  const rsvps = await queryDocuments('rsvps', [
    where('matchId', '==', matchId),
    where('status', '==', 'confirmed'),
  ])
  return rsvps.length
}

export const cancelRSVP = async (rsvpId: string): Promise<void> => {
  await updateDocument('rsvps', rsvpId, { status: 'cancelled' as RSVPStatus })
}

export const deleteRSVP = async (rsvpId: string): Promise<void> => {
  await deleteDocument('rsvps', rsvpId)
}
