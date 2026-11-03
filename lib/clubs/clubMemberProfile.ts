import { getAdminDb } from '@/lib/firebase/admin'
import { membershipDocId } from '@/lib/services/clubService'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'
import { parseMatchLocation } from '@/lib/utils/location'
import type { ClubMembershipRole } from '@/types/club'
import type { MatchLocation } from '@/types/match'
import type { CheckInMethod, RSVPStatus } from '@/types/rsvp'

/** JSON-safe member profile for `/c/[slug]/roster/[userId]` (dates as ISO). */
export type ClubMemberProfileDTO = {
  member: {
    userId: string
    displayName: string
    email: string
    jerseyNumber: number | null
    position: string | null
    clubRole: ClubMembershipRole
    joinedAt: string
  }
  rsvps: {
    id: string
    matchId: string
    userId: string
    status: RSVPStatus
    position: string | null
    jerseyNumber: number | null
    attended: boolean | null
    checkedInAt: string | null
    checkInMethod: CheckInMethod | null
    rsvpAt: string
    updatedAt: string
  }[]
  matches: {
    id: string
    date: string
    time: string
    location: MatchLocation | null
  }[]
}

type FirestoreTime = { toDate?: () => Date } | null | undefined

function toIso(value: unknown, fallback: Date = new Date(0)): string {
  return ((value as FirestoreTime)?.toDate?.() ?? fallback).toISOString()
}

const GET_ALL_CHUNK = 100

/**
 * Profile and RSVP history of one active member, limited to this club's
 * matches so club admins never see a player's activity in other clubs.
 * Returns null when the user is not an active member of the club.
 */
export async function getClubMemberProfile(
  clubId: string,
  userId: string
): Promise<ClubMemberProfileDTO | null> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const membershipSnap = await adminDb
    .collection('clubMemberships')
    .doc(membershipDocId(clubId, userId))
    .get()
  const membership = membershipSnap.data()
  if (
    !membershipSnap.exists ||
    !membership ||
    membership.clubId !== clubId ||
    membership.userId !== userId ||
    membership.status !== 'active'
  ) {
    return null
  }

  const [userSnap, rsvpSnap] = await Promise.all([
    adminDb.collection('users').doc(userId).get(),
    adminDb.collection('rsvps').where('userId', '==', userId).get(),
  ])
  const user = userSnap.data() ?? {}

  const matchIds = Array.from(
    new Set(
      rsvpSnap.docs
        .map(doc => doc.data().matchId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  )
  const matches: ClubMemberProfileDTO['matches'] = []
  for (let i = 0; i < matchIds.length; i += GET_ALL_CHUNK) {
    const refs = matchIds
      .slice(i, i + GET_ALL_CHUNK)
      .map(id => adminDb.collection('matches').doc(id))
    const snaps = await adminDb.getAll(...refs)
    for (const snap of snaps) {
      const data = snap.data()
      if (!snap.exists || !data || data.clubId !== clubId) continue
      matches.push({
        id: snap.id,
        date: toIso(data.date),
        time: typeof data.time === 'string' ? data.time : '',
        location: parseMatchLocation(data.location),
      })
    }
  }

  const clubMatchIds = new Set(matches.map(m => m.id))
  const rsvps: ClubMemberProfileDTO['rsvps'] = rsvpSnap.docs
    .filter(doc => clubMatchIds.has(doc.data().matchId))
    .map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        matchId: data.matchId as string,
        userId,
        status: data.status as RSVPStatus,
        position: (data.position as string | null | undefined) ?? null,
        jerseyNumber: normalizeJerseyNumber(data.jerseyNumber),
        attended: typeof data.attended === 'boolean' ? data.attended : null,
        checkedInAt: data.checkedInAt ? toIso(data.checkedInAt) : null,
        checkInMethod:
          (data.checkInMethod as CheckInMethod | null | undefined) ?? null,
        rsvpAt: toIso(data.rsvpAt),
        updatedAt: toIso(data.updatedAt),
      }
    })

  const email = typeof user.email === 'string' ? user.email : ''
  const displayName =
    (typeof user.displayName === 'string' && user.displayName.trim()) ||
    email ||
    userId

  return {
    member: {
      userId,
      displayName,
      email,
      jerseyNumber: normalizeJerseyNumber(user.jerseyNumber),
      position: typeof user.position === 'string' ? user.position : null,
      clubRole: membership.role === 'club_admin' ? 'club_admin' : 'player',
      joinedAt: toIso(membership.joinedAt),
    },
    rsvps,
    matches,
  }
}
