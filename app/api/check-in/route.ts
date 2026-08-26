import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { logUserError, userErrorResponse } from '@/lib/audit/logUserError'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import { isWithinCheckInWindow, venueHasCheckInCoords } from '@/lib/utils/checkIn'
import {
  CHECK_IN_MAX_ACCURACY_METERS,
  CHECK_IN_RADIUS_METERS,
  isWithinCheckInRadius,
} from '@/lib/utils/geo'
import { parseMatchLocation } from '@/lib/utils/location'

function checkInFailed(
  uid: string,
  status: number,
  error: string,
  opts?: { code?: string; matchId?: string | null }
) {
  return userErrorResponse(
    {
      action: 'check_in.failed',
      actorUid: uid,
      status,
      message: error,
      code: opts?.code,
      matchId: opts?.matchId ?? undefined,
      entityType: 'rsvp',
    },
    { error, ...(opts?.code ? { code: opts.code } : {}) }
  )
}

/**
 * POST /api/check-in
 * Geo check-in for the authenticated user against their confirmed RSVP.
 * Body: { matchId, lat, lng, accuracy? }
 */
export async function POST(request: NextRequest) {
  let uid: string | null = null
  try {
    const auth = await verifyAuth(request)
    uid = auth.uid
    if (auth.error || !uid || uid === 'fallback') {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
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
      return checkInFailed(uid, 400, 'Match ID required')
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return checkInFailed(uid, 400, 'Valid lat and lng are required', {
        matchId,
      })
    }
    if (
      accuracy != null &&
      Number.isFinite(accuracy) &&
      accuracy > CHECK_IN_MAX_ACCURACY_METERS
    ) {
      const error = `GPS accuracy too low (${Math.round(accuracy)}m). Move outdoors or ask a host to mark you present.`
      return checkInFailed(uid, 400, error, { code: 'ACCURACY', matchId })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return checkInFailed(uid, 500, 'Server configuration error', { matchId })
    }

    const matchSnap = await adminDb.collection('matches').doc(matchId).get()
    if (!matchSnap.exists || matchSnap.data()?.deletedAt != null) {
      return checkInFailed(uid, 404, 'Match not found', { matchId })
    }

    const matchData = matchSnap.data()!
    const matchDate = matchData.date?.toDate?.() ?? new Date(matchData.date)
    const time = typeof matchData.time === 'string' ? matchData.time : null

    if (!isWithinCheckInWindow(matchDate, time)) {
      return checkInFailed(
        uid,
        403,
        'Check-in is only available from 40 minutes before kickoff until 2 hours after.',
        { code: 'WINDOW', matchId }
      )
    }

    const location = parseMatchLocation(matchData.location)
    if (!venueHasCheckInCoords(location)) {
      return checkInFailed(
        uid,
        400,
        'This field has no pinned location. Ask a host to mark you present.',
        { code: 'NO_VENUE', matchId }
      )
    }

    if (
      !isWithinCheckInRadius(
        { lat, lng },
        { lat: location!.lat!, lng: location!.lng! },
        CHECK_IN_RADIUS_METERS
      )
    ) {
      return checkInFailed(
        uid,
        400,
        'You appear to be too far from the field. Head to the location to check in.',
        { code: 'DISTANCE', matchId }
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
      return checkInFailed(
        uid,
        403,
        'Confirmed RSVP required to check in',
        { code: 'NO_RSVP', matchId }
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
    const message = sanitizeErrorForClient(error, 'Failed to check in')
    if (uid) {
      logUserError({
        action: 'check_in.failed',
        actorUid: uid,
        status: 500,
        message,
        entityType: 'rsvp',
      })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
