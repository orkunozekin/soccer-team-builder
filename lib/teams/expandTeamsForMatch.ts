/**
 * Server-only: expand teams for a match when RSVP count warrants it (e.g. 3rd team when 23+ RSVPs).
 * Called after an RSVP is created (or by admin when creating a team later).
 */

import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { computeTeamCountForRSVPCount, generateTeams } from '@/lib/utils/teamGenerator'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

const TEAM_COLORS = ['#f97316', '#3b82f6', '#eab308', '#65a30d', '#ef4444', '#8b5cf6']
const TEAM_NAMES = ['Orange', 'Blue', 'Yellow', 'Lime', 'Red', 'Purple']

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

export async function expandTeamsForMatch(
  adminDb: Firestore,
  matchId: string
): Promise<{ regenerated: boolean }> {
  const rsvpSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  const rsvpsToUse: RSVP[] = rsvpSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      matchId: data.matchId ?? matchId,
      userId: data.userId,
      status: data.status ?? 'confirmed',
      rsvpAt: timestampToDate(data.rsvpAt) || new Date(),
      updatedAt: timestampToDate(data.updatedAt) || new Date(),
    }
  })

  if (rsvpsToUse.length < 2) {
    return { regenerated: false }
  }

  const existingTeamsSnap = await adminDb.collection(`matches/${matchId}/teams`).get()
  const currentTeamCount = existingTeamsSnap.size
  const totalAssigned = existingTeamsSnap.docs.reduce(
    (sum, d) => sum + ((d.data().playerIds as string[])?.length ?? 0),
    0
  )

  const desiredTeamCount = computeTeamCountForRSVPCount(rsvpsToUse.length, 11, 2)
  const needMoreTeams = currentTeamCount < desiredTeamCount
  const hasUnassignedRsvps = totalAssigned < rsvpsToUse.length

  if (!needMoreTeams && !hasUnassignedRsvps) {
    return { regenerated: false }
  }

  const usersSnap = await adminDb.collection('users').get()
  const users: User[] = usersSnap.docs.map((d) => {
    const data = d.data()
    return {
      uid: data.uid ?? d.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      jerseyNumber: data.jerseyNumber ?? null,
      position: data.position ?? null,
      role: data.role || 'user',
      createdAt: timestampToDate(data.createdAt) || new Date(),
      updatedAt: timestampToDate(data.updatedAt) || new Date(),
    }
  })

  const teamAssignments = generateTeams(rsvpsToUse, users, 11, {
    teamCount: desiredTeamCount,
  })

  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)

  const batch = adminDb.batch()
  existingTeamsSnap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()

  const now = Timestamp.now()
  const writes: Promise<unknown>[] = []
  for (let i = 0; i < teamAssignments.length; i++) {
    const assignment = teamAssignments[i]
    const teamId = `team_${matchId}_${assignment.teamNumber}_${Date.now()}`
    writes.push(
      teamsCol.doc(teamId).set({
        matchId,
        teamNumber: assignment.teamNumber,
        name: TEAM_NAMES[i % TEAM_NAMES.length] ?? `Team ${assignment.teamNumber}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length] ?? '#3b82f6',
        playerIds: assignment.playerIds,
        maxSize: 11,
        createdAt: now,
        updatedAt: now,
      })
    )
  }

  await Promise.all(writes)
  return { regenerated: true }
}
