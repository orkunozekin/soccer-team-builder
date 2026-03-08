/**
 * Server-only: delete a match and all related data (teams, bench, RSVPs).
 * Used by the API DELETE handler and by the cron when RSVP close time has passed.
 */
import type { Firestore } from 'firebase-admin/firestore'

export async function deleteMatch(
  adminDb: Firestore,
  matchId: string
): Promise<void> {
  const matchRef = adminDb.collection('matches').doc(matchId)
  const matchDoc = await matchRef.get()
  if (!matchDoc.exists) return

  // Delete subcollections: teams and bench
  const teamsSnap = await adminDb.collection(`matches/${matchId}/teams`).get()
  const benchSnap = await adminDb.collection(`matches/${matchId}/bench`).get()
  const batch = adminDb.batch()
  teamsSnap.docs.forEach(d => batch.delete(d.ref))
  benchSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()

  // Delete RSVPs for this match (top-level collection with matchId field)
  const rsvpsSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .get()
  const rsvpBatch = adminDb.batch()
  rsvpsSnap.docs.forEach(d => rsvpBatch.delete(d.ref))
  if (!rsvpsSnap.empty) await rsvpBatch.commit()

  await matchRef.delete()
}
