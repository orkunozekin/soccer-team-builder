import {
  getDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  timestampToDate,
  dateToTimestamp,
} from '@/lib/firebase/firestore'
import { orderBy } from 'firebase/firestore'
import { Match } from '@/types/match'

export const getMatch = async (matchId: string): Promise<Match | null> => {
  const matchDoc = await getDocument('matches', matchId)
  if (!matchDoc) return null

  const matchDate = timestampToDate(matchDoc.date) || new Date()
  const rsvpOpenAt = matchDoc.rsvpOpenAt ? timestampToDate(matchDoc.rsvpOpenAt) : null
  const rsvpCloseAt = matchDoc.rsvpCloseAt ? timestampToDate(matchDoc.rsvpCloseAt) : null

  // UI reflects admin intent: show Open when they've opened the poll (schedule is 6am–10pm CT for reference only)
  const rsvpOpen = matchDoc.rsvpOpen === true

  return {
    id: matchId,
    date: matchDate,
    time: matchDoc.time,
    location: matchDoc.location ?? null,
    rsvpOpen,
    rsvpOpenAt,
    rsvpCloseAt,
    createdAt: timestampToDate(matchDoc.createdAt) || new Date(),
    updatedAt: timestampToDate(matchDoc.updatedAt) || new Date(),
  }
}

export const getAllMatches = async (): Promise<Match[]> => {
  // Single orderBy to avoid requiring a composite index; sort by time in memory
  const matches = await queryDocuments('matches', [orderBy('date', 'asc')])

  const mapped = matches.map((match: any) => {
    const matchDate = timestampToDate(match.date) || new Date()
    const rsvpOpenAt = match.rsvpOpenAt ? timestampToDate(match.rsvpOpenAt) : null
    const rsvpCloseAt = match.rsvpCloseAt ? timestampToDate(match.rsvpCloseAt) : null

    const rsvpOpen = match.rsvpOpen === true

    return {
      id: match.id,
      date: matchDate,
      time: match.time ?? '',
      location: match.location ?? null,
      rsvpOpen,
      rsvpOpenAt,
      rsvpCloseAt,
      createdAt: timestampToDate(match.createdAt) || new Date(),
      updatedAt: timestampToDate(match.updatedAt) || new Date(),
    }
  })

  mapped.sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime()
    if (dateCompare !== 0) return dateCompare
    return (a.time || '').localeCompare(b.time || '')
  })

  return mapped
}

export const updateMatch = async (
  matchId: string,
  updates: Partial<Pick<Match, 'date' | 'time' | 'location' | 'rsvpOpen' | 'rsvpOpenAt' | 'rsvpCloseAt'>>
): Promise<void> => {
  const firestoreUpdates: any = {}
  
  if (updates.date !== undefined) {
    firestoreUpdates.date = dateToTimestamp(updates.date)
  }
  if (updates.time !== undefined) {
    firestoreUpdates.time = updates.time
  }
  if (updates.location !== undefined) {
    firestoreUpdates.location = typeof updates.location === 'string' ? updates.location.trim() || null : null
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
