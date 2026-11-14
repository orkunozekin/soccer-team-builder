import { NextRequest, NextResponse } from 'next/server'
import { verifyClubMember } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import {
  clubRequiresCodeOfConduct,
  getCodeOfConductAgreement,
} from '@/lib/conduct/conductStoreAdmin'
import { getAdminDb } from '@/lib/firebase/admin'

/**
 * GET /api/users/me/code-of-conduct?clubId=… — the caller's agreement, and
 * whether `clubId` requires one they haven't given yet. Only members (and
 * super users) learn a club's setting; anyone else gets 404.
 */
export async function GET(request: NextRequest) {
  try {
    const clubId = request.nextUrl.searchParams.get('clubId')?.trim() || null
    const { uid, isMember, error } = await verifyClubMember(request, clubId)
    if (!uid || uid === 'fallback') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // A failed membership lookup is retryable, never "not a member".
    if (error) {
      return NextResponse.json(
        { error: 'Failed to load code of conduct status' },
        { status: 500 }
      )
    }
    if (clubId && !isMember) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const [agreement, clubRequires] = await Promise.all([
      getCodeOfConductAgreement(adminDb, uid),
      clubId ? clubRequiresCodeOfConduct(adminDb, clubId) : false,
    ])
    return NextResponse.json({
      required: clubRequires && agreement === null,
      agreement,
    })
  } catch (error: unknown) {
    console.error('Error loading code of conduct status:', error)
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(
          error,
          'Failed to load code of conduct status'
        ),
      },
      { status: 500 }
    )
  }
}
