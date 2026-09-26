import { NextRequest, NextResponse } from 'next/server'
import { verifyCanCreateInvite, verifyClubAdmin } from '@/lib/api/auth'
import {
  createInvite,
  listActiveInvitesForClub,
} from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

export async function GET(
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

    const invites = await listActiveInvitesForClub(clubId)
    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    const withLinks = invites.map(invite => {
      const joinPath = `/join?code=${encodeURIComponent(invite.code)}`
      const link = origin ? `${origin.replace(/\/$/, '')}${joinPath}` : joinPath
      return { ...invite, link }
    })

    return NextResponse.json({ success: true, invites: withLinks })
  } catch (err: unknown) {
    console.error('Error listing invites:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to list invites') },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params
    if (!clubId) {
      return NextResponse.json({ error: 'Club ID required' }, { status: 400 })
    }

    const { uid, allowed, createdByRole, error } = await verifyCanCreateInvite(
      request,
      clubId
    )
    if (error || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowed || !createdByRole) {
      return NextResponse.json(
        { error: 'Not allowed to create invites for this club' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const maxUses =
      typeof body?.maxUses === 'number' && body.maxUses > 0
        ? body.maxUses
        : null
    const expiresAt =
      typeof body?.expiresAt === 'string' && body.expiresAt
        ? new Date(body.expiresAt)
        : null
    if (expiresAt && isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        { error: 'Invalid expiresAt' },
        { status: 400 }
      )
    }

    const invite = await createInvite({
      clubId,
      createdBy: uid,
      createdByRole,
      maxUses,
      expiresAt,
    })

    auditLog({
      action: 'club.invite_created',
      actorUid: uid,
      entityType: 'club',
      entityId: clubId,
      source: 'api',
      metadata: { inviteId: invite.id, code: invite.code, createdByRole },
    })

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    const joinPath = `/join?code=${encodeURIComponent(invite.code)}`
    const link = origin ? `${origin.replace(/\/$/, '')}${joinPath}` : joinPath

    return NextResponse.json(
      { success: true, invite, link },
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error('Error creating invite:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to create invite') },
      { status: 500 }
    )
  }
}
