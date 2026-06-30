/**
 * Server-only: expand teams for a match when RSVPs exist (1+ RSVP so the first person sees their team).
 * Also adds more teams when count warrants it (e.g. 3rd team when 23+ RSVPs).
 * Called after an RSVP is created (or by admin when creating a team later).
 */

import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore, QuerySnapshot } from 'firebase-admin/firestore'
import {
  assignUnassignedPlayersToTeams,
  computeTeamCountForRSVPCount,
  generateTeamsWithReplacements,
} from '@/lib/utils/teamGenerator'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

const TEAM_COLORS = [
  '#f97316',
  '#3b82f6',
  '#eab308',
  '#65a30d',
  '#ef4444',
  '#8b5cf6',
]
const TEAM_NAMES = ['Orange', 'Blue', 'Yellow', 'Lime', 'Red', 'Purple']

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

interface ExistingTeamDoc {
  id: string
  teamNumber: number
  name: string
  color: string
  playerIds: string[]
}

async function incrementallyAssignUnassignedPlayers(
  adminDb: Firestore,
  matchId: string,
  existingTeams: ExistingTeamDoc[],
  rsvpsToUse: RSVP[],
  users: User[],
  desiredTeamCount: number
): Promise<void> {
  const assignedUserIds = new Set(
    existingTeams.flatMap(t => t.playerIds)
  )
  const unassignedRsvps = rsvpsToUse.filter(
    r => !assignedUserIds.has(r.userId)
  )
  if (unassignedRsvps.length === 0 && existingTeams.length >= desiredTeamCount) {
    return
  }

  const existingAssignments = existingTeams.map(t => ({
    teamNumber: t.teamNumber,
    playerIds: t.playerIds,
  }))
  const updatedAssignments = assignUnassignedPlayersToTeams(
    existingAssignments,
    unassignedRsvps,
    rsvpsToUse,
    users,
    11,
    desiredTeamCount
  )

  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const existingByNumber = new Map(
    existingTeams.map(t => [t.teamNumber, t])
  )
  const now = Timestamp.now()
  const writes: Promise<unknown>[] = []

  for (let i = 0; i < updatedAssignments.length; i++) {
    const assignment = updatedAssignments[i]
    const existing = existingByNumber.get(assignment.teamNumber)
    if (existing) {
      const playerIdsChanged =
        existing.playerIds.length !== assignment.playerIds.length ||
        existing.playerIds.some((id, idx) => id !== assignment.playerIds[idx])
      if (playerIdsChanged) {
        writes.push(
          teamsCol.doc(existing.id).update({
            playerIds: assignment.playerIds,
            updatedAt: now,
          })
        )
      }
      continue
    }

    const teamId = `team_${matchId}_${assignment.teamNumber}_${Date.now()}`
    writes.push(
      teamsCol.doc(teamId).set({
        matchId,
        teamNumber: assignment.teamNumber,
        name:
          TEAM_NAMES[i % TEAM_NAMES.length] ?? `Team ${assignment.teamNumber}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length] ?? '#3b82f6',
        playerIds: assignment.playerIds,
        maxSize: 11,
        createdAt: now,
        updatedAt: now,
      })
    )
  }

  await Promise.all(writes)
}

async function fullyRegenerateTeams(
  adminDb: Firestore,
  matchId: string,
  existingTeamsSnap: QuerySnapshot,
  rsvpsToUse: RSVP[],
  users: User[],
  desiredTeamCount: number
): Promise<void> {
  const { teams: teamAssignments, gkReplacements } =
    generateTeamsWithReplacements(rsvpsToUse, users, 11, {
      teamCount: desiredTeamCount,
    })

  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)

  const batch = adminDb.batch()
  existingTeamsSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()

  const now = Timestamp.now()
  const gkReplacementsMap: Record<string, string> = {}
  for (const r of gkReplacements) {
    gkReplacementsMap[r.insertedGK] = r.removedPlayer
  }
  if (Object.keys(gkReplacementsMap).length > 0) {
    await adminDb
      .collection('matches')
      .doc(matchId)
      .set(
        { gkReplacements: gkReplacementsMap, updatedAt: now },
        { merge: true }
      )
  }

  const writes: Promise<unknown>[] = []
  for (let i = 0; i < teamAssignments.length; i++) {
    const assignment = teamAssignments[i]
    const teamId = `team_${matchId}_${assignment.teamNumber}_${Date.now()}`
    writes.push(
      teamsCol.doc(teamId).set({
        matchId,
        teamNumber: assignment.teamNumber,
        name:
          TEAM_NAMES[i % TEAM_NAMES.length] ?? `Team ${assignment.teamNumber}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length] ?? '#3b82f6',
        playerIds: assignment.playerIds,
        maxSize: 11,
        createdAt: now,
        updatedAt: now,
      })
    )
  }

  await Promise.all(writes)
}

export async function expandTeamsForMatch(
  adminDb: Firestore,
  matchId: string,
  options?: { forceRegenerate?: boolean }
): Promise<{ regenerated: boolean }> {
  const rsvpSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  const rsvpsToUse: RSVP[] = rsvpSnap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      matchId: data.matchId ?? matchId,
      userId: data.userId,
      status: data.status ?? 'confirmed',
      position: data.position ?? null,
      rsvpAt: timestampToDate(data.rsvpAt) || new Date(),
      updatedAt: timestampToDate(data.updatedAt) || new Date(),
    }
  })

  if (rsvpsToUse.length < 1) {
    return { regenerated: false }
  }

  const existingTeamsSnap = await adminDb
    .collection(`matches/${matchId}/teams`)
    .get()
  const currentTeamCount = existingTeamsSnap.size
  const totalAssigned = existingTeamsSnap.docs.reduce(
    (sum, d) => sum + ((d.data().playerIds as string[])?.length ?? 0),
    0
  )

  const desiredTeamCount =
    rsvpsToUse.length === 1
      ? 1
      : computeTeamCountForRSVPCount(rsvpsToUse.length, 11, 2)
  const needMoreTeams = currentTeamCount < desiredTeamCount
  const hasUnassignedRsvps = totalAssigned < rsvpsToUse.length
  const forceRegenerate = options?.forceRegenerate === true

  if (!forceRegenerate && !needMoreTeams && !hasUnassignedRsvps) {
    return { regenerated: false }
  }

  const usersSnap = await adminDb.collection('users').get()
  const users: User[] = usersSnap.docs.map(d => {
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

  if (forceRegenerate || currentTeamCount === 0) {
    await fullyRegenerateTeams(
      adminDb,
      matchId,
      existingTeamsSnap,
      rsvpsToUse,
      users,
      desiredTeamCount
    )
    return { regenerated: true }
  }

  const existingTeams: ExistingTeamDoc[] = existingTeamsSnap.docs
    .map(d => {
      const data = d.data()
      return {
        id: d.id,
        teamNumber: (data.teamNumber as number) ?? 0,
        name: (data.name as string) ?? '',
        color: (data.color as string) ?? '#3b82f6',
        playerIds: (data.playerIds as string[]) ?? [],
      }
    })
    .sort((a, b) => a.teamNumber - b.teamNumber)

  await incrementallyAssignUnassignedPlayers(
    adminDb,
    matchId,
    existingTeams,
    rsvpsToUse,
    users,
    desiredTeamCount
  )
  return { regenerated: true }
}
