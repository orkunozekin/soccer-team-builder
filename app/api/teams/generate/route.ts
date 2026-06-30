import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { expandTeamsForMatch } from '@/lib/teams/expandTeamsForMatch'

export async function POST(request: NextRequest) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const { matchId } = await request.json()

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .get()

    if (rsvpSnap.size < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 players to generate teams' },
        { status: 400 }
      )
    }

    const result = await expandTeamsForMatch(adminDb, matchId, {
      forceRegenerate: true,
    })

    const teamsSnap = await adminDb
      .collection(`matches/${matchId}/teams`)
      .get()

    return NextResponse.json({
      success: true,
      teamsGenerated: teamsSnap.size,
      regenerated: result.regenerated,
    })
  } catch (error: any) {
    console.error('Error generating teams:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to generate teams') },
      { status: 500 }
    )
  }
}
