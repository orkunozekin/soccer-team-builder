import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdminForMatch } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'

/**
 * POST /api/check-in/host
 * Club admin (or super user) marks a player present (or clears attendance).
 * Body: { matchId, userId, attended: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const matchId = typeof body?.matchId === 'string' ? body.matchId : null
    const userId = typeof body?.userId === 'string' ? body.userId : null
    const attended = body?.attended === true

    if (!matchId || !userId) {
      return NextResponse.json(
        { error: 'matchId and userId are required' },
        { status: 400 }
      )
    }

    const {
      uid,
      isClubAdmin,
      error: authError,
      matchExists,
    } = await verifyClubAdminForMatch(request, matchId)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!matchExists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Club admin privileges required' },
        { status: 403 }
      )
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('userId', '==', userId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get()

    if (rsvpSnap.empty) {
      return NextResponse.json(
        { error: 'Confirmed RSVP not found for this player' },
        { status: 404 }
      )
    }

    const rsvpDoc = rsvpSnap.docs[0]
    const now = Timestamp.now()

    if (attended) {
      await rsvpDoc.ref.update({
        attended: true,
        checkedInAt: now,
        checkInMethod: 'host',
        updatedAt: now,
      })
    } else {
      await rsvpDoc.ref.update({
        attended: null,
        checkedInAt: null,
        checkInMethod: null,
        updatedAt: now,
      })
    }

    auditLog({
      action: attended ? 'check_in.host' : 'check_in.cleared',
      actorUid: uid,
      targetUid: userId,
      matchId,
      entityType: 'rsvp',
      entityId: rsvpDoc.id,
      source: 'api',
      metadata: { attended },
    })

    return NextResponse.json({ success: true, rsvpId: rsvpDoc.id, attended })
  } catch (error: unknown) {
    console.error('check-in/host error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to update attendance') },
      { status: 500 }
    )
  }
}
