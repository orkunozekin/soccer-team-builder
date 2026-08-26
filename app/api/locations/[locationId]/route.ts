import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import { serializeMatchLocation } from '@/lib/utils/location'
import type { SavedLocationInput } from '@/types/savedLocation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { locationId } = await params
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID required' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as SavedLocationInput
    const location = serializeMatchLocation(body)
    if (!location) {
      return NextResponse.json(
        { error: 'Location name or address is required' },
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

    const ref = adminDb.collection('savedLocations').doc(locationId)
    const existing = await ref.get()
    if (!existing.exists) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const now = Timestamp.now()
    await ref.update({
      ...location,
      updatedAt: now,
    })

    auditLog({
      action: 'location.updated',
      actorUid: uid ?? 'unknown',
      entityType: 'location',
      entityId: locationId,
      source: 'api',
      metadata: { name: location.name },
    })

    return NextResponse.json({
      success: true,
      location: {
        id: locationId,
        ...location,
        createdAt:
          (existing.data()?.createdAt as Timestamp | undefined)
            ?.toDate()
            .toISOString() ?? null,
        updatedAt: now.toDate().toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error('Error updating saved location:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(error, 'Failed to update saved location'),
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { locationId } = await params
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID required' },
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

    const ref = adminDb.collection('savedLocations').doc(locationId)
    if (!(await ref.get()).exists) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    await ref.delete()

    auditLog({
      action: 'location.deleted',
      actorUid: uid ?? 'unknown',
      entityType: 'location',
      entityId: locationId,
      source: 'api',
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting saved location:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(error, 'Failed to delete saved location'),
      },
      { status: 500 }
    )
  }
}
