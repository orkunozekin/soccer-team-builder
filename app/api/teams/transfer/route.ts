import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Note: Admin verification should be done here

    const { matchId, playerId, targetTeamId, currentTeamId, isOnBench } =
      await request.json()

    if (!matchId || !playerId || targetTeamId === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Import services
    const { getMatchTeams, getBench, updateTeam, updateBench } = await import(
      '@/lib/services/teamService'
    )
    const { getAllUsers } = await import('@/lib/services/userService')

    const [teams, bench, users] = await Promise.all([
      getMatchTeams(matchId),
      getBench(matchId),
      getAllUsers(),
    ])

    const player = users.find((u) => u.uid === playerId)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const isGK = isGoalkeeper(player.position)

    // If moving to bench
    if (targetTeamId === 'bench') {
      // Remove from current team
      if (currentTeamId) {
        const currentTeam = teams.find((t) => t.id === currentTeamId)
        if (currentTeam) {
          const newPlayerIds = currentTeam.playerIds.filter(
            (id) => id !== playerId
          )
          await updateTeam(matchId, currentTeamId, {
            playerIds: newPlayerIds,
          })
        }
      }

      // Add to bench
      const benchPlayerIds = bench?.playerIds || []
      if (!benchPlayerIds.includes(playerId)) {
        await updateBench(matchId, [...benchPlayerIds, playerId])
      }

      return NextResponse.json({ success: true })
    }

    // Moving to a team
    const targetTeam = teams.find((t) => t.id === targetTeamId)
    if (!targetTeam) {
      return NextResponse.json({ error: 'Target team not found' }, { status: 404 })
    }

    // Validation: Check team size
    if (targetTeam.playerIds.length >= targetTeam.maxSize) {
      return NextResponse.json(
        { error: `Team is full (${targetTeam.maxSize} players)` },
        { status: 400 }
      )
    }

    // Validation: Check goalkeeper limit
    if (isGK) {
      const hasGK = targetTeam.playerIds.some((id) => {
        const p = users.find((u) => u.uid === id)
        return p && isGoalkeeper(p.position)
      })
      if (hasGK) {
        return NextResponse.json(
          { error: 'Team already has a goalkeeper' },
          { status: 400 }
        )
      }
    }

    // Remove from current location
    if (currentTeamId) {
      const currentTeam = teams.find((t) => t.id === currentTeamId)
      if (currentTeam) {
        const newPlayerIds = currentTeam.playerIds.filter(
          (id) => id !== playerId
        )
        await updateTeam(matchId, currentTeamId, {
          playerIds: newPlayerIds,
        })
      }
    } else if (isOnBench) {
      const benchPlayerIds = (bench?.playerIds || []).filter(
        (id) => id !== playerId
      )
      await updateBench(matchId, benchPlayerIds)
    }

    // Add to target team
    const newPlayerIds = [...targetTeam.playerIds, playerId]
    await updateTeam(matchId, targetTeamId, {
      playerIds: newPlayerIds,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error transferring player:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transfer player' },
      { status: 500 }
    )
  }
}
