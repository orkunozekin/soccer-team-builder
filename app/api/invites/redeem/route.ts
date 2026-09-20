import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { redeemInvite } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

export async function POST(request: NextRequest) {
  try {
    const { uid, error } = await verifyAuth(request)
    if (error || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (uid === 'fallback') {
      return NextResponse.json(
        { error: 'Firebase Admin not configured' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    const result = await redeemInvite({ code, userId: uid })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      )
    }

    if (!result.alreadyMember) {
      auditLog({
        action: 'club.invite_redeemed',
        actorUid: uid,
        entityType: 'club',
        entityId: result.clubId,
        source: 'api',
        metadata: { membershipId: result.membership.id },
      })
    }

    return NextResponse.json({
      success: true,
      alreadyMember: result.alreadyMember,
      membership: result.membership,
      clubId: result.clubId,
    })
  } catch (err: unknown) {
    console.error('Error redeeming invite:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to redeem invite') },
      { status: 500 }
    )
  }
}
