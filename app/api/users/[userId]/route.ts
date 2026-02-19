import { NextRequest, NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

import { verifyAdmin } from '@/lib/api/auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { uid, isAdmin, error: authError } = await verifyAdmin(request)
  if (authError || !uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
  }

  const { userId } = await params
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  }
  if (userId === uid) {
    return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 })
  }

  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 })
  }

  const now = Timestamp.now()

  try {
    // 1) Delete user doc (if present)
    await adminDb.collection('users').doc(userId).delete().catch(() => {})

    // 2) Delete RSVPs authored by this user (top-level collection)
    const rsvpSnap = await adminDb.collection('rsvps').where('userId', '==', userId).get()
    for (const batchDocs of chunk(rsvpSnap.docs, 450)) {
      const batch = adminDb.batch()
      batchDocs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }

    // 3) Remove from any team playerIds arrays (collection group)
    const teamSnap = await adminDb
      .collectionGroup('teams')
      .where('playerIds', 'array-contains', userId)
      .get()
    for (const batchDocs of chunk(teamSnap.docs, 450)) {
      const batch = adminDb.batch()
      batchDocs.forEach((d) =>
        batch.update(d.ref, {
          playerIds: FieldValue.arrayRemove(userId),
          updatedAt: now,
        })
      )
      await batch.commit()
    }

    // 4) Remove from any bench playerIds arrays (collection group)
    const benchSnap = await adminDb
      .collectionGroup('bench')
      .where('playerIds', 'array-contains', userId)
      .get()
    for (const batchDocs of chunk(benchSnap.docs, 450)) {
      const batch = adminDb.batch()
      batchDocs.forEach((d) =>
        batch.update(d.ref, {
          playerIds: FieldValue.arrayRemove(userId),
          updatedAt: now,
        })
      )
      await batch.commit()
    }

    // 5) Delete Firebase Auth user (if present)
    await adminAuth.deleteUser(userId).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Error deleting user:', err)
    return NextResponse.json({ error: message || 'Failed to delete user' }, { status: 500 })
  }
}

