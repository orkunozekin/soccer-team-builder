import { orderBy, where } from 'firebase/firestore/lite'
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
    clubId: (match.clubId as string | null | undefined) ?? null,
    rsvpOpen: match.rsvpOpen === true,
    rsvpOpenAt,
    rsvpCloseAt,
    deletedAt,
    scheduleId: (match.scheduleId as string | null | undefined) ?? null,
    scheduleSlotId: (match.scheduleSlotId as string | null | undefined) ?? null,
    scheduleOccurrenceKey:
      (match.scheduleOccurrenceKey as string | null | undefined) ?? null,
    rsvpConfirmedCount:
      typeof match.rsvpConfirmedCount === 'number'
        ? match.rsvpConfirmedCount
        : null,
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

/**
 * Load specific matches by id. Prefer this over {@link getAllMatches} when the
 * caller already knows which match ids it needs (e.g. a user's RSVP history).
 */
export const getMatchesByIds = async (
  matchIds: string[],
  options?: { includeDeleted?: boolean }
): Promise<Match[]> => {
  const uniqueIds = Array.from(
    new Set(matchIds.filter((id): id is string => Boolean(id)))
  )
  if (uniqueIds.length === 0) return []

  const matches = await Promise.all(
    uniqueIds.map(async id => {
      const matchDoc = await getDocument('matches', id)
      if (!matchDoc) return null
      const match = mapDocToMatch(matchDoc, id)
      if (!options?.includeDeleted && match.deletedAt) return null
      return match
    })
  )

  return matches.filter((m): m is Match => m != null)
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

function finalizeMatchList(
  docs: Record<string, unknown>[],
  options?: { includeDeleted?: boolean }
): Match[] {
  const byId = new Map<string, Match>()
  for (const match of docs) {
    const id = (match.id as string) || ''
    if (!id || byId.has(id)) continue
    byId.set(id, mapDocToMatch(match, id))
  }

  const list = Array.from(byId.values())
  const filtered = options?.includeDeleted
    ? list
    : list.filter(m => m.deletedAt == null)

  filtered.sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime()
    if (dateCompare !== 0) return dateCompare
    return (a.time || '').localeCompare(b.time || '')
  })
  return filtered
}

/**
 * Club-scoped match list for members (and super users viewing one club).
 * Queries `clubId == clubId` only (no orderBy) so it works without a composite
 * index; sorting is done client-side in {@link finalizeMatchList}.
 *
 * Does not attempt to load unscoped / missing-`clubId` docs: those remain
 * visible to super users via {@link getAllMatches} / the all-clubs list.
 */
export const getMatchesForClub = async (
  clubId: string,
  options?: { includeDeleted?: boolean }
): Promise<Match[]> => {
  const trimmed = clubId.trim()
  if (!trimmed) return []

  // Equality-only query: avoids requiring a clubId+date composite index that
  // may not be deployed yet. finalizeMatchList sorts by date/time.
  const clubDocs = await queryDocuments('matches', [
    where('clubId', '==', trimmed),
  ])

  return finalizeMatchList(clubDocs, options)
}

/**
 * Load matches the viewer is allowed to query under Firestore rules.
 * - Super user, no club: full collection (authorized for operators).
 * - Otherwise: club-scoped `clubId` query only.
 */
export const listMatchesForViewer = async (input: {
  clubId: string | null
  isSuperUser: boolean
  includeDeleted?: boolean
}): Promise<Match[]> => {
  const preferred = typeof input.clubId === 'string' ? input.clubId.trim() : ''

  if (input.isSuperUser && !preferred) {
    return getAllMatches({ includeDeleted: input.includeDeleted })
  }

  if (!preferred) {
    // Members without a club context: do not run an unqualified matches query.
    return []
  }

  return getMatchesForClub(preferred, {
    includeDeleted: input.includeDeleted,
  })
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
