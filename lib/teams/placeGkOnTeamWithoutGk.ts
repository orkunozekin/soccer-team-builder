/**
 * Server-only: When a user updates their RSVP position to GK and they're not on
 * one of the first two teams (e.g. they RSVP'd after the initial 22), place them
 * on a team that has no GK by replacing the last person on that team (by RSVP time).
 * Only considers the first two teams; if both already have a GK, no placement.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

const TEAM_COLORS = ['#f97316', '#3b82f6', '#eab308', '#65a30d', '#ef4444', '#8b5cf6']
const TEAM_NAMES = ['Orange', 'Blue', 'Yellow', 'Lime', 'Red', 'Purple']

interface TeamDoc {
  id: string
  ref: DocumentReference
  teamNumber: number
  playerIds: string[]
  maxSize: number
}

/**
 * Place userId (new GK) on the first of teams 1 or 2 that has no GK, replacing the
 * last-added player on that team (by rsvpAt). If both of the first two teams
 * already have a GK, does nothing.
 * Removes userId from their current team if they're on one; sets match gkReplacements
 * so swapping back when they change position later works.
 */
export async function placeGkOnTeamWithoutGk(
  adminDb: Firestore,
  matchId: string,
  userId: string,
  rsvpPositionsByUserId: Map<string, string | null>,
  userPositionsByUserId: Map<string, string | null>
): Promise<{ placed: boolean; replacedUserId?: string; teamNumber?: number }> {
  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const teamsSnap = await teamsCol.orderBy('teamNumber').get()
  const teams: TeamDoc[] = teamsSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      ref: d.ref,
      teamNumber: (data.teamNumber as number) ?? 0,
      playerIds: (data.playerIds as string[]) ?? [],
      maxSize: (data.maxSize as number) ?? 11,
    }
  })

  const firstTwoTeams = teams.filter((t) => t.teamNumber === 1 || t.teamNumber === 2).sort((a, b) => a.teamNumber - b.teamNumber)
  if (firstTwoTeams.length === 0) return { placed: false }

  const userAlreadyOnFirstTwo = firstTwoTeams.some((t) => t.playerIds.includes(userId))
  if (userAlreadyOnFirstTwo) return { placed: false }

  const teamHasGk = (playerIds: string[]) =>
    playerIds.some((id) => isGoalkeeper(rsvpPositionsByUserId.get(id) ?? userPositionsByUserId.get(id) ?? null))

  let targetTeam: TeamDoc | null = null
  for (const t of firstTwoTeams) {
    if (t.playerIds.length > 0 && !teamHasGk(t.playerIds)) {
      targetTeam = t
      break
    }
  }
  if (!targetTeam) return { placed: false }

  const rsvpsSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  const rsvpAtByUserId = new Map<string, Date>()
  rsvpsSnap.docs.forEach((d) => {
    const data = d.data()
    const uid = data.userId as string
    const rsvpAt = data.rsvpAt?.toDate?.() ?? new Date(0)
    rsvpAtByUserId.set(uid, rsvpAt)
  })

  const lastOnTeam = [...targetTeam.playerIds].sort((a, b) => {
    const at = rsvpAtByUserId.get(b)?.getTime() ?? 0
    const bt = rsvpAtByUserId.get(a)?.getTime() ?? 0
    return at - bt
  })[0]
  if (!lastOnTeam) return { placed: false }

  const now = Timestamp.now()

  for (const t of teams) {
    if (t.playerIds.includes(userId)) {
      const newPlayerIds = t.playerIds.filter((id) => id !== userId)
      t.playerIds = newPlayerIds
      await t.ref.update({ playerIds: newPlayerIds, updatedAt: now })
      break
    }
  }

  const newPlayerIds = targetTeam.playerIds.map((id) => (id === lastOnTeam ? userId : id))
  await targetTeam.ref.update({ playerIds: newPlayerIds, updatedAt: now })

  const matchRef = adminDb.collection('matches').doc(matchId)
  const matchSnap = await matchRef.get()
  const existing = matchSnap.exists ? (matchSnap.data()?.gkReplacements as Record<string, string> | undefined) ?? {} : {}
  await matchRef.set(
    { gkReplacements: { ...existing, [userId]: lastOnTeam }, updatedAt: now },
    { merge: true }
  )

  const otherTeams = teams.filter((t) => t.teamNumber >= 3).sort((a, b) => a.teamNumber - b.teamNumber)
  const fallbackTeam: TeamDoc | null = otherTeams.find((t) => t.playerIds.length < t.maxSize) ?? null
  if (fallbackTeam) {
    await fallbackTeam.ref.update({
      playerIds: [...fallbackTeam.playerIds, lastOnTeam],
      updatedAt: now,
    })
  } else {
    const nextTeamNumber = teams.length > 0 ? Math.max(...teams.map((t) => t.teamNumber)) + 1 : 3
    const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
    await teamsCol.add({
      matchId,
      teamNumber: nextTeamNumber,
      name: TEAM_NAMES[(nextTeamNumber - 1) % TEAM_NAMES.length] ?? `Team ${nextTeamNumber}`,
      color: TEAM_COLORS[(nextTeamNumber - 1) % TEAM_COLORS.length] ?? '#3b82f6',
      playerIds: [lastOnTeam],
      maxSize: 11,
      createdAt: now,
      updatedAt: now,
    })
  }

  return { placed: true, replacedUserId: lastOnTeam, teamNumber: targetTeam.teamNumber }
}
