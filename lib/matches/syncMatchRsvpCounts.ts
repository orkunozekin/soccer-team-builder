import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

type Counts = { confirmedCount: number; gkCount: number }

/**
 * Count confirmed RSVPs and write `_state/rsvp` + `rsvpConfirmedCount` inside `tx`.
 * RSVP create/cancel transactions also touch `_state/rsvp` and the RSVP docs this
 * query reads, so a concurrent write makes one side retry instead of being lost.
 */
async function recountInTransaction(
  adminDb: Firestore,
  tx: Transaction,
  matchId: string
): Promise<Counts> {
  const matchRef = adminDb.collection('matches').doc(matchId)
  const stateRef = matchRef.collection('_state').doc('rsvp')
  const confirmedSnap = await tx.get(
    adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
  )

  let gkCount = 0
  for (const doc of confirmedSnap.docs) {
    if (isGoalkeeper((doc.data().position as string | null) ?? null)) {
      gkCount += 1
    }
  }
  const confirmedCount = confirmedSnap.size
  const now = Timestamp.now()
  tx.set(stateRef, { confirmedCount, gkCount, updatedAt: now }, { merge: true })
  tx.set(
    matchRef,
    { rsvpConfirmedCount: confirmedCount, updatedAt: now },
    { merge: true }
  )
  return { confirmedCount, gkCount }
}

/**
 * Recompute `_state/rsvp` + denormalized `rsvpConfirmedCount` from confirmed RSVPs.
 * Use after bulk RSVP deletes (e.g. account removal) so list headcounts stay accurate.
 */
export async function syncMatchRsvpCountsFromConfirmed(
  adminDb: Firestore,
  matchId: string
): Promise<Counts> {
  const stateRef = adminDb
    .collection('matches')
    .doc(matchId)
    .collection('_state')
    .doc('rsvp')
  return adminDb.runTransaction(async tx => {
    await tx.get(stateRef)
    return recountInTransaction(adminDb, tx, matchId)
  })
}

/**
 * For legacy matches missing `_state/rsvp`, seed counters from existing confirmed
 * RSVPs before the next increment.
 */
export async function ensureMatchRsvpStateSeeded(
  adminDb: Firestore,
  matchId: string
): Promise<void> {
  const stateRef = adminDb
    .collection('matches')
    .doc(matchId)
    .collection('_state')
    .doc('rsvp')
  await adminDb.runTransaction(async tx => {
    const stateSnap = await tx.get(stateRef)
    if (stateSnap.exists) return
    await recountInTransaction(adminDb, tx, matchId)
  })
}
