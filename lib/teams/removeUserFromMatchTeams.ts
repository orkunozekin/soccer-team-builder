/**
 * Server-only: remove a user from their team for a match. If that team becomes
 * empty, delete the team and renumber remaining teams (1, 2, 3, ...).
 * If the vacated spot was on team 1 or 2, the earliest-RSVP'd player from
 * team 3+ is moved into that spot (first come first serve).
 */

import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'

function timestampToMs(
  t: Timestamp | Date | { toDate?: () => Date } | null | undefined
): number {
  if (!t) return 0
  if (t instanceof Date) return t.getTime()
  if (typeof (t as { toDate }).toDate === 'function') {
    return (t as Timestamp).toDate().getTime()
  }
  return 0
}

export async function removeUserFromMatchTeams(
  adminDb: Firestore,
  matchId: string,
  userId: string
): Promise<{ removed: boolean; teamDeleted: boolean; backfilled: boolean }> {
  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const teamsSnap = await teamsCol.get()

  let teamDocToUpdate: QueryDocumentSnapshot | null = null
  for (const d of teamsSnap.docs) {
    const playerIds = (d.data().playerIds as string[]) ?? []
    if (playerIds.includes(userId)) {
      teamDocToUpdate = d
      break
    }
  }

  if (!teamDocToUpdate) {
    return { removed: false, teamDeleted: false, backfilled: false }
  }

  const data = teamDocToUpdate.data()
  const vacatedTeamNumber = (data.teamNumber as number) ?? 0
  const playerIds: string[] = (data.playerIds ?? []).filter(
    (id: string) => id !== userId
  )
  const teamDeleted = playerIds.length === 0

  if (teamDeleted) {
    await teamDocToUpdate.ref.delete()
  } else {
    await teamDocToUpdate.ref.update({
      playerIds,
      updatedAt: Timestamp.now(),
    })
  }

  // If vacated spot was on team 1 or 2 and we didn't delete the team, backfill from team 3+ (earliest RSVP first)
  let backfilled = false
  if (!teamDeleted && vacatedTeamNumber >= 1 && vacatedTeamNumber <= 2) {
    const rsvpsSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .get()
    const rsvpAtByUserId = new Map<string, number>()
    rsvpsSnap.docs.forEach((d) => {
      const ddata = d.data()
      rsvpAtByUserId.set(
        ddata.userId as string,
        timestampToMs(ddata.rsvpAt ?? ddata.updatedAt)
      )
    })

    const teamsSnap2 = await teamsCol.get()
    const overflowPlayers: { userId: string; teamDoc: QueryDocumentSnapshot }[] =
      []
    for (const d of teamsSnap2.docs) {
      const tdata = d.data()
      const num = (tdata.teamNumber as number) ?? 0
      if (num >= 3) {
        const ids = (tdata.playerIds as string[]) ?? []
        ids.forEach((uid) => overflowPlayers.push({ userId: uid, teamDoc: d }))
      }
    }
    if (overflowPlayers.length > 0) {
      overflowPlayers.sort(
        (a, b) =>
          (rsvpAtByUserId.get(a.userId) ?? 0) -
          (rsvpAtByUserId.get(b.userId) ?? 0)
      )
      const promote = overflowPlayers[0]
      const vacatedTeamRef = teamDocToUpdate.ref
      const promoteTeamRef = promote.teamDoc.ref

      await vacatedTeamRef.update({
        playerIds: [...playerIds, promote.userId],
        updatedAt: Timestamp.now(),
      })

      const promoteTeamData = promote.teamDoc.data()
      const promoteTeamIds = ((promoteTeamData.playerIds as string[]) ?? []).filter(
        (id: string) => id !== promote.userId
      )
      if (promoteTeamIds.length === 0) {
        await promoteTeamRef.delete()
        const remainingSnap = await teamsCol.orderBy('teamNumber').get()
        const batch = adminDb.batch()
        remainingSnap.docs.forEach((d, index) => {
          batch.update(d.ref, {
            teamNumber: index + 1,
            updatedAt: Timestamp.now(),
          })
        })
        await batch.commit()
      } else {
        await promoteTeamRef.update({
          playerIds: promoteTeamIds,
          updatedAt: Timestamp.now(),
        })
      }
      backfilled = true
    }
  }

  if (!teamDeleted && !backfilled) {
    return { removed: true, teamDeleted: false, backfilled: false }
  }
  if (!teamDeleted) {
    return { removed: true, teamDeleted: false, backfilled: true }
  }

  // Renumber remaining teams so we don't have gaps (e.g. 1, 2, 4 -> 1, 2, 3)
  const remainingSnap = await teamsCol.orderBy('teamNumber').get()
  const batch = adminDb.batch()
  remainingSnap.docs.forEach((d, index) => {
    batch.update(d.ref, {
      teamNumber: index + 1,
      updatedAt: Timestamp.now(),
    })
  })
  await batch.commit()

  return { removed: true, teamDeleted: true, backfilled: false }
}
