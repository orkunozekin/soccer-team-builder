import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { computeTeamCountForRSVPCount, generateTeams } from '@/lib/utils/teamGenerator'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

const TEAM_COLORS = ['#f97316', '#3b82f6', '#eab308', '#65a30d', '#ef4444', '#8b5cf6']
const TEAM_NAMES = ['Orange', 'Blue', 'Yellow', 'Lime', 'Red', 'Purple']

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
        position: data.position ?? null,
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

    const teamCount = computeTeamCountForRSVPCount(rsvpsToUse.length, 11, 2)
    const teamAssignments = generateTeams(rsvpsToUse, users, 11, { teamCount })

    const teamsCol = adminDb.collection(`matches/${matchId}/teams`)

    const existingTeams = await teamsCol.get()
    const batch = adminDb.batch()
    existingTeams.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()

    const now = Timestamp.now()
    const writes: Promise<unknown>[] = []
    for (let i = 0; i < teamAssignments.length; i++) {
      const assignment = teamAssignments[i]
      const teamId = `team_${matchId}_${assignment.teamNumber}_${Date.now()}`
      writes.push(teamsCol.doc(teamId).set({
        matchId,
        teamNumber: assignment.teamNumber,
        name: TEAM_NAMES[i % TEAM_NAMES.length] ?? `Team ${assignment.teamNumber}`,
        color: TEAM_COLORS[i % TEAM_COLORS.length] ?? '#3b82f6',
        playerIds: assignment.playerIds,
        maxSize: 11,
        createdAt: now,
        updatedAt: now,
      }))
    }

    await Promise.all(writes)

    return NextResponse.json({
      success: true,
      teamsGenerated: teamAssignments.length,
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
