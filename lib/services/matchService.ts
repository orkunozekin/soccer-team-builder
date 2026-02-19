import {
  createDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  timestampToDate,
  dateToTimestamp,
} from '@/lib/firebase/firestore'
import { where, orderBy } from 'firebase/firestore'
import { Match, MatchFirestore } from '@/types/match'
import { shouldRSVPBeOpen } from '@/lib/utils/rsvpScheduler'

export const createMatch = async (
  date: Date,
  time: string,
  rsvpOpen: boolean = false,
  rsvpOpenAt: Date | null = null,
  rsvpCloseAt: Date | null = null
): Promise<string> => {
  const matchId = `match_${Date.now()}`
  const matchData: Omit<MatchFirestore, 'id' | 'createdAt' | 'updatedAt'> = {
    date: dateToTimestamp(date)!,
    time,
    rsvpOpen,
    rsvpOpenAt: rsvpOpenAt ? dateToTimestamp(rsvpOpenAt) : null,
    rsvpCloseAt: rsvpCloseAt ? dateToTimestamp(rsvpCloseAt) : null,
  }

  await createDocument('matches', matchId, matchData)
  return matchId
}

export const getMatch = async (matchId: string): Promise<Match | null> => {
  const matchDoc = await getDocument('matches', matchId)
  if (!matchDoc) return null

  const matchDate = timestampToDate(matchDoc.date) || new Date()
  const rsvpOpenAt = matchDoc.rsvpOpenAt ? timestampToDate(matchDoc.rsvpOpenAt) : null
  const rsvpCloseAt = matchDoc.rsvpCloseAt ? timestampToDate(matchDoc.rsvpCloseAt) : null

  // Check if RSVP should be open based on schedule
  const shouldBeOpen = shouldRSVPBeOpen(matchDate, rsvpOpenAt, rsvpCloseAt)
  
  // If manual override is not set, update RSVP status based on schedule
  const rsvpOpen = rsvpOpenAt && rsvpCloseAt 
    ? matchDoc.rsvpOpen 
    : shouldBeOpen

  return {
    id: matchId,
    date: matchDate,
    time: matchDoc.time,
    rsvpOpen,
    rsvpOpenAt,
    rsvpCloseAt,
    createdAt: timestampToDate(matchDoc.createdAt) || new Date(),
    updatedAt: timestampToDate(matchDoc.updatedAt) || new Date(),
  }
}

export const getAllMatches = async (): Promise<Match[]> => {
  const matches = await queryDocuments('matches', [
    orderBy('date', 'asc'),
    orderBy('time', 'asc'),
  ])

  return matches.map((match: any) => {
    const matchDate = timestampToDate(match.date) || new Date()
    const rsvpOpenAt = match.rsvpOpenAt ? timestampToDate(match.rsvpOpenAt) : null
    const rsvpCloseAt = match.rsvpCloseAt ? timestampToDate(match.rsvpCloseAt) : null

    // Check if RSVP should be open based on schedule
    const shouldBeOpen = shouldRSVPBeOpen(matchDate, rsvpOpenAt, rsvpCloseAt)
    
    // If manual override is not set, update RSVP status based on schedule
    const rsvpOpen = rsvpOpenAt && rsvpCloseAt 
      ? match.rsvpOpen 
      : shouldBeOpen

    return {
      id: match.id,
      date: matchDate,
      time: match.time,
      rsvpOpen,
      rsvpOpenAt,
      rsvpCloseAt,
      createdAt: timestampToDate(match.createdAt) || new Date(),
      updatedAt: timestampToDate(match.updatedAt) || new Date(),
    }
  })
}

export const updateMatch = async (
  matchId: string,
  updates: Partial<Pick<Match, 'date' | 'time' | 'rsvpOpen' | 'rsvpOpenAt' | 'rsvpCloseAt'>>
): Promise<void> => {
  const firestoreUpdates: any = {}
  
  if (updates.date !== undefined) {
    firestoreUpdates.date = dateToTimestamp(updates.date)
  }
  if (updates.time !== undefined) {
    firestoreUpdates.time = updates.time
  }
  if (updates.rsvpOpen !== undefined) {
    firestoreUpdates.rsvpOpen = updates.rsvpOpen
  }
  if (updates.rsvpOpenAt !== undefined) {
    firestoreUpdates.rsvpOpenAt = updates.rsvpOpenAt ? dateToTimestamp(updates.rsvpOpenAt) : null
  }
  if (updates.rsvpCloseAt !== undefined) {
    firestoreUpdates.rsvpCloseAt = updates.rsvpCloseAt ? dateToTimestamp(updates.rsvpCloseAt) : null
  }

  await updateDocument('matches', matchId, firestoreUpdates)
}

export const deleteMatch = async (matchId: string): Promise<void> => {
  await deleteDocument('matches', matchId)
}
