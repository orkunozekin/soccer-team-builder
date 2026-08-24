import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'

/**
 * PATCH /api/users/me
 * Update the authenticated user's profile.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid || uid === 'fallback') {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    const updates: Record<string, unknown> = {}
    const changedFields: string[] = []

    if (body?.displayName !== undefined) {
      const displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : ''
      if (!displayName) {
        return NextResponse.json(
          { error: 'Display name is required' },
          { status: 400 }
        )
      }
      updates.displayName = displayName
      updates.displayNameLower = displayName.toLowerCase()
      changedFields.push('displayName')
    }

    if (body?.jerseyNumber !== undefined) {
      updates.jerseyNumber = normalizeJerseyNumber(body.jerseyNumber)
      changedFields.push('jerseyNumber')
    }

    if (body?.position !== undefined) {
      const position =
        typeof body.position === 'string' ? body.position.trim() || null : null
      updates.position = position
      changedFields.push('position')
    }

    if (changedFields.length === 0) {
      return NextResponse.json(
        { error: 'No profile fields to update' },
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

    const userRef = adminDb.collection('users').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await userRef.update({
      ...updates,
      updatedAt: Timestamp.now(),
    })

    auditLog({
      action: 'user.profile_updated',
      actorUid: uid,
      targetUid: uid,
      entityType: 'user',
      entityId: uid,
      source: 'api',
      metadata: { fields: changedFields },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to update profile') },
      { status: 500 }
    )
  }
}
