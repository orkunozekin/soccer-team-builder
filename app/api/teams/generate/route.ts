import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { generateTeams } from '@/lib/utils/teamGenerator'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

const TEAM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
const TEAM_NAMES = ['Blue', 'Red', 'Green', 'Orange', 'Purple']

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
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

    // Fetch RSVPs (client uses top-level collection 'rsvps' with matchId field)
    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .get()

    const rsvpsToUse: RSVP[] = rsvpSnap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        matchId: data.matchId ?? matchId,
        userId: data.userId,
        status: data.status ?? 'confirmed',
        rsvpAt: timestampToDate(data.rsvpAt) || new Date(),
        updatedAt: timestampToDate(data.updatedAt) || new Date(),
      }
    })

    if (rsvpsToUse.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 players to generate teams' },
        { status: 400 }
      )
    }

    // Fetch all users
    const usersSnap = await adminDb.collection('users').get()
    const users: User[] = usersSnap.docs.map((d) => {
      const data = d.data()
      return {
        uid: data.uid ?? d.id,
        email: data.email ?? '',
        displayName: data.displayName ?? '',
        jerseyNumber: data.jerseyNumber ?? null,
        position: data.position ?? null,
        role: data.role || 'user',
        createdAt: timestampToDate(data.createdAt) || new Date(),
        updatedAt: timestampToDate(data.updatedAt) || new Date(),
      }
    })

    const teamAssignments = generateTeams(rsvpsToUse, users, 11)

    // Use same path format as client: collection id "matches/{matchId}/teams"
    const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
    const benchCol = adminDb.collection(`matches/${matchId}/bench`)

    // Delete existing teams
    const existingTeams = await teamsCol.get()
    const batch = adminDb.batch()
    existingTeams.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()

    const now = Timestamp.now()
    const allPlayerIds = new Set<string>()

    for (let i = 0; i < teamAssignments.length; i++) {
      const assignment = teamAssignments[i]
      const teamId = `team_${matchId}_${assignment.teamNumber}_${Date.now()}`
      teamsCol.doc(teamId).set({
        matchId,
        teamNumber: assignment.teamNumber,
        name: TEAM_NAMES[i] ?? `Team ${assignment.teamNumber}`,
        color: TEAM_COLORS[i] ?? '#3b82f6',
        playerIds: assignment.playerIds,
        maxSize: 11,
        createdAt: now,
        updatedAt: now,
      })
      assignment.playerIds.forEach((id) => allPlayerIds.add(id))
    }

    const benchPlayerIds = rsvpsToUse
      .map((r) => r.userId)
      .filter((id) => !allPlayerIds.has(id))

    const benchId = `bench_${matchId}`
    const benchDoc = await benchCol.doc(benchId).get()
    if (benchDoc.exists) {
      await benchCol.doc(benchId).update({
        playerIds: benchPlayerIds,
        updatedAt: now,
      })
    } else {
      await benchCol.doc(benchId).set({
        matchId,
        playerIds: benchPlayerIds,
        updatedAt: now,
      })
    }

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
