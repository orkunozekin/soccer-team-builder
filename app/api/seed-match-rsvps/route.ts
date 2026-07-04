import { Timestamp } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { expandTeamsForMatch } from '@/lib/teams/expandTeamsForMatch'
import { TEST_USERS } from '@/lib/testData/testUsers'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET: health check for this route (no auth). */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'seed-match-rsvps' })
}

/**
 * POST /api/seed-match-rsvps
 * Body: { matchId: string }
 * Creates RSVPs for all test users (@test.soccer) for the given match.
 * Requires: admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function POST(request: Request) {
  try {
    const seedSecret = request.headers.get('x-seed-secret')
    const useSecret =
      process.env.SEED_SECRET && seedSecret === process.env.SEED_SECRET

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
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      )
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
    const testUserIds = usersSnap.docs.map(d => d.id)

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

      const userRef = adminDb.collection('users').doc(userId)
      const userDoc = await userRef.get()
      const userData = userDoc.exists ? userDoc.data() : undefined
      const email = (userData?.email as string) ?? ''
      const positionFromDoc = (userData?.position as string | null) ?? null
      const positionFromSeed =
        TEST_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
          ?.position ?? null
      const userPosition = positionFromSeed ?? positionFromDoc

      if (positionFromSeed != null && positionFromSeed !== positionFromDoc) {
        await userRef.set(
          { position: positionFromSeed, updatedAt: now },
          { merge: true }
        )
      }

      const rsvpId = `rsvp_${matchId}_${userId}_${now.toMillis()}_${results.length}`
      await adminDb.collection('rsvps').doc(rsvpId).set({
        matchId,
        userId,
        status: 'confirmed',
        position: userPosition,
        jerseyNumber: normalizeJerseyNumber(userData?.jerseyNumber),
        rsvpAt: now,
        createdAt: now,
        updatedAt: now,
      })
      results.push({ userId, status: 'created' })
    }

    // Optional: regenerate teams so the match reflects the new RSVP count immediately
    if (regenerateTeamsAfter) {
      await expandTeamsForMatch(adminDb, matchId, { forceRegenerate: true })
    }

    return NextResponse.json({
      success: true,
      matchId,
      results,
      regenerateTeams: regenerateTeamsAfter,
      summary: {
        created: results.filter(r => r.status === 'created').length,
        exists: results.filter(r => r.status === 'exists').length,
      },
    })
  } catch (err) {
    console.error('seed-match-rsvps error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to seed match RSVPs') },
      { status: 500 }
    )
  }
}
