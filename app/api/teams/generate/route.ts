import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { generateTeams } from '@/lib/utils/teamGenerator'

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

    const { matchId } = await request.json()

    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    // Note: In production, verify admin role using Firebase Admin SDK
    // For now, we'll rely on Firestore security rules + client-side checks

    // Import Firestore helpers (client SDK works in API routes too)
    const { db } = await import('@/lib/firebase/config')
    const {
      queryDocuments,
      getDocument,
      createDocument,
      updateDocument,
      deleteDocument,
      timestampToDate,
    } = await import('@/lib/firebase/firestore')
    const { where } = await import('firebase/firestore')
    const { getMatchRSVPs } = await import('@/lib/services/rsvpService')
    const { getAllUsers } = await import('@/lib/services/userService')
    const {
      createTeam,
      getMatchTeams,
      deleteTeam,
      updateTeam,
      updateBench,
    } = await import('@/lib/services/teamService')

    // Fetch RSVPs and users
    const [rsvps, users] = await Promise.all([
      getMatchRSVPs(matchId),
      getAllUsers(),
    ])

    if (rsvps.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 players to generate teams' },
        { status: 400 }
      )
    }

    // Generate teams (business logic on server)
    const teamAssignments = generateTeams(rsvps, users, 11)

    // Delete existing teams
    const existingTeams = await getMatchTeams(matchId)
    for (const team of existingTeams) {
      await deleteTeam(matchId, team.id)
    }

    // Create new teams
    const TEAM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
    const TEAM_NAMES = ['Blue', 'Red', 'Green', 'Orange', 'Purple']
    const allPlayerIds = new Set<string>()

    for (let i = 0; i < teamAssignments.length; i++) {
      const assignment = teamAssignments[i]
      const teamId = await createTeam(
        matchId,
        assignment.teamNumber,
        TEAM_NAMES[i] || `Team ${assignment.teamNumber}`,
        TEAM_COLORS[i] || '#3b82f6',
        11
      )

      // Update team with players
      if (assignment.playerIds.length > 0) {
        await updateTeam(matchId, teamId, {
          playerIds: assignment.playerIds,
        })
      }

      assignment.playerIds.forEach((id) => allPlayerIds.add(id))
    }

    // Put remaining players on bench
    const benchPlayerIds = rsvps
      .map((r) => r.userId)
      .filter((id) => !allPlayerIds.has(id))

    await updateBench(matchId, benchPlayerIds)

    return NextResponse.json({
      success: true,
      teamsGenerated: teamAssignments.length,
    })
  } catch (error: any) {
    console.error('Error generating teams:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate teams' },
      { status: 500 }
    )
  }
}
