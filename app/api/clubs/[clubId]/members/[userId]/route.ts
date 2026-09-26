import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import { updateMembershipRole } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'
import type { ClubMembershipRole } from '@/types/club'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string; userId: string }> }
) {
  try {
    const { clubId, userId } = await params
    if (!clubId || !userId) {
      return NextResponse.json(
        { error: 'Club ID and user ID required' },
        { status: 400 }
      )
    }

    const { uid, isClubAdmin, error } = await verifyClubAdmin(request, clubId)
    if (error || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Club admin privileges required' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const role = body?.role as ClubMembershipRole | undefined
    if (role !== 'player' && role !== 'club_admin') {
      return NextResponse.json(
        { error: 'role must be player or club_admin' },
        { status: 400 }
      )
    }

    const membership = await updateMembershipRole({ clubId, userId, role })

    auditLog({
      action: 'club.membership_role_updated',
      actorUid: uid,
      entityType: 'club',
      entityId: clubId,
      source: 'api',
      metadata: { targetUserId: userId, role },
    })

    return NextResponse.json({ success: true, membership })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update membership'
    const status =
      message === 'Membership not found'
        ? 404
        : message === 'Cannot demote the last club admin'
          ? 400
          : 500
    console.error('Error updating membership role:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
