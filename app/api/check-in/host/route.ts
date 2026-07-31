import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { isWithinCheckInWindow } from '@/lib/utils/checkIn'

/**
 * POST /api/check-in/host
 * Admin marks a player present (or clears attendance).
 * Body: { matchId, userId, attended: boolean }
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
    const userId = typeof body?.userId === 'string' ? body.userId : null
    const attended = body?.attended === true

    if (!matchId || !userId) {
      return NextResponse.json(
        { error: 'matchId and userId are required' },
        { status: 400 }
      )
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
    const matchDate = matchData.date?.toDate?.() ?? new Date(matchData.date)
    const time = typeof matchData.time === 'string' ? matchData.time : null

    // Host override allowed during window; clearing also allowed after window for corrections.
    if (attended && !isWithinCheckInWindow(matchDate, time)) {
      // Still allow host mark present slightly outside window for late arrivals —
      // plan says host is the fallback; allow while RSVP window isn't long past.
      // Keep soft gate: reject only if more than RSVP close (start+4h) has passed.
      const { getRSVPSchedule } = await import('@/lib/utils/rsvpScheduler')
      const { closeAt } = getRSVPSchedule(matchDate, time)
      if (closeAt && new Date() > closeAt) {
        return NextResponse.json(
          {
            error: 'Check-in window for this match has ended',
            code: 'WINDOW',
          },
          { status: 403 }
        )
      }
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

    return NextResponse.json({ success: true, rsvpId: rsvpDoc.id, attended })
  } catch (error: unknown) {
    console.error('check-in/host error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to update attendance') },
      { status: 500 }
    )
  }
}
