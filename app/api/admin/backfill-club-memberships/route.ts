import { NextRequest, NextResponse } from 'next/server'
import { verifySuperUser } from '@/lib/api/auth'
import { backfillClubMemberships } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

/**
 * One-shot membership + role + resource clubId backfill for a founding club.
 * Idempotent on (clubId, userId) and existing resource.clubId values.
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, isSuperUser, error } = await verifySuperUser(request)
    if (error || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperUser) {
      return NextResponse.json(
        { error: 'Super user privileges required' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const clubId = typeof body?.clubId === 'string' ? body.clubId.trim() : ''
    if (!clubId) {
      return NextResponse.json(
        { error: 'clubId is required' },
        { status: 400 }
      )
    }

    const result = await backfillClubMemberships(clubId)

    auditLog({
      action: 'club.memberships_backfilled',
      actorUid: uid,
      entityType: 'club',
      entityId: clubId,
      source: 'api',
      metadata: { ...result },
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to backfill memberships'
    const status = message === 'Club not found' ? 404 : 500
    console.error('Error backfilling club memberships:', err)
    return NextResponse.json({ error: message }, { status })
  }
}
