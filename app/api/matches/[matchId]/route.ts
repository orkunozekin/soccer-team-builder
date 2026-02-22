import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

function dateToTimestamp(d: string | null): Timestamp | null {
  if (!d) return null
  const date = new Date(d)
  return isNaN(date.getTime()) ? null : Timestamp.fromDate(date)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { matchId } = await params
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const body = await request.json()
    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const matchRef = adminDb.collection('matches').doc(matchId)
    const matchDoc = await matchRef.get()
    if (!matchDoc.exists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() }

    if (body.date !== undefined) {
      const ts = typeof body.date === 'string' ? dateToTimestamp(body.date) : null
      if (ts) updates.date = ts
    }
    if (body.time !== undefined) updates.time = body.time
    if (body.location !== undefined) {
      updates.location = typeof body.location === 'string' ? body.location.trim() || null : null
    }
    if (body.rsvpOpen !== undefined) updates.rsvpOpen = body.rsvpOpen
    if (body.rsvpOpenAt !== undefined) {
      updates.rsvpOpenAt = body.rsvpOpenAt ? dateToTimestamp(body.rsvpOpenAt) : null
    }
    if (body.rsvpCloseAt !== undefined) {
      updates.rsvpCloseAt = body.rsvpCloseAt ? dateToTimestamp(body.rsvpCloseAt) : null
    }

    await matchRef.update(updates)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error updating match:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to update match') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { matchId } = await params
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const matchRef = adminDb.collection('matches').doc(matchId)
    if (!(await matchRef.get()).exists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Delete subcollections: teams and bench
    const teamsSnap = await adminDb.collection(`matches/${matchId}/teams`).get()
    const benchSnap = await adminDb.collection(`matches/${matchId}/bench`).get()
    const batch = adminDb.batch()
    teamsSnap.docs.forEach((d) => batch.delete(d.ref))
    benchSnap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()

    // Delete RSVPs for this match (top-level collection with matchId field)
    const rsvpsSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .get()
    const rsvpBatch = adminDb.batch()
    rsvpsSnap.docs.forEach((d) => rsvpBatch.delete(d.ref))
    if (!rsvpsSnap.empty) await rsvpBatch.commit()

    await matchRef.delete()
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting match:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to delete match') },
      { status: 500 }
    )
  }
}
