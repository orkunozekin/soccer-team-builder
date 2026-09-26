import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import { revokeInvite } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string; inviteId: string }> }
) {
  try {
    const { clubId, inviteId } = await params
    if (!clubId || !inviteId) {
      return NextResponse.json(
        { error: 'Club ID and invite ID required' },
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

    const invite = await revokeInvite({ clubId, inviteId })

    auditLog({
      action: 'club.invite_revoked',
      actorUid: uid,
      entityType: 'club',
      entityId: clubId,
      source: 'api',
      metadata: { inviteId, code: invite.code },
    })

    return NextResponse.json({ success: true, invite })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to revoke invite'
    const status =
      message === 'Invite not found'
        ? 404
        : message === 'Invite already revoked'
          ? 400
          : 500
    console.error('Error revoking invite:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
