import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { verifySuperAdmin } from '@/lib/api/auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

const TEST_USERS = [
  { email: 'alex.rivera@test.soccer', password: 'testpass123', displayName: 'Alex Rivera' },
  { email: 'jordan.lee@test.soccer', password: 'testpass123', displayName: 'Jordan Lee' },
  { email: 'sam.chen@test.soccer', password: 'testpass123', displayName: 'Sam Chen' },
  { email: 'riley.morgan@test.soccer', password: 'testpass123', displayName: 'Riley Morgan' },
  { email: 'casey.kim@test.soccer', password: 'testpass123', displayName: 'Casey Kim' },
  { email: 'quinn.taylor@test.soccer', password: 'testpass123', displayName: 'Quinn Taylor' },
  { email: 'morgan.james@test.soccer', password: 'testpass123', displayName: 'Morgan James' },
  { email: 'drew.patel@test.soccer', password: 'testpass123', displayName: 'Drew Patel' },
  { email: 'jesse.wright@test.soccer', password: 'testpass123', displayName: 'Jesse Wright' },
  { email: 'skyler.brooks@test.soccer', password: 'testpass123', displayName: 'Skyler Brooks' },
]

/**
 * POST /api/seed-test-users
 * Creates the 10 test users in Firebase Auth and Firestore.
 * Requires: super admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function POST(request: Request) {
  // Allow super admin OR optional secret for scripted/local use
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

  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not configured' },
      { status: 500 }
    )
  }

  const results: { email: string; status: 'created' | 'exists' | 'error'; message?: string }[] = []

  for (const user of TEST_USERS) {
    try {
      const record = await adminAuth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
      })

      const now = Timestamp.now()
      await adminDb.collection('users').doc(record.uid).set({
        uid: record.uid,
        email: user.email,
        displayName: user.displayName,
        jerseyNumber: null,
        position: null,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      })

      results.push({ email: user.email, status: 'created' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code
      if (code === 'auth/email-already-exists' || String(message).includes('already exists')) {
        results.push({ email: user.email, status: 'exists' })
      } else {
        results.push({ email: user.email, status: 'error', message })
      }
    }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      created: results.filter((r) => r.status === 'created').length,
      exists: results.filter((r) => r.status === 'exists').length,
      error: results.filter((r) => r.status === 'error').length,
    },
  })
}
