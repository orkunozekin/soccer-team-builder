import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

function uniq(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

type TeamRow = {
  id: string
  teamNumber: number
  playerIds: string[]
  maxSize: number
}

function findTeamForPlayer(
  teams: TeamRow[],
  playerId: string,
  preferredTeamId?: string
): TeamRow | undefined {
  if (preferredTeamId) {
    const preferred = teams.find(t => t.id === preferredTeamId)
    if (preferred?.playerIds.includes(playerId)) return preferred
  }
  return teams.find(t => t.playerIds.includes(playerId))
}

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

    const {
      matchId,
      playerId,
      targetTeamId,
      currentTeamId,
      swapWithPlayerId,
    } = await request.json()

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

    const teams: TeamRow[] = teamsSnap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        teamNumber: (data.teamNumber as number) ?? 0,
        playerIds: (data.playerIds as string[]) ?? [],
        maxSize: Number(data.maxSize ?? 11),
      }
    })

    const targetTeam = teams.find(t => t.id === targetTeamId)
    if (!targetTeam) {
      return NextResponse.json(
        { error: 'Target team not found' },
        { status: 404 }
      )
    }

    const now = Timestamp.now()
    const batch = adminDb.batch()
    const matchRef = adminDb.collection('matches').doc(matchId)
    const matchSnap = await matchRef.get()
    const existingAssignments = matchSnap.exists
      ? ((matchSnap.data()?.manualTeamAssignments as
          | Record<string, number>
          | undefined) ?? {})
      : {}

    if (swapWithPlayerId) {
      if (typeof swapWithPlayerId !== 'string' || !swapWithPlayerId) {
        return NextResponse.json(
          { error: 'Invalid swapWithPlayerId' },
          { status: 400 }
        )
      }
      if (swapWithPlayerId === playerId) {
        return NextResponse.json(
          { error: 'Cannot swap a player with themselves' },
          { status: 400 }
        )
      }

      const sourceTeam = findTeamForPlayer(teams, playerId, currentTeamId)
      if (!sourceTeam) {
        return NextResponse.json(
          { error: 'Player not found on a team' },
          { status: 400 }
        )
      }
      if (sourceTeam.id === targetTeamId) {
        return NextResponse.json(
          { error: 'Cannot swap players on the same team' },
          { status: 400 }
        )
      }
      if (!targetTeam.playerIds.includes(swapWithPlayerId)) {
        return NextResponse.json(
          { error: 'Swap player not found on target team' },
          { status: 400 }
        )
      }

      const sourceNext = uniq([
        ...sourceTeam.playerIds.filter(id => id !== playerId),
        swapWithPlayerId,
      ])
      const targetNext = uniq([
        ...targetTeam.playerIds.filter(id => id !== swapWithPlayerId),
        playerId,
      ])

      batch.update(teamsCol.doc(sourceTeam.id), {
        playerIds: sourceNext,
        updatedAt: now,
      })
      batch.update(teamsCol.doc(targetTeamId), {
        playerIds: targetNext,
        updatedAt: now,
      })

      await batch.commit()

      await matchRef.set(
        {
          manualTeamAssignments: {
            ...existingAssignments,
            [playerId]: targetTeam.teamNumber,
            [swapWithPlayerId]: sourceTeam.teamNumber,
          },
          updatedAt: now,
        },
        { merge: true }
      )

      return NextResponse.json({ success: true, swapped: true })
    }

    // One-way transfer: remove player from every team, then add to target
    for (const team of teams) {
      if (!team.playerIds.includes(playerId)) continue
      if (team.id === targetTeamId) continue
      batch.update(teamsCol.doc(team.id), {
        playerIds: team.playerIds.filter(id => id !== playerId),
        updatedAt: now,
      })
    }

    batch.update(teamsCol.doc(targetTeamId), {
      playerIds: uniq([
        ...targetTeam.playerIds.filter(id => id !== playerId),
        playerId,
      ]),
      updatedAt: now,
    })

    await batch.commit()

    await matchRef.set(
      {
        manualTeamAssignments: {
          ...existingAssignments,
          [playerId]: targetTeam.teamNumber,
        },
        updatedAt: now,
      },
      { merge: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error transferring player:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to transfer player') },
      { status: 500 }
    )
  }
}
