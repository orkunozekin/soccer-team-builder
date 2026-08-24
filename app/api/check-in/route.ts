import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import { isWithinCheckInWindow, venueHasCheckInCoords } from '@/lib/utils/checkIn'
import {
  CHECK_IN_MAX_ACCURACY_METERS,
  CHECK_IN_RADIUS_METERS,
  isWithinCheckInRadius,
} from '@/lib/utils/geo'
import { parseMatchLocation } from '@/lib/utils/location'

/**
 * POST /api/check-in
 * Geo check-in for the authenticated user against their confirmed RSVP.
 * Body: { matchId, lat, lng, accuracy? }
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid || uid === 'fallback') {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const matchId = typeof body?.matchId === 'string' ? body.matchId : null
    const lat = typeof body?.lat === 'number' ? body.lat : Number(body?.lat)
    const lng = typeof body?.lng === 'number' ? body.lng : Number(body?.lng)
    const accuracy =
      body?.accuracy == null
        ? null
        : typeof body.accuracy === 'number'
          ? body.accuracy
          : Number(body.accuracy)

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: 'Valid lat and lng are required' },
        { status: 400 }
      )
    }
    if (
      accuracy != null &&
      Number.isFinite(accuracy) &&
      accuracy > CHECK_IN_MAX_ACCURACY_METERS
    ) {
      return NextResponse.json(
        {
          error: `GPS accuracy too low (${Math.round(accuracy)}m). Move outdoors or ask a host to mark you present.`,
          code: 'ACCURACY',
        },
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
    if (matchData.deletedAt != null) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    const matchDate = matchData.date?.toDate?.() ?? new Date(matchData.date)
    const time = typeof matchData.time === 'string' ? matchData.time : null

    if (!isWithinCheckInWindow(matchDate, time)) {
      return NextResponse.json(
        {
          error:
            'Check-in is only available from 40 minutes before kickoff until 2 hours after.',
          code: 'WINDOW',
        },
        { status: 403 }
      )
    }

    const location = parseMatchLocation(matchData.location)
    if (!venueHasCheckInCoords(location)) {
      return NextResponse.json(
        {
          error:
            'This field has no pinned location. Ask a host to mark you present.',
          code: 'NO_VENUE',
        },
        { status: 400 }
      )
    }

    if (
      !isWithinCheckInRadius(
        { lat, lng },
        { lat: location!.lat!, lng: location!.lng! },
        CHECK_IN_RADIUS_METERS
      )
    ) {
      return NextResponse.json(
        {
          error:
            'You appear to be too far from the field. Head to the location to check in.',
          code: 'DISTANCE',
        },
        { status: 400 }
      )
    }

    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('userId', '==', uid)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get()

    if (rsvpSnap.empty) {
      return NextResponse.json(
        { error: 'Confirmed RSVP required to check in', code: 'NO_RSVP' },
        { status: 403 }
      )
    }

    const rsvpDoc = rsvpSnap.docs[0]
    const rsvpData = rsvpDoc.data()
    if (rsvpData.attended === true) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        rsvpId: rsvpDoc.id,
      })
    }

    const now = Timestamp.now()
    await rsvpDoc.ref.update({
      attended: true,
      checkedInAt: now,
      checkInMethod: 'geo',
      updatedAt: now,
    })

    auditLog({
      action: 'check_in.geo',
      actorUid: uid,
      targetUid: uid,
      matchId,
      entityType: 'rsvp',
      entityId: rsvpDoc.id,
      source: 'api',
    })

    return NextResponse.json({
      success: true,
      alreadyCheckedIn: false,
      rsvpId: rsvpDoc.id,
    })
  } catch (error: unknown) {
    console.error('check-in error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to check in') },
      { status: 500 }
    )
  }
}
