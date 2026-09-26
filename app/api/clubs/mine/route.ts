import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { listMembershipsForUser } from '@/lib/services/clubService'

export async function GET(request: NextRequest) {
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

    const memberships = await listMembershipsForUser(uid)
    return NextResponse.json({ success: true, memberships })
  } catch (err: unknown) {
    console.error('Error listing clubs:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to list clubs') },
      { status: 500 }
    )
  }
}
