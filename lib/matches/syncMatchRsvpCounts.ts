import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

/**
 * Recompute `_state/rsvp` + denormalized `rsvpConfirmedCount` from confirmed RSVPs.
 * Use after bulk RSVP deletes (e.g. account removal) so list headcounts stay accurate.
 */
export async function syncMatchRsvpCountsFromConfirmed(
  adminDb: Firestore,
  matchId: string
): Promise<{ confirmedCount: number; gkCount: number }> {
  const confirmedSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  let gkCount = 0
  for (const doc of confirmedSnap.docs) {
    if (isGoalkeeper((doc.data().position as string | null) ?? null)) {
      gkCount += 1
    }
  }
  const confirmedCount = confirmedSnap.size
  const now = Timestamp.now()
  const matchRef = adminDb.collection('matches').doc(matchId)
  const stateRef = matchRef.collection('_state').doc('rsvp')
  const batch = adminDb.batch()
  batch.set(
    stateRef,
    { confirmedCount, gkCount, updatedAt: now },
    { merge: true }
  )
  batch.set(
    matchRef,
    { rsvpConfirmedCount: confirmedCount, updatedAt: now },
    { merge: true }
  )
  await batch.commit()
  return { confirmedCount, gkCount }
}

/**
 * For legacy matches missing `_state/rsvp`, seed counters from existing confirmed
 * RSVPs before the next increment. Concurrent creates are ignored (ALREADY_EXISTS).
 */
export async function ensureMatchRsvpStateSeeded(
  adminDb: Firestore,
  matchId: string
): Promise<void> {
  const matchRef = adminDb.collection('matches').doc(matchId)
  const stateRef = matchRef.collection('_state').doc('rsvp')
  const stateSnap = await stateRef.get()
  if (stateSnap.exists) return

  const confirmedSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  let gkCount = 0
  for (const doc of confirmedSnap.docs) {
    if (isGoalkeeper((doc.data().position as string | null) ?? null)) {
      gkCount += 1
    }
  }
  const confirmedCount = confirmedSnap.size
  const now = Timestamp.now()

  try {
    await stateRef.create({
      confirmedCount,
      gkCount,
      updatedAt: now,
    })
    await matchRef.set(
      { rsvpConfirmedCount: confirmedCount, updatedAt: now },
      { merge: true }
    )
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? Number((error as { code?: number }).code)
        : null
    const message = String(
      (error as { message?: string })?.message ?? error ?? ''
    )
    const alreadyExists =
      code === 6 ||
      message.includes('ALREADY_EXISTS') ||
      message.toLowerCase().includes('already exists')
    if (!alreadyExists) throw error
  }
}
