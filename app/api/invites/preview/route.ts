import { NextRequest, NextResponse } from 'next/server'
import { previewInviteByCode } from '@/lib/services/clubService'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'

/**
 * GET /api/invites/preview?code=
 * Public: returns club name for a valid active invite code (no auth).
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')?.trim() ?? ''
    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      )
    }

    const preview = await previewInviteByCode(code)
    if (!preview) {
      return NextResponse.json(
        { error: 'Invalid or expired invite code' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      clubId: preview.clubId,
      clubName: preview.clubName,
    })
  } catch (err: unknown) {
    console.error('Error previewing invite:', err)
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to preview invite') },
      { status: 500 }
    )
  }
}
