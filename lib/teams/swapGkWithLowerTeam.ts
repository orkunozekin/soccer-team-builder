/**
 * Server-only: When a GK leaves their spot (changes position to non-GK), find another GK
 * on a lower-priority team and swap them so the other GK takes this user's spot.
 */

import type { Firestore, DocumentReference } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

interface TeamDoc {
  id: string
  teamNumber: number
  playerIds: string[]
}

/**
 * Find a GK on a team with teamNumber greater than currentUserTeamNumber.
 * Returns { teamDoc, indexInTeam, userId } or null.
 */
export async function swapGkWithLowerPriority(
  adminDb: Firestore,
  matchId: string,
  currentUserId: string,
  currentUserTeamNumber: number,
  rsvpPositionsByUserId: Map<string, string | null>,
  userPositionsByUserId: Map<string, string | null>
): Promise<{ swapOccurred: boolean; otherGkUserId?: string; otherGkDisplayName?: string }> {
  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const teamsSnap = await teamsCol.orderBy('teamNumber').get()
  const teams: TeamDoc[] = teamsSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      teamNumber: (data.teamNumber as number) ?? 0,
      playerIds: (data.playerIds as string[]) ?? [],
    }
  })

  for (const team of teams) {
    if (team.teamNumber <= currentUserTeamNumber) continue
    for (let i = 0; i < team.playerIds.length; i++) {
      const uid = team.playerIds[i]
      const effectivePos = rsvpPositionsByUserId.get(uid) ?? userPositionsByUserId.get(uid) ?? null
      if (isGoalkeeper(effectivePos)) {
        return { swapOccurred: true, otherGkUserId: uid }
      }
    }
  }
  return { swapOccurred: false }
}

/**
 * Perform the swap: replace currentUserId with otherGkUserId in currentUser's team,
 * and replace otherGkUserId with currentUserId in other GK's team.
 */
export async function performGkSwap(
  adminDb: Firestore,
  matchId: string,
  currentUserId: string,
  otherGkUserId: string
): Promise<void> {
  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const teamsSnap = await teamsCol.get()

  let currentTeamRef: DocumentReference | null = null
  let currentIndex = -1
  let otherTeamRef: DocumentReference | null = null
  let otherIndex = -1

  for (const d of teamsSnap.docs) {
    const playerIds = (d.data().playerIds as string[]) ?? []
    const ci = playerIds.indexOf(currentUserId)
    const oi = playerIds.indexOf(otherGkUserId)
    if (ci !== -1) {
      currentTeamRef = d.ref
      currentIndex = ci
    }
    if (oi !== -1) {
      otherTeamRef = d.ref
      otherIndex = oi
    }
  }

  if (!currentTeamRef || currentIndex === -1 || !otherTeamRef || otherIndex === -1) return

  const currentDoc = await currentTeamRef.get()
  const otherDoc = await otherTeamRef.get()
  if (!currentDoc.exists || !otherDoc.exists) return

  const currentPlayerIds = (currentDoc.data()?.playerIds as string[]) ?? []
  const otherPlayerIds = (otherDoc.data()?.playerIds as string[]) ?? []

  const newCurrent = [...currentPlayerIds]
  newCurrent[currentIndex] = otherGkUserId
  const newOther = [...otherPlayerIds]
  newOther[otherIndex] = currentUserId

  const now = Timestamp.now()
  await currentTeamRef.update({ playerIds: newCurrent, updatedAt: now })
  await otherTeamRef.update({ playerIds: newOther, updatedAt: now })
}
