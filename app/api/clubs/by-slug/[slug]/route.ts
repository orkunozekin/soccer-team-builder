import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyClubMember } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getClubBySlug } from '@/lib/services/clubService'

/**
 * Resolve a club by URL slug for callers who may open it (member or super_user).
 * Unknown slug, unauthenticated, and unauthorized callers all get 404 so
 * existence is not leaked via status codes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params
    const slug = typeof rawSlug === 'string' ? rawSlug.trim() : ''
    if (!slug) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Authenticate before lookup so missing vs existing slugs look the same
    // to anonymous callers (always 404).
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const club = await getClubBySlug(slug)
    if (!club) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { isMember } = await verifyClubMember(request, club.id)
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
    console.error('Error resolving club by slug:', err)
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(err, 'Failed to load club'),
      },
      { status: 500 }
    )
  }
}
