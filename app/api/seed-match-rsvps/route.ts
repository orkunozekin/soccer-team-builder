import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { verifySuperAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'

const TEST_USER_EMAILS = [
  'alex.rivera@test.soccer',
  'jordan.lee@test.soccer',
  'sam.chen@test.soccer',
  'riley.morgan@test.soccer',
  'casey.kim@test.soccer',
  'quinn.taylor@test.soccer',
  'morgan.james@test.soccer',
  'drew.patel@test.soccer',
  'jesse.wright@test.soccer',
  'skyler.brooks@test.soccer',
]

/**
 * POST /api/seed-match-rsvps
 * Body: { matchId: string }
 * Creates RSVPs for all test users (@test.soccer) for the given match.
 * Requires: super admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function POST(request: Request) {
  const seedSecret = request.headers.get('x-seed-secret')
  const useSecret = process.env.SEED_SECRET && seedSecret === process.env.SEED_SECRET

  if (!useSecret) {
    const { isSuperAdmin, error } = await verifySuperAdmin(request)
    if (error || !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin required or valid X-Seed-Secret' },
        { status: 403 }
      )
    }
  }

  let body: { matchId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const matchId = body.matchId
  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
  }

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

  // Get UIDs of test users (by email)
  const usersSnap = await adminDb.collection('users').get()
  const testUserIds = usersSnap.docs
    .filter((d) => TEST_USER_EMAILS.includes((d.data().email as string) ?? ''))
    .map((d) => d.id)

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

  return NextResponse.json({
    success: true,
    matchId,
    results,
    summary: {
      created: results.filter((r) => r.status === 'created').length,
      exists: results.filter((r) => r.status === 'exists').length,
    },
  })
}
