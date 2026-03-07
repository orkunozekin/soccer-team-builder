import { NextRequest, NextResponse } from 'next/server'

import { verifyAdmin } from '@/lib/api/auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { removeUserFromMatchTeams } from '@/lib/teams/removeUserFromMatchTeams'

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

  try {
    // 1) Remove from all match teams and backfill (before deleting RSVPs so backfill can use RSVP order).
    //    If the user was on team 1 or 2, the next player from team 3+ is moved into that spot.
    const matchesSnap = await adminDb.collection('matches').get()
    for (const matchDoc of matchesSnap.docs) {
      await removeUserFromMatchTeams(adminDb, matchDoc.id, userId)
    }

    // 2) Delete user doc (if present)
    await adminDb.collection('users').doc(userId).delete().catch(() => {})

    // 3) Delete RSVPs authored by this user (top-level collection)
    const rsvpSnap = await adminDb.collection('rsvps').where('userId', '==', userId).get()
    for (const batchDocs of chunk(rsvpSnap.docs, 450)) {
      const batch = adminDb.batch()
      batchDocs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }

    // 4) Delete Firebase Auth user (if present)
    await adminAuth.deleteUser(userId).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Error deleting user:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to delete user') },
      { status: 500 }
    )
  }
}

