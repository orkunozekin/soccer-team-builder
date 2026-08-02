import { orderBy } from 'firebase/firestore'
import {
  dateToTimestamp,
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

function mapDocToMatch(match: Record<string, unknown>, id: string): Match {
  const matchDate = timestampToDate(match.date as never) || new Date()
  const rsvpOpenAt = match.rsvpOpenAt
    ? timestampToDate(match.rsvpOpenAt as never)
    : null
  const rsvpCloseAt = match.rsvpCloseAt
    ? timestampToDate(match.rsvpCloseAt as never)
    : null
  const deletedAt = match.deletedAt
    ? timestampToDate(match.deletedAt as never)
    : null

  return {
    id,
    date: matchDate,
    time: (match.time as string) ?? '',
    location: parseMatchLocation(match.location),
    rsvpOpen: match.rsvpOpen === true,
    rsvpOpenAt,
    rsvpCloseAt,
    deletedAt,
    createdAt: timestampToDate(match.createdAt as never) || new Date(),
    updatedAt: timestampToDate(match.updatedAt as never) || new Date(),
  }
}

export const getMatch = async (matchId: string): Promise<Match | null> => {
  const matchDoc = await getDocument('matches', matchId)
  if (!matchDoc) return null

  const match = mapDocToMatch(matchDoc, matchId)
  if (match.deletedAt) return null
  return match
}

export const getAllMatches = async (options?: {
  includeDeleted?: boolean
}): Promise<Match[]> => {
  const matches = await queryDocuments('matches', [orderBy('date', 'asc')])

  const mapped = matches.map((match: Record<string, unknown>) =>
    mapDocToMatch(match, (match.id as string) || '')
  )

  const filtered = options?.includeDeleted
    ? mapped
    : mapped.filter(m => m.deletedAt == null)

  filtered.sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime()
    if (dateCompare !== 0) return dateCompare
    return (a.time || '').localeCompare(b.time || '')
  })

  return filtered
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
  const firestoreUpdates: Record<string, unknown> = {}

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

/** Soft-delete a match from the client (sets deletedAt). Prefer the API in admin UI. */
export const deleteMatch = async (matchId: string): Promise<void> => {
  await updateDocument('matches', matchId, {
    deletedAt: dateToTimestamp(new Date()),
    rsvpOpen: false,
  })
}
