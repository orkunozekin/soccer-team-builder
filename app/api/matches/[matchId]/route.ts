import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { deleteMatch } from '@/lib/matches/deleteMatch'
import { auditLog } from '@/lib/services/auditService'
import { serializeMatchLocation } from '@/lib/utils/location'
import { getRSVPSchedule } from '@/lib/utils/rsvpScheduler'
import type { MatchLocation } from '@/types/match'

function dateToTimestamp(d: string | null): Timestamp | null {
  if (!d) return null
  const date = new Date(d)
  return isNaN(date.getTime()) ? null : Timestamp.fromDate(date)
}

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
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
    if (matchDoc.data()?.deletedAt != null) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() }
    const existing = matchDoc.data() ?? {}

    if (body.date !== undefined) {
      const ts =
        typeof body.date === 'string' ? dateToTimestamp(body.date) : null
      if (ts) updates.date = ts
    }
    if (body.time !== undefined) updates.time = body.time
    if (body.location !== undefined) {
      updates.location =
        typeof body.location === 'string'
          ? serializeMatchLocation({
              name: body.location,
              address: body.location,
              lat: null,
              lng: null,
            })
          : serializeMatchLocation(body.location as MatchLocation | null)
    }
    if (body.rsvpOpen !== undefined) updates.rsvpOpen = body.rsvpOpen
    if (body.rsvpOpenAt !== undefined) {
      updates.rsvpOpenAt = body.rsvpOpenAt
        ? dateToTimestamp(body.rsvpOpenAt)
        : null
    }
    if (body.rsvpCloseAt !== undefined) {
      updates.rsvpCloseAt = body.rsvpCloseAt
        ? dateToTimestamp(body.rsvpCloseAt)
        : null
    }

    // When date/time change, refresh the derived RSVP window unless explicitly set.
    if (
      (body.date !== undefined || body.time !== undefined) &&
      body.rsvpOpenAt === undefined &&
      body.rsvpCloseAt === undefined
    ) {
      const nextDate =
        (updates.date as Timestamp | undefined) != null
          ? timestampToDate(updates.date as Timestamp)
          : timestampToDate(existing.date as Timestamp | undefined)
      const nextTime =
        typeof updates.time === 'string'
          ? updates.time
          : typeof existing.time === 'string'
            ? existing.time
            : null
      if (nextDate) {
        const { openAt, closeAt } = getRSVPSchedule(nextDate, nextTime)
        updates.rsvpOpenAt = openAt ? Timestamp.fromDate(openAt) : null
        updates.rsvpCloseAt = closeAt ? Timestamp.fromDate(closeAt) : null
      }
    }

    await matchRef.update(updates)

    const updatedFields = Object.keys(updates).filter(k => k !== 'updatedAt')
    auditLog({
      action: 'match.updated',
      actorUid: uid ?? 'unknown',
      matchId,
      entityType: 'match',
      entityId: matchId,
      source: 'api',
      metadata: { updates: updatedFields },
    })

    if (body.rsvpOpen !== undefined) {
      auditLog({
        action: 'match.rsvp_poll_toggled',
        actorUid: uid ?? 'unknown',
        matchId,
        entityType: 'match',
        entityId: matchId,
        source: 'api',
        metadata: { rsvpOpen: body.rsvpOpen === true },
      })
    }

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
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
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

    await deleteMatch(adminDb, matchId)

    auditLog({
      action: 'match.deleted',
      actorUid: uid ?? 'unknown',
      matchId,
      entityType: 'match',
      entityId: matchId,
      source: 'api',
    })

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
