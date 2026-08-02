/**
 * Server-only: soft-delete a match (keeps the document and related data).
 * Sets deletedAt and closes RSVP. Used by the API DELETE handler.
 */
import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'

export async function deleteMatch(
  adminDb: Firestore,
  matchId: string
): Promise<void> {
  const matchRef = adminDb.collection('matches').doc(matchId)
  const matchDoc = await matchRef.get()
  if (!matchDoc.exists) return

  const data = matchDoc.data()
  if (data?.deletedAt != null) return

  const now = Timestamp.now()
  await matchRef.update({
    deletedAt: now,
    rsvpOpen: false,
    updatedAt: now,
  })
}
