/** Server-only. Caller holds the per-match lock across RSVP mutation and cleanup. */
import type { Firestore } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { compactTeamVacancies } from './compactTeamVacancies'

export async function removeUserFromMatchTeams(
  adminDb: Firestore,
  matchId: string,
  userId: string,
  options: { preserveConfirmedUser?: boolean } = {}
): Promise<{ removed: boolean; teamDeleted: boolean; backfilled: boolean }> {
  const matchRef = adminDb.collection('matches').doc(matchId)
  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const rsvpsQuery = adminDb.collection('rsvps').where('matchId', '==', matchId)
  // One atomic roster write: a failed commit leaves the original vacancy source
  // available to a retry, even though the RSVP cancellation already committed.
  return adminDb.runTransaction(async tx => {
    const teamsSnap = await tx.get(teamsCol)
    const rsvpsSnap = await tx.get(rsvpsQuery)
    const matchSnap = await tx.get(matchRef)
    const confirmed = rsvpsSnap.docs.filter(
      d =>
        d.data().status === 'confirmed' &&
        (options.preserveConfirmedUser || d.data().userId !== userId)
    )
    const userRefs = confirmed.map(d =>
      adminDb.collection('users').doc(d.data().userId)
    )
    const users = userRefs.length > 0 ? await tx.getAll(...userRefs) : []
    const positions = new Map(
      users.map(d => [d.id, d.data()?.position ?? null])
    )
    const players = confirmed.map(d => {
      const data = d.data()
      return {
        userId: data.userId as string,
        rsvpAt:
          data.rsvpAt?.toDate?.() ??
          (data.rsvpAt instanceof Date ? data.rsvpAt : null),
        position: data.position ?? positions.get(data.userId) ?? null,
      }
    })
    const original = teamsSnap.docs.map(d => ({
      id: d.id,
      teamNumber: (d.data().teamNumber as number) ?? 0,
      playerIds: (d.data().playerIds as string[]) ?? [],
      maxSize: (d.data().maxSize as number) ?? 11,
    }))
    const manualAssignments = (matchSnap.data()?.manualTeamAssignments ??
      {}) as Record<string, number>
    const updated = compactTeamVacancies(original, players, {
      manualAssignments,
      capacities: new Map(original.map(t => [t.teamNumber, t.maxSize])),
      // Fill only vacancies caused by removal of cancelled/stale players and
      // the donor vacancies they create, preserving pre-existing partial teams.
      targets: new Map(original.map(t => [t.teamNumber, t.playerIds.length])),
    })
    const remaining = updated.filter(t => t.playerIds.length > 0)
    const numbers = new Map(remaining.map((t, i) => [t.teamNumber, i + 1]))
    const now = Timestamp.now()
    let backfilled = false
    for (const team of updated) {
      const before = original.find(t => t.teamNumber === team.teamNumber)!
      if (team.playerIds.some(id => !before.playerIds.includes(id)))
        backfilled = true
      if (team.playerIds.length === 0) {
        tx.delete(teamsCol.doc(before.id))
      } else if (
        numbers.get(team.teamNumber) !== team.teamNumber ||
        JSON.stringify(before.playerIds) !== JSON.stringify(team.playerIds)
      ) {
        tx.update(teamsCol.doc(before.id), {
          playerIds: team.playerIds,
          teamNumber: numbers.get(team.teamNumber),
          updatedAt: now,
        })
      }
    }
    // Team numbers are persisted pin targets, so renumber them together with rosters.
    const remapped = Object.fromEntries(
      Object.entries(manualAssignments).map(([id, number]) => [
        id,
        numbers.get(number) ?? number,
      ])
    )
    if (JSON.stringify(remapped) !== JSON.stringify(manualAssignments)) {
      tx.update(matchRef, { manualTeamAssignments: remapped, updatedAt: now })
    }
    return {
      removed:
        original.some(t => t.playerIds.includes(userId)) &&
        !updated.some(t => t.playerIds.includes(userId)),
      teamDeleted: remaining.length < original.length,
      backfilled,
    }
  })
}
