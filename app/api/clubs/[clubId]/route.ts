import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import { updateClub } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params
    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
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
    const name = typeof body?.name === 'string' ? body.name : undefined
    const allowPlayerInvites =
      typeof body?.settings?.allowPlayerInvites === 'boolean'
        ? body.settings.allowPlayerInvites
        : undefined

    if (name === undefined && allowPlayerInvites === undefined) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      )
    }

    const club = await updateClub(clubId, {
      name,
      settings:
        allowPlayerInvites === undefined
          ? undefined
          : { allowPlayerInvites },
    })

    auditLog({
      action: 'club.updated',
      actorUid: uid,
      entityType: 'club',
      entityId: clubId,
      source: 'api',
      metadata: { name, allowPlayerInvites },
    })

    return NextResponse.json({ success: true, club })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to update club'
    const status = message === 'Club not found' ? 404 : 500
    console.error('Error updating club:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
