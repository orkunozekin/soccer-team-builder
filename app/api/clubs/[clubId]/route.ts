import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyClubAdmin, verifyClubMember } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getClub, updateClub } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

/**
 * Load a club by id for members / super_users.
 * Missing club and unauthorized callers both get 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params
    if (!clubId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const club = await getClub(clubId)
    if (!club) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { isMember } = await verifyClubMember(request, clubId)
    if (!isMember) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      club: {
        id: club.id,
        name: club.name,
        slug: club.slug,
        settings: club.settings,
      },
    })
  } catch (err: unknown) {
    console.error('Error loading club:', err)
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(err, 'Failed to load club'),
      },
      { status: 500 }
    )
  }
}

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
    return NextResponse.json(
      {
        error:
          status === 404
            ? message
            : sanitizeErrorForClient(err, 'Failed to update club'),
      },
      { status }
    )
  }
}
