import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { getActiveClubMembership, verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { logUserError, userErrorResponse } from '@/lib/audit/logUserError'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'

function profileUpdateFailed(
  uid: string,
  status: number,
  error: string,
  code?: string
) {
  return userErrorResponse(
    {
      action: 'user.profile_update_failed',
      actorUid: uid,
      status,
      message: error,
      code,
      targetUid: uid,
      entityType: 'user',
      entityId: uid,
    },
    { error, ...(code ? { code } : {}) }
  )
}

/**
 * PATCH /api/users/me
 * Update the authenticated user's profile.
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json().catch(() => null)
    const updates: Record<string, unknown> = {}
    const changedFields: string[] = []

    if (body?.displayName !== undefined) {
      const displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : ''
      if (!displayName) {
        return profileUpdateFailed(uid, 400, 'Display name is required')
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

    // Sync Firestore email from the verified ID token (after Auth email change).
    // Never trust a client-supplied email string.
    if (body?.syncEmail === true) {
      const tokenEmail =
        typeof auth.email === 'string' ? auth.email.trim() : ''
      if (!tokenEmail) {
        return profileUpdateFailed(
          uid,
          400,
          'Verified email is not available on this session'
        )
      }
      updates.email = tokenEmail
      updates.emailLower = tokenEmail.toLowerCase()
      changedFields.push('email')
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return profileUpdateFailed(uid, 500, 'Server configuration error')
    }

    if (body?.activeClubId !== undefined) {
      if (body.activeClubId === null || body.activeClubId === '') {
        updates.activeClubId = null
        changedFields.push('activeClubId')
      } else if (typeof body.activeClubId === 'string') {
        const clubId = body.activeClubId.trim()
        if (!clubId) {
          return profileUpdateFailed(uid, 400, 'Invalid activeClubId')
        }
        const clubSnap = await adminDb.collection('clubs').doc(clubId).get()
        if (!clubSnap.exists) {
          return profileUpdateFailed(uid, 404, 'Club not found', 'club_not_found')
        }
        const { membership, isSuperUser } = await getActiveClubMembership(
          uid,
          clubId
        )
        if (!isSuperUser && !membership) {
          return profileUpdateFailed(
            uid,
            403,
            'You are not a member of this club',
            'not_club_member'
          )
        }
        updates.activeClubId = clubId
        changedFields.push('activeClubId')
      } else {
        return profileUpdateFailed(uid, 400, 'Invalid activeClubId')
      }
    }

    if (changedFields.length === 0) {
      return profileUpdateFailed(uid, 400, 'No profile fields to update')
    }

    const userRef = adminDb.collection('users').doc(uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      return profileUpdateFailed(uid, 404, 'User not found')
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
    const message = sanitizeErrorForClient(error, 'Failed to update profile')
    if (uid) {
      logUserError({
        action: 'user.profile_update_failed',
        actorUid: uid,
        status: 500,
        message,
        targetUid: uid,
        entityType: 'user',
        entityId: uid,
      })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
