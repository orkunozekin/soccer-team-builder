import { NextRequest, NextResponse } from 'next/server'
import { verifyClubMember } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getClubBySlug } from '@/lib/services/clubService'

/**
 * Resolve a club by URL slug for callers who may open it (member or super_user).
 * Unknown slug and unauthorized callers both get 404 so existence is not leaked.
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

    const club = await getClubBySlug(slug)
    if (!club) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { uid, isMember, error } = await verifyClubMember(request, club.id)
    if (error || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
