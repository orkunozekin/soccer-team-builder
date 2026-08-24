import { Timestamp, WriteBatch } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'

const FIRESTORE_BATCH_LIMIT = 500

/**
 * POST /api/check-in/host-all
 * Admin marks all confirmed RSVPs present for a match.
 * Body: { matchId }
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !uid || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const matchId = typeof body?.matchId === 'string' ? body.matchId : null

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const matchSnap = await adminDb.collection('matches').doc(matchId).get()
    if (!matchSnap.exists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const matchData = matchSnap.data()!
    if (matchData.deletedAt != null) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .get()

    const toUpdate = rsvpSnap.docs.filter(doc => doc.data().attended !== true)
    if (toUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        updated: [],
        message: 'All confirmed players are already marked present',
      })
    }

    const now = Timestamp.now()
    const attendanceUpdate = {
      attended: true,
      checkedInAt: now,
      checkInMethod: 'host' as const,
      updatedAt: now,
    }

    for (let i = 0; i < toUpdate.length; i += FIRESTORE_BATCH_LIMIT) {
      const chunk = toUpdate.slice(i, i + FIRESTORE_BATCH_LIMIT)
      const batch: WriteBatch = adminDb.batch()
      for (const doc of chunk) {
        batch.update(doc.ref, attendanceUpdate)
      }
      await batch.commit()
    }

    const updated = toUpdate.map(doc => ({
      rsvpId: doc.id,
      userId: doc.data().userId as string,
    }))

    auditLog({
      action: 'check_in.host',
      actorUid: uid,
      matchId,
      entityType: 'match',
      entityId: matchId,
      source: 'api',
      metadata: { bulk: true, count: updated.length },
    })

    return NextResponse.json({ success: true, updated })
  } catch (error: unknown) {
    console.error('check-in/host-all error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to update attendance') },
      { status: 500 }
    )
  }
}
