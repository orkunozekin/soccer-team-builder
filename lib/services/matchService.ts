import { orderBy } from 'firebase/firestore'
import {
  dateToTimestamp,
  deleteDocument,
  getDocument,
  queryDocuments,
  timestampToDate,
  updateDocument,
} from '@/lib/firebase/firestore'
import {
  parseMatchLocation,
  serializeMatchLocation,
} from '@/lib/utils/location'
import { Match, MatchLocation } from '@/types/match'

export const getMatch = async (matchId: string): Promise<Match | null> => {
  const matchDoc = await getDocument('matches', matchId)
  if (!matchDoc) return null

  const matchDate = timestampToDate(matchDoc.date) || new Date()
  const rsvpOpenAt = matchDoc.rsvpOpenAt
    ? timestampToDate(matchDoc.rsvpOpenAt)
    : null
  const rsvpCloseAt = matchDoc.rsvpCloseAt
    ? timestampToDate(matchDoc.rsvpCloseAt)
    : null

  const rsvpOpen = matchDoc.rsvpOpen === true

  return {
    id: matchId,
    date: matchDate,
    time: matchDoc.time,
    location: parseMatchLocation(matchDoc.location),
    rsvpOpen,
    rsvpOpenAt,
    rsvpCloseAt,
    createdAt: timestampToDate(matchDoc.createdAt) || new Date(),
    updatedAt: timestampToDate(matchDoc.updatedAt) || new Date(),
  }
}

export const getAllMatches = async (): Promise<Match[]> => {
  const matches = await queryDocuments('matches', [orderBy('date', 'asc')])

  const mapped = matches.map((match: any) => {
    const matchDate = timestampToDate(match.date) || new Date()
    const rsvpOpenAt = match.rsvpOpenAt
      ? timestampToDate(match.rsvpOpenAt)
      : null
    const rsvpCloseAt = match.rsvpCloseAt
      ? timestampToDate(match.rsvpCloseAt)
      : null

    const rsvpOpen = match.rsvpOpen === true

    return {
      id: match.id,
      date: matchDate,
      time: match.time ?? '',
      location: parseMatchLocation(match.location),
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
  updates: Partial<
    Pick<
      Match,
      'date' | 'time' | 'location' | 'rsvpOpen' | 'rsvpOpenAt' | 'rsvpCloseAt'
    >
  >
): Promise<void> => {
  const firestoreUpdates: any = {}

  if (updates.date !== undefined) {
    firestoreUpdates.date = dateToTimestamp(updates.date)
  }
  if (updates.time !== undefined) {
    firestoreUpdates.time = updates.time
  }
  if (updates.location !== undefined) {
    firestoreUpdates.location = serializeMatchLocation(
      updates.location as MatchLocation | null
    )
  }
  if (updates.rsvpOpen !== undefined) {
    firestoreUpdates.rsvpOpen = updates.rsvpOpen
  }
  if (updates.rsvpOpenAt !== undefined) {
    firestoreUpdates.rsvpOpenAt = updates.rsvpOpenAt
      ? dateToTimestamp(updates.rsvpOpenAt)
      : null
  }
  if (updates.rsvpCloseAt !== undefined) {
    firestoreUpdates.rsvpCloseAt = updates.rsvpCloseAt
      ? dateToTimestamp(updates.rsvpCloseAt)
      : null
  }

  await updateDocument('matches', matchId, firestoreUpdates)
}

export const deleteMatch = async (matchId: string): Promise<void> => {
  await deleteDocument('matches', matchId)
}
