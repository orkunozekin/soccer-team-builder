import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdmin } from '@/lib/api/auth'
import {
  ensureClubNameLower,
  listMembershipsForClub,
} from '@/lib/services/clubService'

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

    // Lazy repair for founding clubs created before nameLower existed.
    await ensureClubNameLower(clubId).catch(() => false)

    const members = await listMembershipsForClub(clubId)
    return NextResponse.json({ success: true, members })
  } catch (err: unknown) {
    console.error('Error listing club members:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to list members') },
      { status: 500 }
    )
  }
}
