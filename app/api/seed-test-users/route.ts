import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { TEST_USERS } from '@/lib/testData/testUsers'

/**
 * POST /api/seed-test-users
 * Creates the test users in Firebase Auth and Firestore.
 * Requires: admin Bearer token, or header X-Seed-Secret matching SEED_SECRET env (optional).
 */
export async function POST(request: Request) {
  // Allow admin OR optional secret for scripted/local use
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

  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not configured' },
      { status: 500 }
    )
  }

  const results: {
    email: string
    status: 'created' | 'updated' | 'error'
    message?: string
  }[] = []

  for (const user of TEST_USERS) {
    try {
      let created = true
      let record = await adminAuth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
      }).catch(async (err: unknown) => {
        const code = (err as { code?: string })?.code
        const message = err instanceof Error ? err.message : String(err)
        if (
          code === 'auth/email-already-exists' ||
          String(message).includes('already exists')
        ) {
          created = false
          return await adminAuth.getUserByEmail(user.email)
        }
        throw err
      })

      // Ensure Auth displayName matches seed data
      if (record.displayName !== user.displayName) {
        record = await adminAuth.updateUser(record.uid, { displayName: user.displayName })
      }

      const now = Timestamp.now()
      const userRef = adminDb.collection('users').doc(record.uid)
      const existing = await userRef.get()
      await userRef.set(
        {
          uid: record.uid,
          email: user.email,
          displayName: user.displayName,
          jerseyNumber: user.jerseyNumber,
          position: user.position,
          role: 'user',
          isTestUser: true,
          createdAt: existing.exists ? existing.data()?.createdAt ?? now : now,
          updatedAt: now,
        },
        { merge: true }
      )

      results.push({
        email: user.email,
        status: created ? 'created' : 'updated',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ email: user.email, status: 'error', message })
    }
  }

  return NextResponse.json({
    success: true,
    results,
    summary: {
      created: results.filter((r) => r.status === 'created').length,
      updated: results.filter((r) => r.status === 'updated').length,
      error: results.filter((r) => r.status === 'error').length,
    },
  })
}
