import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { expandTeamsForMatch } from '@/lib/teams/expandTeamsForMatch'
import { removeUserFromMatchTeams } from '@/lib/teams/removeUserFromMatchTeams'

/**
 * POST: Confirm RSVP for the authenticated user.
 * Creates the RSVP document, then expands teams if needed (e.g. 3rd team when 23+ RSVPs).
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const matchId = body?.matchId
    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const userSnap = await adminDb.collection('users').doc(uid).get()
    const userData = userSnap.exists ? userSnap.data() : null
    const displayName = userData?.displayName
    const jerseyNumber = userData?.jerseyNumber
    const hasName = typeof displayName === 'string' && displayName.trim().length > 0
    const hasJersey =
      typeof jerseyNumber === 'number' &&
      Number.isInteger(jerseyNumber) &&
      jerseyNumber >= 0 &&
      jerseyNumber <= 99
    if (!hasName || !hasJersey) {
      return NextResponse.json(
        { error: 'Complete your profile (display name and jersey number) to RSVP' },
        { status: 400 }
      )
    }

    const existing = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('userId', '==', uid)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get()

    let rsvpId: string
    if (!existing.empty) {
      rsvpId = existing.docs[0].id
      const { regenerated } = await expandTeamsForMatch(adminDb, matchId)
      return NextResponse.json({ rsvpId, regenerated })
    }

    rsvpId = `rsvp_${matchId}_${uid}_${Date.now()}`
    const now = Timestamp.now()

    await adminDb.collection('rsvps').doc(rsvpId).set({
      matchId,
      userId: uid,
      status: 'confirmed',
      rsvpAt: now,
      updatedAt: now,
    })

    const { regenerated } = await expandTeamsForMatch(adminDb, matchId)

    return NextResponse.json({
      rsvpId,
      regenerated,
    })
  } catch (error: any) {
    console.error('Error creating RSVP:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create RSVP' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Cancel an RSVP (body: { rsvpId }).
 * Marks RSVP as cancelled and removes the user from their team; removes the team if they were the last player.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const rsvpId = body?.rsvpId
    if (!rsvpId || typeof rsvpId !== 'string') {
      return NextResponse.json({ error: 'rsvpId required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const rsvpRef = adminDb.collection('rsvps').doc(rsvpId)
    const rsvpSnap = await rsvpRef.get()
    if (!rsvpSnap.exists) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 })
    }

    const data = rsvpSnap.data()!
    if (data.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (data.status === 'cancelled') {
      return NextResponse.json({ cancelled: true, teamsUpdated: false })
    }

    const matchId = data.matchId as string
    const userId = data.userId as string

    await rsvpRef.update({
      status: 'cancelled',
      updatedAt: Timestamp.now(),
    })

    const { removed } = await removeUserFromMatchTeams(adminDb, matchId, userId)

    return NextResponse.json({
      cancelled: true,
      teamsUpdated: removed,
    })
  } catch (error: any) {
    console.error('Error cancelling RSVP:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel RSVP' },
      { status: 500 }
    )
  }
}
