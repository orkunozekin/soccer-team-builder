import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, verifyAuth } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { serializeMatchLocation } from '@/lib/utils/location'
import type { SavedLocationInput } from '@/types/savedLocation'

function mapDoc(id: string, data: Record<string, unknown>) {
  const location = serializeMatchLocation(data as SavedLocationInput)
  if (!location) return null

  const createdAt = data.createdAt as Timestamp | undefined
  const updatedAt = data.updatedAt as Timestamp | undefined

  return {
    id,
    ...location,
    createdAt: createdAt?.toDate().toISOString() ?? null,
    updatedAt: updatedAt?.toDate().toISOString() ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const snapshot = await adminDb
      .collection('savedLocations')
      .orderBy('name', 'asc')
      .get()

    const locations = snapshot.docs
      .map(doc => mapDoc(doc.id, doc.data()))
      .filter(Boolean)

    return NextResponse.json({ success: true, locations })
  } catch (error: unknown) {
    console.error('Error listing saved locations:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(error, 'Failed to list saved locations'),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
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

    const locationId = `loc_${Date.now()}`
    const now = Timestamp.now()

    await adminDb
      .collection('savedLocations')
      .doc(locationId)
      .set({
        ...location,
        createdAt: now,
        updatedAt: now,
      })

    return NextResponse.json({
      success: true,
      locationId,
      location: {
        id: locationId,
        ...location,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error('Error creating saved location:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(error, 'Failed to create saved location'),
      },
      { status: 500 }
    )
  }
}
