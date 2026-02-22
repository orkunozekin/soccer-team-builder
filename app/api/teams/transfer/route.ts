import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin status
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

    const { matchId, playerId, targetTeamId, currentTeamId, isOnBench } =
      await request.json()

    if (!matchId || !playerId || targetTeamId === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    if (targetTeamId === 'bench') {
      return NextResponse.json(
        { error: 'Bench is not supported; use teams only' },
        { status: 400 }
      )
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
    const teamsSnap = await teamsCol.get()

    const teams = teamsSnap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        playerIds: (data.playerIds as string[]) ?? [],
        maxSize: Number(data.maxSize ?? 11),
      }
    })

    // Moving to a team
    const targetTeam = teams.find((t) => t.id === targetTeamId)
    if (!targetTeam) {
      return NextResponse.json({ error: 'Target team not found' }, { status: 404 })
    }

    const now = Timestamp.now()
    const batch = adminDb.batch()

    // Remove from current team if provided
    if (currentTeamId) {
      const currentTeam = teams.find((t) => t.id === currentTeamId)
      if (currentTeam) {
        batch.update(teamsCol.doc(currentTeamId), {
          playerIds: currentTeam.playerIds.filter((id) => id !== playerId),
          updatedAt: now,
        })
      }
    }

    // Add to target team
    batch.update(teamsCol.doc(targetTeamId), {
      playerIds: uniq([...targetTeam.playerIds, playerId]),
      updatedAt: now,
    })

    await batch.commit()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error transferring player:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to transfer player') },
      { status: 500 }
    )
  }
}
