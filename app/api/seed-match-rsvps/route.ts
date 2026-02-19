import { Timestamp } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { computeTeamCountForRSVPCount, generateTeams } from '@/lib/utils/teamGenerator'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

const TEAM_COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6']
const TEAM_NAMES = ['Orange', 'Blue', 'Green', 'Red', 'Purple']

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

/**
 * POST /api/seed-match-rsvps
 * Body: { matchId: string }
 * Creates RSVPs for all test users (@test.soccer) for the given match.
 * Requires: admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function POST(request: Request) {
  const seedSecret = request.headers.get('x-seed-secret')
  const useSecret = process.env.SEED_SECRET && seedSecret === process.env.SEED_SECRET

  if (!useSecret) {
    const { isAdmin, error } = await verifyAdmin(request)
    if (error || !isAdmin) {
      return NextResponse.json(
        { error: 'Admin required or valid X-Seed-Secret' },
        { status: 403 }
      )
    }
  }

  let body: { matchId?: string; regenerateTeams?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const matchId = body.matchId
  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
  }
  const regenerateTeamsAfter = body.regenerateTeams !== false

  const adminDb = getAdminDb()
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not configured' },
      { status: 500 }
    )
  }

  // Verify match exists
  const matchRef = adminDb.collection('matches').doc(matchId)
  if (!(await matchRef.get()).exists) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  // Get UIDs of seeded test users
  const usersSnap = await adminDb
    .collection('users')
    .where('isTestUser', '==', true)
    .get()
  const testUserIds = usersSnap.docs.map((d) => d.id)

  if (testUserIds.length === 0) {
    return NextResponse.json(
      { error: 'No test users found. Run POST /api/seed-test-users first.' },
      { status: 400 }
    )
  }

  const now = Timestamp.now()
  const results: { userId: string; status: 'created' | 'exists' }[] = []

  for (const userId of testUserIds) {
    const existing = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('userId', '==', userId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get()

    if (!existing.empty) {
      results.push({ userId, status: 'exists' })
      continue
    }

    const rsvpId = `rsvp_${matchId}_${userId}_${now.toMillis()}_${results.length}`
    await adminDb.collection('rsvps').doc(rsvpId).set({
      matchId,
      userId,
      status: 'confirmed',
      rsvpAt: now,
      createdAt: now,
      updatedAt: now,
    })
    results.push({ userId, status: 'created' })
  }

  // Optional: regenerate teams so the match reflects the new RSVP count immediately
  if (regenerateTeamsAfter) {
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

    const usersSnapAll = await adminDb.collection('users').get()
    const users: User[] = usersSnapAll.docs.map((d) => {
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
    const benchCol = adminDb.collection(`matches/${matchId}/bench`)

    // Delete existing teams
    const existingTeams = await teamsCol.get()
    const deleteBatch = adminDb.batch()
    existingTeams.docs.forEach((d) => deleteBatch.delete(d.ref))
    await deleteBatch.commit()

    const allPlayerIds = new Set<string>()
    const writes: Promise<unknown>[] = []

    for (let i = 0; i < teamAssignments.length; i++) {
      const assignment = teamAssignments[i]
      const teamId = `team_${matchId}_${assignment.teamNumber}_${Date.now()}`
      writes.push(
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
      )
      assignment.playerIds.forEach((id) => allPlayerIds.add(id))
    }

    const benchPlayerIds = rsvpsToUse
      .map((r) => r.userId)
      .filter((id) => !allPlayerIds.has(id))

    const benchId = `bench_${matchId}`
    writes.push(
      benchCol.doc(benchId).set(
        {
          matchId,
          playerIds: benchPlayerIds,
          updatedAt: now,
        },
        { merge: true }
      )
    )

    await Promise.all(writes)
  }

  return NextResponse.json({
    success: true,
    matchId,
    results,
    regenerateTeams: regenerateTeamsAfter,
    summary: {
      created: results.filter((r) => r.status === 'created').length,
      exists: results.filter((r) => r.status === 'exists').length,
    },
  })
}
